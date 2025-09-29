/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('products', (table) => {
    table.uuid('id').primary();
    table.string('title').notNullable();
    table.string('slug').notNullable().unique();
    table.text('description');
    table.integer('category_id').references('id').inTable('categories').notNullable();
    table.string('subcategory');
    table.integer('price_fcfa').notNullable();
    table.string('currency').defaultTo('FCFA');
    table.string('sku');
    table.jsonb('images').defaultTo('[]');
    table.jsonb('tags').defaultTo('[]');
    table.integer('available_count').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['slug']);
    table.index(['category_id']);
    table.index(['price_fcfa']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('products');
};