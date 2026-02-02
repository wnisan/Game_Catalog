import { getUserFromToken, refreshAccessToken, verifyToken } from '../auth.js';

export const authenticateToken = async (req, res, next) => {
    let token = req.cookies?.accessToken;

    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    let user = getUserFromToken(token);

    if (!user) {
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
            try {
                const { accessToken: newAccessToken, refreshToken: newRefreshToken, user: refreshedUser } = await refreshAccessToken(refreshToken);

                const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
                res.cookie('accessToken', newAccessToken, {
                    httpOnly: true,
                    secure: isProduction,
                    sameSite: isProduction ? 'none' : 'lax',
                    maxAge: 15 * 60 * 1000,
                    path: '/'
                });
                res.cookie('refreshToken', newRefreshToken, {
                    httpOnly: true,
                    secure: isProduction,
                    sameSite: isProduction ? 'none' : 'lax',
                    maxAge: 365 * 24 * 60 * 60 * 1000,
                    path: '/'
                });

                const decoded = verifyToken(newAccessToken);
                if (decoded) {
                    const { getUserById } = await import('../database.js');
                    user = getUserById(decoded.userId);
                } else {
                    user = refreshedUser;
                }
                token = newAccessToken;
            } catch (error) {
                res.clearCookie('accessToken');
                res.clearCookie('refreshToken');
                return res.status(403).json({ error: 'Invalid or expired token' });
            }
        } else {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
    }

    req.user = user;
    next();
};

export const optionalAuth = async (req, res, next) => {
    let token = req.cookies?.accessToken;

    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) {
        req.user = null;
        return next();
    }

    let user = getUserFromToken(token);

    if (!user) {
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
            try {
                const { accessToken: newAccessToken, refreshToken: newRefreshToken, user: refreshedUser } = await refreshAccessToken(refreshToken);

                const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
                res.cookie('accessToken', newAccessToken, {
                    httpOnly: true,
                    secure: isProduction,
                    sameSite: isProduction ? 'none' : 'lax',
                    maxAge: 15 * 60 * 1000,
                    path: '/'
                });
                res.cookie('refreshToken', newRefreshToken, {
                    httpOnly: true,
                    secure: isProduction,
                    sameSite: isProduction ? 'none' : 'lax',
                    maxAge: 365 * 24 * 60 * 60 * 1000,
                    path: '/'
                });

                const decoded = verifyToken(newAccessToken);
                if (decoded) {
                    const { getUserById } = await import('../database.js');
                    user = getUserById(decoded.userId);
                } else {
                    user = refreshedUser;
                }
            } catch (error) {
                req.user = null;
                return next();
            }
        } else {
            req.user = null;
            return next();
        }
    }

    req.user = user;
    next();
};
