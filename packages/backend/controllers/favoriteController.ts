import { RequestHandler } from 'express';
import { getFavorites, addFavorite, removeFavorite, isFavorite } from '../database.js';

interface ErrorResponse {
    error: string;
}

interface MessageResponse {
    message: string;
}

interface FavoritesResponse {
    gameIds: number[];
}

interface CheckFavoriteResponse {
    isFavorite: boolean;
}

interface GameIdParams {
    gameId: string;
}

export const getFavoritesHandler: RequestHandler<Record<string, never>, FavoritesResponse | ErrorResponse> = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const gameIds = await getFavorites(req.user.id);
        res.json({ gameIds: gameIds as number[] });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to get favorites' });
    }
};

export const addFavoriteHandler: RequestHandler<GameIdParams, MessageResponse | ErrorResponse> = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const gameId = Number(req.params.gameId);
        const success = await addFavorite(req.user.id, gameId);
        if (success) res.json({ message: 'Game added to favorites' });
        else res.status(400).json({ error: 'Game already in favorites' });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to add favorite' });
    }
};

export const removeFavoriteHandler: RequestHandler<GameIdParams, MessageResponse | ErrorResponse> = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const gameId = Number(req.params.gameId);
        const success = await removeFavorite(req.user.id, gameId);
        if (success) res.json({ message: 'Game removed from favorites' });
        else res.status(404).json({ error: 'Game not in favorites' });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to remove favorite' });
    }
};

export const checkFavoriteHandler: RequestHandler<GameIdParams, CheckFavoriteResponse | ErrorResponse> = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const gameId = Number(req.params.gameId);
        const isFav = await isFavorite(req.user.id, gameId);
        res.json({ isFavorite: isFav });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to check favorite' });
    }
};
