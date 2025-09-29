const fastify = require('fastify');
const path = require('path');

async function build() {
  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info'
    }
  });
  // Activer le support des formulaires multipart (uploads)
await server.register(require('fastify-multipart'));


  // --------------------------
  // Plugins
  // --------------------------

  // Security
  await server.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  imgSrc: ["'self'", 'data:', 'blob:'],
  connectSrc: ["'self'"],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  });

  // CORS
  await server.register(require('@fastify/cors'), {
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000'],
    credentials: true
  });

  // Rate limiting
  await server.register(require('@fastify/rate-limit'), {
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000
  });

  // Sessions & Cookies
  console.log('APP_SECRET length:', process.env.APP_SECRET ? process.env.APP_SECRET.length : 'undefined');
  await server.register(require('@fastify/cookie'));
  await server.register(require('@fastify/session'), {
    secret: process.env.APP_SECRET || "que_fais_tu_moi_j_'_ai_la_forme_ma_belle_t_'es_plus_fraiche_que_la_norme",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24h
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  });

  // Multipart for file uploads
  //await server.register(require('@fastify/multipart'));

  // Serve static files
  await server.register(require('@fastify/static'), {
    root: path.join(__dirname, '../../frontend'),
    prefix: '/',
    index: false,
    setHeaders: (res, path, stat) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
  });

  // Custom plugins
  await server.register(require('./plugins/db'));
  await server.register(require('./plugins/mailer'));

  // Routes
  await server.register(require('./routes/pages'), { prefix: '/' });
  await server.register(require('./routes/api'), { prefix: '/api' });
  await server.register(require('./routes/admin'), { prefix: '/api/admin' });

  return server;
}

module.exports = build;
