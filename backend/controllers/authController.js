import { registerUser, loginUser, refreshAccessToken, logoutUser } from '../auth.js';
import { getUserById, verifyPassword, updateUser, deleteUser, deleteUserRefreshTokens, getUserByEmail, createUser } from '../database.js';

const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/signin-callback';

const setCookies = (res, accessToken, refreshToken) => {
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/'
    });

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/'
    });
};

export const register = async (req, res) => {
    try {
        const { email, name, password } = req.body;

        if (!email || !name || !password) {
            return res.status(400).json({ error: 'Email, name, and password are required' });
        }

        const { user, accessToken, refreshToken } = await registerUser(email, name, password);

        setCookies(res, accessToken, refreshToken);
        console.log('Cookies set for user:', user.email);
        res.json({ user });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const { user, accessToken, refreshToken } = await loginUser(email, password);

        setCookies(res, accessToken, refreshToken);
        console.log('Cookies set for user:', user.email);
        res.json({ user });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: error.message });
    }
};

export const refresh = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Session expired. Please sign in again' });
        }

        const { accessToken, refreshToken: newRefreshToken, user } = await refreshAccessToken(refreshToken);

        setCookies(res, accessToken, newRefreshToken);
        console.log('Access token refreshed for user:', user.email);
        res.json({ user });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.status(401).json({ error: error.message });
    }
};

export const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (refreshToken) {
            await logoutUser(refreshToken);
        }

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
};

export const getMe = (req, res) => {
    const { password_hash, ...userWithoutPassword } = req.user;
    res.json({ user: userWithoutPassword });
};

export const updateMe = async (req, res) => {
    try {
        const { name, email, password, currentPassword } = req.body;
        const userId = req.user.id;

        if (name === undefined && email === undefined && password === undefined) {
            return res.status(400).json({ error: 'At least one field (name, email, password) must be provided' });
        }

        if (email !== undefined) {
            const existingUser = getUserByEmail(email);
            if (existingUser && existingUser.id !== userId) {
                return res.status(400).json({ error: 'Email is already taken' });
            }
        }

        if (password !== undefined && password.trim() !== '') {
            if (!currentPassword || currentPassword.trim() === '') {
                return res.status(400).json({ error: 'Current password is required to change password' });
            }

            const user = getUserById(userId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.password_hash) {
                return res.status(400).json({ error: 'Cannot change password for OAuth users' });
            }

            if (!verifyPassword(currentPassword, user.password_hash)) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }
        }

        const updated = updateUser(userId, { name, email, password });

        if (!updated) {
            return res.status(400).json({ error: 'No changes to update' });
        }

        const updatedUser = getUserById(userId);

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { password_hash, ...userWithoutPassword } = updatedUser;
        res.json({ user: userWithoutPassword });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

export const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user.id;

        if (!password || !password.trim()) {
            return res.status(400).json({ error: 'Password is required to delete account' });
        }

        const user = getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.password_hash) {
            return res.status(400).json({ error: 'Cannot delete account without password. This account uses external authentication.' });
        }

        if (!verifyPassword(password, user.password_hash)) {
            return res.status(400).json({ error: 'Password is incorrect' });
        }

        deleteUserRefreshTokens(userId);
        const deleted = deleteUser(userId);

        if (!deleted) {
            return res.status(500).json({ error: 'Failed to delete account' });
        }

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
};

export const googleAuth = async (req, res) => {
    try {
        if (!GOOGLE_CLIENT_ID) {
            return res.status(500).json({ error: 'Google OAuth not configured' });
        }

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${GOOGLE_CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&` +
            `response_type=code&` +
            `scope=openid email profile&` +
            `access_type=offline&` +
            `prompt=consent`;

        res.json({ authUrl });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ error: 'Failed to generate Google auth URL' });
    }
};

export const googleCallback = async (req, res) => {
    try {
        const { code, redirectUri } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Authorization code is required' });
        }

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            return res.status(500).json({ error: 'Google OAuth not configured' });
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri || GOOGLE_REDIRECT_URI,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error('Google token error:', tokenData);
            return res.status(400).json({ error: 'Failed to exchange code for token' });
        }

        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });

        const userData = await userResponse.json();

        if (!userResponse.ok) {
            console.error('Google user info error:', userData);
            return res.status(400).json({ error: 'Failed to get user info from Google' });
        }

        let user = getUserByEmail(userData.email);

        if (!user) {
            const userId = createUser(userData.email, userData.name, null, userData.id);
            user = getUserById(userId);
        }

        const { accessToken, refreshToken } = await registerUser(user.email, user.name, null, true);

        setCookies(res, accessToken, refreshToken);

        const { password_hash, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
    } catch (error) {
        console.error('Google callback error:', error);
        res.status(500).json({ error: 'Failed to authenticate with Google' });
    }
};