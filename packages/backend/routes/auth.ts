import express from 'express';
import jwt from 'jsonwebtoken';
import { register, login, refresh, logout, getMe, updateMe, deleteAccount, googleAuth, googleCallback } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { LoginRequestSchema, RegisterRequestSchema } from '@game-catalog/shared';

const router = express.Router();

router.post('/register', validate(RegisterRequestSchema), register);
router.post('/login', validate(LoginRequestSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticateToken, getMe);
router.put('/me', authenticateToken, updateMe);
router.post('/delete-account', authenticateToken, deleteAccount);
router.get('/google', googleAuth);
router.post('/google/callback', googleCallback);

// Короткоживущий токен для WebSocket аутентификации
router.get('/ws-token', authenticateToken, (req, res) => {
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
    if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const token = jwt.sign({ id: req.user.id }, jwtSecret, { expiresIn: '1h' });
    res.json({ token });
});

export default router;