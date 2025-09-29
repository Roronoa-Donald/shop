/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('orders', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').references('id').inTable('users').nullable();
    table.string('guest_name');
    table.string('guest_phone');
    table.text('guest_address');
    table.enu('status', ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'])
         .defaultTo('pending');
    table.integer('total_fcfa').notNullable();
    table.jsonb('payment_meta').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['user_id']);
    table.index(['status']);
    table.index(['created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('orders');
};