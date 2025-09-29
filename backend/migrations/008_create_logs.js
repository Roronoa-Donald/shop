/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('logs', (table) => {
    table.increments('id').primary();
    table.string('level').notNullable();
    table.text('message').notNullable();
    table.jsonb('meta').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['level']);
    table.index(['created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('logs');
};