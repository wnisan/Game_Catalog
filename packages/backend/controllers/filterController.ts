import axios from 'axios';
import { Request, Response } from 'express';
import IGDBService from '../services/igdbService.js';
import twitchAuth from '../services/twitchAuth.js';

interface FilterItem {
    id: number;
    name: string;
}

interface GameBatchItem {
    genres?: number[];
    platforms?: number[];
    game_engines?: number[];
}

interface FilterStat {
    id: number;
    name: string;
    count: number;
}

interface FilterStatsResponse {
    genres: FilterStat[];
    platforms: FilterStat[];
    engines: FilterStat[];
    error?: string;
    details?: string;
}

interface ErrorWithResponse {
    response?: { data?: { message?: string } | unknown; status?: number };
    message?: string;
}

interface CountFilters {
    search?: string | undefined;
    genres?: string | undefined;
    platforms?: string | undefined;
    engines?: string | undefined;
    releaseDateMin?: string | undefined;
    releaseDateMax?: string | undefined;
    ratingMin: number;
    ratingMax: number;
}

let filterStatsCache: FilterStatsResponse | null = null;
let filterStatsCacheTime = 0;
const FILTER_STATS_CACHE_TTL = 60 * 60 * 1000;

function isErrorWithResponse(error: unknown): error is ErrorWithResponse {
    return typeof error === 'object' && error !== null;
}

function queryValueToString(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return undefined;
}

function queryValueToNumber(value: unknown, fallback: number): number {
    const str = queryValueToString(value);
    if (!str) return fallback;
    const parsed = Number(str);
    return Number.isNaN(parsed) ? fallback : parsed;
}

