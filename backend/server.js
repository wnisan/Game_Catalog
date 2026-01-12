import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import IGDBService from './services/igdbService.js';
import twitchAuth from './services/twitchAuth.js';
import axios from 'axios';
import { registerUser, loginUser, getUserFromToken, refreshAccessToken, logoutUser } from './auth.js';
import { createUser, getUserByEmail, getUserById } from './database.js';
import { addFavorite, removeFavorite, getFavorites, isFavorite } from './database.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Настройка CORS для работы с cookies
const allowedOrigins = [
    'http://localhost:5173',
    'https://game-catalog-1aq.pages.dev'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Проверка токена
const authenticateToken = async (req, res, next) => {
    let token = req.cookies?.accessToken;

    if (!token) {
    const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1]; // Bearer токен
    }

    if (!token) {
        console.log('No token found in request. Cookies:', req.cookies);
        return res.status(401).json({ error: 'Access token required' });
    }

    let user = getUserFromToken(token);

    // Если токен истек, пытаемся обновить его через refresh token
    if (!user) {
        const refreshToken = req.cookies?.refreshToken;
        // при успехе устанавливает новый access token в cookie
        if (refreshToken) {
            try {
                const { accessToken: newAccessToken, user: refreshedUser } = await refreshAccessToken(refreshToken);

                const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
                res.cookie('accessToken', newAccessToken, {
                    httpOnly: true,
                    secure: isProduction,
                    sameSite: isProduction ? 'none' : 'lax',
                    maxAge: 15 * 60 * 1000
                });
                user = refreshedUser;
                token = newAccessToken;
            } catch (error) {

                res.clearCookie('accessToken');
                res.clearCookie('refreshToken');
                return res.status(403).json({ error: 'Invalid or expired token' });
            }
        } else {
        return res.status(403).json({ error: 'Invalid or expired token' });
        }
    }

    req.user = user;
    next();
};

let lastFilterStatsRequestTime = 0;
const MIN_FILTER_STATS_INTERVAL = 1000;

app.get('/', (request, response) => {
    response.json({ message: 'The backend is working!' })
});

app.get('/games', async (req, res) => {
    try {
        const {
            limit = 20,
            offset = 0,
            search,
            ratingMin,
            ratingMax,
            genres,
            platforms,
            engines,
            releaseDateMin,
            releaseDateMax,
            pegi,
            sortBy,
            includeCount = 'false'
        } = req.query;

        console.log('GET /games query params:', {
            limit,
            offset,
            search,
            ratingMin,
            ratingMax,
            genres,
            platforms,
            engines,
            releaseDateMin,
            releaseDateMax,
            pegi,
            sortBy,
            includeCount
        });

        const games = await IGDBService.getGamesWithFilters({
            limit: Number(limit),
            offset: Number(offset), // Используется для пагинации (бесконечная прокрутка)
            search,
            ratingMin: ratingMin !== undefined ? Number(ratingMin) : undefined,
            ratingMax: ratingMax !== undefined ? Number(ratingMax) : undefined,
            genres,
            platforms,
            engines,
            releaseDateMin,
            releaseDateMax,
            pegi,
            sortBy
        });

        if (includeCount === 'true') {
            const totalCount = await IGDBService.getGamesCount({
                search,
                ratingMin: ratingMin !== undefined ? Number(ratingMin) : undefined,
                ratingMax: ratingMax !== undefined ? Number(ratingMax) : undefined,
                genres,
                platforms,
                engines,
                releaseDateMin,
                releaseDateMax,
                pegi,
                sortBy
            });
            res.json({ games, totalCount });
        } else {
        res.json(games);
        }
    } catch (error) {
        console.error('Error loading games:', error);
        console.error('Error details:', error.response?.data || error.message);

        if (error.response?.status === 429) {
            return res.status(429).json({
                error: 'Too many requests to IGDB API',
                message: 'Rate limit exceeded. Please wait a moment and try again.',
                details: 'The API has rate limits. Please try your search again in a few seconds.'
            });
        }

        if (error.response?.status === 406) {
            return res.status(406).json({
                error: 'Invalid query combination',
                message: 'Search and sort cannot be used together. Search already sorts by relevance.',
                details: error.response?.data?.details || error.response?.data?.cause || 'Search queries are automatically sorted by relevance.'
            });
        }

        res.status(500).json({
            error: 'Failed to load games',
            details: error.response?.data?.message || error.response?.data || error.message
        });
    }
});


