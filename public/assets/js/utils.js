// Utility Functions

// ========== SITE CONFIGURATION ==========
// Config loaded from API, with fallbacks
const siteConfig = {
    whatsappNumber: '22896272034',
    phoneNumber: '+22896272034',
    siteName: 'Angele Shop',
    currency: 'FCFA',
    country: 'Togo',
    loaded: false
};

// Load config from API (called on page load)
async function loadSiteConfig() {
    if (siteConfig.loaded) return siteConfig;
    
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            Object.assign(siteConfig, config);
            siteConfig.loaded = true;
        }
    } catch (error) {
        console.warn('Could not load site config, using defaults');
    }
    return siteConfig;
}

// Get WhatsApp number (sync version for immediate use)
function getWhatsAppNumber() {
    return siteConfig.whatsappNumber;
}

// Get phone number
function getPhoneNumber() {
    return siteConfig.phoneNumber;
}

// Initialize config on load
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', loadSiteConfig);
}

// ========== FORMATTING ==========

// Format price in FCFA
function formatPrice(price) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF',
        currencyDisplay: 'code'
    }).format(price).replace('XOF', 'FCFA');
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

// Format date and time
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Debounce function
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// Throttle function
function throttle(func, wait) {
    let timeout;
    let previous = 0;
    
    return function executedFunction(...args) {
        const now = Date.now();
        
        if (!previous) previous = now;
        
        const remaining = wait - (now - previous);
        
        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            func(...args);
        } else if (!timeout) {
            timeout = setTimeout(() => {
                previous = Date.now();
                timeout = null;
                func(...args);
            }, remaining);
        }
    };
}

// Validate email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate phone number (simple togo number format)
function isValidPhone(phone) {
    const phoneRegex = /^(?:(?:\+|00)228)?\s*[2798](?:[\s.-]*\d){7}$/
;
    return phoneRegex.test(phone);
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Get URL parameters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}

// Set URL parameter without page reload
function setUrlParam(key, value) {
    const url = new URL(window.location);
    if (value) {
        url.searchParams.set(key, value);
    } else {
        url.searchParams.delete(key);
    }
    window.history.replaceState({}, '', url);
}

// Local storage helpers
const storage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    },
    
    get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('Storage get error:', error);
            return null;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    },
    
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }
};

// Session storage helpers
// Session storage helpers (renommé pour éviter de masquer window.sessionStorage)
const sessionStore = {
    set(key, value) {
        try {
            window.sessionStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Session storage set error:', error);
            return false;
        }
    },
    
    get(key) {
        try {
            const item = window.sessionStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('Session storage get error:', error);
            return null;
        }
    },
    
    remove(key) {
        try {
            window.sessionStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Session storage remove error:', error);
            return false;
        }
    }
};


