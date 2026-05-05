import express from 'express';
import {
    getSellerProfileHandler, getSellerListings,
    getCartHandler, addToCartHandler, removeFromCartHandler, checkCartHandler,
} from '../controllers/sellerController.js';
import { authenticateToken } from '../middleware/auth.js';
import { getListingById, updateListingPrice, getSellerByUserId, getPool } from '../database.js';
import sql from 'mssql';

const router = express.Router();

router.get('/cart/my', authenticateToken, getCartHandler);
router.post('/cart/add', authenticateToken, addToCartHandler);
router.delete('/cart/:listingId', authenticateToken, removeFromCartHandler);
router.get('/cart/check/:listingId', authenticateToken, checkCartHandler);

router.get('/all', async (_, res) => {
    try {
        const p = await getPool();
        const r = await p.request().query(`
            SELECT sp.id, sp.display_name, sp.is_verified, sp.rating, sp.total_sales,
                   sl.igdb_game_id
            FROM seller_profiles sp
            LEFT JOIN seller_listings sl ON sl.seller_id = sp.id AND sl.is_active = 1
            ORDER BY sp.display_name
        `);
        const sellersMap = new Map();
        r.recordset.forEach(row => {
            if (!sellersMap.has(row.id)) {
                sellersMap.set(row.id, {
                    id: row.id,
                    display_name: row.display_name,
                    is_verified: row.is_verified,
                    rating: row.rating,
                    total_sales: row.total_sales,
                    game_ids: []
                });
            }
            if (row.igdb_game_id) {
                sellersMap.get(row.id).game_ids.push(row.igdb_game_id);
            }
        });
        const sellers = Array.from(sellersMap.values()).filter(s => s.game_ids.length > 0);
        res.json({ sellers });
    } catch (e) {
        console.error('Error fetching all sellers:', e);
        res.status(500).json({ error: 'Failed to fetch sellers' });
    }
});

router.patch('/listings/:id/price', authenticateToken, async (req, res) => {
    try {
        const listingId = parseInt(req.params.id);
        const { price } = req.body;
        if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0)
            return res.status(400).json({ error: 'Valid price required' });

        const listing = await getListingById(listingId);
        if (!listing) return res.status(404).json({ error: 'Listing not found' });

        if (req.user.role !== 'admin') {
            const seller = await getSellerByUserId(req.user.id);
            if (!seller || seller.id !== listing.seller_id)
                return res.status(403).json({ error: 'Forbidden' });
        }

        await updateListingPrice(listingId, parseFloat(price));
        res.json({ message: 'Price updated' });
    } catch { res.status(500).json({ error: 'Failed to update price' }); }
});

router.get('/:sellerId', getSellerProfileHandler);
router.get('/:sellerId/listings', getSellerListings);

router.patch('/description', authenticateToken, async (req, res) => {
    try {
        const { description } = req.body;
        const seller = await getSellerByUserId(req.user.id);
        if (!seller) return res.status(404).json({ error: 'Seller profile not found' });
        const p = await getPool();
        await p.request()
            .input('desc', sql.NVarChar, description || '')
            .input('id', sql.Int, seller.id)
            .query(`UPDATE seller_profiles SET description = @desc WHERE id = @id`);
        res.json({ message: 'Description updated' });
    } catch { res.status(500).json({ error: 'Failed to update description' }); }
});

export default router;