app.get('/games/:id', async (request, response) => {
    try {
        const { id } = request.params;
        const game = await IGDBService.getGameById(id);
        response.json(game);
    } catch (error) {
        if (error.message === 'Game not found') {
            response.status(404).json({ error: 'Game not found' });
        } else {
            console.error('Error receiving game', error);
            response.status(500).json({
                error: 'Failed to load game',
                details: error.response?.data?.message || error.message
            });
        }
    }
});

let filterStatsCache = null;
let filterStatsCacheTime = 0;
const FILTER_STATS_CACHE_TTL = 60 * 60 * 1000; // 1 час кеширования для уменьшения нагрузки 

const rateLimitFilterStatsMiddleware = async (req, res, next) => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastFilterStatsRequestTime;

    if (timeSinceLastRequest < MIN_FILTER_STATS_INTERVAL) {
        const waitTime = MIN_FILTER_STATS_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    lastFilterStatsRequestTime = Date.now();
    next();
};

// получения статистики фильтров
app.get('/filters/stats', rateLimitFilterStatsMiddleware, async (req, res) => {
    try {

        const now = Date.now();
        if (filterStatsCache && (now - filterStatsCacheTime) < FILTER_STATS_CACHE_TTL) {
            console.log('Returning cached filter stats');
            return res.json(filterStatsCache);
        }
        const headers = await twitchAuth.getAuthHeaders();

        // общее количество игр в каталоге
        let totalGamesCount = 0;
        try {
            const totalCountRes = await axios.post(
                'https://api.igdb.com/v4/games/count',
                '',
            { headers }
        );
            totalGamesCount = totalCountRes.data.count || 0;
            console.log(`Total games in catalog: ${totalGamesCount}`);
        } catch (error) {
            console.warn('Error getting total games count:', error.response?.data || error.message);
            totalGamesCount = 35000;
        }

        const genreUsage = new Map();
        const platformUsage = new Map();
        const engineUsage = new Map();

        const BATCH_SIZE = 500; // Максимальный лимит IGDB API (по пакетам)
        const TOTAL_BATCHES = Math.ceil(totalGamesCount / BATCH_SIZE);

        const MAX_BATCHES = Math.min(TOTAL_BATCHES, 5);

        // Загружаем метаданные параллельно с батчами игр
        const metadataPromise = Promise.all([
            axios.post('https://api.igdb.com/v4/genres', 'fields id,name; limit 500;', { headers }),
            axios.post('https://api.igdb.com/v4/platforms', 'fields id,name; limit 500;', { headers }),
            axios.post('https://api.igdb.com/v4/game_engines', 'fields id,name; limit 500;', { headers })
        ]);

        let totalProcessedGames = 0; // Подсчитываем количество обработанных игр
        const BATCH_CONCURRENCY = 3;

        for (let i = 0; i < MAX_BATCHES; i += BATCH_CONCURRENCY) {
            const batchGroup = [];
            for (let j = 0; j < BATCH_CONCURRENCY && (i + j) < MAX_BATCHES; j++) {
                const offset = (i + j) * BATCH_SIZE;
                batchGroup.push(
                    axios.post(
                        'https://api.igdb.com/v4/games',
                        `fields genres,platforms,game_engines; limit ${BATCH_SIZE}; offset ${offset};`,
                    { headers }
                    ).catch(error => {
                        console.error(`Error fetching batch ${i + j + 1}:`, error.response?.data || error.message);
                        return { data: [] };
                    })
                );
            }

            const batchResults = await Promise.all(batchGroup);

            batchResults.forEach((gamesRes, index) => {
                const actualIndex = i + index;
                if (gamesRes.data && gamesRes.data.length > 0) {
                    totalProcessedGames += gamesRes.data.length;

                    gamesRes.data.forEach(game => {
                        if (game.genres) {
                            game.genres.forEach(id => {
                                genreUsage.set(id, (genreUsage.get(id) || 0) + 1);
                            });
                        }
                        if (game.platforms) {
                            game.platforms.forEach(id => {
                                platformUsage.set(id, (platformUsage.get(id) || 0) + 1);
                            });
                        }
                        if (game.game_engines) {
                            game.game_engines.forEach(id => {
                                engineUsage.set(id, (engineUsage.get(id) || 0) + 1);
                            });
                        }
                    });

                    console.log(`Processed batch ${actualIndex + 1}/${MAX_BATCHES} (${gamesRes.data.length} games)`);

                    // Если получили меньше игр, чем ожидали, значит достигли конца
                    if (gamesRes.data.length < BATCH_SIZE) {
                        return;
                    }
                }
            });
        }

        console.log(`Found ${genreUsage.size} used genres, ${platformUsage.size} used platforms, ${engineUsage.size} used engines`);
        console.log(`Processed ${totalProcessedGames} games out of ${totalGamesCount} total`);

        const [genresRes, platformsRes, enginesRes] = await metadataPromise;

        console.log(`Fetched ${genresRes.data.length} genres, ${platformsRes.data.length} platforms, ${enginesRes.data.length} engines`);

        const processBatch = async (items, getCountFn, batchSize = 5, type = 'items') => {
            console.log(`Processing ${items.length} ${type} in batches of ${batchSize}...`);
            const results = [];
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = items.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;
                const totalBatches = Math.ceil(items.length / batchSize);
                console.log(`Processing ${type} batch ${batchNumber}/${totalBatches}...`);

                const batchPromises = batch.map(async (item, index) => {
                    try {
                        if (index > 0) {
                            await new Promise(resolve => setTimeout(resolve, 30));
                        }
                        const count = await getCountFn(item);
                        return { item, count };
                    } catch (error) {
                        console.warn(`Error getting count for ${item.name || item.id}:`, error.response?.data || error.message);
                        return { item, count: 0 };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);

                // Задержка между батчами
                if (i + batchSize < items.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            console.log(`Completed processing ${type}: ${results.filter(r => r.count > 0).length} with count > 0`);
            return results;
        };

        // Жанры - используем подсчет через getGamesCount
        console.log('Getting exact counts for genres...');
        const genreCandidates = genresRes.data
            .filter(genre => genreUsage.has(genre.id))
            .sort((a, b) => (genreUsage.get(b.id) || 0) - (genreUsage.get(a.id) || 0)); // Сортируем по популярности 

        const genreResults = await processBatch(genreCandidates, async (genre) => {
            return await IGDBService.getGamesCount({
                genres: String(genre.id),
                search: undefined,
                ratingMin: 0,
                ratingMax: 100,
                platforms: undefined,
                engines: undefined,
                releaseDateMin: undefined,
                releaseDateMax: undefined,
                pegi: undefined,
                sortBy: undefined
            });
        }, 5, 'genres');

        const genreStats = genreResults
            .map(({ item, count }) => ({
                id: item.id,
                name: item.name,
                count: count
            }))
            .filter(stat => stat.count > 0)
            .sort((a, b) => a.name.localeCompare(b.name));

        // Платформы - используем подсчет через getGamesCount
        console.log('Getting exact counts for platforms...');
        const platformCandidates = platformsRes.data
            .filter(platform => platformUsage.has(platform.id))
            .sort((a, b) => (platformUsage.get(b.id) || 0) - (platformUsage.get(a.id) || 0))
            .slice(0, 20); // Берем топ 20 для ускорения

        const platformResults = await processBatch(platformCandidates, async (platform) => {
            return await IGDBService.getGamesCount({
                platforms: String(platform.id),
                search: undefined,
                ratingMin: 0,
                ratingMax: 100,
                genres: undefined,
                engines: undefined,
                releaseDateMin: undefined,
                releaseDateMax: undefined,
                pegi: undefined,
                sortBy: undefined
            });
        }, 5, 'platforms');

        const platformStats = platformResults
            .map(({ item, count }) => ({
                id: item.id,
                name: item.name,
                count: count
            }))
            .filter(stat => stat.count > 0)
            .sort((a, b) => a.name.localeCompare(b.name));

        console.log('Getting exact counts for engines...');
        console.log(`Engine usage map size: ${engineUsage.size}, enginesRes.data length: ${enginesRes.data.length}`);
        
        const engineCandidates = enginesRes.data
            .filter(engine => engineUsage.has(engine.id))
            .sort((a, b) => (engineUsage.get(b.id) || 0) - (engineUsage.get(a.id) || 0))
            .slice(0, 20);

        console.log(`Engine candidates after filtering: ${engineCandidates.length}`);

        if (engineCandidates.length === 0) {
            console.warn('No engine candidates found! engineUsage:', Array.from(engineUsage.keys()).slice(0, 10));
        }

        const engineResults = await processBatch(engineCandidates, async (engine) => {
            try {
                const count = await IGDBService.getGamesCount({
                    engines: String(engine.id),
                    search: undefined,
                    ratingMin: undefined,
                    ratingMax: undefined,
                    genres: undefined,
                    platforms: undefined,
                    releaseDateMin: undefined,
                    releaseDateMax: undefined,
                    pegi: undefined,
                    sortBy: undefined
                });
                return count;
            } catch (error) {
                console.error(`Error getting count for engine ${engine.id} (${engine.name}):`, error.message);
                return 0;
            }
        }, 5, 'engines');

        const engineStats = engineResults
            .map(({ item, count }) => ({
                id: item.id,
                name: item.name,
                count: count
            }))
            .filter(stat => stat.count > 0)
            .sort((a, b) => a.name.localeCompare(b.name));

        console.log(`Engine stats created: ${engineStats.length} engines with count > 0`);

        console.log(`Created stats: ${genreStats.length} genres, ${platformStats.length} platforms, ${engineStats.length} engines`);


        console.log('Getting PEGI stats...');
        const pegiValues = [3, 7, 12, 16, 18];
        const pegiStats = await Promise.all(
            pegiValues.map(async (pegiValue) => {
                try {
                    const count = await IGDBService.getGamesCount({
                        search: undefined,
                        ratingMin: undefined,
                        ratingMax: undefined,
                        genres: undefined,
                        platforms: undefined,
                        engines: undefined,
                        releaseDateMin: undefined,
                        releaseDateMax: undefined,
                        pegi: String(pegiValue)
                    });
                return {
                        id: pegiValue,
                        name: `${pegiValue}+`,
                        count: count
                    };
                } catch (error) {
                    console.warn(`Error getting count for PEGI ${pegiValue}:`, error.message);
                return {
                        id: pegiValue,
                        name: `${pegiValue}+`,
                        count: 0
                    };
                }
            })
        );

        const pegiStatsFiltered = pegiStats.filter(stat => stat.count > 0);

        const result = {
            genres: genreStats,
            platforms: platformStats,
            engines: engineStats,
            pegi: pegiStatsFiltered
        };

        console.log(`Created filter stats: ${genreStats.length} genres, ${platformStats.length} platforms, ${engineStats.length} engines, ${pegiStatsFiltered.length} PEGI ratings`);

        filterStatsCache = result;
        filterStatsCacheTime = now;

        res.json(result);
    } catch (error) {
        console.error('Error getting filter stats:', error);

        if (error.response?.status === 429) {
            console.warn('Rate limit reached for filter stats, returning cached data if available');
            if (filterStatsCache) {
                return res.json(filterStatsCache);
            }
            return res.json({
                genres: [],
                platforms: [],
                engines: []
            });
        }

        console.warn('Returning empty filter stats due to error');
        if (filterStatsCache) {
            console.log('Returning cached filter stats as fallback');
            return res.json(filterStatsCache);
        }
        res.status(500).json({
            error: 'Failed to load filter stats',
            genres: [],
            platforms: [],
            engines: [],
            pegi: [],
            details: error.response?.data?.message || error.message || 'Unknown error'
        });
    }
});

// Аутентификация
app.post('/auth/register', async (req, res) => {
    try {
        const { email, name, password } = req.body;

        if (!email || !name || !password) {
            return res.status(400).json({ error: 'Email, name, and password are required' });
        }

        const { user, accessToken, refreshToken } = await registerUser(email, name, password);

        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 15 * 60 * 1000,
            path: '/'
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        console.log('Cookies set for user:', user.email);
        res.json({ user });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const { user, accessToken, refreshToken } = await loginUser(email, password);

        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 15 * 60 * 1000,
            path: '/'
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        console.log('Cookies set for user:', user.email);
        res.json({ user });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: error.message });
    }
});

// Обновление access token через refresh token
app.post('/auth/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Session expired. Please sign in again' });
        }

        const { accessToken, user } = await refreshAccessToken(refreshToken);

        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 15 * 60 * 1000,
            path: '/'
        });

        console.log('Access token refreshed for user:', user.email);
        res.json({ user });
    } catch (error) {
        console.error('Refresh token error:', error);
        // Очищаем cookies при ошибке
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.status(401).json({ error: error.message });
    }
});

