/**
 * Script de mise à jour des URLs d'images dans la base de données
 * 
 * Usage: node update-image-urls.js
 * 
 * Ce script transforme les URLs locales (/uploads/...) en URLs Cloudinary
 * dans la table products.
 */

require('dotenv').config();
const knex = require('knex');
const config = require('./knexfile');

const db = knex(config[process.env.NODE_ENV || 'development']);
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;

async function updateUrls() {
  console.log('🚀 Mise à jour des URLs en base de données...\n');
  console.log(`Cloud Name: ${CLOUD}`);
  console.log(`Environnement: ${process.env.NODE_ENV || 'development'}\n`);

  const products = await db('products').select('id', 'title', 'images');

  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    let images = product.images;
    if (!images) {
      skipped++;
      continue;
    }

    // Parse JSON si nécessaire
    if (typeof images === 'string') {
      try {
        images = JSON.parse(images);
      } catch {
        console.log(`  ⚠️  ${product.title}: images non parsables`);
        skipped++;
        continue;
      }
    }

    if (!Array.isArray(images) || images.length === 0) {
      skipped++;
      continue;
    }

    // Vérifier si déjà migré (commence par https://res.cloudinary.com)
    if (images[0] && images[0].startsWith('https://res.cloudinary.com')) {
      console.log(`  ⏭️  ${product.title} (déjà migré)`);
      skipped++;
      continue;
    }

    // Transformer /uploads/bijoux/slug/1.jpeg → URL Cloudinary
    const newImages = images.map(img => {
      // Enlever le / initial
      const cleanPath = img.replace(/^\//, '');            // uploads/bijoux/slug/1.jpeg
      // Enlever l'extension
      const withoutExt = cleanPath.replace(/\.[^.]+$/, ''); // uploads/bijoux/slug/1
      // Remplacer uploads/ par angele-shop/
      const cloudPath = withoutExt.replace(/^uploads\//, 'angele-shop/');

      return `https://res.cloudinary.com/${CLOUD}/image/upload/${cloudPath}`;
    });

    await db('products').where('id', product.id).update({
      images: JSON.stringify(newImages),
    });

    updated++;
    console.log(`  ✅ ${product.title}`);
    console.log(`     ${images[0]} → ${newImages[0]}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log(`🎉 Migration terminée !`);
  console.log(`   - Produits mis à jour: ${updated}`);
  console.log(`   - Produits ignorés: ${skipped}`);

  await db.destroy();
}

updateUrls().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
