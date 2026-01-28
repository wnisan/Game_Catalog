import express from 'express';
import { register, login, refresh, logout, getMe, updateMe, deleteAccount, googleAuth, googleCallback } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticateToken, getMe);
router.put('/me', authenticateToken, updateMe);
router.post('/delete-account', authenticateToken, deleteAccount);
router.get('/google', googleAuth);
router.post('/google/callback', googleCallback);

export default router;