const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const { default: fastify } = require('fastify');

async function apiRoutes(fastify) {
  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Get categories
  fastify.get('/categories', async () => {
    const categories = await fastify.db('categories').select('*').orderBy('name');
    return { categories };
  });

  // Get products with filtering and pagination
  // Get products with filtering and pagination (optimisé)
fastify.get('/products', {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 50 },
        q: { type: 'string' },
        category: { type: 'string' },
        subcategory: { type: 'string' },
        minPrice: { type: 'number', minimum: 0 },
        maxPrice: { type: 'number', minimum: 0 }
      }
    }
  }
}, async (request) => {
  const {
    page = 1,
    pageSize = 12,
    q,
    category,
    subcategory,
    minPrice,
    maxPrice
  } = request.query;

  // ----------- Requête principale pour récupérer les produits
  let query = fastify.db('products')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .select(
      'products.*',
      'categories.name as category_name',
      'categories.slug as category_slug'
    );

  // Filtres (produits)
  if (q) {
    query = query.whereRaw(
      "products.title ILIKE ? OR products.description ILIKE ?",
      [`%${q}%`, `%${q}%`]
    );
  }
  if (category) {
    query = query.where('categories.slug', category);
  }
  if (subcategory) {
    query = query.where('products.subcategory', subcategory);
  }
  if (minPrice) {
    query = query.where('products.price_fcfa', '>=', minPrice);
  }
  if (maxPrice) {
    query = query.where('products.price_fcfa', '<=', maxPrice);
  }

  // ----------- Requête séparée pour compter (sans les JOIN inutiles)
  let countQuery = fastify.db('products');

  if (q) {
    countQuery = countQuery.whereRaw(
      "title ILIKE ? OR description ILIKE ?",
      [`%${q}%`, `%${q}%`]
    );
  }
  if (category) {
    countQuery = countQuery
      .whereIn('category_id', function () {
        this.select('id').from('categories').where('slug', category);
      });
  }
  if (subcategory) {
    countQuery = countQuery.where('subcategory', subcategory);
  }
  if (minPrice) {
    countQuery = countQuery.where('price_fcfa', '>=', minPrice);
  }
  if (maxPrice) {
    countQuery = countQuery.where('price_fcfa', '<=', maxPrice);
  }

  const totalResult = await countQuery.count('* as count').first();
  const total = parseInt(totalResult.count);

  // ----------- Récupération avec pagination
  const products = await query
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .orderBy('products.created_at', 'desc');

  return {
    products,
    pagination: {
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize)
    }
  };
});


  // Get single product by slug
  fastify.get('/products/:slug', async (request, reply) => {
    const product = await fastify.db('products')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .leftJoin('product_variants', 'products.id', 'product_variants.product_id')
      .select(
        'products.*',
        'categories.name as category_name',
        'categories.slug as category_slug'
      )
      .where('products.slug', request.params.slug)
      .first();

    if (!product) {
      return reply.code(404).send({ error: 'Product not found' });
    }

    const variants = await fastify.db('product_variants')
      .where('product_id', product.id);

    return { ...product, variants };
  });

