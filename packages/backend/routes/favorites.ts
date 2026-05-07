import express from 'express';
import { getFavoritesHandler, addFavoriteHandler, removeFavoriteHandler, checkFavoriteHandler } from '../controllers/favoriteController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { GameIdParamsSchema } from '@game-catalog/shared';

const router = express.Router();

router.get('/', authenticateToken, getFavoritesHandler);
router.post<{ gameId: string }>('/:gameId', authenticateToken, validate(GameIdParamsSchema, 'params'), addFavoriteHandler);
router.delete<{ gameId: string }>('/:gameId', authenticateToken, validate(GameIdParamsSchema, 'params'), removeFavoriteHandler);
router.get<{ gameId: string }>('/:gameId/check', authenticateToken, validate(GameIdParamsSchema, 'params'), checkFavoriteHandler);

export default router;
