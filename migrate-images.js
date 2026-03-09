/**
 * Script de migration des images locales vers Cloudinary
 * 
 * Usage: node migrate-images.js
 * 
 * Ce script parcourt le dossier frontend/uploads et upload toutes les images
 * vers Cloudinary en conservant la même structure de dossiers.
 */

require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadsDir = path.join(__dirname, 'frontend', 'uploads');

// Extensions d'images autorisées
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];

async function migrate() {
  console.log('🚀 Début de la migration vers Cloudinary...\n');
  console.log(`Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  console.log(`Dossier source: ${uploadsDir}\n`);

  if (!fs.existsSync(uploadsDir)) {
    console.error('❌ Le dossier uploads n\'existe pas:', uploadsDir);
    process.exit(1);
  }

  let totalUploaded = 0;
  let totalErrors = 0;

  // Parcourir chaque catégorie
  const categories = fs.readdirSync(uploadsDir);

  for (const category of categories) {
    const catPath = path.join(uploadsDir, category);
    if (!fs.statSync(catPath).isDirectory()) continue;

    console.log(`\n📁 Catégorie: ${category}`);

    const slugs = fs.readdirSync(catPath);

    for (const slug of slugs) {
      const slugPath = path.join(catPath, slug);
      if (!fs.statSync(slugPath).isDirectory()) continue;

      const files = fs.readdirSync(slugPath);

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!imageExtensions.includes(ext)) continue;

        const filePath = path.join(slugPath, file);
        const publicId = `angele-shop/${category}/${slug}/${path.parse(file).name}`;

        try {
          const result = await cloudinary.uploader.upload(filePath, {
            public_id: publicId,
            folder: '', // public_id contient déjà le chemin
            overwrite: false,
            resource_type: 'image',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }]
          });
          console.log(`  ✅ ${slug}/${file} → ${result.secure_url}`);
          totalUploaded++;
        } catch (err) {
          if (err.message && err.message.includes('already exists')) {
            console.log(`  ⏭️  ${slug}/${file} (déjà existant)`);
          } else {
            console.error(`  ❌ ${slug}/${file} : ${err.message}`);
            totalErrors++;
          }
        }
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`🎉 Migration terminée !`);
  console.log(`   - Images uploadées: ${totalUploaded}`);
  console.log(`   - Erreurs: ${totalErrors}`);
  console.log('\nProchaine étape: exécute "node update-image-urls.js" pour mettre à jour la base de données.');
}

migrate().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
