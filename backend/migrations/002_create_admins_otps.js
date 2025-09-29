/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('admins', (table) => {
      table.uuid('id').primary();
      table.string('email').notNullable().unique();
      table.string('role').defaultTo('admin');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index(['email']);
    })
    .createTable('otps', (table) => {
      table.increments('id').primary();
      table.string('email').notNullable();
      table.string('code_hash').notNullable();
      table.integer('attempts').defaultTo(0);
      table.timestamp('expires_at').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index(['email', 'expires_at']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTable('otps')
    .dropTable('admins');
};