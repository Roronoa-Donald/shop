/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('categories', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('slug').notNullable().unique();
    table.integer('parent_id').references('id').inTable('categories').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['slug']);
    table.index(['parent_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('categories');
};