// REGISTER : create user and emit verification code (motif = 'verification')
fastify.post('/auth/register', {
  schema: {
    body: {
      type: 'object',
      required: ['name','email','password'],
      properties: {
        name: { type: 'string', minLength: 2 },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string' },
        password: { type: 'string', minLength: 6 }
      }
    }
  }
}, async (request, reply) => {
  const { name, email, phone, password } = request.body;
  const existing = await fastify.db('users').where('email', email).first();
  if (existing) return reply.code(400).send({ error: 'Email already exists' });

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = uuidv4();

  // create user row (is_verified default false)
  await fastify.db('users').insert({
    id: userId,
    email,
    name,
    phone,
    password_hash: passwordHash,
    is_verified: false,
    created_at: new Date()
  });

  // create 6-digit code and insert into codes table
  const numCode = Math.floor(100000 + Math.random() * 900000);
  await fastify.db('codes').insert({
    num_code: numCode,
    motif: 'verification',
    mail: email,
    timestamp: Date.now(),
    consumed: false
  });

  // send email (assumes fastify.sendEmail exists)
  try {
    await fastify.sendEmail('verify_register', email, 'Code de vérification Angele Shop', {
      name, code: numCode
    });
  } catch (err) {
    request.log.error('Mail send error (register):', err);
    // NOTE: you may decide to rollback user and code on email failure
  }

  return { success: true, message: 'Verification code sent' };
});
// VERIFY registration code
fastify.post('/auth/register/verify', {
  schema: {
    body: {
      type: 'object',
      required: ['email','code'],
      properties: {
        email: { type: 'string', format: 'email' },
        code: { type: 'string' }
      }
    }
  }
}, async (request, reply) => {
  const { email, code } = request.body;
  const codeInt = parseInt(code, 10);
  if (isNaN(codeInt)) return reply.code(400).send({ error: 'Code invalide' });

  // Find most recent non-consumed verification code for this email
  const row = await fastify.db('codes')
    .where({ mail: email, motif: 'verification', consumed: false })
    .orderBy('id', 'desc')
    .first();

  if (!row) return reply.code(400).send({ error: 'Code introuvable' });

  const now = Date.now();
  const age = now - parseInt(row.timestamp, 10);
  const fifteenMin = 15 * 60 * 1000;

  if (row.num_code !== codeInt) return reply.code(400).send({ error: 'Code invalide' });
  if (age > fifteenMin) return reply.code(400).send({ error: 'Code expiré' });

  // mark code consumed
  await fastify.db('codes').where({ id: row.id }).update({ consumed: true });

  // set user as verified
  await fastify.db('users').where('email', email).update({ is_verified: true, updated_at: new Date() });

  // OPTIONAL: auto-login? By default we DO NOT auto-login. If you want auto-login, uncomment next lines:
  // const user = await fastify.db('users').where('email', email).first();
  // request.session.userId = user.id;

  return { success: true, message: 'Compte vérifié' };
});
// REQUEST password reset (send 6-digit code, motif = 'reset')
fastify.post('/auth/reset/request', {
  schema: {
    body: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }
  }
}, async (request, reply) => {
  const { email } = request.body;
  const user = await fastify.db('users').where('email', email).first();
  // Always return success to avoid user enumeration
  if (!user) return reply.code(200).send({ success: true });

  const numCode = Math.floor(100000 + Math.random() * 900000);
  await fastify.db('codes').insert({
    num_code: numCode,
    motif: 'reset',
    mail: email,
    timestamp: Date.now(),
    consumed: false
  });

  try {
    await fastify.sendEmail('reset_request', email, 'Code de réinitialisation Angele Shop', {
      name: user.name, code: numCode
    });
  } catch (err) {
    request.log.error('Mail send error (reset request):', err);
    // still return success to caller
  }

  return { success: true, message: 'Si le mail existe, un code a été envoyé.' };
});
// VERIFY reset code and set new password
fastify.post('/auth/reset/verify', {
  schema: {
    body: {
      type: 'object',
      required: ['email','code','password'],
      properties: {
        email: { type: 'string', format: 'email' },
        code: { type: 'string' },
        password: { type: 'string', minLength: 6 }
      }
    }
  }
}, async (request, reply) => {
  const { email, code, password } = request.body;
  const codeInt = parseInt(code, 10);
  if (isNaN(codeInt)) return reply.code(400).send({ error: 'Code invalide' });

  const row = await fastify.db('codes')
    .where({ mail: email, motif: 'reset', consumed: false })
    .orderBy('id', 'desc')
    .first();

  if (!row) return reply.code(400).send({ error: 'Code introuvable' });

  const now = Date.now();
  const age = now - parseInt(row.timestamp, 10);
  const fifteenMin = 15 * 60 * 1000;

  if (row.num_code !== codeInt) return reply.code(400).send({ error: 'Code invalide' });
  if (age > fifteenMin) return reply.code(400).send({ error: 'Code expiré' });

  // update password
  const passwordHash = await bcrypt.hash(password, 12);
  await fastify.db('users').where('email', email).update({
    password_hash: passwordHash,
    updated_at: new Date()
  });

  // mark code consumed
  await fastify.db('codes').where({ id: row.id }).update({ consumed: true });

  return { success: true, message: 'Mot de passe modifié' };
});

  // Cart management
  fastify.post('/cart', {
    schema: {
      body: {
        type: 'object',
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['add', 'remove', 'update', 'clear'] },
          productId: { type: 'string' },
          variantId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 }
        }
      }
    }
  }, async (request, reply) => {
    const { action, productId, variantId, quantity = 1 } = request.body;
    const cart = request.session.cart || [];

    switch (action) {
      case 'add':
        const existingIndex = cart.findIndex(item => 
          item.productId === productId && item.variantId === variantId
        );

        if (existingIndex >= 0) {
          cart[existingIndex].quantity += quantity;
        } else {
          cart.push({ productId, variantId, quantity, addedAt: new Date() });
        }
        break;

      case 'remove':
        const removeIndex = cart.findIndex(item => 
          item.productId === productId && item.variantId === variantId
        );
        if (removeIndex >= 0) {
          cart.splice(removeIndex, 1);
        }
        break;

      case 'update':
        const updateIndex = cart.findIndex(item => 
          item.productId === productId && item.variantId === variantId
        );
        if (updateIndex >= 0) {
          cart[updateIndex].quantity = quantity;
        }
        break;

      case 'clear':
        cart.length = 0;
        break;
    }

    request.session.cart = cart;
    return { success: true, cart };
  });

  fastify.get('/cart', async (request) => {
    const cart = request.session.cart || [];
    
    if (cart.length === 0) {
      return { cart: [], total: 0 };
    }

    // Get product details for cart items
    const productIds = cart.map(item => item.productId);
    const products = await fastify.db('products')
      .whereIn('id', productIds)
      .select('id', 'title', 'price_fcfa', 'images', 'slug');

    const cartWithDetails = cart.map(item => {
      const product = products.find(p => p.id === item.productId);
      return { ...item, product };
    }).filter(item => item.product);

    const total = cartWithDetails.reduce((sum, item) => 
      sum + (item.product.price_fcfa * item.quantity), 0);

    return { cart: cartWithDetails, total };
  });

  // Checkout
  fastify.post('/checkout', {
    schema: {
      body: {
        type: 'object',
        required: ['customer'],
        properties: {
          customer: {
            type: 'object',
            required: ['name', 'phone'],
            properties: {
              name: { type: 'string', minLength: 2 },
              phone: { type: 'string', minLength: 8 },
              address: { type: 'string' }
            }
          },
          createAccount: { type: 'boolean' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    const { customer, createAccount, email, password } = request.body;
    const cart = request.session.cart || [];

    if (cart.length === 0) {
      return reply.code(400).send({ error: 'Cart is empty' });
    }

    // Calculate total
    const productIds = cart.map(item => item.productId);
    const products = await fastify.db('products').whereIn('id', productIds);
    
    const total = cart.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      return sum + (product ? product.price_fcfa * item.quantity : 0);
    }, 0);

    let userId = null;

    // Create account if requested
    if (createAccount && email && password) {
      const existingUser = await fastify.db('users').where('email', email).first();
      if (existingUser) {
        return reply.code(400).send({ error: 'Email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const [user] = await fastify.db('users')
        .insert({
          id: uuidv4(),
          email,
          name: customer.name,
          phone: customer.phone,
          password_hash: passwordHash,
          created_at: new Date()
        })
        .returning('*');
      
      userId = user.id;
      request.session.userId = userId;
    }

    // Create order
    const orderId = uuidv4();
    await fastify.db('orders').insert({
      id: orderId,
      user_id: userId,
      guest_name: customer.name,
      guest_phone: customer.phone,
      guest_address: customer.address,
      status: 'pending',
      total_fcfa: total,
      payment_meta: { payment_method: 'pending' },
      created_at: new Date(),
      updated_at: new Date()
    });

    // Create order items
    const orderItems = cart.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        order_id: orderId,
        product_id: item.productId,
        variant_id: item.variantId || null,
        quantity: item.quantity,
        unit_price_fcfa: product ? product.price_fcfa : 0
      };
    });

    await fastify.db('order_items').insert(orderItems);

    // Set guest cookie for order tracking
    if (!userId) {
      const guestOrders = request.cookies[`ANGELE_GUEST`] ? 
        JSON.parse(request.cookies[`ANGELE_GUEST`]) : [];
      
      guestOrders.push({
        orderId,
        total,
        createdAt: new Date(),
        customerName: customer.name
      });

      reply.setCookie(`ANGELE_GUEST`, JSON.stringify(guestOrders), {
        maxAge: 12 * 60 * 60 * 1000, // 12 hours
        httpOnly: false,
        path: '/'
      });
    }

    // Clear cart
    request.session.cart = [];

    // Send order confirmation email if applicable
    if (true) {
      await fastify.sendEmail('order_received', "roronoadonald3@gmail.com", 'Commande reçue', {
        orderId,
        customerName: customer.name,
        amount: `${total.toLocaleString()} FCFA`
      });
      
    }
    console.log(orderId,customer.name,total)
await fastify.sendEmail('order_received','angeleshop228@gmail.com',"nouvelle commande",{
        orderId,customerName:customer.name,
        anmount:`${total.toLocaleString()} FCFA `
      })
    return {
      orderId,
      total,
      payment_instructions: 'Le paiement sera configuré prochainement. Votre commande est en attente.',
      payment_placeholder_url: `/compte#order-${orderId}`
    };
  });

  // User authentication
  fastify.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body;

    const user = await fastify.db('users').where('email', email).first();
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    request.session.userId = user.id;
    return { user: { id: user.id, email: user.email, name: user.name } };
  });

  fastify.post('/auth/logout', async (request) => {
    request.session.destroy();
    return { success: true };
  });

  // User account
  fastify.get('/account', async (request, reply) => {
    if (!request.session.userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    const user = await fastify.db('users')
      .where('id', request.session.userId)
      .select('id', 'email', 'name', 'phone', 'created_at')
      .first();

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const orders = await fastify.db('orders')
      .where('user_id', user.id)
      .orderBy('created_at', 'desc');

    return { user, orders };
  });
fastify.post("/api/send/mess",async (req, res)=>{
  const { name, email, phone, subject, message } = req.body;
   
  await fastify.sendEmail("contact","angeleshop228@gmail.com","contact client",{name,email,phone,subject,message})
  res.send("done done")
})
  // Get order details
  fastify.get('/orders/:orderId', async (request, reply) => {
    const { orderId } = request.params;

    const order = await fastify.db('orders').where('id', orderId).first();
    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    // Check ownership
    if (order.user_id && request.session.userId !== order.user_id) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // For guest orders, check cookie
    if (!order.user_id && !request.session.userId) {
      const guestOrders = request.cookies[`ANGELE_GUEST`] ? 
        JSON.parse(request.cookies[`ANGELE_GUEST`]) : [];
      
      const hasAccess = guestOrders.some(guestOrder => guestOrder.orderId === orderId);
      if (!hasAccess) {
        return reply.code(403).send({ error: 'Access denied' });
      }
    }

    const items = await fastify.db('order_items')
      .leftJoin('products', 'order_items.product_id', 'products.id')
      .leftJoin('product_variants', 'order_items.variant_id', 'product_variants.id')
      .where('order_items.order_id', orderId)
      .select(
        'order_items.*',
        'products.title as product_title',
        'products.images as product_images',
        'product_variants.size',
        'product_variants.color'
      );

    return { ...order, items };
  });
}



module.exports = apiRoutes;
