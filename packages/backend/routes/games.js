import express from 'express';
import { getGames, getPopularGames, getUpcomingGames, getGameById, getGamesByIds, getFavoriteCount, recordGameVisit, getRecentlyVisited } from '../controllers/gameController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getGames);
router.get('/popular', getPopularGames);
router.get('/upcoming', getUpcomingGames);
router.get('/recently-visited', optionalAuth, getRecentlyVisited);
router.get('/:gameId/favorite-count', getFavoriteCount);
router.post('/visit', optionalAuth, recordGameVisit);
router.get('/:idOrSlug', getGameById);
router.post('/bulk', getGamesByIds);

export default router;