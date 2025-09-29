/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('categories').del();
  
  // Inserts seed entries
  await knex('categories').insert([
    { id: 1, name: 'Bijoux', slug: 'bijoux' },
    { id: 2, name: 'Vêtements', slug: 'vetements' },
    { id: 3, name: 'Accessoires', slug: 'accessoires' },
    { id: 4, name: 'Chaussures', slug: 'chaussures' }
  ]);
};