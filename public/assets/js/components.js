// UI Components and Interactions

// Toast Notifications
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = utils.createElement('div', {
        class: `toast ${type}`,
        'data-toast-id': utils.generateId()
    });

    toast.innerHTML = `
        <div class="toast-icon"></div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" type="button">&times;</button>
    `;

    toastContainer.appendChild(toast);

    // Show toast
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto remove
    const autoRemoveTimer = setTimeout(() => {
        removeToast(toast);
    }, duration);

    // Manual close
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        clearTimeout(autoRemoveTimer);
        removeToast(toast);
    });

    return toast;
}

function removeToast(toast) {
    if (!toast.parentNode) return;
    
    toast.classList.remove('show');
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

// Modal Management
class Modal {
    constructor(element) {
        this.element = element;
        this.overlay = element.querySelector('.modal-overlay');
        this.content = element.querySelector('.modal-content');
        this.closeButtons = element.querySelectorAll('.modal-close');
        
        this.init();
    }

    init() {
        // Close on overlay click
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.close());
        }

        // Close on close button click
        this.closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    }

    open() {
        this.element.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus first focusable element
        const focusable = this.content.querySelector('input, button, textarea, select');
        if (focusable) {
            setTimeout(() => focusable.focus(), 100);
        }
    }

    close() {
        this.element.classList.remove('active');
        document.body.style.overflow = '';
    }

    isOpen() {
        return this.element.classList.contains('active');
    }
}

// Initialize modals
function initModals() {
    const modals = {};
    
    document.querySelectorAll('.modal').forEach(modalElement => {
        const modal = new Modal(modalElement);
        modals[modalElement.id] = modal;
    });

    return modals;
}

// Product Card Component
function createProductCard(product) {
    const imageUrl = product.images && product.images.length > 0 
        ? (typeof product.images === 'string' ? JSON.parse(product.images)[0] : product.images[0])
        : 'https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg';

    const isOutOfStock = product.available_count === 0;
    const badge = isOutOfStock ? '<div class="product-badge">Rupture</div>' : '';

    const esc = utils.escapeHTML;
    return `
        <article class="product-card" data-product-id="${product.id}">
            <div class="product-image">
                <img src="${esc(imageUrl)}" alt="${esc(product.title)}" loading="lazy">
                ${badge}
                <div class="product-actions">
                    <button class="product-action-btn wishlist-btn" title="Ajouter aux favoris">
                        <i class="icon-heart"></i>
                    </button>
                    <button class="product-action-btn quick-view-btn" title="Aperçu rapide">
                        <i class="icon-eye"></i>
                    </button>
                    <button class="product-action-btn add-to-cart-btn" title="Ajouter au panier" ${isOutOfStock ? 'disabled' : ''}>
                        <i class="icon-plus"></i>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-title">
                    <a href="/produit/${encodeURI(product.slug)}">${esc(product.title)}</a>
                </h3>
                <div class="product-price">${utils.formatPrice(product.price_fcfa)}</div>
                <p class="product-description">${esc(utils.truncateText(product.description || '', 80))}</p>
                <div class="product-footer">
                    <a href="/produit/${encodeURI(product.slug)}" class="btn btn-outline">Voir détails</a>
                    ${!isOutOfStock ? `<button class="btn btn-primary add-to-cart-main" data-product-id="${product.id}">Ajouter</button>` : '<button class="btn btn-primary" disabled>Indisponible</button>'}
                </div>
            </div>
        </article>
    `;
}

// Search Component
class SearchComponent {
    constructor(searchInput, resultsContainer) {
        this.searchInput = searchInput;
        this.resultsContainer = resultsContainer;
        this.currentQuery = '';
        this.searchTimeout = null;
        
        this.init();
    }

