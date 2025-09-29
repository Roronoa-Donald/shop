/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('product_variants', (table) => {
    table.increments('id').primary();
    table.uuid('product_id').references('id').inTable('products').onDelete('CASCADE').notNullable();
    table.string('size');
    table.string('color');
    table.integer('stock').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['product_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('product_variants');
};