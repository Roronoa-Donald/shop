const fp = require('fastify-plugin');
const knex = require('knex');
const knexConfig = require('../../../knexfile');

const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

async function dbPlugin(fastify) {
  const env = process.env.NODE_ENV || 'development';
  
  // In serverless: create fresh connection for each invocation to avoid stale connections
  const db = knex(knexConfig[env]);
  console.log('Database connection created');

  fastify.decorate('db', db);
  console.log('Plugin DB chargé et fastify.db décoré');

  // Always cleanup connections properly
  fastify.addHook('onClose', async () => {
    try {
      await db.destroy();
      console.log('Database connection destroyed');
    } catch (err) {
      console.error('Error destroying db connection:', err.message);
    }
  });
}

module.exports = fp(dbPlugin);