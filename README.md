# Angele Shop - Boutique de Luxe E-commerce

Une application e-commerce complète et élégante pour la vente de produits de luxe (bijoux, vêtements, accessoires, chaussures) avec interface d'administration sécurisée.

## 🌟 Fonctionnalités

### Frontend (Vanilla HTML/CSS/JS)
- **Design luxueux** avec palette or et noir, animations fluides
- **Responsive mobile-first** avec breakpoints optimisés
- **Catalogue produits** avec filtres avancés et recherche
- **Panier intelligent** avec gestion de session
- **Checkout invité** avec option de création de compte
- **Suivi de commandes** pour utilisateurs connectés et invités (12h)

### Backend (Fastify + PostgreSQL)
- **API REST complète** avec validation des données
- **Authentification utilisateur** par sessions HTTP-only
- **Authentification admin** par OTP email (tokens 10min)
- **Gestion des images** avec protection contre directory traversal
- **Système de logs** complet pour audit
- **Rate limiting** et sécurité renforcée

### Base de données (PostgreSQL + Knex)
- **Schema complet** avec relations optimisées
- **Migrations versionnées** pour déploiement sûr
- **Seeders** avec 12 produits d'exemple
- **Index performants** pour recherche et filtrage

## 🚀 Installation

### Prérequis
- Node.js 18+ LTS
- PostgreSQL 12+
- npm ou yarn

### Installation locale

1. **Cloner le projet**
```bash
git clone <repository-url>
cd angele-shop
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration de la base de données**
```bash
# Créer la base de données PostgreSQL
createdb angele_shop

# Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos paramètres de base de données
```

4. **Migrations et données d'exemple**
```bash
# Exécuter les migrations
npm run migrate

# Charger les données d'exemple
npm run seed
```

5. **Démarrage en développement**
```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

## 📁 Structure du projet

```
angele-shop/
├── frontend/                 # Interface utilisateur
│   ├── assets/
│   │   ├── css/             # Styles CSS modulaires
│   │   ├── js/              # JavaScript vanilla
│   │   └── images/          # Assets statiques
│   ├── uploads/             # Images produits uploadées
│   └── *.html               # Pages HTML
├── backend/
│   ├── src/
│   │   ├── routes/          # Routes API
│   │   ├── plugins/         # Plugins Fastify
│   │   └── templates/       # Templates email
│   ├── migrations/          # Migrations base de données
│   └── seeds/               # Données d'exemple
├── .env.example             # Variables d'environnement
├── knexfile.js             # Configuration Knex
└── package.json
```

## 🔐 Authentification

### Utilisateurs
- **Sessions cookie** HTTP-only sécurisées
- **Checkout invité** autorisé avec suivi 12h
- **Création de compte** optionnelle lors du checkout

### Administrateurs
- **OTP par email** pour chaque connexion
- **Tokens courts** (10 minutes) pour sécurité maximale
- **Pas de cookies** - Authorization Bearer uniquement

## 🛒 Fonctionnalités E-commerce

### Gestion des produits
- **Catégories** : Bijoux, Vêtements, Accessoires, Chaussures
- **Variants** : Tailles, couleurs, stock par variant
- **Images multiples** (max 3 par produit)
- **Recherche avancée** avec filtres prix, catégorie, etc.

### Commandes
- **Checkout invité** ou avec compte
- **Statuts** : pending, paid, processing, shipped, delivered, cancelled, returned
- **Suivi** : Utilisateurs connectés (permanent) + invités (12h cookie)
- **Emails automatiques** de confirmation

### Paiement
- **Placeholder** intégré - prêt pour intégration CinetPay
- **Commandes pending** créées avec instructions de paiement
- **Extensible** pour tout système de paiement

## 🔧 API Endpoints

### Public
- `GET /api/products` - Liste des produits avec filtres
- `GET /api/products/:slug` - Détail produit
- `POST /api/cart` - Gestion panier
- `POST /api/checkout` - Finaliser commande

### Authentification
- `POST /api/auth/login` - Connexion utilisateur
- `GET /api/account` - Informations compte

### Administration (OTP protégé)
- `POST /api/admin/request-otp` - Demander code OTP
- `POST /api/admin/verify-otp` - Vérifier OTP
- `GET /api/admin/products` - Gestion produits
- `GET /api/admin/orders` - Gestion commandes
- `GET /api/admin/logs` - Logs système

## 🎨 Design & UX

