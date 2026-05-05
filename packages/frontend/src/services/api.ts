import axios from 'axios';
import { FilterStatsResponseSchema, GamesResponseSchema } from '@game-catalog/shared';
import type { Comment, Filter, FilterStatsResponse, Game, User } from '@game-catalog/shared';

const API_URL = window.location.port === '5173' || window.location.port === '4173'
    ? 'http://localhost:3001'
    : '';

export const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    withCredentials: true
});

const validateDevResponse = <T>(parser: { parse: (input: unknown) => T }, payload: unknown): T => {
    if (import.meta.env.DEV) {
        return parser.parse(payload);
    }
    return payload as T;
};

if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        const errorMessage = event.message || '';
        const errorSource = event.filename || '';

        if ((errorMessage.includes('/auth/me') || errorSource.includes('/auth/me')) &&
            (errorMessage.includes('401') || errorMessage.includes('Unauthorized'))) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    }, true);

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const errorMessage = reason?.message || String(reason) || '';
        const errorStack = reason?.stack || '';

        if ((errorMessage.includes('/auth/me') || errorStack.includes('/auth/me')) &&
            (errorMessage.includes('401') || errorMessage.includes('Unauthorized'))) {
            event.preventDefault();
            return false;
        }
    });
}

// автоматическое обновление токена
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => {
        if (response.config.url?.includes('/auth/me') && response.status === 401) {
            return { ...response, data: { user: null }, status: 200 };
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url?.includes('/auth/refresh') &&
            !originalRequest.url?.includes('/auth/me')) {

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then(() => {
                        return api(originalRequest);
                    })
                    .catch(err => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshUrl = `${API_URL}/auth/refresh`;
                const refreshResponse = await axios.post(refreshUrl, {}, {
                    withCredentials: true
                });

                if (refreshResponse.data && refreshResponse.data.user) {
                    window.dispatchEvent(new CustomEvent('auth:refresh'));
                    processQueue(null, null);
                    isRefreshing = false;
                    return api(originalRequest);
                } else {
                    throw new Error('Refresh failed: no user data');
                }
            } catch (refreshError: any) {
                processQueue(refreshError, null);
                isRefreshing = false;

                if (refreshError?.response?.data?.error) {
                    const errorMessage = refreshError.response.data.error;
                    if (errorMessage.includes('Refresh token') || errorMessage.includes('refresh token') || errorMessage.includes('Session expired')) {
                        refreshError.response.data.error = 'Session expired. Please sign in again';
                    }
                }

                return Promise.reject(refreshError);
            }
        }

        if (error.response?.status === 403 &&
            error.response?.data?.error?.includes('banned')) {
            window.dispatchEvent(new CustomEvent('auth:banned'));
        }

        return Promise.reject(error);
    }
);


const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getGames = async (
    filters: Filter,
    limit = 20,
    offset = 0,
    retryCount = 0,
    includeCount = false
): Promise<Game[] | { games: Game[]; totalCount: number }> => {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 секунда базовая задержка

    try {
        const params: any = {
            limit,
            offset,
            search: filters.search?.trim() || undefined,
            ratingMin: filters.ratingMin,
            ratingMax: filters.ratingMax,
            genres: filters.genres?.length ? filters.genres.join(',') : undefined,
            platforms: filters.platforms?.length ? filters.platforms.join(',') : undefined,
            engines: filters.engines?.length ? filters.engines.join(',') : undefined,
            releaseDateMin: filters.releaseDateMin || undefined,
            releaseDateMax: filters.releaseDateMax || undefined,
            sortBy: filters.sortBy,
            includeCount: includeCount ? 'true' : 'false',
            gameIds: filters.sellerGameIds?.length ? filters.sellerGameIds.join(',') : undefined,
        };
        Object.keys(params).forEach(key => {
            if (params[key] === undefined) delete params[key];
        });

        const response = await api.get('/games', { params });
        if (includeCount) {
            return {
                games: validateDevResponse(GamesResponseSchema, response.data.games),
                totalCount: Number(response.data.totalCount ?? 0)
            };
        }
        return validateDevResponse(GamesResponseSchema, response.data);
    } catch (error: any) {
        if (error.response?.status === 429 && retryCount < maxRetries) {
            const delayMs = baseDelay * Math.pow(2, retryCount);
            await delay(delayMs);
            return getGames(filters, limit, offset, retryCount + 1);
        }
        if (error.response?.status === 429) {
            throw new Error(error.response?.data?.message || 'Too many requests. Please wait a moment and try again.');
        }
        throw new Error(error.response?.data?.error || error.response?.data?.details || error.response?.data?.message || 'Failed to load games');
    }
};

