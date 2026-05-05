import axios from 'axios';
import twitchAuth from './twitchAuth.js';
import dotenv from 'dotenv';

dotenv.config();

class IGDBService {

    constructor() {
        this.baseURL = 'https://api.igdb.com/v4';
        this.gameCache = new Map();
        this.maxCacheSize = 1000;
        this.cacheCleanupInterval = 30 * 60 * 1000;

        setInterval(() => {
            this.cleanupCache();
        }, this.cacheCleanupInterval);
    }

    cleanupCache() {
        const now = Date.now();
        let deletedCount = 0;

        for (const [key, item] of this.gameCache.entries()) {
            if (item.expiresAt <= now) {
                this.gameCache.delete(key);
                deletedCount++;
            }
        }

        if (this.gameCache.size > this.maxCacheSize) {
            const entries = Array.from(this.gameCache.entries());
            entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);

            const toDelete = this.gameCache.size - this.maxCacheSize;
            for (let i = 0; i < toDelete; i++) {
                this.gameCache.delete(entries[i][0]);
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            console.log(`Cache cleanup: removed ${deletedCount} expired/old entries, ${this.gameCache.size} remaining`);
        }
    }

    getCachedGame(cacheKey) {
        const item = this.gameCache.get(cacheKey);
        if (!item) return null;
        if (item.expiresAt <= Date.now()) {
            this.gameCache.delete(cacheKey);
            return null;
        }
        return item.value;
    }

    setCachedGame(cacheKey, value, ttlMs = 10 * 60 * 1000) {
        if (this.gameCache.size >= this.maxCacheSize) {
            const oldestKey = this.gameCache.keys().next().value;
            this.gameCache.delete(oldestKey);
        }
        this.gameCache.set(cacheKey, { value, expiresAt: Date.now() + ttlMs });
    }