### Palette de couleurs
- **Primaire** : Or (#D4AF37)
- **Secondaire** : Noir profond (#1a1a1a)
- **Accent** : Blanc cassé (#f8f9fa)
- **États** : Success, Warning, Error avec nuances

### Typographie
- **Titres** : Playfair Display (serif élégant)
- **Corps** : Source Sans Pro (sans-serif lisible)
- **Poids** : 300, 400, 600, 700

### Animations
- **Transitions fluides** 0.2s-0.5s
- **Hover states** sur tous les éléments interactifs
- **Loading states** avec spinners élégants
- **Micro-interactions** pour feedback utilisateur

## 🔒 Sécurité

### Mesures implémentées
- **CORS strict** limité au domaine frontend
- **Rate limiting** configurable
- **Validation d'entrée** avec schémas Fastify
- **Protection CSRF** via sessions
- **Sanitisation** des sorties HTML
- **Headers sécurisés** via Helmet
- **Hashage bcrypt** pour mots de passe
- **Tokens JWT** courts pour admin

### Images et uploads
- **Validation des chemins** pour éviter directory traversal
- **Types de fichiers** restreints aux images
- **Taille limitée** et validation côté serveur
- **Stockage sécurisé** dans dossiers dédiés

## 📧 Système d'emails

### Templates disponibles
- **admin_login_code** - Code OTP administrateur
- **order_received** - Confirmation de commande
- **payment_placeholder** - Instructions de paiement

### Configuration SMTP
Variables dans `.env` :
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
EMAIL_FROM="Angele Shop <admin@angele-shop.local>"
```

## 🐳 Déploiement Docker

### Dockerfile inclus
```bash
# Build de l'image
docker build -t angele-shop .

# Lancement avec docker-compose
docker-compose up -d
```

### Variables d'environnement production
⚠️ **Important pour la production** :
- Changer `APP_SECRET` par une clé forte
- Désactiver `SEED_ADMIN=false`
- Configurer SMTP réel
- Utiliser base de données externe
- Activer SSL/HTTPS

## 🧪 Tests

### Tests basiques inclus
```bash
npm test
```

Tests couverts :
- Health check API
- Endpoints produits
- Flow d'authentification admin OTP
- Validation des données

## 📊 Monitoring & Logs

### Logs en base de données
- **Niveaux** : info, warn, error
- **Métadonnées** JSON pour contexte
- **Interface admin** pour consultation
- **Rotation** automatique recommandée

### Métriques disponibles
- Nombre de produits
- Commandes par statut
- Chiffre d'affaires
- Logs d'activité admin

## 🔄 Maintenance

### Commandes utiles
```bash
# Reset complet de la base
npm run reset-db

# Rollback migration
npm run migrate:rollback

# Logs en temps réel
tail -f backend/logs/app.log
```

### Sauvegarde recommandée
- **Base de données** : pg_dump quotidien
- **Images uploads** : sync vers stockage externe
- **Logs** : archivage mensuel

## 🚨 Troubleshooting

### Problèmes courants

**Port déjà utilisé**
```bash
lsof -ti:3000 | xargs kill -9
```

**Erreur de connexion DB**
- Vérifier PostgreSQL démarré
- Contrôler variables `.env`
- Tester connexion : `psql -h localhost -U postgres angele_shop`

**Images non affichées**
- Vérifier permissions dossier `uploads/`
- Contrôler configuration Fastify static
- Tester URL directe : `http://localhost:3000/uploads/bijoux/test/1.jpg`

**OTP non reçu**
- Vérifier configuration SMTP
- Contrôler logs serveur
- Tester avec service email de test

## 🤝 Contribution

### Standards de code
- **ESLint** pour JavaScript
- **Prettier** pour formatage
- **Commits conventionnels**
- **Tests** requis pour nouvelles fonctionnalités

### Workflow
1. Fork du projet
2. Branche feature : `git checkout -b feature/nouvelle-fonctionnalite`
3. Commit : `git commit -m 'feat: ajouter nouvelle fonctionnalité'`
4. Push : `git push origin feature/nouvelle-fonctionnalite`
5. Pull Request

## 📄 Licence

MIT License - voir fichier `LICENSE` pour détails.

## 📞 Support

- **Email** : contact@angele-shop.com
- **Documentation** : Ce README
- **Issues** : GitHub Issues pour bugs et demandes

---

**Angele Shop** - L'élégance à l'état pur ✨