export const getFilterStats = async (retryCount = 0): Promise<FilterStatsResponse> => {
    const maxRetries = 2;
    const baseDelay = 2000;

    try {
        const response = await api.get('/filters/stats', { timeout: 120000 });
        const data = response.data;
        if (data && data.genres && data.platforms && data.engines) {
            if (data.genres.length === 0 && data.platforms.length === 0 && data.engines.length === 0) {
                throw new Error('Filter stats returned empty arrays');
            }
        }
        return validateDevResponse(FilterStatsResponseSchema, data);
    } catch (error: any) {
        if (error.response?.status === 429 && retryCount < maxRetries) {
            const delayMs = baseDelay * Math.pow(2, retryCount);
            await delay(delayMs);
            return getFilterStats(retryCount + 1);
        }
        if (error.response?.status === 429) {
            throw new Error('Too many requests. Filter statistics are temporarily unavailable.');
        }
        throw error;
    }
};

export const register = async (email: string, name: string, password: string) => {
    try {
        const response = await api.post('/auth/register', { email, name, password }, {
            withCredentials: true
        });
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 400) {
            const serverMessage = error.response?.data?.error || '';
            if (serverMessage.includes('already exists')) {
                throw new Error('An account with this email is already registered.');
            }
            throw new Error(serverMessage || 'Registration error');
        }
        throw error;
    }
};

export const login = async (email: string, password: string) => {
    try {
        const response = await api.post('/auth/login', { email, password }, {
            withCredentials: true
        });
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 401) {
            const serverMessage = error.response?.data?.error || '';
            if (serverMessage.includes('Invalid email or password')) {
                throw new Error('Incorrect email or password');
            }
            if (serverMessage.includes('Google authentication')) {
                throw new Error('This account uses Google Sign-In. Please sign in with Google.');
            }
            throw new Error('Incorrect login details');
        }
        throw error;
    }
};

export const logout = async () => {
    const response = await api.post('/auth/logout', {}, {
        withCredentials: true
    });
    return response.data;
};

export const getMe = async () => {
    const response = await api.get('/auth/me', { withCredentials: true });
    return response.data;
};

export const refreshToken = async () => {
    const response = await api.post('/auth/refresh', {}, { withCredentials: true });
    return response.data;
};

export const getFavorites = async (): Promise<number[]> => {
    const response = await api.get('/favorites');
    return response.data.gameIds;
};

export const getGamesBulk = async (ids: number[]): Promise<Game[]> => {
    const response = await api.post('/games/bulk', { ids });
    return response.data.games || [];
};

export const getPopularGames = async (limit = 20): Promise<Game[]> => {
    const response = await api.get('/games/popular', { params: { limit } });
    return Array.isArray(response.data) ? response.data : (response.data?.games || []);
};

export const getUpcomingGames = async (limit = 12): Promise<Game[]> => {
    const response = await api.get('/games/upcoming', { params: { limit } });
    return Array.isArray(response.data) ? response.data : (response.data?.games || []);
};

export const addFavorite = async (gameId: number) => {
    const response = await api.post(`/favorites/${gameId}`);
    return response.data;
};

export const removeFavorite = async (gameId: number) => {
    const response = await api.delete(`/favorites/${gameId}`);
    return response.data;
};

export const checkFavorite = async (gameId: number): Promise<boolean> => {
    const response = await api.get(`/favorites/${gameId}/check`);
    return response.data.isFavorite;
};

export const checkMultipleFavorites = async (gameIds: number[]): Promise<Record<number, boolean>> => {
    const response = await api.post('/favorites/check-multiple', { gameIds });
    return response.data.favorites;
};

// Google OAuth
export const getGoogleAuthUrl = async (): Promise<string> => {
    const response = await api.get('/auth/google');
    return response.data.authUrl;
};

export const googleAuthCallback = async (code: string) => {
    const redirectUri = 'http://localhost/signin-callback';
    const response = await api.post('/auth/google/callback', { code, redirectUri }, {
        withCredentials: true
    });
    return response.data;
};

export type { Comment, Game, User };

export const getGameComments = async (gameId: number): Promise<Comment[]> => {
    const response = await api.get(`/comments/game/${gameId}`);
    return response.data.comments;
};

export const createGameComment = async (gameId: number, text: string, parentId?: number): Promise<void> => {
    await api.post(`/comments`, { gameId, text, parentId });
};

