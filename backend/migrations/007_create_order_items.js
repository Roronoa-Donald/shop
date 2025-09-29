/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('order_items', (table) => {
    table.increments('id').primary();
    table.uuid('order_id').references('id').inTable('orders').onDelete('CASCADE').notNullable();
    table.uuid('product_id').references('id').inTable('products').notNullable();
    table.integer('variant_id').references('id').inTable('product_variants').nullable();
    table.integer('quantity').notNullable();
    table.integer('unit_price_fcfa').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['order_id']);
    table.index(['product_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('order_items');
};