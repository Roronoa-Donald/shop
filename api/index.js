require('dotenv').config();

// Set serverless environment before importing
process.env.VERCEL = '1';

const build = require('../backend/src/server');

// Create fresh app for each request to ensure clean DB connections
module.exports = async (req, res) => {
  let app;
  try {
    console.log(`[Vercel] ${req.method} ${req.url}`);
    
    // Build fresh app for each request
    app = await build();
    await app.ready();
    
    // Properly inject the request into Fastify
    const response = await app.inject({
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
    console.error('[ERROR] Stack:', error.stack || error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal Server Error', message: error.message }));
  } finally {
    // Always close the app to release DB connections
    if (app) {
      try {
        await app.close();
        console.log('[Vercel] App closed, connections released');
      } catch (closeErr) {
        console.error('[Vercel] Error closing app:', closeErr.message);
      }
    }
  }
};
