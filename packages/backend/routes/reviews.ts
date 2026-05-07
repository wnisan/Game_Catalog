import express, { Request } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createReview, getSellerReviews, hasReview } from '../database.js';

const router = express.Router();

router.post('/', authenticateToken, async (req: Request<Record<string, never>, unknown, { orderId?: unknown; listingId?: unknown; sellerUserId?: unknown; rating?: unknown; review?: unknown }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

        const orderId = Number(req.body.orderId);
        const listingId = Number(req.body.listingId);
        const sellerUserId = Number(req.body.sellerUserId);
        const rating = Number(req.body.rating);
        const review = typeof req.body.review === 'string' ? req.body.review : '';

        if ([orderId, listingId, sellerUserId, rating].some((v) => Number.isNaN(v))) {
            return res.status(400).json({ error: 'orderId, listingId, sellerUserId, rating required' });
        }
        if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

        const already = await hasReview(orderId, req.user.id);
        if (already) return res.status(400).json({ error: 'You already reviewed this order' });

        const ok = await createReview(orderId, req.user.id, listingId, sellerUserId, rating, review);
        if (!ok) return res.status(400).json({ error: 'Failed to create review' });
        return res.json({ message: 'Review submitted' });
    } catch (err: unknown) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to submit review' });
    }
});

router.get('/seller/:userId', async (req: Request<{ userId: string }>, res) => {
    try {
        const reviews = await getSellerReviews(Number(req.params.userId));
        return res.json({ reviews });
    } catch {
        return res.status(500).json({ error: 'Failed to get reviews' });
    }
});

router.patch('/:id/reply', authenticateToken, async (req: Request<{ id: string }, unknown, { reply?: unknown }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const reply = typeof req.body.reply === 'string' ? req.body.reply.trim() : '';
        if (!reply) return res.status(400).json({ error: 'reply required' });

        const { getPool } = await import('../database.js');
        const sql = (await import('mssql')).default;
        const p = await getPool();
        const reviewId = Number(req.params.id);

        const check = await p.request()
            .input('id', sql.Int, reviewId)
            .input('uid', sql.Int, req.user.id)
            .query(`SELECT pr.id FROM product_ratings pr
                    JOIN seller_listings sl ON pr.listing_id = sl.id
                    JOIN seller_profiles sp ON sl.seller_id = sp.id
                    WHERE pr.id = @id AND sp.user_id = @uid`);

        if (!check.recordset.length) return res.status(403).json({ error: 'Forbidden' });

        await p.request()
            .input('reply', sql.NVarChar, reply)
            .input('id', sql.Int, reviewId)
            .query(`UPDATE product_ratings SET seller_reply = @reply WHERE id = @id`);

        return res.json({ message: 'Reply saved' });
    } catch {
        return res.status(500).json({ error: 'Failed to save reply' });
    }
});

export default router;
