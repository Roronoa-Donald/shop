const fp = require('fastify-plugin');
const knex = require('knex');
const knexConfig = require('../../../knexfile');

// Reuse database connection across warm serverless invocations
let cachedDb = null;

async function dbPlugin(fastify) {
  const env = process.env.NODE_ENV || 'development';
  
  // Reuse existing connection in serverless environment
  if (!cachedDb) {
    cachedDb = knex(knexConfig[env]);
    console.log('New database connection created');
  } else {
    console.log('Reusing cached database connection');
  }

  fastify.decorate('db', cachedDb);
  console.log('Plugin DB chargé et fastify.db décoré');

  // Don't destroy connection on close in serverless (keep warm)
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (!isServerless) {
    fastify.addHook('onClose', async () => {
      await cachedDb.destroy();
      cachedDb = null;
    });
  }
}

module.exports = fp(dbPlugin);