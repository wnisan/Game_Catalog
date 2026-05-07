import express, { Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
    getAllUsers, banUser, setUserRole,
    getHiddenGames, hideGame, unhideGame, getPool,
    removeHiddenGameFromCartsAndFavorites,
} from '../database.js';

const router = express.Router();
router.use(authenticateToken, requireAdmin);

router.get('/listings', async (_req: Request, res: Response) => {
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
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to get listings' });
    }
});

router.get('/users', async (_req: Request, res: Response) => {
    try {
        const users = await getAllUsers();
        res.json({ users });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to get users' });
    }
});

router.patch('/users/:id/ban', async (req: Request<{ id: string }, unknown, { banned?: boolean }>, res: Response) => {
    try {
        const { banned } = req.body;
        await banUser(Number(req.params.id), Boolean(banned));
        res.json({ message: 'Updated' });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to update ban' });
    }
});

router.patch('/users/:id/role', async (req: Request<{ id: string }, unknown, { role?: string }>, res: Response) => {
    try {
        const { role } = req.body;
        if (role !== 'buyer' && role !== 'seller' && role !== 'admin') {
            res.status(400).json({ error: 'Invalid role' });
            return;
        }
        await setUserRole(Number(req.params.id), role);
        res.json({ message: 'Role updated' });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to update role' });
    }
});

router.get('/hidden-games', async (_req: Request, res: Response) => {
    try {
        const games = await getHiddenGames();
        res.json({ games });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to get hidden games' });
    }
});

router.post('/hidden-games', async (req: Request<Record<string, never>, unknown, { igdbGameId?: string | number; reason?: string }>, res: Response) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { igdbGameId, reason } = req.body;
        if (!igdbGameId) {
            res.status(400).json({ error: 'igdbGameId required' });
            return;
        }

        const id = Number(igdbGameId);
        await hideGame(id, req.user.id, reason ?? '');
        await removeHiddenGameFromCartsAndFavorites(id);
        res.json({ message: 'Game hidden' });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to hide game' });
    }
});

router.delete('/hidden-games/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
        await unhideGame(Number(req.params.id));
        res.json({ message: 'Game unhidden' });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to unhide game' });
    }
});

export default router;
