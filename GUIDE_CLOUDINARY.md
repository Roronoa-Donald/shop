# Migration vers Cloudinary - Guide étape par étape

## 1. Créer un compte Cloudinary

1. Va sur **https://cloudinary.com/users/register/free**
2. Crée un compte gratuit (email + mot de passe ou Google)
3. Une fois connecté, tu arrives sur le **Dashboard**
4. Note tes 3 identifiants visibles en haut du dashboard :
   - **Cloud Name** (ex: `dxyz1234abc`)
   - **API Key** (ex: `123456789012345`)
   - **API Secret** (ex: `abcDEF-ghiJKL_mnoPQR`)

---

## 2. Ajouter les variables d'environnement

### En local (.env)

Ouvre ton fichier `.env` et ajoute ces 3 lignes :

```
CLOUDINARY_CLOUD_NAME=ton_cloud_name
CLOUDINARY_API_KEY=ton_api_key
CLOUDINARY_API_SECRET=ton_api_secret
```

### Sur Vercel

1. Va sur ton projet Vercel → **Settings** → **Environment Variables**
2. Ajoute les 3 mêmes variables avec les mêmes valeurs

---

## 3. Installer le SDK Cloudinary

Dans ton terminal, à la racine du projet :

```bash
npm install cloudinary
```

---

## 4. Uploader tes images existantes

### Option A : Upload manuel via le Dashboard

1. Connecte-toi sur **https://console.cloudinary.com/pm/media-explorer**
2. Crée un dossier `angele-shop` (bouton "Create folder")
3. Dans ce dossier, crée des sous-dossiers par catégorie : `bijoux`, `chaussures`, `vetements`, `accessoires`
4. Glisse-dépose tes images dedans depuis ton dossier `frontend/uploads/`
5. Chaque image aura une URL comme :
   ```
   https://res.cloudinary.com/TON_CLOUD/image/upload/v1234/angele-shop/bijoux/mon-produit/1.jpeg
   ```

### Option B : Upload automatique avec un script

Crée un fichier temporaire `migrate-images.js` à la racine :

```js
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadsDir = path.join(__dirname, 'frontend', 'uploads');

async function migrate() {
  // Parcourir chaque catégorie
  const categories = fs.readdirSync(uploadsDir);

  for (const category of categories) {
    const catPath = path.join(uploadsDir, category);
    if (!fs.statSync(catPath).isDirectory()) continue;

    const slugs = fs.readdirSync(catPath);

    for (const slug of slugs) {
      const slugPath = path.join(catPath, slug);
      if (!fs.statSync(slugPath).isDirectory()) continue;

      const files = fs.readdirSync(slugPath);

      for (const file of files) {
        const filePath = path.join(slugPath, file);
        const publicId = `angele-shop/${category}/${slug}/${path.parse(file).name}`;

        try {
          const result = await cloudinary.uploader.upload(filePath, {
            public_id: publicId,
            folder: '', // public_id contient déjà le chemin
            overwrite: false,
            resource_type: 'image',
          });
          console.log(`✅ ${publicId} → ${result.secure_url}`);
        } catch (err) {
          console.error(`❌ ${publicId} : ${err.message}`);
        }
      }
    }
  }

  console.log('\n🎉 Migration terminée !');
}

migrate();
```

Lance-le :

```bash
node migrate-images.js
```

Attends que toutes les images soient uploadées (tu verras les ✅ défiler).

---

## 5. Mettre à jour la base de données

Une fois les images sur Cloudinary, il faut mettre à jour les URLs dans ta base.

Crée un fichier `update-image-urls.js` à la racine :

```js
require('dotenv').config();
const knex = require('knex');
const config = require('./knexfile');

const db = knex(config[process.env.NODE_ENV || 'development']);
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;

async function updateUrls() {
  const products = await db('products').select('id', 'images');

  let updated = 0;
  for (const product of products) {
    let images = product.images;
    if (!images) continue;

    if (typeof images === 'string') {
      try { images = JSON.parse(images); } catch { continue; }
    }

    if (!Array.isArray(images) || images.length === 0) continue;

    // Transformer /uploads/bijoux/slug/1.jpeg → URL Cloudinary
    const newImages = images.map(img => {
      // Enlever le / initial et l'extension
      const cleanPath = img.replace(/^\//, '');            // uploads/bijoux/slug/1.jpeg
      const withoutExt = cleanPath.replace(/\.[^.]+$/, ''); // uploads/bijoux/slug/1
      const cloudPath = withoutExt.replace(/^uploads\//, 'angele-shop/');

      return `https://res.cloudinary.com/${CLOUD}/image/upload/${cloudPath}`;
    });

    await db('products').where('id', product.id).update({
      images: JSON.stringify(newImages),
    });
    updated++;
    console.log(`✅ ${product.id} : ${newImages[0]}`);
  }

  console.log(`\n🎉 ${updated} produits mis à jour !`);
  await db.destroy();
}

updateUrls();
```

Lance-le :

```bash
node update-image-urls.js
```

---

## 6. Mettre à jour le code d'upload admin

Ton code admin actuel écrit les fichiers sur le disque. Il faut le modifier pour uploader vers Cloudinary.

Les modifications seront faites dans `backend/src/routes/admin.js`, dans la route `POST /products`.

Au lieu de :
```js
await fs.writeFile(filePath, file.buffer);
images.push(`/uploads/${category.slug}/${slug}/${filename}`);
```

Ce sera :
```js
const result = await cloudinary.uploader.upload_stream(/* ... */);
images.push(result.secure_url);
```

> **Tu peux me demander de faire cette modification automatiquement.** Je remplacerai le code d'upload local par l'upload Cloudinary.

---

## 7. Mettre à jour le frontend (si nécessaire)

Les URLs Cloudinary sont des URLs complètes (`https://res.cloudinary.com/...`), donc le frontend les affichera directement — **pas besoin de changer le frontend** si tu utilises `<img src="${imageUrl}">`.

### Bonus : optimisation automatique

Tu peux transformer n'importe quelle URL Cloudinary pour optimiser l'image :

```
https://res.cloudinary.com/TON_CLOUD/image/upload/w_400,q_auto,f_auto/angele-shop/bijoux/produit/1
```

- `w_400` = largeur 400px
- `q_auto` = compression automatique
- `f_auto` = format WebP si le navigateur le supporte

---

## 8. Vérification finale

Checklist avant de considérer la migration terminée :

- [ ] Compte Cloudinary créé
- [ ] Variables d'environnement ajoutées (local + Vercel)
- [ ] `npm install cloudinary` fait
- [ ] Images existantes uploadées (script ou manuel)
- [ ] URLs en base de données mises à jour
- [ ] Route d'upload admin modifiée pour Cloudinary
- [ ] Test : créer un nouveau produit avec image depuis l'admin
- [ ] Test : vérifier que les anciennes images s'affichent correctement sur la boutique
- [ ] Supprimer les scripts de migration (`migrate-images.js`, `update-image-urls.js`)

---

## Résumé des commandes

```bash
# 1. Installer Cloudinary
npm install cloudinary

# 2. Migrer les images existantes
node migrate-images.js

# 3. Mettre à jour les URLs en base
node update-image-urls.js

# 4. Supprimer les scripts temporaires
rm migrate-images.js update-image-urls.js

# 5. Déployer
vercel --prod
```
