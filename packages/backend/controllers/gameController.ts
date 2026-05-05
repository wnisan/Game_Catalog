import IGDBService from '../services/igdbService.js';
import { getGameFavoriteCount, recordGameVisit as recordVisit, getRecentlyVisitedGames, getGamePricesBulk, getHiddenGameIds, isGameHidden } from '../database.js';

async function attachPrices(games) {
    if (!games?.length) return games;
    const ids = games.map(g => g.id);
    const priceMap = await getGamePricesBulk(ids);
    return games.map(g => ({ ...g, price: priceMap[g.id] ?? null }));
}

async function attachPrice(game) {
    if (!game) return game;
    const [withPrice] = await attachPrices([game]);
    return withPrice;
}

async function filterHidden(games) {
    if (!games?.length) return games;
    const hiddenIds = await getHiddenGameIds();
    if (!hiddenIds.size) return games;
    return games.filter(g => !hiddenIds.has(g.id));
}

export const getGames = async (req, res) => {
    try {
        const {
            limit = 20, offset = 0, search,
            ratingMin, ratingMax, genres, platforms, engines,
            ageRatings: ageRatingsRaw, releaseDateMin, releaseDateMax,
            sortBy, includeCount = 'false', gameIds: gameIdsRaw
        } = req.query;

        let ageRatings;
        if (ageRatingsRaw) {
            try { ageRatings = typeof ageRatingsRaw === 'string' ? JSON.parse(ageRatingsRaw) : ageRatingsRaw; }
            catch { }
        }

        const sellerGameIds = gameIdsRaw
            ? gameIdsRaw.split(',').map(Number).filter(n => !isNaN(n))
            : null;

        const filters = {
            limit: Number(limit), offset: Number(offset), search,
            ratingMin: ratingMin !== undefined ? Number(ratingMin) : undefined,
            ratingMax: ratingMax !== undefined ? Number(ratingMax) : undefined,
            genres, platforms, engines, ageRatings, releaseDateMin, releaseDateMax, sortBy,
            gameIds: sellerGameIds && sellerGameIds.length > 0 ? sellerGameIds : undefined,
        };

        let games = await IGDBService.getGamesWithFilters(filters);
        games = await filterHidden(games);
        games = await attachPrices(games);

        if (includeCount === 'true') {
            const totalCount = await IGDBService.getGamesCount(filters);
            return res.json({ games, totalCount });
        }
        res.json(games);
    } catch (error) {
        if (error.response?.status === 429) return res.status(429).json({ error: 'Too many requests to IGDB API' });
        if (error.response?.status === 406) return res.status(406).json({ error: 'Invalid query combination' });
        res.status(500).json({ error: 'Failed to load games', details: error.message });
    }
};

export const getPopularGames = async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        let games = await IGDBService.getPopularGames({ limit });
        games = await filterHidden(games);
        games = await attachPrices(games);
        res.json(games);
    } catch (error) {
        if (error.response?.status === 429) return res.status(429).json({ error: 'Too many requests to IGDB API' });
        res.status(500).json({ error: 'Failed to load popular games' });
    }
};

export const getUpcomingGames = async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 12;
        let games = await IGDBService.getUpcomingGames({ limit });
        games = await filterHidden(games);
        games = await attachPrices(games);
        res.json(games);
    } catch (error) {
        if (error.response?.status === 429) return res.status(429).json({ error: 'Too many requests to IGDB API' });
        res.status(500).json({ error: 'Failed to load upcoming games' });
    }
};

export const getGameById = async (req, res) => {
    try {
        const { idOrSlug } = req.params;
        let game = isNaN(Number(idOrSlug))
            ? await IGDBService.getGameBySlug(idOrSlug)
            : await IGDBService.getGameById(idOrSlug);
        if (game && await isGameHidden(game.id)) {
            return res.status(404).json({ error: 'Game not found' });
        }
        game = await attachPrice(game);
        res.json(game);
    } catch (error) {
        if (error.message === 'Game not found') return res.status(404).json({ error: 'Game not found' });
        res.status(500).json({ error: 'Failed to load game', details: error.message });
    }
};

export const getGamesByIds = async (req, res) => {
    try {
        const { ids } = req.body || {};
        if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
        let games = await IGDBService.getGamesByIds(ids);
        games = await filterHidden(games);
        games = await attachPrices(games);
        res.json({ games });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load games', details: error.message });
    }
};

export const getFavoriteCount = async (req, res) => {
    try {
        const count = await getGameFavoriteCount(Number(req.params.gameId));
        res.json({ count });
    } catch { res.status(500).json({ error: 'Failed to get favorite count' }); }
};

export const recordGameVisit = async (req, res) => {
    try {
        const { gameId } = req.body;
        if (!gameId) return res.status(400).json({ error: 'gameId is required' });
        const numericGameId = Number(gameId);
        if (isNaN(numericGameId)) return res.status(400).json({ error: 'gameId must be a number' });

        await recordVisit(req.user?.id, numericGameId);

        let recentlyVisited = [];
        if (req.user?.id) {
            const recentIds = await getRecentlyVisitedGames(req.user.id, 10);
            if (recentIds.length > 0) {
                let games = await IGDBService.getGamesByIds(recentIds);
                games = await filterHidden(games);
                recentlyVisited = await attachPrices(games);
            }
        }
        res.json({ success: true, recentlyVisited });
    } catch (error) {
        res.status(500).json({ error: 'Failed to record visit', details: error.message });
    }
};

export const getRecentlyVisited = async (req, res) => {
    try {
        if (!req.user?.id) return res.json({ games: [] });
        const recentIds = await getRecentlyVisitedGames(req.user.id, 20);
        if (!recentIds.length) return res.json({ games: [] });
        let games = await IGDBService.getGamesByIds(recentIds);
        games = await filterHidden(games);
        games = await attachPrices(games);
        res.json({ games });
    } catch { res.status(500).json({ games: [] }); }
};
