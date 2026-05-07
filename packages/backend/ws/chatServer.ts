import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { getConversationById, saveMessage, markMessagesRead, getTotalUnread } from '../database.js';

const clients = new Map<number, Set<WebSocket>>();

function addClient(userId: number, ws: WebSocket): void {
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId)!.add(ws);
}

function removeClient(userId: number, ws: WebSocket): void {
    clients.get(userId)?.delete(ws);
    if (clients.get(userId)?.size === 0) clients.delete(userId);
}

function sendTo(userId: number, data: unknown): void {
    const sockets = clients.get(userId);
    if (!sockets) return;
    const payload = JSON.stringify(data);
    for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
}

export function getUnreadCountForUser(userId: number) {
    return getTotalUnread(userId);
}

export function initChatWS(server: Server) {
    const wss = new WebSocketServer({ server, path: '/ws/chat' });

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const url = new URL(req.url!, 'http://localhost');
        const token = url.searchParams.get('token');

        let userId: number | null = null;
        try {
            if (!token) throw new Error('No token');
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload & { id: number };
            userId = Number(decoded.id);
        } catch {
            ws.close(4001, 'Unauthorized');
            return;
        }

        addClient(userId, ws);
        const currentUserId = userId;

        ws.on('message', async (raw) => {
            try {
                const msg = JSON.parse(raw.toString());

                if (msg.type === 'join') {
                    const conv = await getConversationById(msg.convId);
                    if (!conv) return;
                    if (Number(conv.buyer_id) !== currentUserId && Number(conv.seller_id) !== currentUserId) return;
                    await markMessagesRead(msg.convId, currentUserId);
                    const unread = await getTotalUnread(currentUserId);
                    sendTo(currentUserId, { type: 'unread_count', count: unread });
                }

                if (msg.type === 'message') {
                    const conv = await getConversationById(msg.convId);
                    if (!conv) return;
                    const buyerId = Number(conv.buyer_id);
                    const sellerId = Number(conv.seller_id);
                    if (buyerId !== currentUserId && sellerId !== currentUserId) return;

                    const content = msg.content?.trim();
                    if (!content || content.length > 2000) return;

                    const saved = await saveMessage(msg.convId, currentUserId, content);

                    const outgoing = {
                        type: 'message',
                        id: saved.id,
                        convId: msg.convId,
                        senderId: currentUserId,
                        content,
                        createdAt: saved.created_at,
                    };

                    sendTo(buyerId, outgoing);
                    sendTo(sellerId, outgoing);

                    const recipientId = currentUserId === buyerId ? sellerId : buyerId;
                    const unread = await getTotalUnread(recipientId);
                    sendTo(recipientId, { type: 'unread_count', count: unread });
                }
            } catch (err) {
                console.error('WS message error:', (err as Error).message);
            }
        });

        ws.on('close', () => removeClient(currentUserId, ws));
        ws.on('error', () => removeClient(currentUserId, ws));
    });

    return wss;
}
