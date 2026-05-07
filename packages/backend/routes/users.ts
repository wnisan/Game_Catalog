import express, { Request } from 'express';
import { getPublicProfile, getUserBalance, getUserOrders, getListingsBySellerId } from '../database.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/:id', optionalAuth, async (req: Request<{ id: string }>, res) => {
    try {
        const userId = Number(req.params.id);
        const profile = await getPublicProfile(userId) as (Record<string, unknown> & { id: number; role?: string; email?: string; seller?: Record<string, unknown> & { seller_id?: number } }) | null;
        if (!profile) return res.status(404).json({ error: 'User not found' });

        const isSelf = req.user?.id === profile.id;
        if (!isSelf) delete profile.email;

        if (profile.role === 'seller' && profile.seller && typeof profile.seller.seller_id === 'number') {
            const listings = await getListingsBySellerId(profile.seller.seller_id);
            profile.seller.listings = listings;
        }

        return res.json({ profile });
    } catch {
        return res.status(500).json({ error: 'Failed to get profile' });
    }
});

router.get('/:id/balance', authenticateToken, async (req: Request<{ id: string }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const userId = Number(req.params.id);
        if (req.user.id !== userId) return res.status(403).json({ error: 'Forbidden' });
        const balance = await getUserBalance(req.user.id);
        return res.json({ balance });
    } catch {
        return res.status(500).json({ error: 'Failed to get balance' });
    }
});

router.get('/:id/orders', authenticateToken, async (req: Request<{ id: string }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const userId = Number(req.params.id);
        if (req.user.id !== userId) return res.status(403).json({ error: 'Forbidden' });
        const orders = await getUserOrders(req.user.id);
        return res.json({ orders });
    } catch {
        return res.status(500).json({ error: 'Failed to get orders' });
    }
});

export default router;
