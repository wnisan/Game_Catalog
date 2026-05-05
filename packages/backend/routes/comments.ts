import express from 'express';
import { z } from 'zod';
import { createCommentHandler, getCommentsByGameIdHandler, getCommentsByUserIdHandler, updateCommentHandler, deleteCommentHandler } from '../controllers/commentController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { CommentCreateRequestSchema } from '@game-catalog/shared';

const router = express.Router();

router.post('/', authenticateToken, validate(CommentCreateRequestSchema), createCommentHandler);
router.get('/game/:gameId', validate(z.object({ gameId: z.coerce.number() }), 'params'), getCommentsByGameIdHandler);
router.get('/user/my-comments', authenticateToken, getCommentsByUserIdHandler);
router.put('/:commentId', authenticateToken, validate(z.object({ commentId: z.coerce.number() }), 'params'), updateCommentHandler);
router.delete('/:commentId', authenticateToken, validate(z.object({ commentId: z.coerce.number() }), 'params'), deleteCommentHandler);

export default router;