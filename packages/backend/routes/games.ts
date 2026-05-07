import express from 'express';
import { GameIdParamsSchema, GamesBulkRequestSchema, GamesQuerySchema } from '@game-catalog/shared';
import { getGames, getPopularGames, getUpcomingGames, getGameById, getGamesByIds, getFavoriteCount, recordGameVisit, getRecentlyVisited } from '../controllers/gameController.js';
import { getListingForGame } from '../controllers/sellerController.js';
import { optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.get('/', validate(GamesQuerySchema, 'query'), getGames);
router.get('/popular', getPopularGames);
router.get('/upcoming', getUpcomingGames);
router.get('/recently-visited', optionalAuth, getRecentlyVisited);
router.get('/:gameId/favorite-count', validate(GameIdParamsSchema, 'params'), getFavoriteCount);
router.get('/:gameId/listing', validate(GameIdParamsSchema, 'params'), getListingForGame);
router.post('/visit', optionalAuth, recordGameVisit);
router.get('/:idOrSlug', getGameById);
router.post('/bulk', validate(GamesBulkRequestSchema), getGamesByIds);

export default router;
