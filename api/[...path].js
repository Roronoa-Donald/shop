require('dotenv').config();
const build = require('../backend/src/server');

let app;

module.exports = async (req, res) => {
  try {
    if (!app) {
      console.log('[Vercel] Building Fastify app...');
      app = await build();
      await app.ready();
      console.log('[Vercel] Fastify app ready');
    }
    
    console.log(`[Vercel] ${req.method} ${req.url}`);
    
    // Use Fastify's built-in serverless handler
    await app.server.emit('request', req, res);
  } catch (error) {
    console.error('[Vercel] Error:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal Server Error', message: error.message }));
  }
};
