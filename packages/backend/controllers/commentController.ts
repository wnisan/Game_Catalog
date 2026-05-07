import { RequestHandler } from 'express';
import { createComment, getCommentsByGameId, getCommentsByUserId, updateComment, deleteComment, getCommentById } from '../database.js';

interface CommentUser {
    user_id: number;
    user_name: string;
    user_email: string;
}

interface CommentRecord extends CommentUser {
    id: number;
    game_id: number;
    comment_text: string;
    created_at: Date | string;
    updated_at: Date | string;
    parent_id?: number | null;
}

interface ErrorResponse {
    error: string;
}

interface MessageResponse {
    message: string;
}

interface CommentsResponse {
    comments: CommentRecord[];
}

interface CreateCommentBody {
    gameId: number;
    text: string;
    parentId?: number | null;
}

interface UpdateCommentBody {
    text: string;
}

interface GameIdParams {
    gameId: string;
}

interface CommentIdParams {
    commentId: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isCreateCommentBody(value: unknown): value is CreateCommentBody {
    if (!isObject(value)) return false;
    const { gameId, text, parentId } = value;
    const isParentValid = parentId === undefined || parentId === null || typeof parentId === 'number';
    return typeof gameId === 'number' && typeof text === 'string' && isParentValid;
}

function isUpdateCommentBody(value: unknown): value is UpdateCommentBody {
    if (!isObject(value)) return false;
    return typeof value.text === 'string';
}

export const createCommentHandler: RequestHandler<Record<string, never>, CommentRecord | ErrorResponse, unknown> = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!isCreateCommentBody(req.body) || !req.body.text.trim()) {
            res.status(400).json({ error: 'gameId and text are required' });
            return;
        }

        const { gameId, text, parentId } = req.body;
        const commentId = await createComment(req.user.id, gameId, text, parentId ?? null);
        const comment = (await getCommentById(commentId)) as CommentRecord | null;

        if (!comment) {
            res.status(404).json({ error: 'Comment not found after creation' });
            return;
        }

        res.status(201).json(comment);
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to create comment' });
    }
};

export const getCommentsByGameIdHandler: RequestHandler<GameIdParams, CommentsResponse | ErrorResponse, Record<string, never>> = async (req, res) => {
    try {
        const gameId = Number(req.params.gameId);
        const comments = (await getCommentsByGameId(gameId)) as CommentRecord[];
        res.json({ comments });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to get comments' });
    }
};

export const getCommentsByUserIdHandler: RequestHandler<Record<string, never>, CommentsResponse | ErrorResponse, Record<string, never>> = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const comments = (await getCommentsByUserId(req.user.id)) as CommentRecord[];
        res.json({ comments });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to get user comments' });
    }
};

export const updateCommentHandler: RequestHandler<CommentIdParams, CommentRecord | ErrorResponse, unknown> = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!isUpdateCommentBody(req.body) || !req.body.text.trim()) {
            res.status(400).json({ error: 'text is required' });
            return;
        }

        const commentId = Number(req.params.commentId);
        const success = await updateComment(commentId, req.user.id, req.body.text);

        if (!success) {
            res.status(404).json({ error: 'Comment not found or unauthorized' });
            return;
        }

        const comment = (await getCommentById(commentId)) as CommentRecord | null;

        if (!comment) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }

        res.json(comment);
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to update comment' });
    }
};

export const deleteCommentHandler: RequestHandler<CommentIdParams, MessageResponse | ErrorResponse, Record<string, never>> = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const commentId = Number(req.params.commentId);
        const success = await deleteComment(commentId, req.user.id);

        if (!success) {
            res.status(404).json({ error: 'Comment not found or unauthorized' });
            return;
        }

        res.json({ message: 'Comment deleted successfully' });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to delete comment' });
    }
};
