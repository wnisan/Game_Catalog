import { Request, Response } from 'express';
import IGDBService from '../services/igdbService.js';
import { getGameFavoriteCount, recordGameVisit as recordVisit, getRecentlyVisitedGames, getGamePricesBulk, getHiddenGameIds, isGameHidden } from '../database.js';

interface GameEntity {
    id?: number;
    name?: string;
    [key: string]: unknown;
}

interface ErrorWithResponse {
    response?: { status?: number };
    message?: string;
}

function isErrorWithResponse(error: unknown): error is ErrorWithResponse {
    return typeof error === 'object' && error !== null;
}

function queryString(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return undefined;
}

async function attachPrices(games: GameEntity[]): Promise<Array<GameEntity & { price: number | null }>> {
    if (!games.length) return [];
    const ids = games.map((g) => Number(g.id)).filter((n) => !Number.isNaN(n));
    const priceMap = await getGamePricesBulk(ids);
    return games.map((g) => ({ ...g, price: g.id !== undefined ? (priceMap[g.id] ?? null) : null }));
}

async function attachPrice(game: GameEntity | null): Promise<(GameEntity & { price: number | null }) | null> {
    if (!game) return null;
    const [withPrice] = await attachPrices([game]);
    return withPrice ?? null;
}

async function filterHidden(games: GameEntity[]): Promise<GameEntity[]> {
    if (!games.length) return games;
    const hiddenIds = await getHiddenGameIds();
    if (!hiddenIds.size) return games;
    return games.filter((g) => typeof g.id === 'number' && !hiddenIds.has(g.id));
}

export const getGames = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = Number(queryString(req.query.limit) ?? '20');
        const offset = Number(queryString(req.query.offset) ?? '0');
        const search = queryString(req.query.search);
        const ratingMinRaw = queryString(req.query.ratingMin);
        const ratingMaxRaw = queryString(req.query.ratingMax);
        const genres = queryString(req.query.genres);
        const platforms = queryString(req.query.platforms);
        const engines = queryString(req.query.engines);
        const releaseDateMin = queryString(req.query.releaseDateMin);
        const releaseDateMax = queryString(req.query.releaseDateMax);
        const sortBy = queryString(req.query.sortBy);
        const includeCount = queryString(req.query.includeCount) ?? 'false';
        const gameIdsRaw = queryString(req.query.gameIds);

        const sellerGameIds = gameIdsRaw ? gameIdsRaw.split(',').map(Number).filter((n) => !Number.isNaN(n)) : undefined;

        const filters = {
            limit,
            offset,
            search,
            ratingMin: ratingMinRaw !== undefined ? Number(ratingMinRaw) : undefined,
            ratingMax: ratingMaxRaw !== undefined ? Number(ratingMaxRaw) : undefined,
            genres,
            platforms,
            engines,
            releaseDateMin,
            releaseDateMax,
            sortBy,
            gameIds: sellerGameIds && sellerGameIds.length > 0 ? sellerGameIds : undefined,
        };

        let games = await IGDBService.getGamesWithFilters(filters);
        games = await filterHidden(games);
        const pricedGames = await attachPrices(games);

        if (includeCount === 'true') {
            const totalCount = await IGDBService.getGamesCount(filters);
            res.json({ games: pricedGames, totalCount });
            return;
        }

        res.json(pricedGames);
    } catch (error: unknown) {
        if (isErrorWithResponse(error) && error.response?.status === 429) {
            res.status(429).json({ error: 'Too many requests to IGDB API' });
            return;
        }
        if (isErrorWithResponse(error) && error.response?.status === 406) {
            res.status(406).json({ error: 'Invalid query combination' });
            return;
        }
        res.status(500).json({ error: 'Failed to load games', details: isErrorWithResponse(error) ? error.message : 'Unknown error' });
    }
};

export const getPopularGames = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = Number(queryString(req.query.limit) ?? '20');
        let games = await IGDBService.getPopularGames({ limit });
        games = await filterHidden(games);
        const priced = await attachPrices(games);
        res.json(priced);
    } catch (error: unknown) {
        if (isErrorWithResponse(error) && error.response?.status === 429) {
            res.status(429).json({ error: 'Too many requests to IGDB API' });
            return;
        }
        res.status(500).json({ error: 'Failed to load popular games' });
    }
};