    async getGamesByIds(ids) {
        try {
            console.log('getGamesByIds called with:', ids);

            const uniqueIds = Array.from(new Set(ids.map(Number).filter(n => !Number.isNaN(n))));
            console.log('Unique valid IDs:', uniqueIds);

            if (uniqueIds.length === 0) {
                console.log('No valid IDs provided, returning empty array');
                return [];
            }

            const headers = await twitchAuth.getAuthHeaders();
            const query = `fields id,name,slug,first_release_date,genres.name,platforms.name,game_engines.name,videos.video_id,cover.image_id,rating; where id = (${uniqueIds.join(',')}); limit ${Math.min(uniqueIds.length, 500)};`;

            console.log('IGDB query:', query);

            const response = await axios.post(`${this.baseURL}/games`, query, { headers, timeout: 10000 });

            console.log('IGDB response status:', response.status);
            console.log('IGDB response data length:', response.data?.length || 0);

            const games = (response.data || []).map(g => this.normalizeGame(g));
            console.log('Normalized games:', games.length);

            return games;
        } catch (error) {
            console.error('Error in getGamesByIds:', error.response?.data || error.message);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }

    async getGamesCount({
        search,
        ratingMin,
        ratingMax,
        genres,
        platforms,
        engines,
        releaseDateMin,
        releaseDateMax,
        sortBy
    }) {
        const headers = await twitchAuth.getAuthHeaders();
        const where = [];

        where.push(...this.buildRatingWhere(ratingMin, ratingMax, true));

        const addFilterCondition = (filterValue, fieldName) => {
            if (!filterValue) return;
            const ids = filterValue.split(',').map(Number).filter(n => !isNaN(n));
            if (ids.length === 1) {
                where.push(`${fieldName} = (${ids[0]})`);
            } else if (ids.length > 1) {
                ids.forEach(id => {
                    where.push(`${fieldName} = (${id})`);
                });
            }
        };

        addFilterCondition(genres, 'genres');
        addFilterCondition(platforms, 'platforms');
        addFilterCondition(engines, 'game_engines');

        const dateConditions = [];
        if (releaseDateMin) {
            const from = Math.floor(new Date(releaseDateMin).getTime() / 1000);
            if (!Number.isNaN(from)) {
                dateConditions.push(`first_release_date >= ${from}`);
            }
        }
        if (releaseDateMax) {
            const to = Math.floor(new Date(releaseDateMax).getTime() / 1000);
            if (!Number.isNaN(to)) {
                dateConditions.push(`first_release_date <= ${to}`);
            }
        }
        if (dateConditions.length) {
            where.push(...dateConditions);
        }

        if (search && search.trim()) {
            const searchTerm = search.trim();
            const escapedSearch = searchTerm.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            where.push(`name ~ "${escapedSearch}"*`);
        }

        let query = '';
        if (where.length > 0) {
            query = `where ${where.join(' & ')};`;
        }

        try {
            const response = await axios.post(
                `${this.baseURL}/games/count`,
                query,
                { headers }
            );
            const count = response.data.count || 0;
            if (genres || platforms || engines) {
                console.log(`getGamesCount result: ${count} games`);
            }
            return count;
        } catch (error) {
            console.error('Error getting games count:', error.response?.data || error.message);
            console.error('Query was:', query);
            return 0;
        }
    }

    async getGamesWithFilters({
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
        sortBy
    }) {
        const headers = await twitchAuth.getAuthHeaders();

        const where = [];
        where.push(...this.buildRatingWhere(ratingMin, ratingMax, false));

        const addFilterCondition = (filterValue, fieldName) => {
            if (!filterValue) return;
            const ids = filterValue.split(',').map(Number).filter(n => !isNaN(n));
            if (ids.length === 1) {
                where.push(`${fieldName} = (${ids[0]})`);
            } else if (ids.length > 1) {
                ids.forEach(id => {
                    where.push(`${fieldName} = (${id})`);
                });
            }
        };

        addFilterCondition(genres, 'genres');
        addFilterCondition(platforms, 'platforms');
        addFilterCondition(engines, 'game_engines');

        const dateConditions = [];
        if (releaseDateMin) {
            const from = Math.floor(new Date(releaseDateMin).getTime() / 1000);
            if (!Number.isNaN(from)) {
                dateConditions.push(`first_release_date >= ${from}`);
            }
        }
        if (releaseDateMax) {
            const to = Math.floor(new Date(releaseDateMax).getTime() / 1000);
            if (!Number.isNaN(to)) {
                dateConditions.push(`first_release_date <= ${to}`);
            }
        }
        if (dateConditions.length) {
            where.push(...dateConditions);
        }
        const sortMap = {
            'rating-desc': 'rating desc',
            'rating-asc': 'rating asc',
            'name-asc': 'name asc',
            'name-desc': 'name desc',
            'release-desc': 'first_release_date desc',
            'release-asc': 'first_release_date asc'
        };

        let query = `fields id,name,slug,summary,storyline,status,game_status,game_type,created_at,updated_at,checksum,url,external_games,first_release_date,release_dates,genres.name,platforms.name,game_engines.name,game_modes.name,themes.name,keywords.name,tags,player_perspectives.name,hypes,alternative_names.name,artworks.image_id,videos.video_id,cover.image_id,cover.url,rating ;`;

        if (search && search.trim()) {
            const searchTerm = search.trim();
            const escapedSearch = searchTerm.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            where.push(`name ~ "${escapedSearch}"*`);
            console.log(`Using where name ~ filter for search: "${searchTerm}"`);
        }

        if (where.length > 0) {
            query += ` where ${where.join(' & ')};`;
        }

        const sortClause = sortMap[sortBy] || 'first_release_date desc';
        query += ` sort ${sortClause};`;

        const actualLimit = limit;

        query += ` limit ${actualLimit};`;
        query += ` offset ${offset};`;

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delayMs = 1000 * Math.pow(2, attempt - 1);
                    await delay(delayMs);
                }

                const response = await axios.post(
                    `${this.baseURL}/games`,
                    query,
                    { headers, timeout: 10000 }
                );
                let websitesMap = new Map();
                const websiteIds = new Set();
                response.data.forEach(game => {
                    if (game.websites) {
                        if (Array.isArray(game.websites)) {
                            game.websites.forEach(w => {
                                const id = typeof w === 'number' ? w : (w && w.id && !w.url ? w.id : null);
                                if (id) {
                                    websiteIds.add(id);
                                }
                            });
                        } else if (typeof game.websites === 'object' && game.websites.id !== undefined && !game.websites.url) {
                            websiteIds.add(game.websites.id);
                        }
                    }
                });

                if (websiteIds.size > 0) {
                    try {
                        const websiteIdsArray = Array.from(websiteIds);
                        for (let i = 0; i < websiteIdsArray.length; i += 500) {
                            const batch = websiteIdsArray.slice(i, i + 500);
                            const websitesQuery = `fields id, url, category; where id = (${batch.join(',')}); limit 500;`;
                            const websitesResponse = await axios.post(
                                `${this.baseURL}/websites`,
                                websitesQuery,
                                { headers }
                            );
                            websitesResponse.data.forEach(w => {
                                websitesMap.set(w.id, w);
                            });
                        }
                        console.log(`Fetched ${websitesMap.size} websites details for expansion`);
                    } catch (error) {
                        console.error('Error fetching websites details:', error.response?.data || error.message);
                    }
                }

                response.data.forEach(game => {
                    if (game.websites) {
                        if (Array.isArray(game.websites)) {
                            const expandedWebsites = [];
                            game.websites.forEach(w => {
                                const id = typeof w === 'number' ? w : (w && w.id ? w.id : null);
                                if (id && websitesMap.has(id)) {
                                    expandedWebsites.push(websitesMap.get(id));
                                } else if (w && typeof w === 'object' && w.url && w.category) {
                                    expandedWebsites.push(w);
                                }
                            });
                            if (expandedWebsites.length > 0) {
                                game.websites = expandedWebsites;
                            }
                        } else if (typeof game.websites === 'object') {
                            if (game.websites.id !== undefined && !game.websites.url && websitesMap.has(game.websites.id)) {
                                game.websites = [websitesMap.get(game.websites.id)];
                            } else if (game.websites.url && game.websites.category) {
                                game.websites = [game.websites];
                            }
                        }
                    }
                });

                let games = response.data.map(game => this.normalizeGame(game));

                if (games.length === 0 && (ratingMin !== undefined || ratingMax !== undefined) && response.data.length > 0) {
                    console.warn(`No games after rating filter! ratingMin=${ratingMin}, ratingMax=${ratingMax}`);
                    const sampleRatings = response.data.slice(0, 20).map(g => ({
                        id: g.id,
                        name: g.name?.substring(0, 40),
                        rating: g.rating,
                        rounded: g.rating ? Math.round(g.rating) : null
                    }));
                    console.log('Sample ratings from API response (first 20):', sampleRatings);
                }

                if (search && search.trim()) {
                    const searchLower = search.trim().toLowerCase();
                    games.sort((a, b) => {
                        const aStarts = a.name && a.name.toLowerCase().startsWith(searchLower);
                        const bStarts = b.name && b.name.toLowerCase().startsWith(searchLower);
                        if (aStarts && !bStarts) return -1;
                        if (!aStarts && bStarts) return 1;
                        return 0;
                    });
                }

                const applyClientSideFilter = (filterValue, gameField) => {
                    if (!filterValue) return;
                    const ids = filterValue.split(',').map(Number).filter(n => !isNaN(n));
                    if (ids.length === 0) return;
                    games = games.filter(game => {
                        if (!game[gameField] || game[gameField].length === 0) return false;
                        const gameIds = game[gameField].map(item => item.id);
                        return ids.every(id => gameIds.includes(id));
                    });
                };

                applyClientSideFilter(genres, 'genres');
                applyClientSideFilter(platforms, 'platforms');

                return games;
            } catch (error) {
                lastError = error;

                if ((error.response?.status === 429 || error.code === 'ECONNRESET') && attempt < maxRetries) {
                    continue;
                }

                console.error('IGDB API Error:', error.response?.data || error.message);
                console.error('Query that failed:', query);
                throw error;
            }
        }

        throw lastError;
    }
    async getGameByIdOrSlug(idOrSlug, isSlug = false) {
        const headers = await twitchAuth.getAuthHeaders();
        const cacheKey = isSlug ? `slug:${idOrSlug}` : `id:${idOrSlug}`;
        const cached = this.getCachedGame(cacheKey);
        if (cached) return cached;

        const whereClause = isSlug ? `slug = "${idOrSlug}"` : `id = ${idOrSlug}`;
        const query = `fields id,name,slug,summary,storyline,status,game_status,game_type,created_at,updated_at,checksum,url,external_games,first_release_date,release_dates,genres.name,platforms.name,game_engines.name,game_modes.name,themes.name,keywords.name,tags,player_perspectives.name,hypes,alternative_names.name,artworks.image_id,videos.video_id,cover.image_id,cover.url,screenshots.image_id,websites.url,websites.category,similar_games,language_supports.language.name,language_supports.language_support_type,rating; where ${whereClause};`;

        try {
            const response = await axios.post(
                `${this.baseURL}/games`,
                query,
                { headers }
            );

            if (response.data.length === 0) {
                throw new Error('Game not found');
            }

            const game = response.data[0];

            if (game.websites) {
                if (Array.isArray(game.websites)) {
                    const needsExpansion = game.websites.some(w => {
                        if (typeof w === 'number') return true;
                        if (w && w.id && !w.category) return true;
                        return false;
                    });

                    if (needsExpansion) {
                        const websiteIds = new Set();
                        game.websites.forEach(w => {
                            const id = typeof w === 'number' ? w : (w && w.id ? w.id : null);
                            if (id) websiteIds.add(id);
                        });

                        if (websiteIds.size > 0) {
                            try {
                                const websitesQuery = `fields id, url, category; where id = (${Array.from(websiteIds).join(',')});`;
                                const websitesResponse = await axios.post(
                                    `${this.baseURL}/websites`,
                                    websitesQuery,
                                    { headers }
                                );

                                const websitesMap = new Map();
                                websitesResponse.data.forEach(w => {
                                    websitesMap.set(w.id, w);
                                });

                                const expandedWebsites = [];
                                game.websites.forEach(w => {
                                    const id = typeof w === 'number' ? w : (w && w.id ? w.id : null);
                                    if (id && websitesMap.has(id)) {
                                        expandedWebsites.push(websitesMap.get(id));
                                    } else if (w && typeof w === 'object' && w.url) {
                                        expandedWebsites.push(w);
                                    }
                                });
                                game.websites = expandedWebsites;
                            } catch (error) {
                                console.error('Error expanding websites:', error.message);
                                game.websites = game.websites.filter(w => w && typeof w === 'object' && w.url);
                            }
                        }
                    } else {
                        game.websites = game.websites.filter(w => w && typeof w === 'object' && w.url);
                    }
                } else if (typeof game.websites === 'object') {
                    if (!game.websites.category && game.websites.id) {
                        try {
                            const websitesQuery = `fields id, url, category; where id = ${game.websites.id};`;
                            const websitesResponse = await axios.post(
                                `${this.baseURL}/websites`,
                                websitesQuery,
                                { headers }
                            );
                            if (websitesResponse.data.length > 0) {
                                game.websites = [websitesResponse.data[0]];
                            } else {
                                game.websites = [];
                            }
                        } catch (error) {
                            console.error('Error expanding website:', error.message);
                            game.websites = [];
                        }
                    } else if (game.websites.url) {
                        game.websites = [game.websites];
                    } else {
                        game.websites = [];
                    }
                }
            }

            if (game.screenshots && Array.isArray(game.screenshots)) {
                const screenshotIds = new Set();
                game.screenshots.forEach(s => {
                    const id = typeof s === 'number' ? s : (s && s.image_id ? s.image_id : (s && s.id ? s.id : null));
                    if (id) screenshotIds.add(id);
                });

                if (screenshotIds.size > 0) {
                    game.screenshots = Array.from(screenshotIds).map(id => ({
                        image_id: typeof id === 'number' ? id : (id && id.image_id ? id.image_id : id),
                        url: `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${typeof id === 'number' ? id : (id && id.image_id ? id.image_id : id)}.jpg`
                    }));
                }
            }

            if (game.similar_games && Array.isArray(game.similar_games)) {
                const similarGameIds = game.similar_games.map(id => typeof id === 'number' ? id : (id && id.id ? id.id : id)).filter(Boolean);
                if (similarGameIds.length > 0) {
                    try {
                        const similarGamesQuery = `fields id,name,slug,cover.image_id,rating,genres.name; where id = (${similarGameIds.slice(0, 10).join(',')});`;
                        const similarGamesResponse = await axios.post(
                            `${this.baseURL}/games`,
                            similarGamesQuery,
                            { headers }
                        );
                        game.similar_games = similarGamesResponse.data.map(g => ({
                            id: g.id,
                            name: g.name,
                            slug: g.slug,
                            cover: g.cover ? { url: `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` } : null,
                            rating: g.rating,
                            genres: g.genres
                        }));
                    } catch (error) {
                        console.error('Error fetching similar games:', error.message);
                        game.similar_games = [];
                    }
                }
            }

            const normalized = this.normalizeGame(game);
            this.setCachedGame(cacheKey, normalized);
            return normalized;
        } catch (error) {
            console.error(`Error getting game by ${isSlug ? 'slug' : 'ID'}:`, error.response?.data || error.message);
            throw error;
        }
    }

    async getGameById(id) {
        return this.getGameByIdOrSlug(id, false);
    }

    async getGameBySlug(slug) {
        return this.getGameByIdOrSlug(slug, true);
    }

    normalizeGame(game) {
        const releaseDate = game.first_release_date
            ? new Date(game.first_release_date * 1000).toISOString()
            : undefined;

        let externalLinks = undefined;
        if (game.websites) {
            const websites = Array.isArray(game.websites) ? game.websites : [game.websites];
            const links = {};

            websites.forEach(w => {
                if (w && w.url && w.category !== undefined) {
                    if (w.category === 13) {
                        links.steam = w.url;
                    } else if (w.category === 17) {
                        links.gog = w.url;
                    } else if (w.category === 16) {
                        links.epic = w.url;
                    } else if (w.category === 26) {
                        links.playstation = w.url;
                    } else if (w.category === 27) {
                        links.xbox = w.url;
                    }
                } else if (w && w.url) {
                    if (w.url.includes('store.steampowered.com') || w.url.includes('steampowered.com')) {
                        links.steam = w.url;
                    } else if (w.url.includes('gog.com')) {
                        links.gog = w.url;
                    } else if (w.url.includes('epicgames.com') || w.url.includes('store.epicgames.com')) {
                        links.epic = w.url;
                    } else if (w.url.includes('playstation.com') || w.url.includes('store.playstation.com')) {
                        links.playstation = w.url;
                    } else if (w.url.includes('xbox.com') || w.url.includes('microsoft.com')) {
                        links.xbox = w.url;
                    }
                }
            });

            if (links.steam || links.gog || links.epic || links.playstation || links.xbox) {
                externalLinks = links;
            }
        }

        let screenshots = [];
        if (game.screenshots) {
            if (Array.isArray(game.screenshots)) {
                screenshots = game.screenshots.map(s => {
                    const imageId = typeof s === 'number' ? s : (s && s.image_id ? s.image_id : (s && s.id ? s.id : null));
                    if (imageId) {
                        return {
                            image_id: imageId,
                            url: `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${imageId}.jpg`
                        };
                    }
                    return null;
                }).filter(Boolean);
            }
        }

        let languageSupports = [];
        if (game.language_supports && Array.isArray(game.language_supports)) {
            languageSupports = game.language_supports.map(ls => {
                if (ls && typeof ls === 'object') {
                    return {
                        language: ls.language ? (typeof ls.language === 'object' ? ls.language.name : ls.language) : null,
                        language_support_type: ls.language_support_type
                    };
                }
                return null;
            }).filter(Boolean);
        }

        let trailerVideoId = undefined;
        if (game.videos && Array.isArray(game.videos) && game.videos.length > 0) {
            const first = game.videos.find(v => v && v.video_id) || game.videos[0];
            if (first && first.video_id) {
                trailerVideoId = first.video_id;
            }
        }

        return {
            ...game,
            releaseDate,
            cover: game.cover
                ? (game.cover.url
                    ? { url: game.cover.url }
                    : (game.cover.image_id ? { url: `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg` } : null))
                : null,
            engines: game.game_engines || undefined,
            externalLinks: externalLinks,
            trailerVideoId,
            screenshots: screenshots,
            language_supports: languageSupports,
            similar_games: game.similar_games || []
        };
    }

    async getPopularGames({ limit = 20 } = {}) {
        try {
            const headers = await twitchAuth.getAuthHeaders();
            const actualLimit = Math.min(Number(limit) || 20, 50);
            const query = `fields id,name,slug,first_release_date,genres.name,platforms.name,game_engines.name,game_modes.name,themes.name,keywords.name,tags,player_perspectives.name,hypes,artworks.image_id,videos.video_id,cover.image_id,cover.url,rating; where cover != null & rating != null; sort rating desc; limit ${actualLimit};`;

            const response = await axios.post(`${this.baseURL}/games`, query, {
                headers,
                timeout: 10000
            });

            return (response.data || []).map(g => this.normalizeGame(g));
        } catch (error) {
            console.error('Error in getPopularGames:', error.response?.data || error.message);
            if (error.response?.status === 429) {
                console.log('Rate limit exceeded for popular games, returning empty array');
                return [];
            }
            throw error;
        }
    }

    async getUpcomingGames({ limit = 12 } = {}) {
        try {
            const headers = await twitchAuth.getAuthHeaders();
            const actualLimit = Math.min(Number(limit) || 12, 50);
            const now = Math.floor(Date.now() / 1000);
            const query = `fields id,name,slug,first_release_date,genres.name,platforms.name,game_engines.name,game_modes.name,themes.name,keywords.name,tags,player_perspectives.name,hypes,artworks.image_id,videos.video_id,cover.image_id,cover.url,rating; where first_release_date != null & first_release_date > ${now}; sort first_release_date asc; limit ${actualLimit};`;

            const response = await axios.post(`${this.baseURL}/games`, query, {
                headers,
                timeout: 10000
            });

            return (response.data || []).map(g => this.normalizeGame(g));
        } catch (error) {
            console.error('Error in getUpcomingGames:', error.response?.data || error.message);
            if (error.response?.status === 429) {
                console.log('Rate limit exceeded for upcoming games, returning empty array');
                return [];
            }
            throw error;
        }
    }

    buildRatingWhere(ratingMin, ratingMax, log = false) {
        const where = [];
        if (ratingMin !== undefined && ratingMin !== null && !isNaN(Number(ratingMin))) {
            const minRating = Number(ratingMin);
            const minValue = minRating > 0 ? Math.max(0, Math.floor(minRating - 0.5)) : 0;
            where.push(`rating >= ${minValue}`);
            if (log) {
                console.log(`Rating min filter: requesting rating >= ${minValue} (for minRating=${minRating})`);
            }
        }
        if (ratingMax !== undefined && ratingMax !== null && !isNaN(Number(ratingMax))) {
            const maxRating = Number(ratingMax);
            let maxValue;
            if (maxRating >= 100) maxValue = 100;
            else if (maxRating >= 22 && maxRating <= 91) maxValue = Math.min(100, maxRating + 10);
            else if (maxRating < 22) maxValue = Math.min(100, maxRating + 5);
            else maxValue = Math.min(100, maxRating + 2);
            where.push(`rating <= ${maxValue}`);
            if (log) {
                console.log(`Rating max filter: requesting rating <= ${maxValue} (for maxRating=${maxRating})`);
            }
        }
        return where;
    }
}

const service = new IGDBService();
export default service;