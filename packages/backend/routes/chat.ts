import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
    getOrCreateConversation, getConversationById,
    getUserConversations, getConversationMessages,
    markMessagesRead, getTotalUnread,
    editMessage, deleteMessage,
} from '../database.js';

const router = express.Router();

// POST /chat/conversations — начать или получить чат
router.post('/conversations', authenticateToken, async (req, res) => {
    try {
        const { sellerUserId, igdbGameId, gameName } = req.body;
        if (!sellerUserId || !igdbGameId) return res.status(400).json({ error: 'sellerUserId and igdbGameId required' });
        if (req.user.id === sellerUserId) return res.status(400).json({ error: 'Cannot chat with yourself' });

        const convId = await getOrCreateConversation(req.user.id, sellerUserId, igdbGameId, gameName || '');
        const conv = await getConversationById(convId);
        res.json({ conversation: conv });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

// GET /chat/conversations — все чаты пользователя
router.get('/conversations', authenticateToken, async (req, res) => {
    try {
        const convs = await getUserConversations(req.user.id);
        res.json({ conversations: convs });
    } catch {
        res.status(500).json({ error: 'Failed to get conversations' });
    }
});

// GET /chat/conversations/:id/messages — история сообщений
router.get('/conversations/:id/messages', authenticateToken, async (req, res) => {
    try {
        const conv = await getConversationById(parseInt(req.params.id));
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });
        if (conv.buyer_id !== req.user.id && conv.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const messages = await getConversationMessages(parseInt(req.params.id));
        await markMessagesRead(parseInt(req.params.id), req.user.id);
        res.json({ messages });
    } catch {
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// GET /chat/unread — количество непрочитанных
router.get('/unread', authenticateToken, async (req, res) => {
    try {
        const count = await getTotalUnread(req.user.id);
        res.json({ count });
    } catch {
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});

// PATCH /chat/messages/:id — редактировать сообщение
router.patch('/messages/:id', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content?.trim()) return res.status(400).json({ error: 'content required' });
        const ok = await editMessage(parseInt(req.params.id), req.user.id, content.trim());
        if (!ok) return res.status(403).json({ error: 'Not your message' });
        res.json({ message: 'Updated' });
    } catch { res.status(500).json({ error: 'Failed to edit message' }); }
});

// DELETE /chat/messages/:id — удалить сообщение (soft)
router.delete('/messages/:id', authenticateToken, async (req, res) => {
    try {
        const ok = await deleteMessage(parseInt(req.params.id), req.user.id);
        if (!ok) return res.status(403).json({ error: 'Not your message' });
        res.json({ message: 'Deleted' });
    } catch { res.status(500).json({ error: 'Failed to delete message' }); }
});

export default router;
