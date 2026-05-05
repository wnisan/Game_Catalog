import { getUserFromToken, refreshAccessToken, verifyToken } from '../auth.js';
import { getUserById } from '../database.js';

const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

const cookieOpts = (maxAge) => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge,
    path: '/',
});

async function resolveUser(req, res) {
    let token = req.cookies?.accessToken || req.headers['authorization']?.split(' ')[1];
    if (!token) return null;

    let user = await getUserFromToken(token);
    if (user) return user;

    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return null;

    try {
        const { accessToken, refreshToken: newRT, user: refreshedUser } = await refreshAccessToken(refreshToken);
        res.cookie('accessToken', accessToken, cookieOpts(15 * 60 * 1000));
        res.cookie('refreshToken', newRT, cookieOpts(365 * 24 * 60 * 60 * 1000));

        const decoded = verifyToken(accessToken);
        return decoded ? await getUserById(decoded.userId) : refreshedUser;
    } catch {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return null;
    }
}

export const authenticateToken = async (req, res, next) => {
    const user = await resolveUser(req, res);
    if (!user) return res.status(401).json({ error: 'Access token required' });
    if (user.is_banned === 1 || user.is_banned === true) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.status(403).json({ error: 'Your account has been banned.' });
    }
    req.user = user;
    next();
};

export const optionalAuth = async (req, res, next) => {
    req.user = await resolveUser(req, res);
    next();
};

export const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

export const requireSeller = (req, res, next) => {
    if (!req.user || req.user.role !== 'seller') {
        return res.status(403).json({ error: 'Seller access required' });
    }
    next();
};
