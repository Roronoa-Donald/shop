require('dotenv').config();
const knex = require('knex');
const config = require('../knexfile');
const db = knex(config[process.env.NODE_ENV || 'development']);
db.raw('SELECT 1').then(() => {
  console.log('Connexion OK');
  process.exit(0);
}).catch(e => {
  console.error('Erreur connexion DB:', e);
  process.exit(1);
});
