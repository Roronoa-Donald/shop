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

    return `
        <article class="product-card" data-product-id="${product.id}">
            <div class="product-image">
                <img src="${imageUrl}" alt="${product.title}" loading="lazy">
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
                    <a href="/produit/${product.slug}">${product.title}</a>
                </h3>
                <div class="product-price">${utils.formatPrice(product.price_fcfa)}</div>
                <p class="product-description">${utils.truncateText(product.description || '', 80)}</p>
                <div class="product-footer">
                    <a href="/produit/${product.slug}" class="btn btn-outline">Voir détails</a>
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
                    <p>Aucun résultat pour "${query}"</p>
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
                <div class="search-result-item" onclick="window.location.href='/produit/${product.slug}'">
                    <img src="${imageUrl}" alt="${product.title}" class="search-result-image" loading="lazy">
                    <div class="search-result-info">
                        <h4 class="search-result-title">${product.title}</h4>
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
window.hideLoadingOverlay = hideLoadingOverlay;