    init() {
        this.searchInput.addEventListener('input', utils.debounce((e) => {
            this.search(e.target.value.trim());
        }, 300));

        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = e.target.value.trim();
                if (query) {
                    window.location.href = `/boutique?q=${encodeURIComponent(query)}`;
                }
            }
        });
    }

    async search(query) {
        if (query.length < 2) {
            this.clearResults();
            return;
        }

        if (query === this.currentQuery) return;
        this.currentQuery = query;

        try {
            this.showLoading();
            const response = await productAPI.search(query, { pageSize: 5 });
            this.displayResults(response.products || [], query);
        } catch (error) {
            console.error('Search error:', error);
            this.showError();
        }
    }

    displayResults(products, query) {
        if (products.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="search-no-results">
                    <p>Aucun résultat pour "${utils.escapeHTML(query)}"</p>
                    <a href="/boutique?q=${encodeURIComponent(query)}" class="btn btn-outline">Voir tous les résultats</a>
                </div>
            `;
            return;
        }

        const resultHTML = products.map(product => {
            const imageUrl = product.images && product.images.length > 0 
                ? (typeof product.images === 'string' ? JSON.parse(product.images)[0] : product.images[0])
                : 'https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg';

            return `
                <div class="search-result-item" onclick="window.location.href='/produit/${encodeURI(product.slug)}'">
                    <img src="${utils.escapeHTML(imageUrl)}" alt="${utils.escapeHTML(product.title)}" class="search-result-image" loading="lazy">
                    <div class="search-result-info">
                        <h4 class="search-result-title">${utils.escapeHTML(product.title)}</h4>
                        <div class="search-result-price">${utils.formatPrice(product.price_fcfa)}</div>
                    </div>
                </div>
            `;
        }).join('');

        this.resultsContainer.innerHTML = `
            ${resultHTML}
            <div class="search-result-footer">
                <a href="/boutique?q=${encodeURIComponent(query)}" class="btn btn-primary">Voir tous les résultats</a>
            </div>
        `;
    }

    showLoading() {
        this.resultsContainer.innerHTML = `
            <div class="search-loading">
                <div class="loading"></div>
                <p>Recherche en cours...</p>
            </div>
        `;
    }

    showError() {
        this.resultsContainer.innerHTML = `
            <div class="search-error">
                <p>Erreur lors de la recherche</p>
            </div>
        `;
    }

    clearResults() {
        this.resultsContainer.innerHTML = '';
        this.currentQuery = '';
    }
}

// Lazy Loading Images
function initLazyLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    } else {
        // Fallback for browsers without IntersectionObserver
        document.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.dataset.src;
            img.classList.remove('lazy');
        });
    }
}

// Smooth scroll navigation
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                utils.scrollToElement(target);
            }
        });
    });
}

// Header scroll behavior
function initHeaderScroll() {
    const header = document.getElementById('header');
    if (!header) return;

    let lastScrollTop = 0;
    let scrolled = false;

    window.addEventListener('scroll', utils.throttle(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Add scrolled class for backdrop effect
        if (scrollTop > 50 && !scrolled) {
            header.classList.add('scrolled');
            scrolled = true;
            document.querySelectorAll(".nav-link").forEach(link => {
                link.style.color = "black";
            });
        } else if (scrollTop <= 50 && scrolled) {
            header.classList.remove('scrolled');
            scrolled = false;
            document.querySelectorAll(".nav-link").forEach(link => {
                link.style.color = "white";
            });
        }

        // Hide/show header on scroll (mobile)
        if (window.innerWidth <= 768) {
            if (scrollTop > lastScrollTop && scrollTop > 200) {
                // Scrolling down
                header.style.transform = 'translateY(-100%)';
            } else {
                // Scrolling up
                header.style.transform = 'translateY(0)';
            }
        }

        lastScrollTop = scrollTop;
    }, 100));
}

// Form validation
function validateForm(form) {
    const errors = [];
    
    form.querySelectorAll('[required]').forEach(field => {
        if (!field.value.trim()) {
            errors.push(`Le champ ${field.getAttribute('placeholder') || field.name} est obligatoire`);
            field.classList.add('error');
        } else {
            field.classList.remove('error');
        }
    });

    // Email validation
    form.querySelectorAll('[type="email"]').forEach(field => {
        if (field.value && !utils.isValidEmail(field.value)) {
            errors.push('Adresse email invalide');
            field.classList.add('error');
        }
    });

    // Phone validation
    form.querySelectorAll('[type="tel"]').forEach(field => {
        if (field.value && !utils.isValidPhone(field.value)) {
            errors.push('Numéro de téléphone invalide');
            field.classList.add('error');
        }
    });

    return errors;
}

// Loading overlay
function showLoadingOverlay() {
    const overlay = utils.createElement('div', {
        class: 'loading-overlay',
        id: 'loading-overlay'
    }, `
        <div class="loading loading-large"></div>
    `);
    
    document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// WhatsApp Floating Button Component
function initWhatsAppButton() {
    // WhatsApp number from centralized config (utils.js)
    const whatsappNumber = typeof getWhatsAppNumber === 'function' ? getWhatsAppNumber() : '22896272034';
    const message = encodeURIComponent('Bonjour ! Je souhaite des informations sur vos produits.');
    
    // Check if button already exists
    if (document.querySelector('.whatsapp-float')) return;
    
    const whatsappButton = document.createElement('a');
    whatsappButton.className = 'whatsapp-float';
    whatsappButton.href = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${message}`;
    whatsappButton.target = '_blank';
    whatsappButton.rel = 'noopener noreferrer';
    whatsappButton.setAttribute('aria-label', 'Contactez-nous sur WhatsApp');
    
    whatsappButton.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span class="tooltip">Besoin d'aide ? Contactez-nous !</span>
    `;
    
    document.body.appendChild(whatsappButton);
}

// Phone bar component (top of page)
function initPhoneBar() {
    const phoneNumber = typeof getPhoneNumber === 'function' ? getPhoneNumber() : '+22896272034';
    
    // Check if already exists
    if (document.querySelector('.phone-bar')) return;
    
    const phoneBar = document.createElement('div');
    phoneBar.className = 'phone-bar';
    phoneBar.innerHTML = `
        📞 Appelez-nous : <a href="tel:${phoneNumber}">${phoneNumber}</a> | 
        Livraison disponible partout au Togo
    `;
    
    // Insert at beginning of body
    document.body.insertBefore(phoneBar, document.body.firstChild);
    
    // Adjust header position if exists (add margin-top to compensate for phone bar)
    const header = document.querySelector('.header');
    if (header) {
        header.style.top = '33px';
    }
    
    // Adjust main content offset
    const main = document.querySelector('.main');
    if (main) {
        main.style.paddingTop = 'calc(var(--spacing-xxxl) + 33px)';
    }
}

// Favorite button component for product cards
function createFavoriteButton(productId, isFavorite = false) {
    const btn = document.createElement('button');
    btn.className = `favorite-btn ${isFavorite ? 'active' : ''}`;
    btn.setAttribute('data-product-id', productId);
    btn.setAttribute('aria-label', isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris');
    
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
    `;
    
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isActive = btn.classList.contains('active');
        
        try {
            if (isActive) {
                await window.favoriteAPI?.remove(productId);
                btn.classList.remove('active');
                btn.setAttribute('aria-label', 'Ajouter aux favoris');
                showToast('Retiré des favoris', 'info');
            } else {
                await window.favoriteAPI?.add(productId);
                btn.classList.add('active');
                btn.setAttribute('aria-label', 'Retirer des favoris');
                showToast('Ajouté aux favoris ❤️', 'success');
            }
        } catch (error) {
            showToast('Connectez-vous pour ajouter aux favoris', 'info');
        }
    });
    
    return btn;
}

// Animation on scroll utility
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    
    if (!animatedElements.length) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fadeInUp');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    animatedElements.forEach(el => observer.observe(el));
}

// Initialize premium components
function initPremiumComponents() {
    initWhatsAppButton();
    initPhoneBar();
    initScrollAnimations();
}

// Auto-init premium components when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPremiumComponents);
} else {
    initPremiumComponents();
}

// Export functions
window.showToast = showToast;
window.Modal = Modal;
window.initModals = initModals;
window.createProductCard = createProductCard;
window.SearchComponent = SearchComponent;
window.initLazyLoading = initLazyLoading;
window.initSmoothScroll = initSmoothScroll;
window.initHeaderScroll = initHeaderScroll;
window.validateForm = validateForm;
window.showLoadingOverlay = showLoadingOverlay;
window.initWhatsAppButton = initWhatsAppButton;
window.initPhoneBar = initPhoneBar;
window.createFavoriteButton = createFavoriteButton;
window.initScrollAnimations = initScrollAnimations;
window.hideLoadingOverlay = hideLoadingOverlay;