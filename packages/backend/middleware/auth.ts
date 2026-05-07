import { NextFunction, Request, Response } from 'express';
import { getUserFromToken, refreshAccessToken, verifyToken } from '../auth.js';
import { getUserById } from '../database.js';

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);

type CookieOptions = {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'none' | 'lax';
    maxAge: number;
    path: string;
};

const cookieOpts = (maxAge: number): CookieOptions => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge,
    path: '/',
});

async function resolveUser(req: Request, res: Response): Promise<Express.UserPayload | null> {
    const bearerToken = req.headers.authorization?.split(' ')[1];
    const token = req.cookies?.accessToken ?? bearerToken;
    if (!token) return null;

    const user = await getUserFromToken(token) as Express.UserPayload | null;
    if (user) return user;

    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return null;

    try {
        const { accessToken, refreshToken: newRT, user: refreshedUser } = await refreshAccessToken(refreshToken) as {
            accessToken: string;
            refreshToken: string;
            user: Express.UserPayload | null;
        };

        res.cookie('accessToken', accessToken, cookieOpts(15 * 60 * 1000));
        res.cookie('refreshToken', newRT, cookieOpts(365 * 24 * 60 * 60 * 1000));

        const decoded = verifyToken(accessToken) as { userId: number } | null;
        return decoded ? await getUserById(decoded.userId) as Express.UserPayload | null : refreshedUser;
    } catch (_error: unknown) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return null;
    }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = await resolveUser(req, res);
    if (!user) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }

    if ((user as { is_banned?: boolean | number }).is_banned === 1 || (user as { is_banned?: boolean | number }).is_banned === true) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.status(403).json({ error: 'Your account has been banned.' });
        return;
    }

    req.user = user;
    next();
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = await resolveUser(req, res);
    if (user) req.user = user;
    next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
};

export const requireSeller = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== 'seller') {
        res.status(403).json({ error: 'Seller access required' });
        return;
    }
    next();
};