// Cookie helpers
const cookies = {
    set(name, value, days = 7) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))};expires=${expires.toUTCString()};path=/`;
    },
    
    get(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) {
                try {
                    return JSON.parse(decodeURIComponent(c.substring(nameEQ.length, c.length)));
                } catch (error) {
                    return decodeURIComponent(c.substring(nameEQ.length, c.length));
                }
            }
        }
        return null;
    },
    
    remove(name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
};

// Element helpers
function $(selector, context = document) {
    return context.querySelector(selector);
}

function $$(selector, context = document) {
    return context.querySelectorAll(selector);
}

// Create element with attributes
function createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'class') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('data-')) {
            element.setAttribute(key, value);
        } else {
            element[key] = value;
        }
    });
    
    if (content) {
        if (typeof content === 'string') {
            element.innerHTML = content;
        } else if (content instanceof Node) {
            element.appendChild(content);
        }
    }
    
    return element;
}

// Animation helpers
function fadeIn(element, duration = 300) {
    element.style.opacity = '0';
    element.style.display = 'block';
    
    let start = null;
    
    function animate(timestamp) {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        
        element.style.opacity = Math.min(progress / duration, 1);
        
        if (progress < duration) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

function fadeOut(element, duration = 300) {
    let start = null;
    const initialOpacity = parseFloat(getComputedStyle(element).opacity);
    
    function animate(timestamp) {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        
        element.style.opacity = Math.max(initialOpacity - (progress / duration), 0);
        
        if (progress < duration) {
            requestAnimationFrame(animate);
        } else {
            element.style.display = 'none';
        }
    }
    
    requestAnimationFrame(animate);
}

// Smooth scroll to element
function scrollToElement(element, offset = 80) {
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
    });
}

// Check if element is in viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Truncate text
function truncateText(text, length = 100, suffix = '...') {
    if (text.length <= length) return text;
    return text.substring(0, length).trim() + suffix;
}

// Slugify string
function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[àáäâ]/g, 'a')
        .replace(/[èéëê]/g, 'e')
        .replace(/[ìíïî]/g, 'i')
        .replace(/[òóöô]/g, 'o')
        .replace(/[ùúüû]/g, 'u')
        .replace(/[ñ]/g, 'n')
        .replace(/[ç]/g, 'c')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Capitalize first letter
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Random number between min and max
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Copy text to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            textArea.remove();
            return true;
        } catch (error) {
            textArea.remove();
            return false;
        }
    }
}

// Export for use in other files
window.utils = {
    formatPrice,
    formatDate,
    formatDateTime,
    debounce,
    throttle,
    isValidEmail,
    isValidPhone,
    generateId,
    getUrlParams,
    setUrlParam,
    storage,
    sessionStore,
    cookies,
    $,
    $$,
    createElement,
    fadeIn,
    fadeOut,
    scrollToElement,
    isInViewport,
    truncateText,
    slugify,
    capitalize,
    randomBetween,
    copyToClipboard,
    escapeHTML,
    openWhatsAppOrder,
    openWhatsAppBuyNow,
    // Config functions
    siteConfig,
    loadSiteConfig,
    getWhatsAppNumber,
    getPhoneNumber
};

// Also export globally for easy access
window.getWhatsAppNumber = getWhatsAppNumber;
window.getPhoneNumber = getPhoneNumber;
window.siteConfig = siteConfig;

// WhatsApp number is now loaded from siteConfig (see top of file)

// Open WhatsApp with order details (for checkout)
function openWhatsAppOrder(orderData, cartItems, total, customer) {
    const orderId = orderData.orderId.substring(0, 8).toUpperCase();
    
    let message = `🛒 *NOUVELLE COMMANDE #${orderId}*\n\n`;
    message += `👤 *Client:* ${customer.name}\n`;
    message += `📞 *Téléphone:* ${customer.phone}\n`;
    message += `📍 *Adresse:* ${customer.address}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `📦 *ARTICLES COMMANDÉS:*\n\n`;
    
    cartItems.forEach((item, index) => {
        const product = item.product;
        const subtotal = product.price_fcfa * item.quantity;
        message += `${index + 1}. *${product.title}*\n`;
        message += `   Qté: ${item.quantity} × ${formatPrice(product.price_fcfa)}\n`;
        message += `   Sous-total: ${formatPrice(subtotal)}\n`;
        message += `   🔗 ${window.location.origin}/produit?id=${product.id}\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *TOTAL: ${formatPrice(total)}*\n`;
    message += `💵 Paiement à la livraison\n\n`;
    message += `Merci de confirmer la disponibilité et les frais de livraison.`;
    
    const whatsappUrl = `https://wa.me/${getWhatsAppNumber()}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

// Open WhatsApp for "Buy Now" button (single product) - Quick impulsive version
function openWhatsAppBuyNow(product, quantity, customer = null) {
    const subtotal = product.price_fcfa * quantity;
    
    let message = `🛍️ *ACHAT RAPIDE - Angele Shop*\n\n`;
    
    // If customer info provided
    if (customer && customer.name) {
        message += `👤 *Client:* ${customer.name}\n`;
        message += `📞 *Téléphone:* ${customer.phone}\n`;
        message += `📍 *Adresse:* ${customer.address}\n\n`;
    }
    
    message += `📦 *PRODUIT:*\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `*${product.title}*\n`;
    message += `• Quantité: ${quantity}\n`;
    message += `• Prix unitaire: ${formatPrice(product.price_fcfa)}\n`;
    message += `💰 *Total: ${formatPrice(subtotal)}*\n\n`;
    message += `🔗 ${window.location.origin}/produit/${product.slug}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `Bonjour! Je souhaite acheter ce produit. Merci de me confirmer la disponibilité et les frais de livraison. 🙏`;
    
    const whatsappUrl = `https://wa.me/${getWhatsAppNumber()}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}