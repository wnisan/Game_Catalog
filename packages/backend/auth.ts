import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
    createUser, getUserByEmail, getUserById, verifyPassword,
    createRefreshToken, getRefreshToken, deleteRefreshToken, deleteUserRefreshTokens,
} from './database.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is required');

export function generateAccessToken(userId: number | string): string {
    return jwt.sign({ userId }, JWT_SECRET!, { expiresIn: '15m' });
}

export function generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
}

export function verifyToken(token: string): (JwtPayload & { userId: number }) | null {
    try { return jwt.verify(token, JWT_SECRET!) as JwtPayload & { userId: number }; }
    catch { return null; }
}

export async function registerUser(email: string, name: string, password: string | null, isOAuth = false) {
    let user = await getUserByEmail(email);

    if (user && !isOAuth) throw new Error('User with this email already exists');

    if (!user) {
        const userId = await createUser(email, name, password);
        user = await getUserById(userId);
    }

    const accessToken  = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    const expiresAt    = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await createRefreshToken(user.id, refreshToken, expiresAt.toISOString());

    return { user, accessToken, refreshToken };
}

export async function loginUser(email: string, password: string) {
    const user = await getUserByEmail(email);
    if (!user) throw new Error('Invalid email or password');

    if (user.is_banned === 1 || user.is_banned === true) {
        throw new Error('Your account has been banned. Please contact support.');
    }

    if (!user.password_hash || user.password_hash.trim() === '') {
        throw new Error('This account uses Google authentication. Please sign in with Google.');
    }

    if (!verifyPassword(password, user.password_hash)) throw new Error('Invalid email or password');

    await deleteUserRefreshTokens(user.id);

    const accessToken  = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    const expiresAt    = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await createRefreshToken(user.id, refreshToken, expiresAt.toISOString());

    const { password_hash, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string) {
    const tokenData = await getRefreshToken(refreshToken);
    if (!tokenData) throw new Error('Invalid or expired refresh token');
    if (new Date(tokenData.expires_at) < new Date()) {
        await deleteRefreshToken(refreshToken);
        throw new Error('Refresh token expired');
    }

    const user = await getUserById(tokenData.user_id);
    if (!user) throw new Error('User not found');

    const accessToken     = generateAccessToken(tokenData.user_id);
    const newRefreshToken = generateRefreshToken();
    const expiresAt       = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    await createRefreshToken(tokenData.user_id, newRefreshToken, expiresAt.toISOString());
    await deleteRefreshToken(refreshToken);

    const { password_hash, ...userWithoutPassword } = user;
    return { accessToken, refreshToken: newRefreshToken, user: userWithoutPassword };
}

export async function logoutUser(refreshToken: string): Promise<void> {
    if (refreshToken) await deleteRefreshToken(refreshToken);
}

export async function getUserFromToken(token: string) {
    const decoded = verifyToken(token);
    if (!decoded) return null;
    return getUserById(decoded.userId);
}
