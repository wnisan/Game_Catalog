import { createComment, getCommentsByGameId, getCommentsByUserId, updateComment, deleteComment, getCommentById } from '../database.js';

export const createCommentHandler = (req, res) => {
    try {
        const { gameId, text } = req.body;

        if (!gameId || !text || !text.trim()) {
            return res.status(400).json({ error: 'gameId and text are required' });
        }

        const commentId = createComment(req.user.id, gameId, text);
        const comment = getCommentById(commentId);

        res.status(201).json(comment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
};

export const getCommentsByGameIdHandler = (req, res) => {
    try {
        const { gameId } = req.params;
        const comments = getCommentsByGameId(gameId);
        res.json({ comments });
    } catch (error) {
        console.error('Error getting comments:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
};

export const getCommentsByUserIdHandler = (req, res) => {
    try {
        const comments = getCommentsByUserId(req.user.id);
        res.json({ comments });
    } catch (error) {
        console.error('Error getting user comments:', error);
        res.status(500).json({ error: 'Failed to get user comments' });
    }
};

export const updateCommentHandler = (req, res) => {
    try {
        const { commentId } = req.params;
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'text is required' });
        }

        const success = updateComment(commentId, req.user.id, text);

        if (!success) {
            return res.status(404).json({ error: 'Comment not found or unauthorized' });
        }

        const comment = getCommentById(commentId);
        res.json(comment);
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
};

export const deleteCommentHandler = (req, res) => {
    try {
        const { commentId } = req.params;
        const success = deleteComment(commentId, req.user.id);

        if (!success) {
            return res.status(404).json({ error: 'Comment not found or unauthorized' });
        }

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
};