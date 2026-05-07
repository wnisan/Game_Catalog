import express, { Request } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
    createOrder, getUserOrders, getSellerOrders,
    sellerSendKey, buyerConfirmOrder, cancelOrder,
    getUserBalance, addToBalance, getCart, removeFromCart,
    getListingById,
} from '../database.js';

const router = express.Router();

interface CartItem {
    price: string;
    listing_id: number;
    igdb_game_id: number;
}

function idParam(req: Request<{ id: string }>): number {
    return Number(req.params.id);
}

router.post('/checkout', authenticateToken, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

        const cartItems = await getCart(req.user.id) as CartItem[];
        if (!cartItems.length) return res.status(400).json({ error: 'Cart is empty' });

        const total = cartItems.reduce((sum: number, i: CartItem) => sum + parseFloat(i.price), 0);
        const balance = await getUserBalance(req.user.id);

        if (balance < total) {
            return res.status(400).json({ error: `Insufficient balance. Need $${total.toFixed(2)}, have $${balance.toFixed(2)}` });
        }

        await addToBalance(req.user.id, -total);

        const orderIds: number[] = [];
        for (const item of cartItems) {
            const listing = await getListingById(item.listing_id);
            if (!listing) continue;
            if (listing.seller_user_id === req.user.id) continue;
            const orderId = await createOrder(req.user.id, listing.seller_user_id, item.listing_id, item.igdb_game_id, parseFloat(item.price));
            orderIds.push(orderId as number);
            await removeFromCart(req.user.id, item.listing_id);
        }

        const newBalance = await getUserBalance(req.user.id);
        return res.json({ orderIds, newBalance, message: `${orderIds.length} order(s) created` });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Checkout error:', message);
        return res.status(500).json({ error: 'Checkout failed' });
    }
});

router.get('/my', authenticateToken, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const orders = await getUserOrders(req.user.id);
        return res.json({ orders });
    } catch {
        return res.status(500).json({ error: 'Failed to get orders' });
    }
});

router.get('/selling', authenticateToken, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        if (req.user.role !== 'seller') return res.status(403).json({ error: 'Sellers only' });
        const orders = await getSellerOrders(req.user.id);
        return res.json({ orders });
    } catch {
        return res.status(500).json({ error: 'Failed to get orders' });
    }
});

router.post('/:id/send-key', authenticateToken, async (req: Request<{ id: string }, unknown, { gameKey?: unknown }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        if (req.user.role !== 'seller') return res.status(403).json({ error: 'Sellers only' });
        const gameKey = typeof req.body.gameKey === 'string' ? req.body.gameKey.trim() : '';
        if (!gameKey) return res.status(400).json({ error: 'Game key is required' });

        const ok = await sellerSendKey(idParam(req), req.user.id, gameKey);
        if (!ok) return res.status(400).json({ error: 'Order not found or already processed' });
        return res.json({ message: 'Key sent' });
    } catch {
        return res.status(500).json({ error: 'Failed to send key' });
    }
});

router.post('/:id/confirm', authenticateToken, async (req: Request<{ id: string }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const ok = await buyerConfirmOrder(idParam(req), req.user.id);
        if (!ok) return res.status(400).json({ error: 'Order not found or key not sent yet' });
        return res.json({ message: 'Order completed' });
    } catch {
        return res.status(500).json({ error: 'Failed to confirm order' });
    }
});

router.post('/:id/cancel', authenticateToken, async (req: Request<{ id: string }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const ok = await cancelOrder(idParam(req), req.user.id);
        if (!ok) return res.status(400).json({ error: 'Cannot cancel this order' });
        return res.json({ message: 'Order cancelled, balance refunded' });
    } catch {
        return res.status(500).json({ error: 'Failed to cancel order' });
    }
});

export default router;
