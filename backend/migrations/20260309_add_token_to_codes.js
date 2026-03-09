// Add token column to codes table for link-based verification
exports.up = function(knex) {
  return knex.schema.alterTable('codes', function(table) {
    table.string('token').nullable();
    table.index('token', 'codes_token_idx');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('codes', function(table) {
    table.dropIndex('token', 'codes_token_idx');
    table.dropColumn('token');
  });
};
