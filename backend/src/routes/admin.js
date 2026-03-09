const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const cloudinary = require('cloudinary').v2;

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper pour uploader un buffer vers Cloudinary
function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    uploadStream.end(buffer);
  });
}

async function adminRoutes(fastify, opts) {
  // Admin authentication middleware
// ---- début du snippet à coller dans verifyAdminToken ----
async function verifyAdminToken(request, reply) {
  try {
    // 1) Priorité : header Authorization
    let authHeader = (request.headers && request.headers.authorization) || null;

    // 2) Si pas d'Authorization, essayer un header alterné (ex: X-Admin-Token)
    if (!authHeader && request.headers && request.headers['x-admin-token']) {
      authHeader = `Bearer ${request.headers['x-admin-token']}`;
    }

    // 3) Fallback pour multipart/form-data : lire le champ 'admin_token' si présent
    // Attention : fastify-multipart ne met pas request.body automatiquement.
    if (!authHeader && request.isMultipart && request.multipart) {
      // on parcourt rapidement les parties pour trouver un champ "admin_token"
      let found = false;
      await new Promise((resolve, reject) => {
        request.multipart((field, file, filename, encoding, mimetype) => {
          if (field === 'admin_token') {
            // dans certains cas field est la chaîne — gérer les deux cas
            // si file est un stream, il faut collecter la valeur ; cependant pour un field non-file,
            // fastify passera file === value (string). Ici on tente les deux.
            if (typeof file === 'string') {
              authHeader = `Bearer ${file}`;
              found = true;
            } else {
              // si c'est un stream (rare pour simple champ), collecter
              let chunks = [];
              file.on('data', (c) => chunks.push(c));
              file.on('end', () => {
                authHeader = `Bearer ${Buffer.concat(chunks).toString()}`;
                found = true;
              });
            }
          }
          // ne pas stocker les fichiers ici, callback appelé pour chacune des parties
        }, (err) => {
          if (err) return reject(err);
          resolve();
        });
      }).catch(err => {
        // ignore parse error for multipart fallback
        request.log.warn('[ADMIN AUTH] multipart parse warning:', err && err.message);
      });
      if (found) request.log.debug('Token récupéré depuis champ multipart admin_token');
    }

    // 4) Enfin, si toujours pas de token -> refuser
    if (!authHeader) {
      reply.code(401).send({ error: 'Admin token required' });
      return;
    }

    // 5) Normaliser : on attend "Bearer <token>"
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = tokenMatch ? tokenMatch[1] : authHeader;

        // === Vérification complète du token et attachement de request.admin ===
    const secret = process.env.APP_SECRET;
    if (!secret) {
      console.error('[ADMIN AUTH] APP_SECRET manquant dans les variables d\'environnement');
      reply.code(500).send({ error: 'Server misconfigured (APP_SECRET missing)' });
      return;
    }

    try {
      const decoded = jwt.verify(token, secret);

      // Vérifications minimales
      if (!decoded || decoded.type !== 'admin' || decoded.email !== process.env.ADMIN_EMAIL) {
        request.log.warn('Token invalide ou claims inattendus');
        reply.code(401).send({ error: 'Invalid admin token' });
        return;
      }

      // Attacher les infos admin à la requête pour les handlers suivants
      request.admin = {
        email: decoded.email,
        type: decoded.type,
        iat: decoded.iat,
        exp: decoded.exp
      };

      // Laisser Fastify continuer vers le handler suivant
      return;
    } catch (err) {
      request.log.warn('Échec de vérification du token:', err && err.message);
      reply.code(401).send({ error: 'Invalid admin token' });
      return;
    }

  } catch (err) {
    request.log.error('Admin auth middleware error', err);
    reply.code(500).send({ error: 'Internal server error' });
  }
}
// ---- fin du snippet ----

  // Request OTP
  fastify.post('/request-otp', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      }
    }
  }, async (request, reply) => {
    const { email } = request.body;

    if (email !== process.env.ADMIN_EMAIL) {
      return reply.code(403).send({ error: 'Unauthorized email' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);

    // Clean expired OTPs and store new one
    await fastify.db('otps').where('expires_at', '<', new Date()).del();
    
    await fastify.db('otps').insert({
      email,
      code_hash: codeHash,
      attempts: 0,
      expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      created_at: new Date()
    });

    // Send email
    const sent = await fastify.sendEmail('admin_login_code', email, 'Code de connexion admin', { code });
    
    if (!sent) {
      return reply.code(500).send({ error: 'Failed to send email' });
    }

    return { success: true, message: 'OTP sent to admin email' };
  });

  // Verify OTP
  fastify.post('/verify-otp', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'code'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string', minLength: 6, maxLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    const { email, code } = request.body;

    if (email !== process.env.ADMIN_EMAIL) {
      return reply.code(403).send({ error: 'Unauthorized email' });
    }

    const otp = await fastify.db('otps')
      .where('email', email)
      .where('expires_at', '>', new Date())
      .orderBy('created_at', 'desc')
      .first();
    if (!otp) {
      return reply.code(400).send({ error: 'Invalid or expired OTP' });
    }

    if (otp.attempts >= 3) {
      await fastify.db('otps').where('id', otp.id).del();
      return reply.code(429).send({ error: 'Too many attempts' });
    }

    const isValid = await bcrypt.compare(code, otp.code_hash);
    if (!isValid) {
      await fastify.db('otps').where('id', otp.id).increment('attempts', 1);
      return reply.code(400).send({ error: 'Invalid OTP' });
    }

    // Generate admin token (24 hours)
    const adminToken = jwt.sign({
      type: 'admin',
      email,
      exp: Math.floor(Date.now() / 1000) + (60 * 1440) // 24h
    }, process.env.APP_SECRET);

    // Clean up used OTP
    await fastify.db('otps').where('id', otp.id).del();

    // Log admin login with detailed info
    const ip = request.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               request.headers['x-real-ip'] || 
               request.ip || 
               'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';
    
    await fastify.db('logs').insert({
      level: 'info',
      message: 'Admin login successful',
      meta: JSON.stringify({
        email,
        ip,
        userAgent,
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url
      }),
      created_at: new Date()
    });

    return { admin_token: adminToken };
  });

  // Protected admin routes
  fastify.register(async function(adminRoutes) {
  adminRoutes.addHook('preValidation', verifyAdminToken);

    // Verify admin token validity
    adminRoutes.get('/verify', async () => {
      return { valid: true };
    });

    // Helper function for detailed logging
    async function logAction(request, level, action, details = {}) {
      const ip = request.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                 request.headers['x-real-ip'] || 
                 request.ip || 
                 'unknown';
      const userAgent = request.headers['user-agent'] || 'unknown';
      
      await fastify.db('logs').insert({
        level,
        message: action,
        meta: JSON.stringify({
          ...details,
          ip,
          userAgent,
          admin: request.admin?.email || 'system',
          timestamp: new Date().toISOString(),
          method: request.method,
          url: request.url
        }),
        created_at: new Date()
      });
    }

    // List orders with filters
    adminRoutes.get('/orders', async (request) => {
      const page = parseInt(request.query.page) || 1;
      const pageSize = parseInt(request.query.pageSize) || 20;
      const status = request.query.status;
      const search = request.query.search;

      let query = fastify.db('orders');
      
      // Filter by status
      if (status && status !== 'all') {
        query = query.where('status', status);
      }
      
      // Search by guest name, phone, or order ID
      if (search) {
        query = query.where(function() {
          this.where('guest_name', 'ilike', `%${search}%`)
              .orWhere('guest_phone', 'ilike', `%${search}%`)
              .orWhere('id', 'ilike', `%${search}%`);
        });
      }

      const totalQuery = query.clone();
      const total = await totalQuery.count('* as count').first();
      
      const orders = await query
        .orderBy('created_at', 'desc')
        .offset((page - 1) * pageSize)
        .limit(pageSize);

      // Get order items for each order
      const ordersWithItems = await Promise.all(orders.map(async (order) => {
        const items = await fastify.db('order_items')
          .where('order_id', order.id)
          .leftJoin('products', 'order_items.product_id', 'products.id')
          .select('order_items.*', 'products.title as product_title', 'products.images as product_images');
        return { ...order, items };
      }));

      return {
        orders: ordersWithItems,
        pagination: {
          page,
          pageSize,
          total: parseInt(total.count),
          pages: Math.ceil(total.count / pageSize)
        }
      };
    });

    // Get single order details
    adminRoutes.get('/orders/:id', async (request, reply) => {
      const { id } = request.params;
      
      const order = await fastify.db('orders').where('id', id).first();
      if (!order) {
        return reply.code(404).send({ error: 'Commande non trouvée' });
      }

      const items = await fastify.db('order_items')
        .where('order_id', id)
        .leftJoin('products', 'order_items.product_id', 'products.id')
        .select('order_items.*', 'products.title as product_title', 'products.images as product_images', 'products.slug as product_slug');

      // Get user info if linked
      let user = null;
      if (order.user_id) {
        user = await fastify.db('users').where('id', order.user_id).select('id', 'name', 'email', 'phone').first();
      }

      await logAction(request, 'info', 'Order viewed', { orderId: id });

      return { order, items, user };
    });

    // Update order status
    adminRoutes.put('/orders/:id', async (request, reply) => {
      const { id } = request.params;
      const { status, notes } = request.body;

      const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
      if (status && !validStatuses.includes(status)) {
        return reply.code(400).send({ error: 'Statut invalide' });
      }

      const order = await fastify.db('orders').where('id', id).first();
      if (!order) {
        return reply.code(404).send({ error: 'Commande non trouvée' });
      }

      const oldStatus = order.status;
      const updates = { updated_at: new Date() };
      
      if (status) updates.status = status;
      if (notes !== undefined) {
        const existingMeta = typeof order.payment_meta === 'string' 
          ? JSON.parse(order.payment_meta) 
          : (order.payment_meta || {});
        updates.payment_meta = JSON.stringify({ ...existingMeta, admin_notes: notes });
      }

      await fastify.db('orders').where('id', id).update(updates);

      await logAction(request, 'info', 'Order status updated', {
        orderId: id,
        oldStatus,
        newStatus: status || oldStatus,
        guestName: order.guest_name,
        total: order.total_fcfa
      });

      return { success: true, message: 'Commande mise à jour' };
    });

    // Delete order
    adminRoutes.delete('/orders/:id', async (request, reply) => {
      const { id } = request.params;

      const order = await fastify.db('orders').where('id', id).first();
      if (!order) {
        return reply.code(404).send({ error: 'Commande non trouvée' });
      }

      // Delete order items first
      await fastify.db('order_items').where('order_id', id).del();
      // Delete order
      await fastify.db('orders').where('id', id).del();

      await logAction(request, 'warning', 'Order deleted', {
        orderId: id,
        guestName: order.guest_name,
        guestPhone: order.guest_phone,
        total: order.total_fcfa,
        status: order.status
      });

      return { success: true, message: 'Commande supprimée' };
    });

    // Get order statistics
    adminRoutes.get('/stats', async (request) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const stats = await fastify.db('orders')
        .select(
          fastify.db.raw("COUNT(*) as total_orders"),
          fastify.db.raw("COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders"),
          fastify.db.raw("COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders"),
          fastify.db.raw("COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders"),
          fastify.db.raw("COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders"),
          fastify.db.raw("COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders"),
          fastify.db.raw("SUM(total_fcfa) as total_revenue"),
          fastify.db.raw("SUM(CASE WHEN status = 'delivered' THEN total_fcfa ELSE 0 END) as confirmed_revenue")
        )
        .first();

      const todayOrders = await fastify.db('orders')
        .where('created_at', '>=', today)
        .count('* as count')
        .first();

      const recentOrders = await fastify.db('orders')
        .orderBy('created_at', 'desc')
        .limit(5);

      return {
        stats: {
          ...stats,
          today_orders: parseInt(todayOrders.count)
        },
        recentOrders
      };
    });

    // List products
    adminRoutes.get('/products', async () => {
      const products = await fastify.db('products')
        .leftJoin('categories', 'products.category_id', 'categories.id')
        .select('products.*', 'categories.name as category_name')
        .orderBy('products.created_at', 'desc');

      return { products };
    });

    // Create product
    adminRoutes.post('/products', async (request, reply) => {
      const fields = {};
      const files = [];
      // Parse multipart data (fields + files)
     for await (const part of request.parts()) {
  if (part.file) {
    // Lire tout le contenu du fichier
    const buffer = await part.toBuffer();
    files.push({
      buffer,
      mimetype: part.mimetype,
      filename: part.filename
    });
  } else {
    fields[part.fieldname] = part.value;
  }
}


      const { title, description, category_id, subcategory, price_fcfa, sku, tags, available_count } = fields;
      
      // Validate required fields
      if (!title || !price_fcfa || !category_id) {
        return reply.code(400).send({ error: 'Missing required fields' });
      }

      let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      slug= slug + '-' + Date.now();
      const productId = uuidv4();

        // Handle image uploads vers Cloudinary
  const images = [];
  if (files.length > 0) {
    const category = await fastify.db('categories').where('id', category_id).first();

    for (let i = 0; i < Math.min(files.length, 3); i++) {
      const file = files[i];

      // Reject files over 5MB
      if (file.buffer.length > 5 * 1024 * 1024) {
        continue;
      }

      // Reject empty files
      if (file.buffer.length === 0) {
        continue;
      }

      try {
        // Upload vers Cloudinary
        const result = await uploadToCloudinary(file.buffer, {
          folder: `angele-shop/${category.slug}/${slug}`,
          public_id: `${i + 1}`,
          resource_type: 'image',
          overwrite: true,
          transformation: [{ quality: 'auto', fetch_format: 'auto' }]
        });

        images.push(result.secure_url);
        request.log.info(`Image uploaded to Cloudinary: ${result.secure_url}`);
      } catch (err) {
        request.log.error(`Failed to upload image to Cloudinary: ${err.message}`);
      }
    }
  }



      
      // Create product
      await fastify.db('products').insert({
        id: productId,
        title,
        slug,
        description,
        category_id,
        subcategory: subcategory || null,
        price_fcfa: parseInt(price_fcfa),
        sku: sku || null,
        images: JSON.stringify(images),
        tags: tags ? JSON.stringify(tags.split(',').map(t => t.trim())) : null,
        available_count: parseInt(available_count) || 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Update JSON file for frontend
      await updateProductJSON(fastify, category_id);

      // Log action
      await logAction(request, 'info', 'Product created', {
        productId,
        title,
        price: price_fcfa,
        category: category_id
      });

      return { success: true, productId };
    });

    // Update product (whitelist allowed fields)
    adminRoutes.put('/products/:id', async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const product = await fastify.db('products').where('id', id).first();
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      // Only allow specific fields to be updated
      const allowedFields = ['title', 'description', 'price_fcfa', 'category_id', 'subcategory', 'sku', 'tags', 'available_count', 'images'];
      const updates = {};
      for (const key of allowedFields) {
        if (body[key] !== undefined) {
          updates[key] = body[key];
        }
      }
      updates.updated_at = new Date();

      await fastify.db('products')
        .where('id', id)
        .update(updates);

      // Update JSON file
      await updateProductJSON(fastify, product.category_id);

      // Log action
      await logAction(request, 'info', 'Product updated', {
        productId: id,
        title: product.title,
        updatedFields: Object.keys(updates).filter(k => k !== 'updated_at')
      });

      return { success: true };
    });

    // Delete product
    adminRoutes.delete('/products/:id', async (request, reply) => {
      const { id } = request.params;

      const product = await fastify.db('products').where('id', id).first();
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      await fastify.db('products').where('id', id).del();

      // Update JSON file
      await updateProductJSON(fastify, product.category_id);

      // Log action
      await logAction(request, 'warning', 'Product deleted', {
        productId: id,
        title: product.title,
        category: product.category_id,
        price: product.price_fcfa
      });

      return reply.send({ success: true });
    });

    // Get logs with filters
    adminRoutes.get('/logs', async (request) => {
      const page = parseInt(request.query.page) || 1;
      const pageSize = parseInt(request.query.pageSize) || 50;
      const level = request.query.level;
      const search = request.query.search;
      const dateFrom = request.query.dateFrom;
      const dateTo = request.query.dateTo;

      let query = fastify.db('logs');
      
      // Filter by level
      if (level && level !== 'all') {
        query = query.where('level', level);
      }
      
      // Search in message or meta
      if (search) {
        query = query.where(function() {
          this.where('message', 'ilike', `%${search}%`)
              .orWhereRaw("meta::text ilike ?", [`%${search}%`]);
        });
      }
      
      // Date filters
      if (dateFrom) {
        query = query.where('created_at', '>=', new Date(dateFrom));
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.where('created_at', '<=', endDate);
      }

      const totalQuery = query.clone();
      const total = await totalQuery.count('* as count').first();

      const logs = await query
        .orderBy('created_at', 'desc')
        .offset((page - 1) * pageSize)
        .limit(pageSize);

      // Parse meta JSON for each log
      const parsedLogs = logs.map(log => ({
        ...log,
        meta: typeof log.meta === 'string' ? JSON.parse(log.meta) : log.meta
      }));

      return { 
        logs: parsedLogs,
        pagination: {
          page,
          pageSize,
          total: parseInt(total.count),
          pages: Math.ceil(total.count / pageSize)
        }
      };
    });
  });

  // Helper function to update JSON files
  async function updateProductJSON(fastify, categoryId) {
    try {
      const category = await fastify.db('categories').where('id', categoryId).first();
      if (!category) return;

      const products = await fastify.db('products')
        .where('category_id', categoryId)
        .select('*');

      const jsonPath = path.join(__dirname, '../../..', 'frontend', 'assets', 'data', `${category.slug}.json`);
      await fs.mkdir(path.dirname(jsonPath), { recursive: true });
      await fs.writeFile(jsonPath, JSON.stringify({ products }, null, 2));
    } catch (error) {
      fastify.log.error('Failed to update product JSON:', error);
    }
  }
}

module.exports = adminRoutes;