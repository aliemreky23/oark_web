// ========================================
// OARK - API Service Layer
// ========================================

const API_BASE_URL = 'https://oark-api.vercel.app';

class OarkAPI {
    constructor() {
        this.baseUrl = API_BASE_URL;
        this.accessToken = localStorage.getItem('access_token');
        this.refreshToken = localStorage.getItem('refresh_token');
    }

    // ========================================
    // HTTP Helper Methods
    // ========================================

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.accessToken && !options.noAuth) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const data = await response.json();

            // Handle token refresh if 401
            if (response.status === 401 && this.refreshToken && !options.isRetry) {
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    return this.request(endpoint, { ...options, isRetry: true });
                }
            }

            if (!response.ok) {
                throw new Error(data.error?.message || 'Bir hata oluştu');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async get(endpoint, options = {}) {
        return this.request(endpoint, { method: 'GET', ...options });
    }

    async post(endpoint, body, options = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
            ...options
        });
    }

    async patch(endpoint, body, options = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(body),
            ...options
        });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, { method: 'DELETE', ...options });
    }

    // ========================================
    // Token Management
    // ========================================

    setTokens(accessToken, refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    }

    async refreshAccessToken() {
        try {
            const response = await this.post('/api/v1/auth/refresh', {
                refresh_token: this.refreshToken
            }, { noAuth: true });

            if (response.success) {
                this.setTokens(response.data.access_token, response.data.refresh_token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.clearTokens();
            return false;
        }
    }

    // ========================================
    // Auth Endpoints
    // ========================================

    async login(email, password) {
        const response = await this.post('/api/v1/auth/login', { email, password }, { noAuth: true });
        if (response.success) {
            this.setTokens(response.data.access_token, response.data.refresh_token);
        }
        return response;
    }

    async register(email, password, username, fullName) {
        return this.post('/api/v1/auth/register', {
            email,
            password,
            username,
            full_name: fullName
        }, { noAuth: true });
    }

    async logout() {
        try {
            await this.post('/api/v1/auth/logout', {});
        } finally {
            this.clearTokens();
        }
    }

    async getCurrentUser() {
        return this.get('/api/v1/auth/me');
    }

    // ========================================
    // User Endpoints
    // ========================================

    async getProfile() {
        return this.get('/api/v1/users/me');
    }

    async updateProfile(data) {
        return this.patch('/api/v1/users/me', data);
    }

    async getUserById(userId) {
        return this.get(`/api/v1/users/${userId}`);
    }

    async searchUsers(query) {
        return this.get(`/api/v1/users/search?q=${encodeURIComponent(query)}`);
    }

    // ========================================
    // Games Endpoints
    // ========================================

    async getGames() {
        return this.get('/api/v1/games', { noAuth: true });
    }

    async getGame(gameId) {
        return this.get(`/api/v1/games/${gameId}`, { noAuth: true });
    }

    // ========================================
    // Listings Endpoints
    // ========================================

    async getListings(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/api/v1/listings${query ? '?' + query : ''}`, { noAuth: true });
    }

    async getListing(listingId) {
        return this.get(`/api/v1/listings/${listingId}`, { noAuth: true });
    }

    async createListing(data) {
        return this.post('/api/v1/listings', data);
    }

    async deleteListing(listingId) {
        return this.delete(`/api/v1/listings/${listingId}`);
    }

    async sendRequest(listingId) {
        return this.post(`/api/v1/listings/${listingId}/requests`, {});
    }

    async getListingRequests(listingId) {
        return this.get(`/api/v1/listings/${listingId}/requests`);
    }

    async updateRequest(listingId, requestId, status) {
        return this.patch(`/api/v1/listings/${listingId}/requests/${requestId}`, { status });
    }

    // ========================================
    // Lobbies Endpoints
    // ========================================

    async createLobby(data) {
        return this.post('/api/v1/lobbies', data);
    }

    async joinLobby(code) {
        return this.post('/api/v1/lobbies/join', { code });
    }

    async getLobby(lobbyId) {
        return this.get(`/api/v1/lobbies/${lobbyId}`);
    }

    async leaveLobby(lobbyId) {
        return this.delete(`/api/v1/lobbies/${lobbyId}/leave`);
    }

    async kickMember(lobbyId, userId) {
        return this.delete(`/api/v1/lobbies/${lobbyId}/members/${userId}`);
    }

    async getActiveLobby() {
        return this.get('/api/v1/lobbies/active');
    }
}

// Create global instance
window.oarkAPI = new OarkAPI();
