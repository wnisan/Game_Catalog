import { createComment, getCommentsByGameId, getCommentsByUserId, updateComment, deleteComment, getCommentById } from '../database.js';

export const createCommentHandler = async (req, res) => {
    try {
        const { gameId, text, parentId } = req.body;
        if (!gameId || !text?.trim()) return res.status(400).json({ error: 'gameId and text are required' });
        const commentId = await createComment(req.user.id, gameId, text, parentId || null);
        const comment = await getCommentById(commentId);
        res.status(201).json(comment);
    } catch { res.status(500).json({ error: 'Failed to create comment' }); }
};

export const getCommentsByGameIdHandler = async (req, res) => {
    try {
        const comments = await getCommentsByGameId(req.params.gameId);
        res.json({ comments });
    } catch { res.status(500).json({ error: 'Failed to get comments' }); }
};

export const getCommentsByUserIdHandler = async (req, res) => {
    try {
        const comments = await getCommentsByUserId(req.user.id);
        res.json({ comments });
    } catch { res.status(500).json({ error: 'Failed to get user comments' }); }
};

export const updateCommentHandler = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
        const success = await updateComment(req.params.commentId, req.user.id, text);
        if (!success) return res.status(404).json({ error: 'Comment not found or unauthorized' });
        const comment = await getCommentById(req.params.commentId);
        res.json(comment);
    } catch { res.status(500).json({ error: 'Failed to update comment' }); }
};

export const deleteCommentHandler = async (req, res) => {
    try {
        const success = await deleteComment(req.params.commentId, req.user.id);
        if (!success) return res.status(404).json({ error: 'Comment not found or unauthorized' });
        res.json({ message: 'Comment deleted successfully' });
    } catch { res.status(500).json({ error: 'Failed to delete comment' }); }
};