// Выход из системы
app.post('/auth/logout', async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (refreshToken) {
            await logoutUser(refreshToken);
        }

        // Очищаем cookies
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});

app.get('/auth/me', authenticateToken, (req, res) => {
    const { password_hash, ...userWithoutPassword } = req.user;
    res.json({ user: userWithoutPassword });
});

// Получение хеша пароля для отображения
app.get('/auth/me/password-hash', authenticateToken, async (req, res) => {
    try {
        const { getUserById } = await import('./database.js');
        const user = getUserById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Возвращаем только хеш пароля 
        res.json({ passwordHash: user.password_hash || 'No password set' });
    } catch (error) {
        console.error('Error getting password hash:', error);
        res.status(500).json({ error: 'Failed to get password hash' });
    }
});

// Обновление данных пользователя
app.put('/auth/me', authenticateToken, async (req, res) => {
    try {
        const { name, email, password, currentPassword } = req.body;
        const userId = req.user.id;

        if (name === undefined && email === undefined && password === undefined) {
            return res.status(400).json({ error: 'At least one field (name, email, password) must be provided' });
        }

        // Если обновляется email, проверяем, что он не занят другим пользователем
        if (email !== undefined) {
            const { getUserByEmail } = await import('./database.js');
            const existingUser = getUserByEmail(email);
            if (existingUser && existingUser.id !== userId) {
                return res.status(400).json({ error: 'Email is already taken' });
            }
        }

        // Если обновляется пароль, проверяем текущий пароль
        if (password !== undefined && password.trim() !== '') {
            if (!currentPassword || currentPassword.trim() === '') {
                return res.status(400).json({ error: 'Current password is required to change password' });
            }

            // Получаем пользователя для проверки текущего пароля
            const { getUserById, verifyPassword } = await import('./database.js');
            const user = getUserById(userId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.password_hash) {
                return res.status(400).json({ error: 'Cannot change password for OAuth users' });
            }

            if (!verifyPassword(currentPassword, user.password_hash)) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }
        }

        // Обновляем данные пользователя
        const { updateUser } = await import('./database.js');
        const updated = updateUser(userId, { name, email, password });

        if (!updated) {
            return res.status(400).json({ error: 'No changes to update' });
        }

        // Получаем обновленные данные пользователя
        const { getUserById } = await import('./database.js');
        const updatedUser = getUserById(userId);

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { password_hash, ...userWithoutPassword } = updatedUser;
        res.json({ user: userWithoutPassword });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Избранное
app.get('/favorites', authenticateToken, (req, res) => {
    try {
        const gameIds = getFavorites(req.user.id);
        res.json({ gameIds });
    } catch (error) {
        console.error('Error getting favorites:', error);
        res.status(500).json({ error: 'Failed to get favorites' });
    }
});

app.post('/favorites/:gameId', authenticateToken, (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const success = addFavorite(req.user.id, gameId);
        if (success) {
            res.json({ message: 'Game added to favorites' });
        } else {
            res.status(400).json({ error: 'Game already in favorites' });
        }
    } catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({ error: 'Failed to add favorite' });
    }
});

