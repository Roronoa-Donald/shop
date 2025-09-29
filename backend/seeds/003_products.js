const { v4: uuidv4 } = require('uuid');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing products
  await knex('product_variants').del();
  await knex('products').del();

  const categories = await knex('categories').select('*');
  const bijoux = categories.find(c => c.slug === 'bijoux');
  const vetements = categories.find(c => c.slug === 'vetements');
  const accessoires = categories.find(c => c.slug === 'accessoires');
  const chaussures = categories.find(c => c.slug === 'chaussures');

  const products = [
    // Bijoux
    {
      id: uuidv4(),
      title: 'Collier Or 18K Élégance',
      slug: 'collier-or-18k-elegance',
      description: 'Magnifique collier en or 18 carats avec pendentif en diamant. Pièce unique pour les occasions spéciales.',
      category_id: bijoux.id,
      subcategory: 'Colliers',
      price_fcfa: 850000,
      sku: 'BIJ-COL-001',
      images: JSON.stringify([
        'https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg',
        'https://images.pexels.com/photos/1191532/pexels-photo-1191532.jpeg'
      ]),
      tags: JSON.stringify(['or', 'diamant', 'luxe', 'cadeau']),
      available_count: 5
    },
    {
      id: uuidv4(),
      title: 'Boucles d\'oreilles Perles Fines',
      slug: 'boucles-oreilles-perles-fines',
      description: 'Élégantes boucles d\'oreilles ornées de perles fines naturelles. Parfaites pour un look raffiné.',
      category_id: bijoux.id,
      subcategory: 'Boucles d\'oreilles',
      price_fcfa: 320000,
      sku: 'BIJ-BOU-001',
      images: JSON.stringify([
        'https://images.pexels.com/photos/1445546/pexels-photo-1445546.jpeg'
      ]),
      tags: JSON.stringify(['perles', 'élégant', 'soirée']),
      available_count: 8
    },
    {
      id: uuidv4(),
      title: 'Bracelet Diamants Éternité',
      slug: 'bracelet-diamants-eternite',
      description: 'Bracelet en or blanc serti de diamants. Symbole d\'éternité et d\'amour.',
      category_id: bijoux.id,
      subcategory: 'Bracelets',
      price_fcfa: 1200000,
      sku: 'BIJ-BRA-001',
      images: JSON.stringify([
        'https://images.pexels.com/photos/1721942/pexels-photo-1721942.jpeg'
      ]),
      tags: JSON.stringify(['diamants', 'or blanc', 'mariage']),
      available_count: 3
    },

    // Vêtements
    {
      id: uuidv4(),
      title: 'Robe de Soirée Velours Noir',
      slug: 'robe-soiree-velours-noir',
      description: 'Somptueuse robe de soirée en velours noir avec détails dorés. Coupe élégante et féminine.',
      category_id: vetements.id,
      subcategory: 'Robes',
      price_fcfa: 280000,
      sku: 'VET-ROB-001',
      images: JSON.stringify([
        'https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg',
        'https://images.pexels.com/photos/1536620/pexels-photo-1536620.jpeg'
      ]),
      tags: JSON.stringify(['velours', 'soirée', 'élégant', 'noir']),
      available_count: 12
    },
    {
      id: uuidv4(),
      title: 'Costume Sur-Mesure Premium',
      slug: 'costume-sur-mesure-premium',
      description: 'Costume trois pièces confectionné dans les plus beaux tissus. Service de retouches inclus.',
      category_id: vetements.id,
      subcategory: 'Costumes',
      price_fcfa: 650000,
      sku: 'VET-COS-001',
      images: JSON.stringify([
        'https://images.pexels.com/photos/1036622/pexels-photo-1036622.jpeg'
      ]),
      tags: JSON.stringify(['sur-mesure', 'costume', 'premium', 'business']),
      available_count: 0 // Sur commande
    },
    {
      id: uuidv4(),
      title: 'Blazer Cachemire Beige',
      slug: 'blazer-cachemire-beige',
      description: 'Blazer luxueux en cachemire pur. Parfait pour un look business chic.',
      category_id: vetements.id,
      subcategory: 'Vestes',
      price_fcfa: 420000,
      sku: 'VET-BLA-001',
      images: JSON.stringify([
        'https://images.pexels.com/photos/1308881/pexels-photo-1308881.jpeg'
      ]),
      tags: JSON.stringify(['cachemire', 'blazer', 'beige', 'chic']),
      available_count: 6
    },

    // Accessoires
    {
      id: uuidv4(),
      title: 'Sac à Main Cuir Italien',
      slug: 'sac-main-cuir-italien',
      description: 'Sac à main artisanal en cuir italien véritable. Design intemporel et fonctionnel.',
      category_id: accessoires.id,
      subcategory: 'Sacs',
      price_fcfa: 180000,
      sku: 'ACC-SAC-001',
      images: JSON.stringify([
        'https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg',
        'https://images.pexels.com/photos/1152078/pexels-photo-1152078.jpeg'
      ]),
      tags: JSON.stringify(['cuir', 'italien', 'artisanal', 'intemporel']),
      available_count: 15
    },
    {
      id: uuidv4(),
      title: 'Montre Automatique Suisse',
      slug: 'montre-automatique-suisse',
      description: 'Montre de prestige à mouvement automatique suisse. Boîtier en acier inoxydable.',
      category_id: accessoires.id,
      subcategory: 'Montres',
      price_fcfa: 950000,
      sku: 'ACC-MON-001',
      images: JSON.stringify([
        'https://images.pexels.com/photos/190819/pexels-photo-190819.jpeg'
      ]),
      tags: JSON.stringify(['montre', 'suisse', 'automatique', 'prestige']),
      available_count: 4
    },
    {
      id: uuidv4(),
      title: 'Écharpe Soie Imprimée',
      slug: 'echarpe-soie-imprimee',
      description: 'Écharpe en soie pure avec motifs floraux. Accessoire parfait pour sublimer vos tenues.',
      category_id: accessoires.id,
      subcategory: 'Écharpes',
      price_fcfa: 85000,
      sku: 'ACC-ECH-001',
      images: JSON.stringify([
        'https://images.pexels.com/photos/1078958/pexels-photo-1078958.jpeg'
      ]),
      tags: JSON.stringify(['soie', 'écharpe', 'floral', 'accessoire']),
      available_count: 20
    },

    // Chaussures
    {
      id: uuidv4(),
      title: 'Escarpins Cuir Verni Rouge',
      slug: 'escarpins-cuir-verni-rouge',
      description: 'Escarpins élégants en cuir verni rouge. Talon de 8cm pour un look sophistiqué.',
      category_id: chaussures.id,
      subcategory: 'Escarpins',
      price_fcfa: 220000,
      sku: 'CHA-ESC-001',
      images: JSON.stringify([
        'https://images.pexels.com/photos/1449667/pexels-photo-1449667.jpeg'
      ]),
      tags: JSON.stringify(['escarpins', 'cuir verni', 'rouge', 'talon']),
      available_count: 10
    },
    {
      id: uuidv4(),
      title: 'Mocassins Cuir Homme',
      slug: 'mocassins-cuir-homme',
      description: 'Mocassins classiques en cuir pleine fleur. Confort et élégance pour le quotidien.',
      category_id: chaussures.id,
      subcategory: 'Mocassins',
      price_fcfa: 165000,
      sku: 'CHA-MOC-001',
      images: JSON.stringify([
        'https://images.pexels.com/photos/2529157/pexels-photo-2529157.jpeg'
      ]),
      tags: JSON.stringify(['mocassins', 'cuir', 'homme', 'classique']),
      available_count: 18
    }
  ];

  await knex('products').insert(products);

  // Add some variants for clothing items
  const variants = [
    // Robe de soirée variants
    { product_id: products[3].id, size: 'S', color: 'Noir', stock: 3 },
    { product_id: products[3].id, size: 'M', color: 'Noir', stock: 4 },
    { product_id: products[3].id, size: 'L', color: 'Noir', stock: 5 },
    
    // Blazer variants
    { product_id: products[5].id, size: '38', color: 'Beige', stock: 2 },
    { product_id: products[5].id, size: '40', color: 'Beige', stock: 2 },
    { product_id: products[5].id, size: '42', color: 'Beige', stock: 2 },

    // Escarpins variants
    { product_id: products[9].id, size: '37', color: 'Rouge', stock: 2 },
    { product_id: products[9].id, size: '38', color: 'Rouge', stock: 3 },
    { product_id: products[9].id, size: '39', color: 'Rouge', stock: 3 },
    { product_id: products[9].id, size: '40', color: 'Rouge', stock: 2 },

    // Mocassins variants
    { product_id: products[10].id, size: '40', color: 'Marron', stock: 6 },
    { product_id: products[10].id, size: '41', color: 'Marron', stock: 6 },
    { product_id: products[10].id, size: '42', color: 'Marron', stock: 6 }
  ];

  await knex('product_variants').insert(variants);
};