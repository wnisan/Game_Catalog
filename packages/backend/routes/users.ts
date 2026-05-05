import express from 'express';
import { getPublicProfile, getUserBalance, getUserOrders, getSellerByUserId, getListingsBySellerId } from '../database.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /users/:id — публичный профиль
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const profile = await getPublicProfile(parseInt(req.params.id));
        if (!profile) return res.status(404).json({ error: 'User not found' });

        const isSelf = req.user?.id === profile.id;
        if (!isSelf) delete profile.email;

        if (profile.role === 'seller' && profile.seller) {
            const listings = await getListingsBySellerId(profile.seller.seller_id);
            profile.seller.listings = listings;
        }

        res.json({ profile });
    } catch { res.status(500).json({ error: 'Failed to get profile' }); }
});

// GET /users/:id/balance — баланс 
router.get('/:id/balance', authenticateToken, async (req, res) => {
    try {
        if (req.user.id !== parseInt(req.params.id))
            return res.status(403).json({ error: 'Forbidden' });
        const balance = await getUserBalance(req.user.id);
        res.json({ balance });
    } catch { res.status(500).json({ error: 'Failed to get balance' }); }
});

// GET /users/:id/orders — купленные игры 
router.get('/:id/orders', authenticateToken, async (req, res) => {
    try {
        if (req.user.id !== parseInt(req.params.id))
            return res.status(403).json({ error: 'Forbidden' });
        const orders = await getUserOrders(req.user.id);
        res.json({ orders });
    } catch { res.status(500).json({ error: 'Failed to get orders' }); }
});

export default router;
