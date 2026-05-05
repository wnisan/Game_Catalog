import { getFavorites, addFavorite, removeFavorite, isFavorite } from '../database.js';

export const getFavoritesHandler = async (req, res) => {
    try {
        const gameIds = await getFavorites(req.user.id);
        res.json({ gameIds });
    } catch { res.status(500).json({ error: 'Failed to get favorites' }); }
};

export const addFavoriteHandler = async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const success = await addFavorite(req.user.id, gameId);
        if (success) res.json({ message: 'Game added to favorites' });
        else res.status(400).json({ error: 'Game already in favorites' });
    } catch { res.status(500).json({ error: 'Failed to add favorite' }); }
};

export const removeFavoriteHandler = async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const success = await removeFavorite(req.user.id, gameId);
        if (success) res.json({ message: 'Game removed from favorites' });
        else res.status(404).json({ error: 'Game not in favorites' });
    } catch { res.status(500).json({ error: 'Failed to remove favorite' }); }
};

export const checkFavoriteHandler = async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const isFav = await isFavorite(req.user.id, gameId);
        res.json({ isFavorite: isFav });
    } catch { res.status(500).json({ error: 'Failed to check favorite' }); }
};
