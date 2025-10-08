const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

async function adminRoutes(fastify, opts) {
  console.log('Dans admin.js, fastify.db =', typeof(fastify.db));
  // Admin authentication middleware
// ---- début du snippet à coller dans verifyAdminToken ----
async function verifyAdminToken(request, reply) {
  try {
    console.log('[ADMIN AUTH] Début middleware');

    // 1) Priorité : header Authorization
    let authHeader = (request.headers && request.headers.authorization) || null;
    console.log('[ADMIN AUTH] En-têtes reçus:', request.headers);

    // 2) Si pas d'Authorization, essayer un header alterné (ex: X-Admin-Token)
    if (!authHeader && request.headers && request.headers['x-admin-token']) {
      authHeader = `Bearer ${request.headers['x-admin-token']}`;
      console.log('[ADMIN AUTH] Token trouvé dans X-Admin-Token header');
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
        // ignore parse error for multipart fallback — on continue
        console.warn('[ADMIN AUTH] multipart parse warning:', err && err.message);
      });
      if (found) console.log('[ADMIN AUTH] Token récupéré depuis champ multipart admin_token');
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
        console.warn('[ADMIN AUTH] Token invalide ou claims inattendus', decoded);
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
      console.warn('[ADMIN AUTH] Échec de vérification du token:', err && err.message);
      reply.code(401).send({ error: 'Invalid admin token' });
      return;
    }

  } catch (err) {
    console.error('[ADMIN AUTH] erreur middleware', err);
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

    console.log('Dans admin.js, fastify.db =', typeof(fastify.db));
    const otp = await fastify.db('otps')
      .where('email', email)
      .where('expires_at', '>', new Date())
      .orderBy('created_at', 'desc')
      .first();
    console.log('Dans admin.js, fastify.db =', typeof(fastify.db));
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

    // Generate admin token (10 minutes)
    const adminToken = jwt.sign({
      type: 'admin',
      email,
      exp: Math.floor(Date.now() / 1000) + (60 * 1440) // 1 jour
    }, process.env.APP_SECRET);

    // Clean up used OTP
    await fastify.db('otps').where('id', otp.id).del();

    // Log admin login
    await fastify.db('logs').insert({
      level: 'info',
      message: 'Admin login successful',
      meta: { email, ip: request.ip },
      created_at: new Date()
    });
    await fastify.db('tokens').insert({token:adminToken})
    return { admin_token: adminToken };
  });

  // Protected admin routes
  fastify.register(async function(adminRoutes) {
  adminRoutes.addHook('preValidation', verifyAdminToken);

    // List orders
    adminRoutes.get('/orders', async (request) => {
      const page = parseInt(request.query.page) || 1;
      const pageSize = parseInt(request.query.pageSize) || 20;

      const total = await fastify.db('orders').count('* as count').first();
      const orders = await fastify.db('orders')
        .orderBy('created_at', 'desc')
        .offset((page - 1) * pageSize)
        .limit(pageSize);

      return {
        orders,
        pagination: {
          page,
          pageSize,
          total: parseInt(total.count),
          pages: Math.ceil(total.count / pageSize)
        }
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
      console.log('[ADMIN PRODUCTS] Handler POST /products appelé. Authorization header:', request.headers.authorization);

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

        // Handle image uploads (robust naming & extension)
  const images = [];
  if (files.length > 0) {
    const category = await fastify.db('categories').where('id', category_id).first();
    const uploadDir = path.join(process.env.UPLOAD_DIR || '/home/donald/project-bolt-sb1-jfjrbe5d/project/frontend/uploads', category.slug, slug);

    await fs.mkdir(uploadDir, { recursive: true });

    // whitelist des extensions autorisées (sans point)
    const allowedExt = new Set(['jpg','jpeg','png','gif','webp','avif','svg']);

    for (let i = 0; i < Math.min(files.length, 3); i++) {
      const file = files[i];

      // 1) tenter d'extraire l'extension depuis le filename original
      let ext = null;
      try {
        const origExt = path.extname(file.filename || '').toLowerCase();
        if (origExt) ext = origExt.replace(/^\./, '');
      } catch (e) {
        ext = null;
      }

      // 2) si pas d'ext trouvée, essayer depuis le mimetype (ex: image/jpeg => jpeg)
      if (!ext && file.mimetype && file.mimetype.includes('/')) {
        const fromMime = file.mimetype.split('/')[1].toLowerCase();
        if (fromMime && allowedExt.has(fromMime)) ext = fromMime;
      }

      // 3) fallback sûr
      if (!ext || !allowedExt.has(ext)) {
        // forcer jpeg si incertain
        ext = 'jpeg';
      }

      // Construire un filename propre : index.ext
      const filename = `${i + 1}.${ext}`;
      const filePath = path.join(uploadDir, filename);
      console.log('[ADMIN PRODUCTS] uploadDir =', uploadDir);
      console.log('[ADMIN PRODUCTS] category =', category, ' -> saving as', filename);

      // Écrire le fichier binaire
      await fs.writeFile(filePath, file.buffer);

      // Optionnel : vérifier la taille > 0 et supprimer si vide
      const stat = await fs.stat(filePath);
      if (stat.size === 0) {
        console.warn('[ADMIN PRODUCTS] file saved with size 0, removing:', filePath);
        await fs.unlink(filePath);
      } else {
        images.push(`/uploads/${category.slug}/${slug}/${filename}`);
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
      await fastify.db('logs').insert({
        level: 'info',
        message: 'Product created',
        meta: { productId, title, admin: request.admin.email },
        created_at: new Date()
      });

      return { success: true, productId };
    });

    // Update product
    adminRoutes.put('/products/:id', async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const product = await fastify.db('products').where('id', id).first();
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      await fastify.db('products')
        .where('id', id)
        .update({
          ...updates,
          updated_at: new Date()
        });

      // Update JSON file
      await updateProductJSON(fastify, product.category_id);

      // Log action
      await fastify.db('logs').insert({
        level: 'info',
        message: 'Product updated',
        meta: { productId: id, admin: request.admin.email },
        created_at: new Date()
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
      await fastify.db('logs').insert({
        level: 'info',
        message: 'Product deleted',
        meta: { productId: id, title: product.title, admin: request.admin.email },
        created_at: new Date()
      });

      return reply.send({ success: true });
    });

    // Get logs
    adminRoutes.get('/logs', async (request) => {
      const page = parseInt(request.query.page) || 1;
      const pageSize = parseInt(request.query.pageSize) || 50;

      const logs = await fastify.db('logs')
        .orderBy('created_at', 'desc')
        .offset((page - 1) * pageSize)
        .limit(pageSize);

      return { logs };
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