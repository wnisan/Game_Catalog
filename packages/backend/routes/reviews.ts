import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createReview, getSellerReviews, hasReview } from '../database.js';

const router = express.Router();

// POST /reviews — оставить отзыв на заказ
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { orderId, listingId, sellerUserId, rating, review } = req.body;
        if (!orderId || !listingId || !sellerUserId || !rating) {
            return res.status(400).json({ error: 'orderId, listingId, sellerUserId, rating required' });
        }
        if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

        const already = await hasReview(orderId, req.user.id);
        if (already) return res.status(400).json({ error: 'You already reviewed this order' });

        const ok = await createReview(orderId, req.user.id, listingId, sellerUserId, rating, review);
        if (!ok) return res.status(400).json({ error: 'Failed to create review' });
        res.json({ message: 'Review submitted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

// GET /reviews/seller/:userId — отзывы на продавца
router.get('/seller/:userId', async (req, res) => {
    try {
        const reviews = await getSellerReviews(parseInt(req.params.userId));
        res.json({ reviews });
    } catch {
        res.status(500).json({ error: 'Failed to get reviews' });
    }
});

// PATCH /reviews/:id/reply — продавец отвечает на отзыв
router.patch('/:id/reply', authenticateToken, async (req, res) => {
    try {
        const { reply } = req.body;
        if (!reply?.trim()) return res.status(400).json({ error: 'reply required' });
        const { getPool } = await import('../database.js');
        const sql = (await import('mssql')).default;
        const p = await getPool();

        const check = await p.request()
            .input('id', sql.Int, parseInt(req.params.id))
            .input('uid', sql.Int, req.user.id)
            .query(`SELECT pr.id FROM product_ratings pr
                    JOIN seller_listings sl ON pr.listing_id = sl.id
                    JOIN seller_profiles sp ON sl.seller_id = sp.id
                    WHERE pr.id = @id AND sp.user_id = @uid`);
        if (!check.recordset.length) return res.status(403).json({ error: 'Forbidden' });
        await p.request()
            .input('reply', sql.NVarChar, reply.trim())
            .input('id', sql.Int, parseInt(req.params.id))
            .query(`UPDATE product_ratings SET seller_reply = @reply WHERE id = @id`);
        res.json({ message: 'Reply saved' });
    } catch { res.status(500).json({ error: 'Failed to save reply' }); }
});

export default router;
