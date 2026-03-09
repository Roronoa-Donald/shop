// Migration: Create favorites table
exports.up = function(knex) {
  return knex.schema.createTable('favorites', function(table) {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Unique constraint: user can only favorite a product once
    table.unique(['user_id', 'product_id']);
    
    // Index for faster lookups
    table.index('user_id');
    table.index('product_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('favorites');
};
