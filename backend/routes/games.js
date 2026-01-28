import express from 'express';
import { getGames, getPopularGames, getUpcomingGames, getGameById, getGamesByIds } from '../controllers/gameController.js';

const router = express.Router();

router.get('/', getGames);
router.get('/popular', getPopularGames);
router.get('/upcoming', getUpcomingGames);
router.get('/:idOrSlug', getGameById);
router.post('/bulk', getGamesByIds);

export default router;