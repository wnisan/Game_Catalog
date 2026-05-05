import { Request, Response } from 'express';
import { registerUser, loginUser, refreshAccessToken, logoutUser } from '../auth.js';
import { getUserById, verifyPassword, updateUser, deleteUser, deleteUserRefreshTokens, getUserByEmail, createUser } from '../database.js';

const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost/signin-callback';

const setCookies = (res: Response, accessToken: string, refreshToken: string) => {
    const opts = (maxAge: number) => ({ httpOnly: true, secure: !!isProduction, sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax', maxAge, path: '/' });
    res.cookie('accessToken', accessToken, opts(15 * 60 * 1000));
    res.cookie('refreshToken', refreshToken, opts(365 * 24 * 60 * 60 * 1000));
};

export const register = async (req: Request, res: Response) => {
    try {
        const { email, name, password } = req.body;
        if (!email || !name || !password) return res.status(400).json({ error: 'Email, name, and password are required' });
        const { user, accessToken, refreshToken } = await registerUser(email, name, password);
        setCookies(res, accessToken, refreshToken);
        res.json({ user });
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
        const { user, accessToken, refreshToken } = await loginUser(email, password);
        setCookies(res, accessToken, refreshToken);
        res.json({ user });
    } catch (error) {
        res.status(401).json({ error: (error as Error).message });
    }
};

export const refresh = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });
    try {
        const data = await refreshAccessToken(refreshToken);
        setCookies(res, data.accessToken, data.refreshToken);
        res.json({ user: data.user });
    } catch {
        res.status(401).json({ error: 'Session expired' });
    }
};

export const logout = async (req: Request, res: Response) => {
    try {
        if (req.cookies?.refreshToken) await logoutUser(req.cookies.refreshToken);
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.json({ message: 'Logged out successfully' });
    } catch {
        res.status(500).json({ error: 'Failed to logout' });
    }
};

export const getMe = (req: Request, res: Response) => {
    const { password_hash, ...user } = (req as any).user;
    res.json({ user });
};

export const updateMe = async (req: Request, res: Response) => {
    try {
        const { name, email, password, currentPassword } = req.body;
        const userId = (req as any).user.id;
        if (name === undefined && email === undefined && password === undefined)
            return res.status(400).json({ error: 'At least one field must be provided' });

        if (email !== undefined) {
            const existing = await getUserByEmail(email);
            if (existing && existing.id !== userId) return res.status(400).json({ error: 'Email is already taken' });
        }

        if (password !== undefined && password.trim() !== '') {
            if (!currentPassword?.trim()) return res.status(400).json({ error: 'Current password is required' });
            const user = await getUserById(userId);
            if (!user?.password_hash) return res.status(400).json({ error: 'Cannot change password for OAuth users' });
            if (!verifyPassword(currentPassword, user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' });
        }

        const updated = await updateUser(userId, { name, email, password });
        if (!updated) return res.status(400).json({ error: 'No changes to update' });

        const updatedUser = await getUserById(userId);
        const { password_hash, ...userWithoutPassword } = updatedUser;
        res.json({ user: userWithoutPassword });
    } catch {
        res.status(500).json({ error: 'Failed to update user' });
    }
};

export const deleteAccount = async (req: Request, res: Response) => {
    try {
        const { password } = req.body;
        const userId = (req as any).user.id;
        if (!password?.trim()) return res.status(400).json({ error: 'Password is required' });

        const user = await getUserById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!user.password_hash) return res.status(400).json({ error: 'Cannot delete OAuth account this way' });
        if (!verifyPassword(password, user.password_hash)) return res.status(400).json({ error: 'Password is incorrect' });

        await deleteUserRefreshTokens(userId);
        await deleteUser(userId);
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.json({ message: 'Account deleted successfully' });
    } catch {
        res.status(500).json({ error: 'Failed to delete account' });
    }
};

export const googleAuth = (req: Request, res: Response) => {
    if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Google OAuth not configured' });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&response_type=code&scope=openid email profile&access_type=offline&prompt=consent`;
    res.json({ authUrl });
};

export const googleCallback = async (req: Request, res: Response) => {
    try {
        const { code, redirectUri } = req.body;
        if (!code) return res.status(400).json({ error: 'Authorization code is required' });
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(500).json({ error: 'Google OAuth not configured' });

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: redirectUri || GOOGLE_REDIRECT_URI }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) return res.status(400).json({ error: 'Failed to exchange code for token' });

        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
        const userData = await userRes.json();
        if (!userRes.ok) return res.status(400).json({ error: 'Failed to get user info from Google' });

        let user = await getUserByEmail(userData.email);
        if (!user) {
            const userId = await createUser(userData.email, userData.name, null);
            user = await getUserById(userId);
        }

        const { accessToken, refreshToken } = await registerUser(user.email, user.name, null, true);
        setCookies(res, accessToken, refreshToken);
        const { password_hash, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
    } catch {
        res.status(500).json({ error: 'Failed to authenticate with Google' });
    }
};
