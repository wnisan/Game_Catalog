import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    withCredentials: true
});

if (typeof window !== 'undefined') {
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: any[]) => {
        const errorString = args.map(arg => {
            if (typeof arg === 'string') return arg;
            if (arg?.message) return arg.message;
            if (arg?.stack) return arg.stack;
            return String(arg);
        }).join(' ');

        if (errorString.includes('/auth/me') && (errorString.includes('401') || errorString.includes('Unauthorized'))) {
            return;
        }
        originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
        const warnString = args.map(arg => {
            if (typeof arg === 'string') return arg;
            if (arg?.message) return arg.message;
            return String(arg);
        }).join(' ');

        if (warnString.includes('/auth/me') && (warnString.includes('401') || warnString.includes('Unauthorized'))) {
            return;
        }
        originalWarn.apply(console, args);
    };

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
        if (error.response?.status === 401 && originalRequest.url?.includes('/auth/me')) {

            return Promise.resolve({
                data: { user: null },
                status: 200,
                statusText: 'OK',
                headers: error.response.headers,
                config: originalRequest
            });
        }

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
                await axios.post(refreshUrl, {}, {
                    withCredentials: true
                });

                processQueue(null, 'cookie');
                isRefreshing = false;

                return api(originalRequest);
            } catch (refreshError: any) {
                processQueue(refreshError, null);
                isRefreshing = false;

                if (refreshError?.response?.data?.error) {
                    const errorMessage = refreshError.response.data.error;
                    if (errorMessage.includes('Refresh token') || errorMessage.includes('refresh token')) {
                        refreshError.response.data.error = 'Session expired. Please sign in again';
                    }
                }

                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export interface Game {
    id: number;
    name: string;
    cover?: { url: string };
    rating?: number;
    summary?: string;
    releaseDate?: string; 
    genres?: { id: number; name: string }[];
    platforms?: { id: number; name: string }[];
    engines?: { id: number; name: string }[];
    pegi?: number;
    externalLinks?: {
        steam?: string;
        gog?: string;
        epic?: string;
        playstation?: string;
        xbox?: string;
    };
}

// проверка подключения с бэком
export const testBackendConnection = async () => {
    const responce = await api.get('/');
    return responce.data;
}

// Функция для задержки
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// получение списка игр
export const getGames = async (
    filters: any,
    limit = 20,
    offset = 0,
    retryCount = 0,
    includeCount = false
): Promise<Game[] | { games: Game[]; totalCount: number }> => {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 секунда базовая задержка

    try {
        let pegiParam: string | undefined = undefined;
        if (filters.pegi && Array.isArray(filters.pegi) && filters.pegi.length > 0) {
            pegiParam = filters.pegi.join(',');
            console.log('PEGI parameter formed:', pegiParam, 'from array:', filters.pegi);
        } else {
            console.log('PEGI parameter is undefined or empty. filters.pegi:', filters.pegi);
        }
        
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
            pegi: pegiParam,
            sortBy: filters.sortBy,
            includeCount: includeCount ? 'true' : 'false'
        };
        
        console.log('BEFORE cleanup - filters.pegi:', filters.pegi);
        console.log('BEFORE cleanup - params.pegi:', params.pegi);
        console.log('BEFORE cleanup - full params:', JSON.stringify(params, null, 2));
        
        // Удаляем undefined параметры
        Object.keys(params).forEach(key => {
            if (params[key] === undefined) {
                delete params[key];
            }
        });
        
        console.log('AFTER cleanup - params:', params);
        console.log('AFTER cleanup - params.pegi:', params.pegi);
        console.log('AFTER cleanup - has pegi?', 'pegi' in params);
        
        const response = await api.get('/games', { params });

    return response.data;
    } catch (error: any) {
        console.error('Error in getGames:', error);

        if (error.response?.status === 429 && retryCount < maxRetries) {
            const delayMs = baseDelay * Math.pow(2, retryCount); // Экспоненциальная задержка: 1s, 2s, 4s
            console.log(`Rate limit exceeded. Retrying in ${delayMs}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            await delay(delayMs);
            return getGames(filters, limit, offset, retryCount + 1);
        }

        if (error.response?.status === 429) {
            throw new Error(error.response?.data?.message || 'Too many requests. Please wait a moment and try again.');
        }

        throw new Error(error.response?.data?.error || error.response?.data?.details || error.response?.data?.message || 'Failed to load games');
    }
};

// статистика фильтров
export interface FilterStats {
    genres: { id: number; name: string; count: number }[];
    platforms: { id: number; name: string; count: number }[];
    engines: { id: number; name: string; count: number }[];
    pegi?: { id: number; name: string; count: number }[];
}

export const getFilterStats = async (retryCount = 0): Promise<FilterStats> => {
    const maxRetries = 2; 
    const baseDelay = 2000; // 2 секунды базовая задержка

    try { 
        const response = await api.get('/filters/stats', {
            timeout: 120000 // 120 секунд (2 минуты)
        });
        const data = response.data;
        if (data && data.genres && data.platforms && data.engines) {
            if (data.genres.length === 0 && data.platforms.length === 0 && data.engines.length === 0) {
                throw new Error('Filter stats returned empty arrays');
            }
        }
        return data;
    } catch (error: any) {
        if (error.response?.status === 429 && retryCount < maxRetries) {
            const delayMs = baseDelay * Math.pow(2, retryCount); 
            console.log(`Filter stats rate limit exceeded. Retrying in ${delayMs}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            await delay(delayMs);
            return getFilterStats(retryCount + 1);
        }

        if (error.response?.status === 429) {
            throw new Error('Too many requests. Filter statistics are temporarily unavailable.');
        }

        throw error;
    }
};

// Аутентификация
export const register = async (email: string, name: string, password: string) => {
    const response = await api.post('/auth/register', { email, name, password }, {
        withCredentials: true
    });
    return response.data; // без пароля
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
            if (serverMessage && serverMessage !== 'Access token required') {
                throw new Error(serverMessage);
            }
            throw new Error('Password is incorrect');
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

// получение текущего пользователя
export const getMe = async () => {
    try {
       
        const response = await api.get('/auth/me', {
            withCredentials: true,
            validateStatus: (status) => {
                return status === 200 || status === 401;
            }
        });

        if (response.status === 401) {
            return { user: null };
        }

        return response.data;
    } catch (error: any) {
        if (error.response?.status === 401 || error.status === 401) {
            return { user: null };
        }

        throw error;
    }
};

export const refreshToken = async () => {
    const response = await api.post('/auth/refresh', {}, {
        withCredentials: true
    });
    return response.data;
};

// Избранное
export const getFavorites = async (): Promise<number[]> => {
    const response = await api.get('/favorites');
    return response.data.gameIds;
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
    return response.data.favorited;
};

// Google OAuth
export const getGoogleAuthUrl = async (): Promise<string> => {
    const response = await api.get('/auth/google');
    return response.data.authUrl;
};

export const googleAuthCallback = async (code: string) => {
    const response = await api.post('/auth/google/callback', { code }, {
        withCredentials: true
    });
    return response.data;
};