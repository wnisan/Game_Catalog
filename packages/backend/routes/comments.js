import express from 'express';
import { createCommentHandler, getCommentsByGameIdHandler, getCommentsByUserIdHandler, updateCommentHandler, deleteCommentHandler } from '../controllers/commentController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateToken, createCommentHandler);
router.get('/game/:gameId', getCommentsByGameIdHandler);
router.get('/user/my-comments', authenticateToken, getCommentsByUserIdHandler);
router.put('/:commentId', authenticateToken, updateCommentHandler);
router.delete('/:commentId', authenticateToken, deleteCommentHandler);

export default router;