# AUDIT COMPLET — Angele Shop

**Date :** 8 mars 2026  
**Projet :** Angele Shop — Plateforme e-commerce de luxe  
**Stack :** Node.js (Fastify) + PostgreSQL + HTML/CSS/JS vanilla  
**Auditeur :** Audit automatisé (code review statique)

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Architecture & structure](#2-architecture--structure)
3. [Vulnérabilités de sécurité (CRITIQUE)](#3-vulnérabilités-de-sécurité)
4. [Problèmes fonctionnels](#4-problèmes-fonctionnels)
5. [Qualité du code & style](#5-qualité-du-code--style)
6. [Performance](#6-performance)
7. [DevOps & déploiement](#7-devops--déploiement)
8. [Tests](#8-tests)
9. [Frontend](#9-frontend)
10. [Base de données](#10-base-de-données)
11. [Recommandations prioritaires](#11-recommandations-prioritaires)

---

## 1. Résumé exécutif

| Catégorie | Sévérité | Nombre de problèmes |
|-----------|----------|---------------------|
| Sécurité CRITIQUE | 🔴 | 12 |
| Sécurité HAUTE | 🟠 | 8 |
| Sécurité MOYENNE | 🟡 | 6 |
| Fonctionnel | 🟠 | 9 |
| Qualité code | 🟡 | 15+ |
| Performance | 🟡 | 5 |
| DevOps | 🟠 | 4 |

**Verdict global : Le projet présente des vulnérabilités CRITIQUES qui doivent être corrigées AVANT toute mise en production.**

---

## 2. Architecture & structure

### Points positifs ✅
- Séparation backend/frontend claire
- Utilisation de Fastify (performant et modern)
- Migrations Knex bien structurées
- Système de plugins Fastify bien utilisé (db, mailer)
- Dockerfile avec utilisateur non-root (`USER node`)
- Health check dans Docker
- Rate limiting configuré
- Helmet CSP configuré

### Points négatifs ❌
- **Pas de fichier `.env.example`** — Impossible de savoir quelles variables d'environnement sont nécessaires
- **Fichiers résiduels** : `admin.js.orig`, `api.js.bak`, `api.js.orig`, `all.txt`, `i.txt`, `frontend.login.html`, `index.js` (racine) — Ces fichiers encombrent le projet
- **Pas de `.gitignore` visible** — Risque de commit de fichiers sensibles
- **Dossier `uploads/` dans le repo** avec des données de test (noms aléatoires comme `dhdq`, `fuvk`, `hfhg`)
- **Pas de séparation claire des middlewares** — Le middleware `verifyAdminToken` est défini inline dans les routes

---

## 3. Vulnérabilités de sécurité

### 🔴 CRITIQUE-01 : Secret de session hardcodé en fallback

**Fichier :** `backend/src/server.js` (ligne ~53)

```javascript
secret: process.env.APP_SECRET || "que_fais_tu_moi_j_'_ai_la_forme_ma_belle_t_'es_plus_fraiche_que_la_norme"
```

**Risque :** Si `APP_SECRET` n'est pas défini, un secret prévisible est utilisé. Un attaquant pourrait forger des sessions.  
**Correction :** Supprimer le fallback, crasher au démarrage si APP_SECRET est manquant.

---

### 🔴 CRITIQUE-02 : Token admin stocké EN CLAIR en base de données

**Fichier :** `backend/src/routes/admin.js` (ligne ~183)

```javascript
await fastify.db('tokens').insert({token: adminToken})
```

**Risque :** Le JWT admin est stocké tel quel en DB. Si la base est compromise, tous les tokens admin sont exploitables immédiatement.  
**Correction :** Stocker un hash du token (SHA-256) ou ne pas stocker le token du tout.

---

### 🔴 CRITIQUE-03 : Vérification de token admin par simple comparaison en clair

**Fichier :** `backend/src/routes/api.js` — route `PUT /verifytoken`

```javascript
if(token === lastToken) {
    res.send({oklm: true})
}
```

**Risques multiples :**
1. Compare le token en clair (timing attack possible)
2. Vérifie uniquement le DERNIER token inséré — si un autre admin se connecte, le premier perd l'accès
3. La route est **non protégée** — n'importe qui peut tester des tokens
4. Utilise `PUT` au lieu de `POST` (sémantique incorrecte)
5. La réponse `{oklm: true}` est peu professionnelle

**Correction :** Utiliser `jwt.verify()` directement côté client/middleware, supprimer cette route.

---

### 🔴 CRITIQUE-04 : Route `/api/editproduct/:id` sans authentification

**Fichier :** `backend/src/routes/api.js`

```javascript
fastify.put("/editproduct/:id", async (req, res) => { ... })
```

**Risque :** N'importe qui peut modifier n'importe quel produit sans être authentifié. Aucun middleware d'authentification n'est appliqué.  
**Correction :** Déplacer cette route dans le contexte admin protégé ou ajouter `verifyAdminToken`.

---

### 🔴 CRITIQUE-05 : Route dupliquée `/api/send/mess` sans validation

**Fichier :** `backend/src/server.js` (lignes ~87-107) ET `backend/src/routes/api.js`

La route est définie **deux fois** :
1. Dans `server.js` comme "DEBUG / fix temporaire" — sans validation du body
2. Dans `api.js` — comme `POST /api/send/mess` (imbrication incorrecte car déjà sous préfixe `/api`)

**Risques :**
- Injection de contenu dans les emails (pas de validation/sanitization)
- Spam : n'importe qui peut envoyer des emails via cette route
- Confusion sur quelle route est réellement active

---

### 🔴 CRITIQUE-06 : XSS stocké via les données produit dans le dashboard admin

**Fichier :** `frontend/admin.html`

```javascript
<td>${product.title}</td>
<td>${order.guest_name || 'N/A'}</td>
```

Les données sont injectées directement dans le HTML via `innerHTML` sans échappement. Un attaquant pourrait créer un produit ou une commande avec un titre contenant `<script>alert('XSS')</script>`.

**Aussi présent dans :** `components.js` — `createProductCard()` et `SearchComponent.displayResults()`  
**Correction :** Utiliser `textContent` ou une fonction d'échappement HTML systématique.

---

### 🔴 CRITIQUE-07 : Cookie guest non-httpOnly et parsing JSON non sécurisé

**Fichier :** `backend/src/routes/api.js` — route checkout

```javascript
reply.setCookie('ANGELE_GUEST', JSON.stringify(guestOrders), {
    httpOnly: false,
    path: '/'
});
// ...
const guestOrders = request.cookies['ANGELE_GUEST'] ? 
    JSON.parse(request.cookies['ANGELE_GUEST']) : [];
```

**Risques :**
1. Cookie accessible via JavaScript (vol de données possible via XSS)
2. `JSON.parse()` sur une valeur contrôlée par l'utilisateur sans try/catch — crash si cookie manipulé
3. Pas de validation du contenu du cookie parsé

---

### 🔴 CRITIQUE-08 : Email hardcodé dans le code source

**Fichier :** `backend/src/routes/api.js` — route checkout

```javascript
await fastify.sendEmail('order_received', "roronoadonald3@gmail.com", ...);
```

**Risques :**
- Email personnel exposé dans le code source
- Si le repo est public, spam/phishing possible
- Devrait être dans une variable d'environnement

---

### 🔴 CRITIQUE-09 : Injection SQL potentielle via ILIKE

**Fichier :** `backend/src/routes/api.js`

```javascript
query = query.whereRaw(
    "products.title ILIKE ? OR products.description ILIKE ?",
    [`%${q}%`, `%${q}%`]
);
```

Bien que les paramètres soient liés (ce qui protège contre l'injection SQL classique), les caractères spéciaux `%` et `_` de LIKE ne sont pas échappés. Un utilisateur peut envoyer `%` pour forcer un full scan ou `_` pour du pattern matching non désiré.

**Correction :** Échapper `%`, `_` et `\` dans la valeur de recherche.

---

### 🔴 CRITIQUE-10 : Aucune validation de type de fichier sur upload (magic bytes)

**Fichier :** `backend/src/routes/admin.js` — POST /products

```javascript
const allowedExt = new Set(['jpg','jpeg','png','gif','webp','avif','svg']);
// Extension basée sur le filename et mimetype
```

**Risques :**
- L'extension et le mimetype sont contrôlés par le client et facilement falsifiables
- Un fichier `.svg` peut contenir du JavaScript (XSS via SVG)
- Pas de vérification des magic bytes (contenu réel du fichier)
- Pas de limite de taille de fichier configurée

---

### 🔴 CRITIQUE-11 : Path traversal partiel dans le slug produit

**Fichier :** `backend/src/routes/admin.js`

```javascript
let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
slug = slug + '-' + Date.now();
const uploadDir = path.join(UPLOAD_DIR, category.slug, slug);
```

Le slug est dérivé du titre. Bien que le regex filtre la plupart des caractères dangereux, la validation est insuffisante :
- Pas de vérification que le chemin résultant est bien dans le répertoire uploads
- Le `UPLOAD_DIR` en fallback pointe vers un chemin absolu spécifique à une machine de dev

---

### 🔴 CRITIQUE-12 : Accès aux commandes par ID prévisible (IDOR)

**Fichier :** `backend/src/routes/api.js` — GET `/orders/:orderId`

```javascript
if (!order.user_id && !request.session.userId) {
    const guestOrders = request.cookies['ANGELE_GUEST'] ? 
        JSON.parse(request.cookies['ANGELE_GUEST']) : [];
    const hasAccess = guestOrders.some(guestOrder => guestOrder.orderId === orderId);
}
```

Pour les commandes guest avec un `user_id` null et un utilisateur non connecté, la vérification repose sur un **cookie manipulable** (non httpOnly). Un attaquant peut forger le cookie pour accéder à n'importe quelle commande.

---

### 🟠 HAUTE-01 : Double enregistrement de multipart

**Fichier :** `backend/src/server.js`

```javascript
await server.register(require('fastify-multipart'));  // ligne 11
// await server.register(require('@fastify/multipart'));  // commenté ligne 68
```

Deux packages multipart différents : `fastify-multipart` (legacy v5) et `@fastify/multipart` (v7 dans package.json). La version legacy est celle utilisée, ce qui peut causer des incompatibilités.

---

### 🟠 HAUTE-02 : Pas de CSRF protection

Les formulaires de checkout et de contact n'ont pas de token CSRF. Fastify ne fournit pas de CSRF par défaut. Combiné avec `sameSite: 'lax'`, certaines attaques cross-site sont possibles via les requêtes POST.

---

### 🟠 HAUTE-03 : Token JWT admin avec durée de vie de 24h

**Fichier :** `backend/src/routes/admin.js`

```javascript
exp: Math.floor(Date.now() / 1000) + (60 * 1440) // 1 jour
```

Le commentaire indique "10 minutes" mais la durée réelle est 24h. Pour un token admin, c'est excessivement long.

---

### 🟠 HAUTE-04 : Pas de mécanisme de révocation des tokens JWT

Il n'y a pas de blacklist ou de vérification en base des tokens JWT. Un token volé reste valide jusqu'à expiration.

---

### 🟠 HAUTE-05 : `'unsafe-inline'` dans la CSP pour scripts

**Fichier :** `backend/src/server.js`

```javascript
scriptSrc: ["'self'", "'unsafe-inline'"],
```

Permet l'exécution de scripts inline, ce qui réduit considérablement l'efficacité de la CSP contre les attaques XSS.

---

### 🟠 HAUTE-06 : SSL `rejectUnauthorized: false` dans la config DB

**Fichier :** `knexfile.js`

```javascript
ssl: { rejectUnauthorized: false }
```

Désactive la vérification du certificat SSL de la DB. Vulnérable aux attaques MITM.

---

### 🟠 HAUTE-07 : Mot de passe DB par défaut dans docker-compose

**Fichier :** `docker-compose.yml`

```yaml
POSTGRES_PASSWORD=changeme
DB_PASSWORD=changeme
```

Mot de passe par défaut exposé dans le repo.

---

### 🟠 HAUTE-08 : Le `update product` (PUT /products/:id) accepte n'importe quels champs

**Fichier :** `backend/src/routes/admin.js`

```javascript
await fastify.db('products')
    .where('id', id)
    .update({
        ...updates,
        updated_at: new Date()
    });
```

`request.body` est spreadé directement dans l'update SQL. Un attaquant pourrait modifier des champs non prévus (ex: `id`, `created_at`).

---

### 🟡 MOYENNE-01 : Pas de rate limiting spécifique sur les routes d'authentification

Le rate limiting global (100 req/min) s'applique. Mais les routes `/auth/login`, `/admin/request-otp`, `/admin/verify-otp` devraient avoir un rate limiting plus strict (ex: 5 tentatives/min).

---

### 🟡 MOYENNE-02 : Les OTP ne sont pas purgés régulièrement

Les OTP expirés sont nettoyés uniquement lors d'un nouveau `request-otp`. Il n'y a pas de job de nettoyage périodique.

---

### 🟡 MOYENNE-03 : Pas de validation `is_verified` lors du login

Un utilisateur non vérifié peut se connecter :

```javascript
// api.js — POST /auth/login
const user = await fastify.db('users').where('email', email).first();
// Pas de vérification de user.is_verified
```

---

### 🟡 MOYENNE-04 : `console.log` avec données sensibles

Multiples `console.log` exposant des données en production :
- `console.log('APP_SECRET length:', ...)`
- `console.log(orderId, customer.name, total)`
- `console.log(req.body)` dans editproduct
- `console.log('[ADMIN AUTH] En-têtes reçus:', request.headers)`

---

### 🟡 MOYENNE-05 : Template email injection

**Fichier :** `backend/src/plugins/mailer.js`

```javascript
Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, data[key]);
});
```

Les données utilisateur sont injectées directement dans le HTML de l'email sans échappement. Possible injection HTML dans les emails.

---

### 🟡 MOYENNE-06 : Port PostgreSQL exposé

**Fichier :** `docker-compose.yml`

```yaml
ports:
  - "5432:5432"
```

Le port PostgreSQL est exposé sur l'hôte en production.

---

## 4. Problèmes fonctionnels

### 🟠 FUNC-01 : Route contact dupliquée et potentiellement cassée

La route `POST /api/send/mess` est définie dans `server.js` ET dans `api.js` (sous préfixe `/api`), ce qui crée `POST /api/api/send/mess` pour la version dans api.js. Confusion sur quelle route est active.

---

### 🟠 FUNC-02 : Typo dans le template email de commande

**Fichier :** `backend/src/routes/api.js`

```javascript
anmount: `${total.toLocaleString()} FCFA`  // typo: "anmount" au lieu de "amount"
```

Le template `order_received.html` utilise `{{amount}}` mais le code passe `anmount`, donc le montant n'apparaîtra pas dans l'email envoyé à l'admin.

---

### 🟠 FUNC-03 : Page editpage.html sans route bien définie

Dans `pages.js` :
```javascript
'editpage': 'editpage.html'  // manque le '/' initial
```

La route est `editpage` sans `/` initial, ce qui peut causer un routage incorrect.

---

### 🟠 FUNC-04 : Table `tokens` utilisée mais jamais créée par migration

Le code insère des tokens admin dans `fastify.db('tokens')` et vérifie via `/verifytoken`, mais aucune migration ne crée la table `tokens`.

---

### 🟠 FUNC-05 : Catégories hardcodées dans le frontend

Le formulaire admin a les catégories en dur :
```html
<option value="1">Bijoux</option>
<option value="2">Vêtements</option>
```

Mais les catégories sont en base de données. Si les IDs changent, le formulaire sera cassé.

---

### 🟠 FUNC-06 : Le checkout crée un compte sans vérification email

Si `createAccount: true`, un compte est créé au checkout sans envoyer de code de vérification, contournant le flux d'inscription normal.

---

### 🟠 FUNC-07 : Le panier n'est pas transactionnel

Le checkout lit le panier de la session, crée la commande, insère les items, mais sans transaction DB. Si une erreur survient à mi-parcours, on peut avoir une commande sans items ou des items orphelins.

---

### 🟠 FUNC-08 : Pas de gestion du stock

Le champ `available_count` existe mais n'est jamais décrémenté lors d'une commande. Pas de vérification de stock suffisant avant checkout.

---

### 🟠 FUNC-09 : Pas de pagination pour les logs admin

La route `/admin/logs` a une pagination mais le frontend charge simplement "Chargement des logs..." sans jamais les afficher réellement (pas d'implémentation visible dans `admin.html`).

---

## 5. Qualité du code & style

### Incohérences de style

| Problème | Exemples |
|----------|----------|
| **Mélange français/anglais** | Commentaires en français, variables en anglais, message `"produit modifié avec succès"` côté API |
| **Indentation incohérente** | Mélange de 2 et 4 espaces dans `admin.js` et `api.js` |
| **Mélange `const/let`** | Utilisation de `let` là où `const` suffit |
| **Mélange arrow functions et functions** | `async (request, reply) =>` vs `async function(adminRoutes)` |
| **Nommage incohérent** | `req/res` vs `request/reply` dans le même fichier |
| **Code mort / commenté** | `// await server.register(require('@fastify/multipart'));` |
| **Debug code en production** | Multiples `console.log` de debug |
| **Variables non professionnelles** | `{oklm: true}`, noms de slug comme `dhdq`, `fuvk` |
| **Commentaires TODO/DEBUG** | `// DEBUG / fix temporaire` jamais nettoyé |

### Duplication de code

1. **Route `/editproduct/:id`** dans `api.js` fait presque la même chose que `PUT /products/:id` dans `admin.js`
2. **Logique de parsing de cookie ANGELE_GUEST** dupliquée dans checkout et orders
3. **Envoi d'email de commande** dupliqué (vers 2 destinataires dans 2 appels séparés)

### Erreurs de logique

- `Math.min(files.length, 3)` limite à 3 fichiers mais l'attribut `max="3"` sur l'input file n'est pas supporté par tous les navigateurs
- Le `switch/case` dans la gestion du panier n'a pas de `default`
- `const { default: fastify } = require('fastify');` dans `api.js` import inutile et incorrect

---

## 6. Performance

### PERF-01 : Cache désactivé sur TOUS les fichiers statiques

**Fichier :** `backend/src/server.js`

```javascript
setHeaders: (res, path, stat) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
}
```

Les images, CSS et JS ne sont jamais mis en cache. Impact majeur sur les performances et la bande passante.

---

### PERF-02 : Pas de compression (gzip/brotli)

Aucun plugin de compression n'est configuré (`@fastify/compress` absent).

---

### PERF-03 : Fichiers JSON générés à chaque modification produit

`updateProductJSON()` réécrit un fichier JSON complet à chaque CRUD produit. Pour un grand catalogue, cela deviendra un goulot d'étranglement.

---

### PERF-04 : Pas d'index sur `products.slug`

La recherche de produit par slug (`WHERE products.slug = ?`) est fréquente mais aucun index n'est défini sur cette colonne.

---

### PERF-05 : Images produit chargées en mémoire entière

```javascript
const buffer = await part.toBuffer();
```

Les fichiers sont entièrement chargés en mémoire avant écriture. Pour de gros fichiers, cela peut causer des problèmes. Le fichier `upload-safe.js` avec streaming existe mais n'est pas utilisé.

---

## 7. DevOps & déploiement

### DEVOPS-01 : Pas de configuration pour différents environnements

Le `knexfile.js` a `development` et `production` identiques. Pas de staging.

---

### DEVOPS-02 : `UPLOAD_DIR` hardcodé avec chemin personnel

```javascript
const uploadDir = path.join(process.env.UPLOAD_DIR || '/home/donald/project-bolt-sb1-jfjrbe5d/project/frontend/uploads', ...);
```

Chemin de développement personnel en fallback.

---

### DEVOPS-03 : Pas de monitoring/alerting

Pas de health checks applicatifs détaillés (DB connectivity, mailer status).  
Le health check est minimal : `{ status: 'ok' }`.

---

### DEVOPS-04 : Pas de logging structuré en production

Utilisation de `console.log` au lieu du logger Pino de Fastify (`request.log.info`).

---

## 8. Tests

### Couverture très insuffisante

Seul fichier : `test/api.test.js` avec **3 tests** :
1. Health check
2. Liste des produits
3. Rejet OTP email invalide

**Manquent totalement :**
- Tests d'authentification utilisateur
- Tests CRUD produits admin
- Tests checkout complet
- Tests de sécurité (injection, XSS, auth bypass)
- Tests de la gestion du panier
- Tests du flux d'inscription/vérification
- Tests du reset mot de passe
- Tests d'upload de fichiers
- Tests de l'envoi d'emails

---

## 9. Frontend

### FRONT-01 : Pas de framework de templating — innerHTML partout

Le rendu dynamique utilise `innerHTML` systématiquement (admin dashboard, recherche, panier), créant des vecteurs XSS multiples.

---

### FRONT-02 : Pas de sanitization des données affichées

Les titres de produits, noms de clients, et descriptions sont insérés dans le DOM sans échappement HTML.

---

### FRONT-03 : Token admin dans localStorage

```javascript
localStorage.setItem('admin_token', response.admin_token);
```

Le token admin est stocké dans `localStorage`, accessible via XSS. `sessionStorage` ou un cookie httpOnly serait plus sûr.

---

### FRONT-04 : Image placeholder depuis un domaine externe

```javascript
: 'https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg';
```

Dépendance à Pexels pour les images par défaut — peut casser si le service est indisponible et viole potentiellement les CSP si non autorisé.

---

### FRONT-05 : Pas de gestion offline/fallback

Pas de service worker, pas de gestion d'erreurs réseau gracieuse pour l'utilisateur final.

---

### FRONT-06 : Accessibilité (a11y) insuffisante

- Les icones (`icon-search`, `icon-user`, `icon-bag`) n'ont pas de texte alternatif
- Pas d'attributs `aria-*` sur les éléments interactifs
- Le modal n'a pas de trap focus
- Pas de skip links pour la navigation au clavier

---

## 10. Base de données

### DB-01 : Table `tokens` manquante

Utilisée dans le code mais aucune migration ne la crée.

---

### DB-02 : Pas d'index sur `products.slug`

Requêtes fréquentes sans index.

---

### DB-03 : Pas de contrainte `ON DELETE CASCADE` sur les relations

- `order_items.order_id` → `orders.id`
- `order_items.product_id` → `products.id`

Si un produit est supprimé, les order_items deviennent orphelins.

---

### DB-04 : Le champ `meta` dans `logs` est potentiellement un objet JS non sérialisé

```javascript
meta: { email, ip: request.ip }
```

Si la colonne `meta` n'est pas de type JSONB, l'insertion pourrait échouer ou stocker `[object Object]`.

---

### DB-05 : Pas de nettoyage automatique des sessions expirées

La table `sessions` a un index sur `expires_at` mais pas de mécanisme de purge.

---

## 11. Recommandations prioritaires

### Immédiat (avant mise en production) 🔴

| # | Action | Fichier(s) |
|---|--------|------------|
| 1 | **Supprimer le secret de session en dur** — crasher si `APP_SECRET` n'est pas défini | `server.js` |
| 2 | **Protéger la route `/api/editproduct/:id`** avec l'authentification admin | `api.js` |
| 3 | **Supprimer la route `/api/verifytoken`** — utiliser `jwt.verify()` côté middleware | `api.js` |
| 4 | **Ne pas stocker les tokens JWT en clair en DB** — hasher ou supprimer | `admin.js` |
| 5 | **Échapper toutes les données dans innerHTML** — créer une fonction `escapeHTML()` | `admin.html`, `components.js` |
| 6 | **Rendre le cookie ANGELE_GUEST httpOnly** et ajouter try/catch sur JSON.parse | `api.js` |
| 7 | **Retirer les emails hardcodés** — utiliser variables d'environnement | `api.js` |
| 8 | **Ajouter la migration pour la table `tokens`** ou supprimer la logique | `migrations/` |
| 9 | **Valider les données dans PUT /products/:id** — whitelist des champs | `admin.js` |
| 10 | **Retirer SVG de la whitelist d'upload** ou le sanitiser | `admin.js` |

### Court terme (prochaines semaines) 🟠

| # | Action |
|---|--------|
| 1 | Ajouter protection CSRF sur les formulaires |
| 2 | Rate limiting strict sur authentification (5 req/min) |
| 3 | Vérifier `is_verified` lors du login |
| 4 | Utiliser des transactions DB pour le checkout |
| 5 | Gérer le stock (décrémenter `available_count`) |
| 6 | Supprimer tout le code de debug (`console.log`) |
| 7 | Corriger le typo `anmount` → `amount` |
| 8 | Résoudre le conflit fastify-multipart vs @fastify/multipart |
| 9 | Ajouter un fichier `.env.example` |
| 10 | Nettoyer les fichiers résiduels (`.orig`, `.bak`, `all.txt`) |

### Moyen terme (prochains mois) 🟡

| # | Action |
|---|--------|
| 1 | Augmenter la couverture de tests (objectif : 70%+) |
| 2 | Activer la compression gzip/brotli |
| 3 | Configurer le cache des assets statiques |
| 4 | Ajouter un index sur `products.slug` |
| 5 | Implémenter un job de purge des OTP/sessions expirées |
| 6 | Améliorer l'accessibilité (ARIA, skip links, focus trap) |
| 7 | Remplacer `localStorage` par cookie httpOnly pour le token admin |
| 8 | Valider les magic bytes des fichiers uploadés |
| 9 | Ajouter un logging structuré avec Pino (niveaux, rotation) |
| 10 | Mettre en place CI/CD avec lint + tests automatiques |

---

## Annexe : Fichiers audités

| Fichier | Statut |
|---------|--------|
| `backend/src/index.js` | ✅ Audité |
| `backend/src/server.js` | ✅ Audité |
| `backend/src/routes/admin.js` | ✅ Audité |
| `backend/src/routes/api.js` | ✅ Audité |
| `backend/src/routes/pages.js` | ✅ Audité |
| `backend/src/plugins/db.js` | ✅ Audité |
| `backend/src/plugins/mailer.js` | ✅ Audité |
| `backend/src/utils/upload-safe.js` | ✅ Audité |
| `backend/migrations/*` | ✅ Audité |
| `backend/seeds/*` | ✅ Audité |
| `frontend/assets/js/api.js` | ✅ Audité |
| `frontend/assets/js/main.js` | ✅ Audité |
| `frontend/assets/js/cart.js` | ✅ Audité |
| `frontend/assets/js/components.js` | ✅ Audité |
| `frontend/assets/js/utils.js` | ✅ Audité |
| `frontend/admin.html` | ✅ Audité |
| `frontend/index.html` | ✅ Audité |
| `frontend/checkout.html` | ✅ Audité |
| `frontend/contact.html` | ✅ Audité |
| `backend/src/templates/*` | ✅ Audité |
| `knexfile.js` | ✅ Audité |
| `package.json` | ✅ Audité |
| `docker-compose.yml` | ✅ Audité |
| `Dockerfile` | ✅ Audité |
| `test/api.test.js` | ✅ Audité |

---

*Fin de l'audit — Angele Shop — 8 mars 2026*