export const getFilterStats = async (req: Request, res: Response<FilterStatsResponse>): Promise<Response<FilterStatsResponse> | void> => {
    try {
        const now = Date.now();
        const hasFilters =
            queryValueToString(req.query.genres) ||
            queryValueToString(req.query.platforms) ||
            queryValueToString(req.query.engines) ||
            queryValueToString(req.query.search) ||
            queryValueToString(req.query.ratingMin) ||
            queryValueToString(req.query.ratingMax) ||
            queryValueToString(req.query.releaseDateMin) ||
            queryValueToString(req.query.ageRatings) ||
            queryValueToString(req.query.releaseDateMax);

        if (!hasFilters && filterStatsCache && (now - filterStatsCacheTime) < FILTER_STATS_CACHE_TTL) {
            console.log('Returning cached filter stats (no filters)');
            return res.json(filterStatsCache);
        }

        const headers = await twitchAuth.getAuthHeaders();

        let totalGamesCount = 0;
        try {
            const totalCountRes = await axios.post('https://api.igdb.com/v4/games/count', '', { headers });
            totalGamesCount = (totalCountRes.data as { count?: number }).count || 0;
            console.log(`Total games in catalog: ${totalGamesCount}`);
        } catch (error: unknown) {
            if (isErrorWithResponse(error)) console.warn('Error getting total games count:', error.response?.data || error.message);
            totalGamesCount = 35000;
        }

        const genreUsage = new Map<number, number>();
        const platformUsage = new Map<number, number>();
        const engineUsage = new Map<number, number>();

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
            const batchGroup: Array<Promise<{ data: GameBatchItem[] }>> = [];
            for (let j = 0; j < BATCH_CONCURRENCY && (i + j) < MAX_BATCHES; j++) {
                const offset = (i + j) * BATCH_SIZE;
                batchGroup.push(
                    axios.post('https://api.igdb.com/v4/games', `fields genres,platforms,game_engines; limit ${BATCH_SIZE}; offset ${offset};`, { headers })
                        .then((r) => ({ data: (r.data as GameBatchItem[]) || [] }))
                        .catch((error: unknown) => {
                            if (isErrorWithResponse(error)) console.error(`Error fetching batch ${i + j + 1}:`, error.response?.data || error.message);
                            return { data: [] };
                        })
                );
            }

            const batchResults = await Promise.all(batchGroup);

            batchResults.forEach((gamesRes, index) => {
                const actualIndex = i + index;
                if (gamesRes.data && gamesRes.data.length > 0) {
                    totalProcessedGames += gamesRes.data.length;

                    gamesRes.data.forEach((game: GameBatchItem) => {
                        game.genres?.forEach((id: number) => {
                            genreUsage.set(id, (genreUsage.get(id) || 0) + 1);
                        });
                        game.platforms?.forEach((id: number) => {
                            platformUsage.set(id, (platformUsage.get(id) || 0) + 1);
                        });
                        game.game_engines?.forEach((id: number) => {
                            engineUsage.set(id, (engineUsage.get(id) || 0) + 1);
                        });
                    });

                    console.log(`Processed batch ${actualIndex + 1}/${MAX_BATCHES} (${gamesRes.data.length} games)`);
                }
            });
        }

        console.log(`Found ${genreUsage.size} used genres, ${platformUsage.size} used platforms, ${engineUsage.size} used engines`);
        console.log(`Processed ${totalProcessedGames} games out of ${totalGamesCount} total`);

        const [genresRes, platformsRes, enginesRes] = await metadataPromise;
        const genresData = genresRes.data as FilterItem[];
        const platformsData = platformsRes.data as FilterItem[];
        const enginesData = enginesRes.data as FilterItem[];

        const buildCountFilters = (overrides: Partial<CountFilters> = {}): CountFilters => ({
            search: queryValueToString(req.query.search),
            genres: queryValueToString(req.query.genres),
            platforms: queryValueToString(req.query.platforms),
            engines: queryValueToString(req.query.engines),
            releaseDateMin: queryValueToString(req.query.releaseDateMin),
            releaseDateMax: queryValueToString(req.query.releaseDateMax),
            ratingMin: queryValueToNumber(req.query.ratingMin, 0),
            ratingMax: queryValueToNumber(req.query.ratingMax, 100),
            ...overrides
        });

        const processBatch = async <T extends FilterItem>(
            items: T[],
            getCountFn: (item: T) => Promise<number>,
            batchSize = 5,
            type = 'items'
        ): Promise<Array<{ item: T; count: number }>> => {
            console.log(`Processing ${items.length} ${type} in batches of ${batchSize}...`);
            const results: Array<{ item: T; count: number }> = [];
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = items.slice(i, i + batchSize);
                const batchPromises = batch.map(async (item, index) => {
                    try {
                        if (index > 0) await new Promise<void>((resolve) => setTimeout(resolve, 30));
                        const count = await getCountFn(item);
                        return { item, count };
                    } catch (error: unknown) {
                        if (isErrorWithResponse(error)) console.warn(`Error getting count for ${item.name || item.id}:`, error.response?.data || error.message);
                        return { item, count: 0 };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);

                if (i + batchSize < items.length) await new Promise<void>((resolve) => setTimeout(resolve, 100));
            }
            return results;
        };

        const genreCandidates = genresData
            .filter((genre) => genreUsage.has(genre.id))
            .sort((a, b) => (genreUsage.get(b.id) || 0) - (genreUsage.get(a.id) || 0));

        const genreResults = await processBatch(genreCandidates, async (genre) => {
            return IGDBService.getGamesCount(buildCountFilters({ genres: String(genre.id) }));
        }, 5, 'genres');

        const genreStats = genreResults
            .map(({ item, count }) => ({ id: item.id, name: item.name, count }))
            .filter((stat) => stat.count > 0)
            .sort((a, b) => a.name.localeCompare(b.name));

        const platformCandidates = platformsData
            .filter((platform) => platformUsage.has(platform.id))
            .sort((a, b) => (platformUsage.get(b.id) || 0) - (platformUsage.get(a.id) || 0))
            .slice(0, 20);

        const platformResults = await processBatch(platformCandidates, async (platform) => {
            return IGDBService.getGamesCount(buildCountFilters({ platforms: String(platform.id) }));
        }, 5, 'platforms');

        const platformStats = platformResults
            .map(({ item, count }) => ({ id: item.id, name: item.name, count }))
            .filter((stat) => stat.count > 0)
            .sort((a, b) => a.name.localeCompare(b.name));

        const engineCandidates = enginesData
            .filter((engine) => engineUsage.has(engine.id))
            .sort((a, b) => (engineUsage.get(b.id) || 0) - (engineUsage.get(a.id) || 0))
            .slice(0, 20);

        const engineResults = await processBatch(engineCandidates, async (engine) => {
            try {
                return await IGDBService.getGamesCount(buildCountFilters({ engines: String(engine.id) }));
            } catch (error: unknown) {
                if (isErrorWithResponse(error)) console.error(`Error getting count for engine ${engine.id} (${engine.name}):`, error.message);
                return 0;
            }
        }, 5, 'engines');

        const engineStats = engineResults
            .map(({ item, count }) => ({ id: item.id, name: item.name, count }))
            .filter((stat) => stat.count > 0)
            .sort((a, b) => a.name.localeCompare(b.name));

        const result: FilterStatsResponse = {
            genres: genreStats,
            platforms: platformStats,
            engines: engineStats
        };

        filterStatsCache = result;
        filterStatsCacheTime = now;

        res.json(result);
    } catch (error: unknown) {
        console.error('Error getting filter stats:', error);

        if (isErrorWithResponse(error) && error.response?.status === 429) {
            if (filterStatsCache) return res.json(filterStatsCache);
            return res.json({ genres: [], platforms: [], engines: [] });
        }

        if (filterStatsCache) return res.json(filterStatsCache);

        const details = isErrorWithResponse(error)
            ? ((typeof error.response?.data === 'object' && error.response?.data !== null && 'message' in error.response.data)
                ? String((error.response.data as { message?: string }).message || '')
                : (error.message || 'Unknown error'))
            : 'Unknown error';

        res.status(500).json({
            error: 'Failed to load filter stats',
            genres: [],
            platforms: [],
            engines: [],
            details
        });
    }
};