app.delete('/favorites/:gameId', authenticateToken, (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const success = removeFavorite(req.user.id, gameId);
        if (success) {
            res.json({ message: 'Game removed from favorites' });
        } else {
            res.status(404).json({ error: 'Game not in favorites' });
        }
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ error: 'Failed to remove favorite' });
    }
});

app.get('/favorites/:gameId/check', authenticateToken, (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const favorited = isFavorite(req.user.id, gameId);
        res.json({ favorited });
    } catch (error) {
        console.error('Error checking favorite:', error);
        res.status(500).json({ error: 'Failed to check favorite' });
    }
});

// Google OAuth авторизация
app.get('/auth/google', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const scope = process.env.GOOGLE_SCOPE || 'openid profile email';

    if (!clientId) {
        console.error('Missing Google OAuth environment variables');
        return res.status(500).json({
            error: 'Google OAuth configuration is missing',
            details: 'Please set GOOGLE_CLIENT_ID environment variable'
        });
    }

    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    let redirectUri;
    
    if (origin) {
        redirectUri = `${origin}/signin-callback`;
    } else {
        redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/signin-callback';
    }

    console.log('Google OAuth config:', {
        hasClientId: !!clientId,
        redirectUri,
        origin,
        headersOrigin: req.headers.origin,
        headersReferer: req.headers.referer,
        scope
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

    res.json({ authUrl });
});

app.post('/auth/google/callback', async (req, res) => {
    try {
        const { code, redirectUri: clientRedirectUri } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code is required' });
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        
        let redirectUri = clientRedirectUri;
        if (!redirectUri) {
            const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
            if (origin) {
                redirectUri = `${origin}/signin-callback`;
            } else {
                redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/signin-callback';
            }
        }
        
        console.log('Google OAuth callback:', {
            hasCode: !!code,
            redirectUri,
            clientRedirectUri,
            headersOrigin: req.headers.origin,
            headersReferer: req.headers.referer
        });

        if (!clientId || !clientSecret) {
            console.error('Missing Google OAuth environment variables:', {
                hasClientId: !!clientId,
                hasClientSecret: !!clientSecret
            });
            return res.status(500).json({ error: 'Google OAuth configuration is missing' });
        }

        console.log('Exchanging code for token...', { code: code.substring(0, 20) + '...' });

        let tokenResponse;
        try {
            const params = new URLSearchParams();
            params.append('code', code);
            params.append('client_id', clientId);
            params.append('client_secret', clientSecret);
            params.append('redirect_uri', redirectUri);
            params.append('grant_type', 'authorization_code');

            console.log('Token request params:', {
                code: code.substring(0, 20) + '...',
                client_id: clientId?.substring(0, 20) + '...',
                redirect_uri: redirectUri
            });

            tokenResponse = await axios.post(
                'https://oauth2.googleapis.com/token',
                params.toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            if (!tokenResponse.data || !tokenResponse.data.access_token) {
                console.error('Invalid token response:', tokenResponse.data);
                throw new Error('Invalid token response from Google');
            }

            console.log('Token response received successfully');
        } catch (tokenError) {
            console.error('Token exchange error:', tokenError.response?.data || tokenError.message);
            return res.status(400).json({
                error: 'Failed to exchange code for token',
                details: tokenError.response?.data || tokenError.message
            });
        }

        const { access_token } = tokenResponse.data;
        if (!access_token) {
            console.error('No access token in response:', tokenResponse.data);
            return res.status(500).json({ error: 'No access token received from Google' });
        }

        console.log('Getting user info from Google...');

        let userResponse;
        try {
            userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${access_token}` }
            });
        } catch (userError) {
            console.error('User info error:', userError.response?.data || userError.message);
            return res.status(400).json({
                error: 'Failed to get user info from Google',
                details: userError.response?.data || userError.message
            });
        }

        const { email, name } = userResponse.data;

        if (!email) {
            console.error('No email in user response:', userResponse.data);
            return res.status(400).json({ error: 'Email not provided by Google' });
        }

        console.log('Creating/finding user:', { email, name });

        // Проверяем, существует ли пользователь
        let user = getUserByEmail(email);
        if (!user) {
            const userId = createUser(email, name || email.split('@')[0], 'google_oauth_' + Date.now());
            user = getUserById(userId);
            if (!user) {
                console.error('Failed to create user');
                return res.status(500).json({ error: 'Failed to create user' });
            }
        }

        const { password_hash, ...userWithoutPassword } = user;
        user = userWithoutPassword;

        const { generateAccessToken, generateRefreshToken } = await import('./auth.js');
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken();

        const { createRefreshToken } = await import('./database.js');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        createRefreshToken(user.id, refreshToken, expiresAt.toISOString());

        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 15 * 60 * 1000,
            path: '/'
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        console.log('Google OAuth success for user:', user.email);
        console.log('Cookies set for Google OAuth user');

        res.json({ user });
    } catch (error) {
        console.error('Google OAuth error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Failed to authenticate with Google',
            details: error.message || 'Unknown error'
        });
    }
});

app.listen(port, () => {
    console.log(`The server is running on http://localhost:${port}`)
});