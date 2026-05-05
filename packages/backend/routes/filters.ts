import express from 'express';
import { getFilterStats } from '../controllers/filterController.js';
import { rateLimitFilterStatsMiddleware } from '../middleware/rateLimit.js';

const router = express.Router();

router.get('/stats', rateLimitFilterStatsMiddleware, getFilterStats);

export default router;