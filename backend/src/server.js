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
  await server.register(require('@fastify/cookie'), {
    secret: process.env.APP_SECRET, // for signing cookies
    parseOptions: {}
  });
  
  // Simple session using signed cookies (serverless compatible)
  // Session data stored in encrypted cookie - no server-side storage needed
  const crypto = require('crypto');
  
  // Encrypt/decrypt session data
  const ALGO = 'aes-256-gcm';
  const SECRET_KEY = crypto.createHash('sha256').update(process.env.APP_SECRET).digest();
  
  function encryptSession(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGO, SECRET_KEY, iv);
    const json = JSON.stringify(data);
    let encrypted = cipher.update(json, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    return `${iv.toString('base64')}.${encrypted}.${authTag}`;
  }
  
  function decryptSession(token) {
    try {
      const [ivB64, encryptedB64, authTagB64] = token.split('.');
      if (!ivB64 || !encryptedB64 || !authTagB64) return {};
      const iv = Buffer.from(ivB64, 'base64');
      const encrypted = Buffer.from(encryptedB64, 'base64');
      const authTag = Buffer.from(authTagB64, 'base64');
      const decipher = crypto.createDecipheriv(ALGO, SECRET_KEY, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (e) {
      return {};
    }
  }
  
  // Add session object to each request
  server.decorateRequest('session', null);
  server.addHook('onRequest', async (request, reply) => {
    const sessionCookie = request.cookies['angele_session'];
    const sessionData = sessionCookie ? decryptSession(sessionCookie) : {};
    
    // Create session object with get/set methods
    request.session = {
      _data: sessionData,
      get(key) { return this._data[key]; },
      set(key, value) { this._data[key] = value; },
      delete() { this._data = {}; }
    };
  });
  
  // Save session on response
  server.addHook('onSend', async (request, reply) => {
    if (request.session && Object.keys(request.session._data).length > 0) {
      const token = encryptSession(request.session._data);
      reply.setCookie('angele_session', token, {
        maxAge: 7 * 24 * 60 * 60, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });
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
