import axios from 'axios';
import IGDBService from '../services/igdbService.js';
import twitchAuth from '../services/twitchAuth.js';

let filterStatsCache = null;
let filterStatsCacheTime = 0;
const FILTER_STATS_CACHE_TTL = 60 * 60 * 1000;

export const getFilterStats = async (req, res) => {
    try {
        const now = Date.now();
        const hasFilters =
            req.query.genres ||
            req.query.platforms ||
            req.query.engines ||
            req.query.search ||
            req.query.ratingMin ||
            req.query.ratingMax ||
            req.query.releaseDateMin ||
            req.query.ageRatings ||
            req.query.releaseDateMax;

        if (!hasFilters && filterStatsCache && (now - filterStatsCacheTime) < FILTER_STATS_CACHE_TTL) {
            console.log('Returning cached filter stats (no filters)');
            return res.json(filterStatsCache);
        }

        const headers = await twitchAuth.getAuthHeaders();

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

        const BATCH_SIZE = 500;
        const TOTAL_BATCHES = Math.ceil(totalGamesCount / BATCH_SIZE);
        const MAX_BATCHES = Math.min(TOTAL_BATCHES, 5);

        const metadataPromise = Promise.all([
            axios.post('https://api.igdb.com/v4/genres', 'fields id,name; limit 500;', { headers }),
            axios.post('https://api.igdb.com/v4/platforms', 'fields id,name; limit 500;', { headers }),
            axios.post('https://api.igdb.com/v4/game_engines', 'fields id,name; limit 500;', { headers })
        ]);

        let totalProcessedGames = 0;
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

        const buildCountFilters = (req, overrides = {}) => ({
            search: req.query.search || undefined,
            genres: req.query.genres || undefined,
            platforms: req.query.platforms || undefined,
            engines: req.query.engines || undefined,
            releaseDateMin: req.query.releaseDateMin || undefined,
            releaseDateMax: req.query.releaseDateMax || undefined,
            ratingMin: req.query.ratingMin ? Number(req.query.ratingMin) : 0,
            ratingMax: req.query.ratingMax ? Number(req.query.ratingMax) : 100,
            sortBy: undefined,
            ...overrides
        });

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

                if (i + batchSize < items.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            console.log(`Completed processing ${type}: ${results.filter(r => r.count > 0).length} with count > 0`);
            return results;
        };

        console.log('Getting exact counts for genres...');
        const genreCandidates = genresRes.data
            .filter(genre => genreUsage.has(genre.id))
            .sort((a, b) => (genreUsage.get(b.id) || 0) - (genreUsage.get(a.id) || 0));

        const genreResults = await processBatch(genreCandidates, async (genre) => {
            return await IGDBService.getGamesCount(
                buildCountFilters(req, {
                    genres: String(genre.id),
                    ratingMin: req.query.ratingMin ? Number(req.query.ratingMin) : 0,
                    ratingMax: req.query.ratingMax ? Number(req.query.ratingMax) : 100
                })
            );
        }, 5, 'genres');

        const genreStats = genreResults
            .map(({ item, count }) => ({
                id: item.id,
                name: item.name,
                count: count
            }))
            .filter(stat => stat.count > 0)
            .sort((a, b) => a.name.localeCompare(b.name));

        console.log('Getting exact counts for platforms...');
        const platformCandidates = platformsRes.data
            .filter(platform => platformUsage.has(platform.id))
            .sort((a, b) => (platformUsage.get(b.id) || 0) - (platformUsage.get(a.id) || 0))
            .slice(0, 20);

        const platformResults = await processBatch(platformCandidates, async (platform) => {
            return await IGDBService.getGamesCount(
                buildCountFilters(req, {
                    platforms: String(platform.id),
                    ratingMin: req.query.ratingMin ? Number(req.query.ratingMin) : 0,
                    ratingMax: req.query.ratingMax ? Number(req.query.ratingMax) : 100
                })
            );
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
        const engineCandidates = enginesRes.data
            .filter(engine => engineUsage.has(engine.id))
            .sort((a, b) => (engineUsage.get(b.id) || 0) - (engineUsage.get(a.id) || 0))
            .slice(0, 20);

        const engineResults = await processBatch(engineCandidates, async (engine) => {
            try {
                const count = await IGDBService.getGamesCount(
                    buildCountFilters(req, {
                        engines: String(engine.id),
                        ratingMin: req.query.ratingMin ? Number(req.query.ratingMin) : 0,
                        ratingMax: req.query.ratingMax ? Number(req.query.ratingMax) : 100
                    })
                );
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

        const result = {
            genres: genreStats,
            platforms: platformStats,
            engines: engineStats
        };

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

        if (filterStatsCache) {
            console.log('Returning cached filter stats as fallback');
            return res.json(filterStatsCache);
        }
        res.status(500).json({
            error: 'Failed to load filter stats',
            genres: [],
            platforms: [],
            engines: [],
            details: error.response?.data?.message || error.message || 'Unknown error'
        });
    }
};