export const getUpcomingGames = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = Number(queryString(req.query.limit) ?? '12');
        let games = await IGDBService.getUpcomingGames({ limit });
        games = await filterHidden(games);
        const priced = await attachPrices(games);
        res.json(priced);
    } catch (error: unknown) {
        if (isErrorWithResponse(error) && error.response?.status === 429) {
            res.status(429).json({ error: 'Too many requests to IGDB API' });
            return;
        }
        res.status(500).json({ error: 'Failed to load upcoming games' });
    }
};

export const getGameById = async (req: Request<{ idOrSlug: string }>, res: Response): Promise<void> => {
    try {
        const { idOrSlug } = req.params;
        let game = Number.isNaN(Number(idOrSlug))
            ? await IGDBService.getGameBySlug(idOrSlug)
            : await IGDBService.getGameById(idOrSlug);

        if (game && typeof game.id === 'number' && await isGameHidden(game.id)) {
            res.status(404).json({ error: 'Game not found' });
            return;
        }

        const gameWithPrice = await attachPrice(game);
        res.json(gameWithPrice);
    } catch (error: unknown) {
        if (isErrorWithResponse(error) && error.message === 'Game not found') {
            res.status(404).json({ error: 'Game not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to load game', details: isErrorWithResponse(error) ? error.message : 'Unknown error' });
    }
};

export const getGamesByIds = async (req: Request<Record<string, never>, unknown, { ids?: unknown }>, res: Response): Promise<void> => {
    try {
        const idsRaw = req.body?.ids;
        if (!Array.isArray(idsRaw)) {
            res.status(400).json({ error: 'ids must be an array' });
            return;
        }
        let games = await IGDBService.getGamesByIds(idsRaw as Array<number | string>);
        games = await filterHidden(games);
        const priced = await attachPrices(games);
        res.json({ games: priced });
    } catch (error: unknown) {
        res.status(500).json({ error: 'Failed to load games', details: isErrorWithResponse(error) ? error.message : 'Unknown error' });
    }
};

export const getFavoriteCount = async (req: Request<{ gameId: string }>, res: Response): Promise<void> => {
    try {
        const count = await getGameFavoriteCount(Number(req.params.gameId));
        res.json({ count });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to get favorite count' });
    }
};

export const recordGameVisit = async (req: Request<Record<string, never>, unknown, { gameId?: unknown }>, res: Response): Promise<void> => {
    try {
        const gameIdRaw = req.body?.gameId;
        if (gameIdRaw === undefined || gameIdRaw === null) {
            res.status(400).json({ error: 'gameId is required' });
            return;
        }

        const numericGameId = Number(gameIdRaw);
        if (Number.isNaN(numericGameId)) {
            res.status(400).json({ error: 'gameId must be a number' });
            return;
        }

        await recordVisit(req.user?.id, numericGameId);

        let recentlyVisited: Array<GameEntity & { price: number | null }> = [];
        if (req.user?.id) {
            const recentIds = await getRecentlyVisitedGames(req.user.id, 10);
            if (recentIds.length > 0) {
                let games = await IGDBService.getGamesByIds(recentIds);
                games = await filterHidden(games);
                recentlyVisited = await attachPrices(games);
            }
        }

        res.json({ success: true, recentlyVisited });
    } catch (error: unknown) {
        res.status(500).json({ error: 'Failed to record visit', details: isErrorWithResponse(error) ? error.message : 'Unknown error' });
    }
};

export const getRecentlyVisited = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.json({ games: [] });
            return;
        }
        const recentIds = await getRecentlyVisitedGames(req.user.id, 20);
        if (!recentIds.length) {
            res.json({ games: [] });
            return;
        }
        let games = await IGDBService.getGamesByIds(recentIds);
        games = await filterHidden(games);
        const priced = await attachPrices(games);
        res.json({ games: priced });
    } catch (_error: unknown) {
        res.status(500).json({ games: [] });
    }
};
