const fp = require('fastify-plugin');
const knex = require('knex');
const knexConfig = require('../../../knexfile');

const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Wrapper to add retry logic for database operations
function withRetry(db) {
  const originalRaw = db.raw.bind(db);
  
  db.raw = async function(...args) {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await originalRaw(...args);
      } catch (err) {
        lastError = err;
        if (err.message.includes('too many clients') || err.message.includes('connection slots')) {
          console.log(`[DB] Retry ${attempt}/3 - waiting for connection...`);
          await new Promise(r => setTimeout(r, 500 * attempt));
        } else {
          throw err;
        }
      }
    }
    throw lastError;
  };
  
  return db;
}

async function dbPlugin(fastify) {
  const env = process.env.NODE_ENV || 'development';
  
  const db = knex(knexConfig[env]);
  
  // Add retry wrapper in serverless mode
  const wrappedDb = isServerless ? withRetry(db) : db;
  
  fastify.decorate('db', wrappedDb);
  fastify.decorate('dbRaw', db); // Keep raw access for cleanup
  console.log('Plugin DB chargé');

  // Always cleanup connections
  fastify.addHook('onClose', async () => {
    try {
      await db.destroy();
    } catch (err) {
      console.error('Error destroying db:', err.message);
    }
  });
}

module.exports = fp(dbPlugin);