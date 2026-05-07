import express, { Request } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
    getOrCreateConversation, getConversationById,
    getUserConversations, getConversationMessages,
    markMessagesRead, getTotalUnread,
    editMessage, deleteMessage,
} from '../database.js';

const router = express.Router();

function paramAsNumber(req: Request<{ id: string }>): number {
    return Number(req.params.id);
}

router.post('/conversations', authenticateToken, async (req: Request<Record<string, never>, unknown, { sellerUserId?: unknown; igdbGameId?: unknown; gameName?: unknown }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const sellerUserId = Number(req.body.sellerUserId);
        const igdbGameId = Number(req.body.igdbGameId);
        const gameName = typeof req.body.gameName === 'string' ? req.body.gameName : '';

        if (Number.isNaN(sellerUserId) || Number.isNaN(igdbGameId)) return res.status(400).json({ error: 'sellerUserId and igdbGameId required' });
        if (req.user.id === sellerUserId) return res.status(400).json({ error: 'Cannot chat with yourself' });

        const convId = await getOrCreateConversation(req.user.id, sellerUserId, igdbGameId, gameName);
        const conv = await getConversationById(convId);
        return res.json({ conversation: conv });
    } catch (err: unknown) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to create conversation' });
    }
});

router.get('/conversations', authenticateToken, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const convs = await getUserConversations(req.user.id);
        return res.json({ conversations: convs });
    } catch {
        return res.status(500).json({ error: 'Failed to get conversations' });
    }
});

router.get('/conversations/:id/messages', authenticateToken, async (req: Request<{ id: string }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const convId = paramAsNumber(req);
        const conv = await getConversationById(convId);
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });
        if (conv.buyer_id !== req.user.id && conv.seller_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        const messages = await getConversationMessages(convId);
        await markMessagesRead(convId, req.user.id);
        return res.json({ messages });
    } catch {
        return res.status(500).json({ error: 'Failed to get messages' });
    }
});

router.get('/unread', authenticateToken, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const count = await getTotalUnread(req.user.id);
        return res.json({ count });
    } catch {
        return res.status(500).json({ error: 'Failed to get unread count' });
    }
});

router.patch('/messages/:id', authenticateToken, async (req: Request<{ id: string }, unknown, { content?: unknown }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
        if (!content) return res.status(400).json({ error: 'content required' });

        const ok = await editMessage(paramAsNumber(req), req.user.id, content);
        if (!ok) return res.status(403).json({ error: 'Not your message' });
        return res.json({ message: 'Updated' });
    } catch {
        return res.status(500).json({ error: 'Failed to edit message' });
    }
});

router.delete('/messages/:id', authenticateToken, async (req: Request<{ id: string }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const ok = await deleteMessage(paramAsNumber(req), req.user.id);
        if (!ok) return res.status(403).json({ error: 'Not your message' });
        return res.json({ message: 'Deleted' });
    } catch {
        return res.status(500).json({ error: 'Failed to delete message' });
    }
});

export default router;
