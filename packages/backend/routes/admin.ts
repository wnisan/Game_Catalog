import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
    getAllUsers, banUser, setUserRole,
    getHiddenGames, hideGame, unhideGame, getPool,
    removeHiddenGameFromCartsAndFavorites,
} from '../database.js';

const router = express.Router();
router.use(authenticateToken, requireAdmin);

// GET /admin/listings
router.get('/listings', async (req, res) => {
    try {
        const p = await getPool();
        const r = await p.request().query(`
            SELECT sl.id, sl.igdb_game_id, sl.price, sl.is_active,
                   sp.display_name AS seller_name, u.id AS seller_user_id
            FROM seller_listings sl
            JOIN seller_profiles sp ON sl.seller_id = sp.id
            JOIN users u ON sp.user_id = u.id
            WHERE sl.is_active = 1
            ORDER BY sl.igdb_game_id`);
        res.json({ listings: r.recordset });
    } catch { res.status(500).json({ error: 'Failed to get listings' }); }
});

// GET /admin/users
router.get('/users', async (req, res) => {
    try {
        const users = await getAllUsers();
        res.json({ users });
    } catch { res.status(500).json({ error: 'Failed to get users' }); }
});

// PATCH /admin/users/:id/ban
router.patch('/users/:id/ban', async (req, res) => {
    try {
        const { banned } = req.body;
        await banUser(parseInt(req.params.id), !!banned);
        res.json({ message: 'Updated' });
    } catch { res.status(500).json({ error: 'Failed to update ban' }); }
});

// PATCH /admin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        if (!['buyer', 'seller', 'admin'].includes(role))
            return res.status(400).json({ error: 'Invalid role' });
        await setUserRole(parseInt(req.params.id), role);
        res.json({ message: 'Role updated' });
    } catch { res.status(500).json({ error: 'Failed to update role' }); }
});

// GET /admin/hidden-games
router.get('/hidden-games', async (req, res) => {
    try {
        const games = await getHiddenGames();
        res.json({ games });
    } catch { res.status(500).json({ error: 'Failed to get hidden games' }); }
});

// POST /admin/hidden-games
router.post('/hidden-games', async (req, res) => {
    try {
        const { igdbGameId, reason } = req.body;
        if (!igdbGameId) return res.status(400).json({ error: 'igdbGameId required' });
        const id = parseInt(igdbGameId);
        await hideGame(id, req.user.id, reason || '');
        await removeHiddenGameFromCartsAndFavorites(id);
        res.json({ message: 'Game hidden' });
    } catch { res.status(500).json({ error: 'Failed to hide game' }); }
});

// DELETE /admin/hidden-games/:id
router.delete('/hidden-games/:id', async (req, res) => {
    try {
        await unhideGame(parseInt(req.params.id));
        res.json({ message: 'Game unhidden' });
    } catch { res.status(500).json({ error: 'Failed to unhide game' }); }
});

export default router;
