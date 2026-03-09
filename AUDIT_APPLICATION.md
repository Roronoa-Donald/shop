# AUDIT COMPLET - Angele Shop
**Date:** 9 Mars 2026  
**Version:** 2.0

---

## ✅ CORRECTIONS EFFECTUÉES

Les problèmes suivants ont été **corrigés automatiquement** :

| # | Problème | Statut |
|---|----------|--------|
| 1 | CSP bloque Cloudinary | ✅ Corrigé |
| 2 | Template verify_register.txt manquant | ✅ Créé |
| 3 | Template reset_request.txt manquant | ✅ Créé |
| 4 | Double bouton "Ajouter au panier" | ✅ Corrigé |
| 5 | Variable `bool` inutilisée | ✅ Supprimée |
| 6 | Console.log de debug | ✅ Supprimés |

---

## 🔴 PROBLÈMES CRITIQUES (À corriger immédiatement)

### 1. CSP bloque les images Cloudinary ❌
**Fichier:** `backend/src/server.js` (lignes 32-40)

**Problème:**  
La politique CSP (Content Security Policy) n'autorise que `images.pexels.com` pour les images. Les images Cloudinary sont donc **bloquées par le navigateur**.

**Code actuel:**
```javascript
imgSrc: ["'self'", 'data:', 'blob:', 'https://images.pexels.com'],
```

**Solution:**
```javascript
imgSrc: ["'self'", 'data:', 'blob:', 'https://images.pexels.com', 'https://res.cloudinary.com'],
```

**Impact:** Les images des produits ne s'affichent pas !

---

### 2. Templates email manquants ❌
**Fichiers manquants:**
- `backend/src/templates/verify_register.txt`
- `backend/src/templates/reset_request.txt`

**Problème:**  
Le mailer (`plugins/mailer.js`) tente de lire les versions `.txt` des templates. Si elles n'existent pas, l'envoi d'email échoue silencieusement.

**Solution:** Créer les fichiers texte correspondants :

**verify_register.txt:**
```
Bonjour {{name}},

Votre code de vérification Angele Shop est : {{code}}

Ce code expire dans 15 minutes.

Si vous n'avez pas demandé ce code, ignorez cet email.

Angele Shop
```

**reset_request.txt:**
```
Bonjour {{name}},

Votre code de réinitialisation de mot de passe est : {{code}}

Ce code expire dans 15 minutes.

Si vous n'avez pas demandé ce code, ignorez cet email.

Angele Shop
```

---

### 3. Double bouton "Ajouter au panier" sur la page produit ⚠️
**Fichier:** `frontend/produit.html` (lignes ~540-550)

**Problème:**  
Le bouton "Ajouter au panier" est dupliqué dans le HTML généré :
```javascript
<button class="btn btn-primary add-to-cart-btn" id="add-to-cart">Ajouter au panier</button>
<div class="product-actions">
    <button class="btn btn-primary add-to-cart-btn" id="add-to-cart">Ajouter au panier</button>
    ...
</div>
```

Deux éléments avec le même `id="add-to-cart"` = comportement imprévisible.

**Solution:** Supprimer le premier bouton ou fusionner le HTML.

---

## 🟠 PROBLÈMES IMPORTANTS (À corriger rapidement)

### 4. Panier : Conflit d'événements ⚠️
**Fichiers:**  
- `frontend/assets/js/main.js` (lignes 208-223)  
- `frontend/produit.html` (ligne ~742)

**Problème:**  
Sur la page produit :
1. `main.js` attache un listener global sur `.add-to-cart-btn`
2. `ProductPage.attachEventListeners()` attache un listener spécifique sur `#add-to-cart`

Les deux listeners peuvent se déclencher, causant potentiellement un double ajout au panier.

**Solution:** Dans `ProductPage.attachEventListeners()`, ajouter `e.stopPropagation()` :
```javascript
addToCartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    this.addToCart();
});
```

---

### 5. Gestion du stock incorrect ⚠️
**Fichier:** `frontend/produit.html` 

**Problème:**  
Variable `bool` déclarée mais jamais utilisée dans `getStockStatusHTML()`:
```javascript
let bool=false
// ...
if (count <= 5) {
    bool=true  // défini mais jamais lu
```

**Solution:** Supprimer cette variable inutilisée ou l'utiliser correctement.

---

### 6. Variables d'environnement Cloudinary sur Vercel ⚠️
**Impact:** Les uploads depuis l'admin ne fonctionneront pas sur Vercel sans ces variables.

**Variables requises sur Vercel Dashboard → Settings → Environment Variables:**
```
CLOUDINARY_CLOUD_NAME=dgh5ss8lp
CLOUDINARY_API_KEY=981923369451358
CLOUDINARY_API_SECRET=Jgt9tWgEXruYNlTxcnzz-AvENEk
```

