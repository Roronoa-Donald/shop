const fp = require('fastify-plugin');
const knex = require('knex');
const knexConfig = require('../../../knexfile');

async function dbPlugin(fastify) {
  const env = process.env.NODE_ENV || 'development';
  const db = knex(knexConfig[env]);

  fastify.decorate('db', db);
  console.log('Plugin DB chargé et fastify.db décoré');

  fastify.addHook('onClose', async () => {
    await db.destroy();
  });
}

module.exports = fp(dbPlugin);