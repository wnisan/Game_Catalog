import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail, getUserById, verifyPassword, createRefreshToken, getRefreshToken, deleteRefreshToken, deleteUserRefreshTokens } from './database.js';
import dotenv from 'dotenv';
import crypto from 'crypto'; // для хеширования

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-change-in-production'; // изменить потом
//const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET + '_refresh';

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

export async function registerUser(email, name, password) {
    const existingUser = getUserByEmail(email);
    if (existingUser) {
        throw new Error('User with this email already exists');
    }

    // Создаем пользователя
    const userId = createUser(email, name, password);
    const user = getUserById(userId);
    
    // Генерируем токены
    const accessToken = generateAccessToken(userId);
    const refreshToken = generateRefreshToken();
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    createRefreshToken(userId, refreshToken, expiresAt.toISOString());

    return { user, accessToken, refreshToken };
}

export async function loginUser(email, password) {
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

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    createRefreshToken(user.id, refreshToken, expiresAt.toISOString());
    
    const { password_hash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken) {
    const tokenData = getRefreshToken(refreshToken);
    if (!tokenData) {
        throw new Error('Invalid or expired refresh token');
    }

    // Генерируем новый access token
    const accessToken = generateAccessToken(tokenData.user_id);
    const user = getUserById(tokenData.user_id);
    
    if (!user) {
        throw new Error('User not found');
    }

    const { password_hash, ...userWithoutPassword } = user;

    return { accessToken, user: userWithoutPassword };
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