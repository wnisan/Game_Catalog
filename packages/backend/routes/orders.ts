import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
    createOrder, getUserOrders, getSellerOrders,
    sellerSendKey, buyerConfirmOrder, cancelOrder,
    getUserBalance, addToBalance, getCart, removeFromCart,
    getListingById,
} from '../database.js';

const router = express.Router();

// POST /orders/checkout — списать деньги с баланса и создать заказы из корзины
router.post('/checkout', authenticateToken, async (req, res) => {
    try {
        const cartItems = await getCart(req.user.id);
        if (!cartItems.length) return res.status(400).json({ error: 'Cart is empty' });

        const total = cartItems.reduce((sum, i) => sum + parseFloat(i.price), 0);
        const balance = await getUserBalance(req.user.id);

        if (balance < total) {
            return res.status(400).json({ error: `Insufficient balance. Need $${total.toFixed(2)}, have $${balance.toFixed(2)}` });
        }

        await addToBalance(req.user.id, -total);

        const orderIds = [];
        for (const item of cartItems) {
            const listing = await getListingById(item.listing_id);
            if (!listing) continue;
            if (listing.seller_user_id === req.user.id) continue;
            const orderId = await createOrder(
                req.user.id,
                listing.seller_user_id,
                item.listing_id,
                item.igdb_game_id,
                parseFloat(item.price)
            );
            orderIds.push(orderId);
            await removeFromCart(req.user.id, item.listing_id);
        }

        const newBalance = await getUserBalance(req.user.id);
        res.json({ orderIds, newBalance, message: `${orderIds.length} order(s) created` });
    } catch (err) {
        console.error('Checkout error:', err.message);
        res.status(500).json({ error: 'Checkout failed' });
    }
});

// GET /orders/my — заказы покупателя
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const orders = await getUserOrders(req.user.id);
        res.json({ orders });
    } catch {
        res.status(500).json({ error: 'Failed to get orders' });
    }
});

// GET /orders/selling — заказы продавца
router.get('/selling', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'seller') return res.status(403).json({ error: 'Sellers only' });
        const orders = await getSellerOrders(req.user.id);
        res.json({ orders });
    } catch {
        res.status(500).json({ error: 'Failed to get orders' });
    }
});

// POST /orders/:id/send-key — продавец отправляет ключ
router.post('/:id/send-key', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'seller') return res.status(403).json({ error: 'Sellers only' });
        const { gameKey } = req.body;
        if (!gameKey?.trim()) return res.status(400).json({ error: 'Game key is required' });
        const ok = await sellerSendKey(parseInt(req.params.id), req.user.id, gameKey.trim());
        if (!ok) return res.status(400).json({ error: 'Order not found or already processed' });
        res.json({ message: 'Key sent' });
    } catch {
        res.status(500).json({ error: 'Failed to send key' });
    }
});

// POST /orders/:id/confirm — покупатель подтверждает получение
router.post('/:id/confirm', authenticateToken, async (req, res) => {
    try {
        const ok = await buyerConfirmOrder(parseInt(req.params.id), req.user.id);
        if (!ok) return res.status(400).json({ error: 'Order not found or key not sent yet' });
        res.json({ message: 'Order completed' });
    } catch {
        res.status(500).json({ error: 'Failed to confirm order' });
    }
});

// POST /orders/:id/cancel — отмена 
router.post('/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const ok = await cancelOrder(parseInt(req.params.id), req.user.id);
        if (!ok) return res.status(400).json({ error: 'Cannot cancel this order' });
        res.json({ message: 'Order cancelled, balance refunded' });
    } catch {
        res.status(500).json({ error: 'Failed to cancel order' });
    }
});

export default router;
