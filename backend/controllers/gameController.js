import IGDBService from '../services/igdbService.js';

export const getGames = async (req, res) => {
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
            ageRatings: ageRatingsRaw,
            releaseDateMin,
            releaseDateMax,
            sortBy,
            includeCount = 'false'
        } = req.query;

        let ageRatings = undefined;
        if (ageRatingsRaw) {
            try {
                ageRatings = typeof ageRatingsRaw === 'string' ? JSON.parse(ageRatingsRaw) : ageRatingsRaw;
            } catch (e) {
                console.warn('Failed to parse ageRatings:', e);
            }
        }

        const games = await IGDBService.getGamesWithFilters({
            limit: Number(limit),
            offset: Number(offset),
            search,
            ratingMin: ratingMin !== undefined ? Number(ratingMin) : undefined,
            ratingMax: ratingMax !== undefined ? Number(ratingMax) : undefined,
            genres,
            platforms,
            engines,
            ageRatings,
            releaseDateMin,
            releaseDateMax,
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
                ageRatings,
                releaseDateMin,
                releaseDateMax,
                sortBy
            });
            res.json({ games, totalCount });
        } else {
            res.json(games);
        }
    } catch (error) {
        console.error('Error loading games:', error);

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
};

export const getPopularGames = async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        const games = await IGDBService.getPopularGames({ limit });
        res.json(games);
    } catch (error) {
        console.error('Error loading popular games:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to load popular games' });
    }
};

export const getUpcomingGames = async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 12;
        const games = await IGDBService.getUpcomingGames({ limit });
        res.json(games);
    } catch (error) {
        console.error('Error loading upcoming games:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to load upcoming games' });
    }
};

export const getGameById = async (req, res) => {
    try {
        const { idOrSlug } = req.params;
        let game;

        if (isNaN(Number(idOrSlug))) {
            game = await IGDBService.getGameBySlug(idOrSlug);
        } else {
            game = await IGDBService.getGameById(idOrSlug);
        }

        res.json(game);
    } catch (error) {
        if (error.message === 'Game not found') {
            res.status(404).json({ error: 'Game not found' });
        } else {
            console.error('Error receiving game', error);
            res.status(500).json({
                error: 'Failed to load game',
                details: error.response?.data?.message || error.message
            });
        }
    }
};

export const getGamesByIds = async (req, res) => {
    try {
        const { ids } = req.body || {};
        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: 'ids must be an array of numbers' });
        }
        const games = await IGDBService.getGamesByIds(ids);
        res.json({ games });
    } catch (error) {
        console.error('Error loading games bulk:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to load games', details: error.message });
    }
};