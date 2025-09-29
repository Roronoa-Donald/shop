// backend/migrations/20250929_create_codes_table.js
exports.up = function(knex) {
  return knex.schema.createTable('codes', function(table) {
    table.increments('id').primary();       // serial int PK
    table.integer('num_code').notNullable();
    table.string('motif').notNullable();    // 'reset' ou 'verification'
    table.string('mail').notNullable();
    table.bigInteger('timestamp').notNullable(); // epoch ms
    table.boolean('consumed').defaultTo(false); // pratique pour marquer utilisé
    table.index(['mail', 'motif'], 'codes_mail_motif_idx');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('codes');
};
