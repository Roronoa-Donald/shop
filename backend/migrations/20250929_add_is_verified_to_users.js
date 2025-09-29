// backend/migrations/20250929_add_is_verified_to_users.js
exports.up = function(knex) {
  return knex.schema.hasColumn('users', 'is_verified').then(has => {
    if (!has) {
      return knex.schema.table('users', t => {
        t.boolean('is_verified').defaultTo(false);
      });
    }
  });
};

exports.down = function(knex) {
  return knex.schema.hasColumn('users', 'is_verified').then(has => {
    if (has) {
      return knex.schema.table('users', t => {
        t.dropColumn('is_verified');
      });
    }
  });
};
