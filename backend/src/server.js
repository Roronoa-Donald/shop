const fastify = require('fastify');
const path = require('path');

async function build() {
  const isVercel = !!process.env.VERCEL;

  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'debug'
    }
  });

  // Detailed logging for Vercel (appears in Functions logs)
  server.addHook('onRequest', async (request) => {
    console.log(`[REQ] ${new Date().toISOString()} ${request.method} ${request.url}`);
    if (request.body && Object.keys(request.body).length > 0) {
      console.log('[REQ BODY]', JSON.stringify(request.body, null, 2));
    }
  });
  
  server.addHook('onResponse', async (request, reply) => {
    console.log(`[RES] ${request.method} ${request.url} → ${reply.statusCode} (${reply.elapsedTime?.toFixed(2) || '?'}ms)`);
  });
  
  server.addHook('onError', async (request, reply, error) => {
    console.error(`[ERROR] ${request.method} ${request.url}`);
    console.error(`[ERROR] Message: ${error.message}`);
    console.error(`[ERROR] Stack: ${error.stack}`);
  });

  // Multipart for file uploads
  // On Vercel: use attachFieldsToBody to buffer files in memory (no filesystem)
  await server.register(require('@fastify/multipart'), {
    attachFieldsToBody: true,  // Parse multipart and attach to request.body
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max
  });


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
  imgSrc: ["'self'", 'data:', 'blob:', 'https://images.pexels.com', 'https://res.cloudinary.com'],
  connectSrc: ["'self'"],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  });

  // CORS
  await server.register(require('@fastify/cors'), {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
      : true,
    credentials: true
  });

  // Rate limiting
  await server.register(require('@fastify/rate-limit'), {
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000
  });

  // Sessions & Cookies
  if (!process.env.APP_SECRET) {
    throw new Error('APP_SECRET environment variable is required');
  }
  await server.register(require('@fastify/cookie'));
  
  // Use secure-session for serverless (stores session data IN the cookie)
  // Generate key from APP_SECRET (must be 32 bytes for sodium)
  const crypto = require('crypto');
  const sessionKey = crypto.createHash('sha256').update(process.env.APP_SECRET).digest();
  
  await server.register(require('@fastify/secure-session'), {
    key: sessionKey,
    cookieName: 'angele_session',
    cookie: {
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    }
  });

  // Serve static files — only in non-serverless mode
  if (!isVercel) {
    await server.register(require('@fastify/static'), {
      root: path.join(__dirname, '../../frontend'),
      prefix: '/',
      index: ['index.html'],
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      }
    });
  }

  // Custom plugins
  await server.register(require('./plugins/db'));
  await server.register(require('./plugins/mailer'));

  // Routes
  if (!isVercel) {
    await server.register(require('./routes/pages'), { prefix: '/' });
  }
  await server.register(require('./routes/api'), { prefix: '/api' });
  await server.register(require('./routes/admin'), { prefix: '/api/admin' });

  return server;
}

module.exports = build;
