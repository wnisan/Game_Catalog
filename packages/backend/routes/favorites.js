import express from 'express';
import { getFavoritesHandler, addFavoriteHandler, removeFavoriteHandler, checkFavoriteHandler } from '../controllers/favoriteController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getFavoritesHandler);
router.post('/:gameId', authenticateToken, addFavoriteHandler);
router.delete('/:gameId', authenticateToken, removeFavoriteHandler);
router.get('/:gameId/check', authenticateToken, checkFavoriteHandler);

export default router;