export const updateComment = async (commentId: number, text: string): Promise<Comment> => {
    const response = await api.put(`/comments/${commentId}`, { text });
    return response.data;
};

export const deleteComment = async (commentId: number) => {
    const response = await api.delete(`/comments/${commentId}`);
    return response.data;
};

export const getUserComments = async (): Promise<Comment[]> => {
    const response = await api.get('/comments/user/my-comments');
    return response.data.comments;
};

export const deleteAccount = async (password: string) => {
    const response = await api.post('/auth/delete-account', { password });
    return response.data;
};

export interface Listing {
    id: number;
    seller_profile_id: number;
    seller_name: string;
    seller_rating: number;
    seller_user_id: number;
    is_verified: boolean;
    total_sales: number;
    igdb_game_id: number;
    price: number;
    description: string;
    listing_description?: string;
}

export interface CartItem {
    id: number;
    listing_id: number;
    igdb_game_id: number;
    price: number;
    seller_name: string;
    seller_profile_id: number;
    seller_rating: number;
    is_verified: boolean;
    added_at: string;
    listing_description?: string;
}

export const getListingForGame = async (gameId: number): Promise<Listing | null> => {
    const response = await api.get(`/games/${gameId}/listing`);
    return response.data.listing;
};

export const getCart = async (): Promise<CartItem[]> => {
    const response = await api.get('/sellers/cart/my');
    return response.data.items;
};

export const addToCart = async (listingId: number) => {
    const response = await api.post('/sellers/cart/add', { listingId });
    return response.data;
};

export const removeFromCart = async (listingId: number) => {
    const response = await api.delete(`/sellers/cart/${listingId}`);
    return response.data;
};

export const checkInCart = async (listingId: number): Promise<boolean> => {
    const response = await api.get(`/sellers/cart/check/${listingId}`);
    return response.data.inCart;
};

export interface PublicProfile {
    id: number;
    name: string;
    email?: string;
    role: string;
    avatar_url?: string;
    created_at: string;
    seller?: {
        seller_id: number;
        display_name: string;
        description: string;
        is_verified: boolean;
        total_sales: number;
        rating: number;
        listings?: any[];
    };
}

export const getPublicProfile = async (userId: number): Promise<PublicProfile> => {
    const response = await api.get(`/users/${userId}`);
    return response.data.profile;
};

export const getMyBalance = async (userId: number): Promise<number> => {
    const response = await api.get(`/users/${userId}/balance`);
    return response.data.balance;
};

export const getMyOrders = async (userId: number): Promise<any[]> => {
    const response = await api.get(`/users/${userId}/orders`);
    return response.data.orders;
};

export const checkoutCart = async () => {
    const response = await api.post('/orders/checkout');
    return response.data;
};

export const confirmOrder = async (orderId: number) => {
    const response = await api.post(`/orders/${orderId}/confirm`);
    return response.data;
};

export const cancelOrder = async (orderId: number) => {
    const response = await api.post(`/orders/${orderId}/cancel`);
    return response.data;
};

export const sellerSendKey = async (orderId: number, gameKey: string) => {
    const response = await api.post(`/orders/${orderId}/send-key`, { gameKey });
    return response.data;
};

export interface AdminUser {
    id: number;
    email: string;
    name: string;
    role: string;
    is_banned: boolean;
    created_at: string;
}

export const adminGetUsers = async (): Promise<AdminUser[]> => {
    const r = await api.get('/admin/users');
    return r.data.users;
};

export const adminBanUser = async (userId: number, banned: boolean) => {
    await api.patch(`/admin/users/${userId}/ban`, { banned });
};

export const adminSetRole = async (userId: number, role: string) => {
    await api.patch(`/admin/users/${userId}/role`, { role });
};

export const adminGetHiddenGames = async () => {
    const r = await api.get('/admin/hidden-games');
    return r.data.games;
};

export const adminHideGame = async (igdbGameId: number, reason: string) => {
    await api.post('/admin/hidden-games', { igdbGameId, reason });
};

export const adminUnhideGame = async (igdbGameId: number) => {
    await api.delete(`/admin/hidden-games/${igdbGameId}`);
};

export const updateListingPrice = async (listingId: number, price: number) => {
    await api.patch(`/sellers/listings/${listingId}/price`, { price });
};

export interface SellerOption {
    id: number;
    display_name: string;
    is_verified: boolean;
    rating: number;
    total_sales: number;
    game_ids: number[];
}

export const getAllSellers = async (): Promise<SellerOption[]> => {
    const response = await api.get('/sellers/all');
    return response.data.sellers;
};
