import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail, getUserById, verifyPassword, createRefreshToken, getRefreshToken, deleteRefreshToken, deleteUserRefreshTokens } from './database.js';
import dotenv from 'dotenv';
import crypto from 'crypto'; // для хеширования

dotenv.config();

const getEnvVar = (name) => {
    const value = process.env[name];
    if (value === undefined || value === '') {
        throw new Error(`Expected env var ${name} to be defined`);
    }
    return value;
};

const JWT_SECRET = getEnvVar('JWT_SECRET');
// const REFRESH_TOKEN_SECRET = getEnvVar('REFRESH_TOKEN_SECRET');

// Access token (15 минут)
export function generateAccessToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' });
}

// Refresh token (7 дней)
export function generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
}

// проверка токена
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

export async function registerUser(email, name, password, isOAuth = false) {
    const existingUser = getUserByEmail(email);
    if (existingUser && !isOAuth) {
        throw new Error('User with this email already exists');
    }

    let userId;
    let user;

    if (existingUser && isOAuth) {
        user = existingUser;
        userId = user.id;
    } else {
        userId = createUser(email, name, password);
        user = getUserById(userId);
    }

    const accessToken = generateAccessToken(userId);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);
    createRefreshToken(userId, refreshToken, expiresAt.toISOString());

    return { user, accessToken, refreshToken };
}

export async function loginUser(email, password) {
    const { deleteUserRefreshTokens } = await import('./database.js');
    const user = getUserByEmail(email);
    if (!user) {
        throw new Error('Invalid email or password');
    }

    if (!user.password_hash || user.password_hash.trim() === '') {
        throw new Error('This account uses Google authentication. Please sign in with Google.');
    }

    if (!verifyPassword(password, user.password_hash)) {
        throw new Error('Invalid email or password');
    }

    deleteUserRefreshTokens(user.id);

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    createRefreshToken(user.id, refreshToken, expiresAt.toISOString());

    const { password_hash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken) {
    const { getRefreshToken, deleteRefreshToken, createRefreshToken } = await import('./database.js');
    const tokenData = getRefreshToken(refreshToken);
    if (!tokenData) {
        throw new Error('Invalid or expired refresh token');
    }

    if (new Date(tokenData.expires_at) < new Date()) {
        deleteRefreshToken(refreshToken);
        throw new Error('Refresh token expired');
    }

    const user = getUserById(tokenData.user_id);
    if (!user) {
        throw new Error('User not found');
    }

    const accessToken = generateAccessToken(tokenData.user_id);
    const newRefreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    createRefreshToken(tokenData.user_id, newRefreshToken, expiresAt.toISOString());
    deleteRefreshToken(refreshToken);

    const { password_hash, ...userWithoutPassword } = user;

    return { accessToken, refreshToken: newRefreshToken, user: userWithoutPassword };
}

export async function logoutUser(refreshToken) {
    if (refreshToken) {
        deleteRefreshToken(refreshToken);
    }
}

export function getUserFromToken(token) {
    const decoded = verifyToken(token);
    if (!decoded) {
        return null;
    }

    const user = getUserById(decoded.userId);
    if (!user) {
        return null;
    }

    return user;
}