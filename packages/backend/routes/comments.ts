import express from 'express';
import { createCommentHandler, getCommentsByGameIdHandler, getCommentsByUserIdHandler, updateCommentHandler, deleteCommentHandler } from '../controllers/commentController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { CommentCreateRequestSchema, CommentIdParamsSchema, GameIdParamsSchema } from '@game-catalog/shared';

const router = express.Router();

router.post('/', authenticateToken, validate(CommentCreateRequestSchema), createCommentHandler);
router.get<{ gameId: string }>('/game/:gameId', validate(GameIdParamsSchema, 'params'), getCommentsByGameIdHandler);
router.get('/user/my-comments', authenticateToken, getCommentsByUserIdHandler);
router.put<{ commentId: string }>('/:commentId', authenticateToken, validate(CommentIdParamsSchema, 'params'), updateCommentHandler);
router.delete<{ commentId: string }>('/:commentId', authenticateToken, validate(CommentIdParamsSchema, 'params'), deleteCommentHandler);

export default router;
