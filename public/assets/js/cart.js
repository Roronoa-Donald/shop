// Cart Management System

class CartManager {
    constructor() {
        this.cart = [];
        this.isLoading = false;
        this.listeners = [];
        
        // Initialize cart from server session
        this.init();
        
        // Bind methods
        this.add = this.add.bind(this);
        this.remove = this.remove.bind(this);
        this.update = this.update.bind(this);
        this.clear = this.clear.bind(this);
        this.getTotal = this.getTotal.bind(this);
        this.getCount = this.getCount.bind(this);
    }

    async init() {
        try {
            const response = await cartAPI.get();
            this.cart = response.cart || [];
            this.notifyListeners();
            this.updateCartUI();
        } catch (error) {
            console.error('Failed to initialize cart:', error);
            showToast('Erreur lors du chargement du panier', 'error');
        }
    }

    // Add event listener for cart changes
    addEventListener(callback) {
        this.listeners.push(callback);
    }

    // Remove event listener
    removeEventListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    // Notify all listeners of cart changes
    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.cart);
            } catch (error) {
                console.error('Cart listener error:', error);
            }
        });
    }

    // Add item to cart
       // Add item to cart
       // Add item to cart (serialized + retry on 429)
    async add(productId, variantId = null, quantity = 1) {
        // create a queue promise chain if not present
        if (!this._queue) this._queue = Promise.resolve();

        // enqueue the add operation
        this._queue = this._queue.then(() => this._addWithRetry(productId, variantId, quantity));

        // return the queued promise so callers can await it
        return this._queue;
    }

    // Helper that performs the real network call with retry/backoff
    async _addWithRetry(productId, variantId = null, quantity = 1) {
        // If another operation flagged isLoading, wait a bit (defensive)
        if (this.isLoading) {
            await new Promise(r => setTimeout(r, 120));
        }

        this.isLoading = true;
        const maxRetries = 3;
        let attempt = 0;
        let backoff = 300; // ms initial backoff

        try {
            while (true) {
                try {
                    // Do the add POST (server updates session)
                    await cartAPI.add(productId, variantId, quantity);

                    // After successful add, fetch the enriched cart (with product objects)
                    const full = await cartAPI.get();
                    this.cart = full.cart || [];

                    this.notifyListeners();
                    this.updateCartUI();

                    showToast('Produit ajouté au panier', 'success');
                    return true;
                } catch (err) {
                    // Try to detect 429 status robustly (varies selon implémentation de api client)
                    const status = err?.status || err?.response?.status || (err?.response && err.response.status) || null;

                    if (status === 429 && attempt < maxRetries) {
                        attempt++;

                        // attempt to get Retry-After header if available
                        let retryAfterMs = null;
                        try {
                            // some clients expose headers function, guard with optional chaining
                            const hdr = err?.response?.headers?.get?.('Retry-After') || err?.response?.headers?.['retry-after'];
                            if (hdr) {
                                const sec = parseInt(hdr, 10);
                                if (!isNaN(sec)) retryAfterMs = sec * 1000;
                            }
                        } catch (e) {
                            // ignore header parse errors
                        }

                        const wait = retryAfterMs || backoff;
                        await new Promise(r => setTimeout(r, wait));
                        backoff = backoff * 2; // exponential backoff
                        continue; // retry
                    }

                    // non-retryable or retries exhausted: rethrow to outer catch
                    throw err;
                }
            }
        } catch (error) {
            console.error('Failed to add to cart (after retries):', error);
            showToast(error?.message || "Erreur lors de l'ajout au panier", 'error');
            return false;
        } finally {
            this.isLoading = false;
            // short gap to avoid immediate next op burst
            await new Promise(r => setTimeout(r, 120));
        }
    }


    // Remove item from cart
        // Remove item from cart
    async remove(productId, variantId = null) {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            await cartAPI.remove(productId, variantId);

            // Re-fetch full cart with product details
            const full = await cartAPI.get();
            this.cart = full.cart || [];

            this.notifyListeners();
            this.updateCartUI();

            showToast('Produit supprimé du panier', 'success');
            return true;
        } catch (error) {
            console.error('Failed to remove from cart:', error);
            showToast(error?.message || "Erreur lors de la suppression du panier", 'error');
            return false;
        } finally {
            this.isLoading = false;
        }
    }


    // Update item quantity
       // Update item in cart
    async update(productId, variantId = null, quantity) {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            await cartAPI.update(productId, variantId, quantity);

            // Re-fetch full cart with product objects
            const full = await cartAPI.get();
            this.cart = full.cart || [];

            this.notifyListeners();
            this.updateCartUI();

            return true;
        } catch (error) {
            console.error('Failed to update cart:', error);
            showToast(error?.message || "Erreur lors de la mise à jour du panier", 'error');
            return false;
        } finally {
            this.isLoading = false;
        }
    }


    // Clear entire cart
       // Clear entire cart
    async clear() {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            await cartAPI.clear();

            // Re-fetch to ensure consistent state (server may have additional logic)
            const full = await cartAPI.get();
            this.cart = full.cart || [];

            this.notifyListeners();
            this.updateCartUI();

            showToast('Panier vidé', 'success');
            return true;
        } catch (error) {
            console.error('Failed to clear cart:', error);
            showToast(error?.message || "Erreur lors du vidage du panier", 'error');
            return false;
        } finally {
            this.isLoading = false;
        }
    }


    // Get cart total
    getTotal() {
        return this.cart.reduce((total, item) => {
            if (item.product && item.product.price_fcfa) {
                return total + (item.product.price_fcfa * item.quantity);
            }
            return total;
        }, 0);
    }

    // Get total item count
    getCount() {
        return this.cart.reduce((count, item) => count + item.quantity, 0);
    }

    // Get cart items
    getItems() {
        return [...this.cart];
    }

    // Update cart UI elements
    updateCartUI() {
        this.updateCartCount();
        this.updateCartModal();
    }

    // Update cart count badge
    updateCartCount() {
        const countElement = document.getElementById('cart-count');
        if (countElement) {
            const count = this.getCount();
            countElement.textContent = count;
            countElement.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    // Update cart modal content
    updateCartModal() {
        const cartItems = document.getElementById('cart-items');
        const cartSummary = document.getElementById('cart-summary');
        const cartEmpty = document.getElementById('cart-empty');
        const cartTotal = document.getElementById('cart-total');

        if (!cartItems) return;

        const hasItems = this.cart.length > 0;

        if (cartSummary) cartSummary.style.display = hasItems ? 'block' : 'none';
        if (cartEmpty) cartEmpty.style.display = hasItems ? 'none' : 'block';

        if (hasItems) {
            cartItems.innerHTML = this.cart.map(item => this.createCartItemHTML(item)).join('');
            if (cartTotal) cartTotal.textContent = utils.formatPrice(this.getTotal());
        } else {
            cartItems.innerHTML = '';
        }

        // Attach event listeners to cart item controls
        this.attachCartItemListeners();
    }

    // Create HTML for cart item
    createCartItemHTML(item) {
        const product = item.product || { title: 'Produit inconnu', price_fcfa: 0, images: [] };
        const imageUrl = product.images && product.images.length > 0 
            ? (typeof product.images === 'string' ? JSON.parse(product.images)[0] : product.images[0])
            : 'https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg';

        return `
            <div class="cart-item" data-product-id="${item.productId}" data-variant-id="${item.variantId || ''}">
                <img src="${imageUrl}" alt="${product.title}" class="cart-item-image" loading="lazy">
                <div class="cart-item-info">
                    <h4 class="cart-item-title">${product.title}</h4>
                    <div class="cart-item-price">${utils.formatPrice(product.price_fcfa)}</div>
                    <div class="cart-item-controls">
                        <button class="quantity-btn quantity-minus" type="button">-</button>
                        <input type="number" class="quantity-input" value="${item.quantity}" min="1" max="99">
                        <button class="quantity-btn quantity-plus" type="button">+</button>
                        <button class="cart-item-remove" type="button">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Attach event listeners to cart item controls
    attachCartItemListeners() {
        const cartItems = document.getElementById('cart-items');
        if (!cartItems) return;

        // Quantity buttons and input
        cartItems.addEventListener('click', async (e) => {
            const cartItem = e.target.closest('.cart-item');
            if (!cartItem) return;

            const productId = cartItem.dataset.productId;
            const variantId = cartItem.dataset.variantId || null;
            const quantityInput = cartItem.querySelector('.quantity-input');
            
            if (e.target.classList.contains('quantity-minus')) {
                const newQuantity = Math.max(1, parseInt(quantityInput.value) - 1);
                quantityInput.value = newQuantity;
                await this.update(productId, variantId, newQuantity);
            } else if (e.target.classList.contains('quantity-plus')) {
                const newQuantity = Math.min(99, parseInt(quantityInput.value) + 1);
                quantityInput.value = newQuantity;
                await this.update(productId, variantId, newQuantity);
            } else if (e.target.classList.contains('cart-item-remove')) {
                await this.remove(productId, variantId);
            }
        });

        // Quantity input changes
        cartItems.addEventListener('change', async (e) => {
            if (e.target.classList.contains('quantity-input')) {
                const cartItem = e.target.closest('.cart-item');
                const productId = cartItem.dataset.productId;
                const variantId = cartItem.dataset.variantId || null;
                const quantity = Math.max(1, Math.min(99, parseInt(e.target.value) || 1));
                
                e.target.value = quantity;
                await this.update(productId, variantId, quantity);
            }
        });
    }

    // Check if product is in cart
    hasProduct(productId, variantId = null) {
        return this.cart.some(item => 
            item.productId === productId && 
            (item.variantId || null) === variantId
        );
    }

    // Get product quantity in cart
    getProductQuantity(productId, variantId = null) {
        const item = this.cart.find(item => 
            item.productId === productId && 
            (item.variantId || null) === variantId
        );
        return item ? item.quantity : 0;
    }
}

// Create global cart instance
const cart = new CartManager();

// Export for use in other files
window.cart = cart;
window.CartManager = CartManager;