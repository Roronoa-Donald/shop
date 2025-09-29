const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  if (process.env.SEED_ADMIN !== 'true') {
    return;
  }

  // Clear existing admins
  await knex('admins').del();
  
  // Insert admin
  await knex('admins').insert({
    id: uuidv4(),
    email: process.env.ADMIN_EMAIL || 'admin@angele-shop.local',
    role: 'admin'
  });
};