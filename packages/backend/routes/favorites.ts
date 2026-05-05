import express from 'express';
import { z } from 'zod';
import { getFavoritesHandler, addFavoriteHandler, removeFavoriteHandler, checkFavoriteHandler } from '../controllers/favoriteController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.get('/', authenticateToken, getFavoritesHandler);
router.post('/:gameId', authenticateToken, validate(z.object({ gameId: z.coerce.number() }), 'params'), addFavoriteHandler);
router.delete('/:gameId', authenticateToken, validate(z.object({ gameId: z.coerce.number() }), 'params'), removeFavoriteHandler);
router.get('/:gameId/check', authenticateToken, validate(z.object({ gameId: z.coerce.number() }), 'params'), checkFavoriteHandler);

export default router;