---

### 7. Multipart désactivé sur Vercel ⚠️
**Fichier:** `backend/src/server.js` (lignes 14-18)

**Code:**
```javascript
if (!isVercel) {
    await server.register(require('@fastify/multipart'), { ... });
}
```

**Impact:** L'upload d'images depuis l'admin **ne fonctionne pas sur Vercel** car le plugin multipart est désactivé.

**Solution:** Sur Vercel, l'upload direct vers Cloudinary depuis le frontend (avec un signed upload preset) est nécessaire. Alternative : activer multipart même sur Vercel mais gérer les buffers en mémoire uniquement.

---

## 🟡 PROBLÈMES MINEURS (À corriger plus tard)

### 8. Session non persistante
**Problème:**  
Les sessions sont stockées en mémoire (comportement par défaut de `@fastify/session`). Elles sont perdues à chaque redémarrage du serveur.

**Impact:** Le panier des utilisateurs est vidé quand le serveur redémarre.

**Solution:** Utiliser un store Redis ou PostgreSQL pour les sessions :
```javascript
await server.register(require('@fastify/session'), {
    // ... 
    store: new RedisStore({ client: redisClient })
});
```

---

### 9. Rate limiting trop strict pour le panier
**Fichier:** `backend/src/server.js`

**Problème:**  
Le rate limit global (100 req/min) peut bloquer les utilisateurs qui ajoutent plusieurs produits rapidement au panier.

**Solution:** Exclure les routes `/api/cart` du rate limiting ou augmenter la limite.

---

### 10. Wishlist non implémentée
**Fichier:** `frontend/produit.html` (ligne ~747)

**Code:**
```javascript
wishlistBtn.addEventListener('click', () => {
    showToast('Fonctionnalité à venir', 'info');
});
```

**Impact:** Le bouton wishlist ne fait rien actuellement.

---

### 11. Favicon manquant
**Fichier:** Toutes les pages HTML

**Référence:** `<link rel="icon" type="image/x-icon" href="/assets/images/favicon.ico">`

**Vérifier:** Le fichier `frontend/assets/images/favicon.ico` existe-t-il ?

---

### 12. Paiement non implémenté
**Fichier:** `backend/src/routes/api.js` (checkout route)

**Retour actuel:**
```javascript
return {
    orderId,
    total,
    payment_instructions: 'Le paiement sera configuré prochainement...',
    payment_placeholder_url: `/compte#order-${orderId}`
};
```

**Impact:** Les clients ne peuvent pas payer en ligne.

---

### 13. Copyright année statique
**Fichiers:** Tous les footers HTML

**Code:** `© 2024 Angele Shop`

**Solution:** Utiliser JavaScript pour l'année dynamique ou mettre à jour manuellement.

---

## 📋 CHECKLIST POUR DÉPLOIEMENT

### Avant de déployer sur Vercel :

- [ ] **CRITIQUE:** Corriger la CSP pour autoriser Cloudinary
- [ ] **CRITIQUE:** Créer `verify_register.txt` et `reset_request.txt`
- [ ] **CRITIQUE:** Ajouter les variables Cloudinary sur Vercel
- [ ] Supprimer le bouton "Ajouter au panier" dupliqué
- [ ] Corriger le conflit d'événements du panier
- [ ] Tester l'envoi d'emails (inscription, reset password)
- [ ] Tester le checkout complet
- [ ] Vérifier que les images Cloudinary s'affichent

---

## 🔧 CORRECTIONS RAPIDES À APPLIQUER

### Correction 1 : CSP pour Cloudinary
```javascript
// backend/src/server.js - ligne 35
imgSrc: ["'self'", 'data:', 'blob:', 'https://images.pexels.com', 'https://res.cloudinary.com'],
```

### Correction 2 : Templates texte manquants
Créer les fichiers manquants (voir section 2).

### Correction 3 : Double bouton produit
Dans `frontend/produit.html`, supprimer la ligne ~545 (premier bouton add-to-cart).

---

## 📊 RÉSUMÉ

| Catégorie | Nombre | Statut |
|-----------|--------|--------|
| 🔴 Critiques | 3 | À faire maintenant |
| 🟠 Importants | 4 | À faire rapidement |
| 🟡 Mineurs | 6 | À planifier |

**Total : 13 problèmes identifiés**

---

## 🚀 ORDRE DE PRIORITÉ DES CORRECTIONS

1. ❌ CSP Cloudinary (images ne s'affichent pas)
2. ❌ Templates email manquants (inscription échoue)
3. ❌ Variables Vercel (déploiement échoue)
4. ⚠️ Double bouton panier (UX confuse)
5. ⚠️ Conflit événements panier (double ajout potentiel)
6. ⚠️ Multipart Vercel (uploads admin)
7. Les autres...
