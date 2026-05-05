import { getFavorites, addFavorite, removeFavorite, isFavorite } from '../database.js';

export const getFavoritesHandler = (req, res) => {
    try {
        const gameIds = getFavorites(req.user.id);
        res.json({ gameIds });
    } catch (error) {
        console.error('Error getting favorites:', error);
        res.status(500).json({ error: 'Failed to get favorites' });
    }
};

export const addFavoriteHandler = (req, res) => {
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
};

export const removeFavoriteHandler = (req, res) => {
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
};

export const checkFavoriteHandler = (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const isFav = isFavorite(req.user.id, gameId);
        res.json({ isFavorite: isFav });
    } catch (error) {
        console.error('Error checking favorite:', error);
        res.status(500).json({ error: 'Failed to check favorite' });
    }
};