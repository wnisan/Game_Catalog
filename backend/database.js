import Database from 'better-sqlite3'; // для встроенной бд
import bcrypt from 'bcrypt'; // для хеширования паролей
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'database.sqlite'));

export function initDatabase() {
    // Создаем таблицу если её нет
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Миграция
    try {
        // получение инфы о структуре таблицы
        const tableInfo = db.prepare("PRAGMA table_info(users)").all();
        const columnNames = tableInfo.map(col => col.name);

        if (!columnNames.includes('password_hash')) {
            console.log('Adding password_hash column to users table...');
            db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT;`);
        }
    } catch (error) {
        console.error('Migration error:', error);
    }

    // Таблица избранных игр
    db.exec(`
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            game_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, game_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Таблица refresh токенов
    db.exec(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Таблица комментариев к играм
    db.exec(`
        CREATE TABLE IF NOT EXISTS game_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            comment_text TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_game_comments_game_id ON game_comments(game_id)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_game_comments_user_id ON game_comments(user_id)
    `);

    // Создаем индекс для быстрого поиска по токену
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)
    `);

    console.log('Database initialized');
}

// Пользователи
export function createUser(email, name, password, googleId = null) {
    let passwordHash = null;
    if (password && password.trim() !== '') {
        passwordHash = bcrypt.hashSync(password, 10);
    }

    const stmt = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)');
    const result = stmt.run(email, name, passwordHash);
    return result.lastInsertRowid;
}

export function getUserByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
}

export function getUserById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
}

export function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

export function updateUser(userId, updates) {
    const { name, email, password } = updates;
    const fields = [];
    const values = [];

    if (name !== undefined) {
        fields.push('name = ?');
        values.push(name);
    }

    if (email !== undefined) {
        fields.push('email = ?');
        values.push(email);
    }

    if (password !== undefined && password.trim() !== '') {
        const passwordHash = bcrypt.hashSync(password, 10);
        fields.push('password_hash = ?');
        values.push(passwordHash);
    }

    if (fields.length === 0) {
        return false; // Нет изменений
    }

    values.push(userId);
    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return result.changes > 0;
}

// Избранное
export function addFavorite(userId, gameId) {
    try {
        const stmt = db.prepare('INSERT INTO favorites (user_id, game_id) VALUES (?, ?)');
        stmt.run(userId, gameId);
        return true;
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return false; // Уже в избранном
        }
        throw error;
    }
}

export function removeFavorite(userId, gameId) {
    const stmt = db.prepare('DELETE FROM favorites WHERE user_id = ? AND game_id = ?');
    const result = stmt.run(userId, gameId);
    return result.changes > 0;
}

export function getFavorites(userId) {
    const stmt = db.prepare('SELECT game_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId).map(row => row.game_id);
}

export function isFavorite(userId, gameId) {
    const stmt = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND game_id = ?');
    return !!stmt.get(userId, gameId);
}

export function getFavoriteCount(userId) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM favorites WHERE user_id = ?');
    return stmt.get(userId).count;
}

// Refresh токены
export function createRefreshToken(userId, token, expiresAt) {
    const stmt = db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)');
    stmt.run(userId, token, expiresAt);
}

export function getRefreshToken(token) {
    const stmt = db.prepare('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now")');
    return stmt.get(token);
}

export function deleteRefreshToken(token) {
    const stmt = db.prepare('DELETE FROM refresh_tokens WHERE token = ?');
    stmt.run(token);
}

export function deleteUserRefreshTokens(userId) {
    const stmt = db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?');
    stmt.run(userId);
}

export function deleteUser(userId) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(userId);
    return result.changes > 0;
}

// Очистка истекших токенов
export function cleanupExpiredTokens() {
    const stmt = db.prepare('DELETE FROM refresh_tokens WHERE expires_at <= datetime("now")');
    const result = stmt.run();
    return result.changes;
}

export function updateRefreshTokenExpiry(token, expiresAtIso) {
    const stmt = db.prepare('UPDATE refresh_tokens SET expires_at = ? WHERE token = ?');
    const result = stmt.run(expiresAtIso, token);
    return result.changes > 0;
}

// Комментарии к играм
export function createComment(userId, gameId, commentText) {
    const stmt = db.prepare('INSERT INTO game_comments (user_id, game_id, comment_text) VALUES (?, ?, ?)');
    const result = stmt.run(userId, gameId, commentText);
    return result.lastInsertRowid;
}

export function getCommentsByGameId(gameId) {
    const stmt = db.prepare(`
        SELECT 
            gc.id,
            gc.game_id,
            gc.comment_text,
            gc.created_at,
            gc.updated_at,
            u.id as user_id,
            u.name as user_name,
            u.email as user_email
        FROM game_comments gc
        JOIN users u ON gc.user_id = u.id
        WHERE gc.game_id = ?
        ORDER BY gc.created_at DESC
    `);
    return stmt.all(gameId);
}

export function getCommentsByUserId(userId) {
    const stmt = db.prepare(`
        SELECT 
            gc.id,
            gc.game_id,
            gc.comment_text,
            gc.created_at,
            gc.updated_at,
            u.id as user_id,
            u.name as user_name,
            u.email as user_email
        FROM game_comments gc
        JOIN users u ON gc.user_id = u.id
        WHERE gc.user_id = ?
        ORDER BY gc.created_at DESC
    `);
    return stmt.all(userId);
}

export function updateComment(commentId, userId, commentText) {
    const existing = db
        .prepare('SELECT game_id FROM game_comments WHERE id = ? AND user_id = ?')
        .get(commentId, userId);

    if (!existing) {
        return null;
    }

    const stmt = db.prepare(`
        UPDATE game_comments
        SET comment_text = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(commentText, commentId, userId);

    if (result.changes > 0) {
        return existing.game_id;
    }
    return null;
}

export function deleteComment(commentId, userId) {
    const stmt = db.prepare('DELETE FROM game_comments WHERE id = ? AND user_id = ?');
    const result = stmt.run(commentId, userId);
    return result.changes > 0;
}

export function getCommentById(commentId) {
    const stmt = db.prepare(`
        SELECT 
            gc.id,
            gc.game_id,
            gc.comment_text,
            gc.created_at,
            gc.updated_at,
            u.id as user_id,
            u.name as user_name,
            u.email as user_email
        FROM game_comments gc
        JOIN users u ON gc.user_id = u.id
        WHERE gc.id = ?
    `);
    return stmt.get(commentId);
}

initDatabase();

export default db;