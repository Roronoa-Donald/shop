// Main Application Logic

class AngeleShopApp {
    constructor() {
        this.modals = {};
        this.searchComponent = null;
        
        this.init();
    }

    async init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeApp());
        } else {
            this.initializeApp();
        }
    }

    initializeApp() {
        console.log('Angele Shop - Initializing...');
        
        // Initialize core components
        this.initNavigation();
        this.initModals();
        this.initSearch();
        this.initUI();
        this.initCartEvents();
        
        // Initialize page-specific features
        this.initPageFeatures();
        
        console.log('Angele Shop - Ready!');
    }

    initNavigation() {
        // Mobile navigation toggle
        const navToggle = document.getElementById('nav-toggle');
        const navMenu = document.getElementById('nav-menu');

        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
                
                // Animate hamburger lines
                const lines = navToggle.querySelectorAll('.nav-toggle-line');
                lines.forEach((line, index) => {
                    if (navToggle.classList.contains('active')) {
                        if (index === 0) line.style.transform = 'rotate(45deg) translate(5px, 5px)';
                        if (index === 1) line.style.opacity = '0';
                        if (index === 2) line.style.transform = 'rotate(-45deg) translate(7px, -6px)';
                    } else {
                        line.style.transform = '';
                        line.style.opacity = '';
                    }
                });
            });

            // Close mobile menu when clicking on links
            navMenu.addEventListener('click', (e) => {
                if (e.target.classList.contains('nav-link')) {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                }
            });
        }

        // Header scroll effects
        initHeaderScroll();

        // Smooth scrolling for anchor links
        initSmoothScroll();
    }

    initModals() {
        this.modals = initModals();

        // Cart modal
        const cartBtn = document.getElementById('cart-btn');
        if (cartBtn && this.modals['cart-modal']) {
            cartBtn.addEventListener('click', () => {
                this.modals['cart-modal'].open();
            });
        }

        // Search modal
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn && this.modals['search-modal']) {
            searchBtn.addEventListener('click', () => {
                this.modals['search-modal'].open();
            });
        }
    }

    initSearch() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');

        if (searchInput && searchResults) {
            this.searchComponent = new SearchComponent(searchInput, searchResults);
        }
    }

    initUI() {
        // Initialize lazy loading
        initLazyLoading();

        // Initialize tooltips/popovers if needed
        this.initTooltips();

        // Form enhancements
        this.enhanceForms();

        // Intersection observer for animations
        this.initAnimations();
    }

    initTooltips() {
        // Simple tooltip implementation
        document.querySelectorAll('[title]').forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                const tooltip = utils.createElement('div', {
                    class: 'tooltip',
                    style: {
                        position: 'absolute',
                        background: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        pointerEvents: 'none',
                        zIndex: '9999'
                    }
                }, e.target.title);

                document.body.appendChild(tooltip);
                
                const rect = e.target.getBoundingClientRect();
                tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + 'px';
                tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';

                e.target.title = ''; // Remove title to prevent browser tooltip
                e.target._originalTitle = tooltip.textContent;
            });

            element.addEventListener('mouseleave', (e) => {
                const tooltip = document.querySelector('.tooltip');
                if (tooltip) tooltip.remove();
                
                if (e.target._originalTitle) {
                    e.target.title = e.target._originalTitle;
                }
            });
        });
    }

    enhanceForms() {
        // Add floating label effect
        document.querySelectorAll('.form-input').forEach(input => {
            const handleInput = () => {
                if (input.value) {
                    input.classList.add('has-value');
                } else {
                    input.classList.remove('has-value');
                }
            };

            input.addEventListener('input', handleInput);
            input.addEventListener('blur', handleInput);
            handleInput(); // Initial check
        });

        // Form validation on submit
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => {
                const errors = validateForm(form);
                if (errors.length > 0) {
                    e.preventDefault();
                    showToast(errors[0], 'error');
                }
            });
        });
    }

    initAnimations() {
        // Fade in animation for elements
        if ('IntersectionObserver' in window) {
            const animationObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-in');
                        animationObserver.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            });

            document.querySelectorAll('.animate-on-scroll').forEach(el => {
                animationObserver.observe(el);
            });
        }
    }

    initCartEvents() {
        // Add to cart buttons
        document.addEventListener('click', async (e) => {
            if (e.target.matches('.add-to-cart-btn, .add-to-cart-main')) {
                e.preventDefault();
                
                const productId = e.target.dataset.productId || 
                                 e.target.closest('[data-product-id]')?.dataset.productId;
                
                if (productId && !e.target.disabled) {
                    const success = await cart.add(productId);
                    if (success && this.modals['cart-modal']) {
                        // Optionally open cart modal after adding
                        setTimeout(() => this.modals['cart-modal'].open(), 500);
                    }
                }
            }
        });

        // Cart count update listener
        cart.addEventListener((cartItems) => {
            console.log('Cart updated:', cartItems.length, 'items');
        });
    }

    initPageFeatures() {
        const page = document.body.dataset.page || this.getCurrentPage();
        
        switch (page) {
            case 'home':
                this.initHomePage();
                break;
            case 'boutique':
                this.initBoutiquePage();
                break;
            case 'produit':
                this.initProductPage();
                break;
            case 'panier':
                this.initCartPage();
                break;
            case 'checkout':
                this.initCheckoutPage();
                break;
            case 'compte':
                this.initAccountPage();
                break;
            case 'admin':
                this.initAdminPage();
                break;
        }
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path === '/') return 'home';
        if (path.startsWith('/boutique')) return 'boutique';
        if (path.startsWith('/produit/')) return 'produit';
        if (path === '/panier') return 'panier';
        if (path === '/checkout') return 'checkout';
        if (path === '/compte') return 'compte';
        if (path === '/admin') return 'admin';
        return 'other';
    }

    initHomePage() {
        console.log('Initializing home page features');
        
        // Collection card hover effects
        document.querySelectorAll('.collection-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('a')) {
                    const category = card.dataset.category;
                    if (category) {
                        window.location.href = `/boutique?category=${category}`;
                    }
                }
            });
        });
    }

    initBoutiquePage() {
        console.log('Initializing boutique page features');
        // Boutique-specific features will be added here
    }

    initProductPage() {
        console.log('Initializing product page features');
        // Product-specific features will be added here
    }

    initCartPage() {
        console.log('Initializing cart page features');
        // Cart-specific features will be added here
    }

    initCheckoutPage() {
        console.log('Initializing checkout page features');
        // Checkout-specific features will be added here
    }

    initAccountPage() {
        console.log('Initializing account page features');
        // Account-specific features will be added here
    }

    initAdminPage() {
        console.log('Initializing admin page features');
        // Admin-specific features will be added here
    }
}

// Initialize the application
const app = new AngeleShopApp();

// Global error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showToast('Une erreur inattendue s\'est produite', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('Une erreur de réseau s\'est produite', 'error');
});

// Export app instance
window.app = app;