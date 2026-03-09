require('dotenv').config();

// Set serverless environment before importing
process.env.VERCEL = '1';

const build = require('../backend/src/server');

let app;
let appPromise;

async function getApp() {
  if (app) return app;
  
  if (!appPromise) {
    appPromise = (async () => {
      console.log('[Vercel] Building Fastify app...');
      app = await build();
      await app.ready();
      console.log('[Vercel] Fastify app ready');
      return app;
    })();
  }
  
  return appPromise;
}

module.exports = async (req, res) => {
  try {
    const fastify = await getApp();
    
    // Properly inject the request into Fastify
    const response = await fastify.inject({
      method: req.method,
      url: req.url,
      headers: req.headers,
      payload: req,
      query: req.query
    });
    
    // Copy response headers
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    res.statusCode = response.statusCode;
    res.end(response.rawPayload);
  } catch (error) {
    console.error('[Vercel] Error:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal Server Error', message: error.message }));
  }
};
