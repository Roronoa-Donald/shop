// API Client for Angele Shop

class ApiClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

   async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    // Clone des headers par défaut
    const headers = { ...this.defaultHeaders };
    if (options.headers && typeof options.headers === 'object') {
    Object.assign(headers, options.headers);
}
    // Si body est FormData, on supprime Content-Type
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const config = {
        headers,
        credentials: 'include',
        ...options,
    };

    // Transformer body en JSON seulement si ce n'est pas FormData
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(url, config);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }

        return await response.text();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

    // HTTP Methods
    async get(endpoint, params = {}) {
    // build query string from params
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) qs.append(k, v);
    });
    const path = endpoint + (qs.toString() ? `?${qs.toString()}` : '');
    return this.request(path, { method: 'GET' });
}


    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: data,
        });
    }

    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data,
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }

    // Multipart form data for file uploads
   
// Multipart form data for file uploads
// Multipart form data for file uploads
async postFormData(endpoint, formData) {
    const headers = {};
    console.log('[ApiClient] postFormData headers to send:', headers);

    // Si on a déjà stocké l'Authorization en mémoire, on l'utilise
    if (this.defaultHeaders && this.defaultHeaders['Authorization']) {
        headers['Authorization'] = this.defaultHeaders['Authorization'];
    } else {
        // Sinon, tentative robuste : récupérer le token depuis localStorage
        try {
            if (typeof localStorage !== 'undefined') {
                const token = localStorage.getItem('admin_token');
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            }
        } catch (err) {
            console.warn("postFormData: localStorage inaccessible", err);
        }
    }

    const config = {
        method: 'POST',
        body: formData,
        headers,
        credentials: 'include',
    };
    return this.request(endpoint, config);
}


    // Set authorization header for admin operations
    setAuthToken(token) {
        if (token) {
            this.defaultHeaders['Authorization'] = `Bearer ${token}`;
        } else {
            delete this.defaultHeaders['Authorization'];
        }
    }
}

// Create API instance
const api = new ApiClient();

// Product API methods
const productAPI = {
    async getAll(params = {}) {
        return api.get('/api/products', params);
    },

    async getBySlug(slug) {
        return api.get(`/api/products/${slug}`);
    },

    async search(query, params = {}) {
        return api.get('/api/products', { ...params, q: query });
    }
};

// Categories API methods
const categoryAPI = {
    async getAll() {
        return api.get('/api/categories');
    }
};

// Cart API methods
const cartAPI = {
    async get() {
        return api.get('/api/cart');
    },

    async add(productId, variantId = null, quantity = 1) {
        return api.post('/api/cart', {
            action: 'add',
            productId,
            variantId,
            quantity
        });
    },

    async remove(productId, variantId = null) {
        return api.post('/api/cart', {
            action: 'remove',
            productId,
            variantId
        });
    },

    async update(productId, variantId = null, quantity) {
        return api.post('/api/cart', {
            action: 'update',
            productId,
            variantId,
            quantity
        });
    },

    async clear() {
        return api.post('/api/cart', {
            action: 'clear'
        });
    }
};

// Checkout API methods
const checkoutAPI = {
    async create(data) {
        return api.post('/api/checkout', data);
    }
};

// Auth API methods
const authAPI = {
    async login(email, password) {
        return api.post('/api/auth/login', { email, password });
    },

    async register(name, email, phone, password) {
        return api.post('/api/auth/register', { name, email, phone, password });
    },

    async verifyEmail(email, code) {
        return api.post('/api/auth/register/verify', { email, code });
    },

    async requestPasswordReset(email) {
        return api.post('/api/auth/forgot-password', { email });
    },

    async resetPassword(email, code, newPassword) {
        return api.post('/api/auth/reset-password', { email, code, newPassword });
    },

    async logout() {
        return api.post('/api/auth/logout');
    },

    async getAccount() {
        return api.get('/api/account');
    }
};

// Orders API methods
const orderAPI = {
    async getById(orderId) {
        return api.get(`/api/orders/${orderId}`);
    }
};

// Admin API methods
const adminAPI = {
    // Generic methods for flexible API calls
    async get(endpoint, params = {}) {
        const fullEndpoint = endpoint.startsWith('/api/admin') ? endpoint : `/api/admin${endpoint}`;
        return api.get(fullEndpoint, params);
    },

    async put(endpoint, data) {
        const fullEndpoint = endpoint.startsWith('/api/admin') ? endpoint : `/api/admin${endpoint}`;
        return api.put(fullEndpoint, data);
    },

    async delete(endpoint) {
        const fullEndpoint = endpoint.startsWith('/api/admin') ? endpoint : `/api/admin${endpoint}`;
        return api.delete(fullEndpoint);
    },

    async requestOTP(email) {
        return api.post('/api/admin/request-otp', { email });
    },

    async verifyOTP(email, code) {
        return api.post('/api/admin/verify-otp', { email, code });
    },

    async getOrders(params = {}) {
        return api.get('/api/admin/orders', params);
    },

    async getProducts() {
        return api.get('/api/admin/products');
    },

    async createProduct(formData) {
        return api.postFormData('/api/admin/products', formData);
    },

    async updateProduct(id, data) {
        return api.put(`/api/admin/products/${id}`, data);
    },

    async deleteProduct(id) {
        return api.delete(`/api/admin/products/${id}`);
    },

    async getLogs(params = {}) {
        return api.get('/api/admin/logs', params);
    },

    setToken(token) {
        api.setAuthToken(token);
    }
};

// Error handling wrapper
function withErrorHandling(apiMethod) {
    return async function(...args) {
        try {
            const result = await apiMethod.apply(this, args);
            return { success: true, data: result };
        } catch (error) {
            console.error('API Error:', error);
            return { 
                success: false, 
                error: error.message || 'Une erreur est survenue'
            };
        }
    };
}

// Health check
const healthAPI = {
    async check() {
        return api.get('/api/health');
    }
};

// Favorites API
const favoritesAPI = {
    async getAll() {
        return api.get('/api/favorites');
    },
    async add(productId) {
        return api.post('/api/favorites', { productId });
    },
    async remove(productId) {
        return api.delete(`/api/favorites/${productId}`);
    },
    async check(productIds) {
        return api.post('/api/favorites/check', { productIds });
    },
    async toggle(productId) {
        // Vérifie si dans les favoris, puis ajoute ou retire
        const { favoriteIds } = await this.check([productId]);
        if (favoriteIds.includes(productId)) {
            await this.remove(productId);
            return { isFavorite: false };
        } else {
            await this.add(productId);
            return { isFavorite: true };
        }
    }
};

// Suggestions API
const suggestionsAPI = {
    async get(limit = 8, excludeIds = []) {
        const exclude = excludeIds.join(',');
        return api.get('/api/suggestions', { limit, exclude: exclude || undefined });
    }
};

// Export API methods
window.api = api;
window.productAPI = productAPI;
window.categoryAPI = categoryAPI;
window.cartAPI = cartAPI;
window.checkoutAPI = checkoutAPI;
window.authAPI = authAPI;
window.orderAPI = orderAPI;
window.adminAPI = adminAPI;
window.healthAPI = healthAPI;
window.favoritesAPI = favoritesAPI;
window.suggestionsAPI = suggestionsAPI;
window.withErrorHandling = withErrorHandling;