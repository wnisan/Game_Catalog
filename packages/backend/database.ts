import sql from 'mssql';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const poolConfig = {
    server: process.env.DB_HOST || 'WNISAN',
    database: process.env.DB_NAME || 'GameCatalog',
    user: process.env.DB_USER || 'gamecatalog',
    password: process.env.DB_PASSWORD || 'GameCatalog123!',
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

type DbPool = Awaited<ReturnType<typeof sql.connect>>;
let pool: DbPool | undefined;
function isSqlDuplicateKeyError(error: unknown): error is { number: number } {
    return typeof error === 'object' && error !== null && 'number' in error && typeof (error as { number: unknown }).number === 'number';
}
export async function getPool() {
    if (!pool) pool = await sql.connect(poolConfig);
    return pool;
}

// INIT
export async function initDatabase() {
    const p = await getPool();
    console.log('MSSQL connected');

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
        CREATE TABLE users (
            id            INT IDENTITY(1,1) PRIMARY KEY,
            email         NVARCHAR(255) UNIQUE NOT NULL,
            name          NVARCHAR(255) NOT NULL,
            password_hash NVARCHAR(255),
            role          NVARCHAR(20)  DEFAULT 'buyer',
            avatar_url    NVARCHAR(500),
            is_banned     BIT           DEFAULT 0,
            created_at    DATETIME      DEFAULT GETDATE()
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='refresh_tokens' AND xtype='U')
        CREATE TABLE refresh_tokens (
            id         INT IDENTITY(1,1) PRIMARY KEY,
            user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token      NVARCHAR(500) UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT GETDATE()
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='favorites' AND xtype='U')
        CREATE TABLE favorites (
            id         INT IDENTITY(1,1) PRIMARY KEY,
            user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            game_id    INT NOT NULL,
            created_at DATETIME DEFAULT GETDATE(),
            CONSTRAINT uq_favorites UNIQUE(user_id, game_id)
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='game_comments' AND xtype='U')
        CREATE TABLE game_comments (
            id           INT IDENTITY(1,1) PRIMARY KEY,
            game_id      INT NOT NULL,
            user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            comment_text NVARCHAR(MAX) NOT NULL,
            created_at   DATETIME DEFAULT GETDATE(),
            updated_at   DATETIME DEFAULT GETDATE()
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='game_visits' AND xtype='U')
        CREATE TABLE game_visits (
            id         INT IDENTITY(1,1) PRIMARY KEY,
            user_id    INT,
            game_id    INT NOT NULL,
            visited_at DATETIME DEFAULT GETDATE()
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='game_prices' AND xtype='U')
        CREATE TABLE game_prices (
            id           INT IDENTITY(1,1) PRIMARY KEY,
            igdb_game_id INT UNIQUE NOT NULL,
            price        DECIMAL(10,2) NOT NULL
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_balances' AND xtype='U')
        CREATE TABLE user_balances (
            id         INT IDENTITY(1,1) PRIMARY KEY,
            user_id    INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            balance    DECIMAL(10,2) DEFAULT 0.00,
            updated_at DATETIME DEFAULT GETDATE()
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='seller_profiles' AND xtype='U')
        CREATE TABLE seller_profiles (
            id           INT IDENTITY(1,1) PRIMARY KEY,
            user_id      INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            display_name NVARCHAR(255) NOT NULL,
            description  NVARCHAR(MAX),
            is_verified  BIT DEFAULT 0,
            total_sales  INT DEFAULT 0,
            rating       DECIMAL(3,2) DEFAULT 0,
            created_at   DATETIME DEFAULT GETDATE()
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='seller_listings' AND xtype='U')
        CREATE TABLE seller_listings (
            id           INT IDENTITY(1,1) PRIMARY KEY,
            seller_id    INT NOT NULL REFERENCES seller_profiles(id),
            igdb_game_id INT NOT NULL UNIQUE,
            price        DECIMAL(10,2) NOT NULL,
            description  NVARCHAR(MAX),
            is_active    BIT DEFAULT 1,
            created_at   DATETIME DEFAULT GETDATE(),
            updated_at   DATETIME DEFAULT GETDATE()
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cart_items' AND xtype='U')
        CREATE TABLE cart_items (
            id         INT IDENTITY(1,1) PRIMARY KEY,
            user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            listing_id INT NOT NULL REFERENCES seller_listings(id),
            added_at   DATETIME DEFAULT GETDATE(),
            CONSTRAINT uq_cart UNIQUE(user_id, listing_id)
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' AND xtype='U')
        CREATE TABLE orders (
            id                       INT IDENTITY(1,1) PRIMARY KEY,
            buyer_id                 INT NOT NULL REFERENCES users(id),
            seller_id                INT NOT NULL REFERENCES users(id),
            listing_id               INT NOT NULL REFERENCES seller_listings(id),
            igdb_game_id             INT NOT NULL,
            amount                   DECIMAL(10,2) NOT NULL,
            status                   NVARCHAR(30) DEFAULT 'pending_payment',
            stripe_payment_intent_id NVARCHAR(255),
            key_sent_at              DATETIME,
            buyer_confirmed_at       DATETIME,
            completed_at             DATETIME,
            refunded_at              DATETIME,
            cancelled_at             DATETIME,
            created_at               DATETIME DEFAULT GETDATE()
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='conversations' AND xtype='U')
        CREATE TABLE conversations (
            id         INT IDENTITY(1,1) PRIMARY KEY,
            order_id   INT NULL REFERENCES orders(id),
            buyer_id   INT NOT NULL REFERENCES users(id),
            seller_id  INT NOT NULL REFERENCES users(id),
            created_at DATETIME DEFAULT GETDATE()
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='messages' AND xtype='U')
        CREATE TABLE messages (
            id              INT IDENTITY(1,1) PRIMARY KEY,
            conversation_id INT NOT NULL REFERENCES conversations(id),
            sender_id       INT NOT NULL REFERENCES users(id),
            content         NVARCHAR(MAX) NOT NULL,
            is_read         BIT DEFAULT 0,
            created_at      DATETIME DEFAULT GETDATE()
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='product_ratings' AND xtype='U')
        CREATE TABLE product_ratings (
            id         INT IDENTITY(1,1) PRIMARY KEY,
            order_id   INT UNIQUE NOT NULL REFERENCES orders(id),
            buyer_id   INT NOT NULL REFERENCES users(id),
            listing_id INT NOT NULL REFERENCES seller_listings(id),
            rating     INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
            review     NVARCHAR(MAX),
            created_at DATETIME DEFAULT GETDATE()
        )`);

    await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='hidden_games' AND xtype='U')
        CREATE TABLE hidden_games (
            id           INT IDENTITY(1,1) PRIMARY KEY,
            igdb_game_id INT UNIQUE NOT NULL,
            hidden_by    INT NOT NULL REFERENCES users(id),
            reason       NVARCHAR(500),
            hidden_at    DATETIME DEFAULT GETDATE()
        )`);

    console.log('All tables ready');
    await migrateOrdersTable();
    await migrateConversationsTable();
    await migrateCommentsTable();
    await migrateMessagesTable();
    await migrateReviewsTable();
}

// USER HELPERS
export async function createUser(email: string, name: string, password: string | null) {
    const p = await getPool();
    let password_hash = null;
    if (password?.trim()) password_hash = await bcrypt.hash(password, 10);
    const r = await p.request()
        .input('email', sql.NVarChar, email)
        .input('name', sql.NVarChar, name)
        .input('hash', sql.NVarChar, password_hash)
        .query(`INSERT INTO users (email, name, password_hash) OUTPUT INSERTED.id VALUES (@email, @name, @hash)`);
    const userId = r.recordset[0].id;
    await p.request().input('uid', sql.Int, userId)
        .query(`INSERT INTO user_balances (user_id) VALUES (@uid)`);
    return userId;
}

export async function getUserByEmail(email: string) {
    const p = await getPool();
    const r = await p.request().input('email', sql.NVarChar, email)
        .query(`SELECT * FROM users WHERE email = @email`);
    return r.recordset[0] || null;
}

export async function getUserById(id: number) {
    const p = await getPool();
    const r = await p.request().input('id', sql.Int, id)
        .query(`SELECT * FROM users WHERE id = @id`);
    return r.recordset[0] || null;
}

export function verifyPassword(password: string, hash: string) {
    return bcrypt.compareSync(password, hash);
}

export async function updateUser(userId: number, updates: { name?: string; email?: string; password?: string | null }) {
    const p = await getPool();
    const { name, email, password } = updates;
    const parts = [];
    const req = p.request().input('id', sql.Int, userId);
    if (name !== undefined) { parts.push('name = @name'); req.input('name', sql.NVarChar, name); }
    if (email !== undefined) { parts.push('email = @email'); req.input('email', sql.NVarChar, email); }
    if (password?.trim()) {
        const hash = await bcrypt.hash(password, 10);
        parts.push('password_hash = @hash');
        req.input('hash', sql.NVarChar, hash);
    }
    if (!parts.length) return false;
    const r = await req.query(`UPDATE users SET ${parts.join(', ')} WHERE id = @id`);
    return r.rowsAffected[0] > 0;
}

export async function deleteUser(userId: number) {
    const p = await getPool();
    const r = await p.request().input('id', sql.Int, userId)
        .query(`DELETE FROM users WHERE id = @id`);
    return r.rowsAffected[0] > 0;
}

// REFRESH TOKENS
export async function createRefreshToken(userId: number, token: string, expiresAt: string | Date) {
    const p = await getPool();
    await p.request()
        .input('uid', sql.Int, userId)
        .input('token', sql.NVarChar, token)
        .input('exp', sql.DateTime, new Date(expiresAt))
        .query(`INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (@uid, @token, @exp)`);
}

export async function getRefreshToken(token: string) {
    const p = await getPool();
    const r = await p.request().input('token', sql.NVarChar, token)
        .query(`SELECT * FROM refresh_tokens WHERE token = @token`);
    return r.recordset[0] || null;
}

export async function deleteRefreshToken(token: string) {
    const p = await getPool();
    await p.request().input('token', sql.NVarChar, token)
        .query(`DELETE FROM refresh_tokens WHERE token = @token`);
}

export async function deleteUserRefreshTokens(userId: number) {
    const p = await getPool();
    await p.request().input('uid', sql.Int, userId)
        .query(`DELETE FROM refresh_tokens WHERE user_id = @uid`);
}

export async function cleanupExpiredTokens() {
    const p = await getPool();
    const r = await p.request().query(`DELETE FROM refresh_tokens WHERE expires_at <= GETDATE()`);
    return r.rowsAffected[0];
}

export async function updateRefreshTokenExpiry(token: string, expiresAt: string | Date) {
    const p = await getPool();
    const r = await p.request()
        .input('exp', sql.DateTime, new Date(expiresAt))
        .input('token', sql.NVarChar, token)
        .query(`UPDATE refresh_tokens SET expires_at = @exp WHERE token = @token`);
    return r.rowsAffected[0] > 0;
}

// FAVORITES
export async function addFavorite(userId: number, gameId: number) {
    const p = await getPool();
    try {
        await p.request().input('uid', sql.Int, userId).input('gid', sql.Int, gameId)
            .query(`INSERT INTO favorites (user_id, game_id) VALUES (@uid, @gid)`);
        return true;
    } catch (e: unknown) {
        if (isSqlDuplicateKeyError(e) && (e.number === 2627 || e.number === 2601)) return false;
        throw e;
    }
}

export async function removeFavorite(userId: number, gameId: number) {
    const p = await getPool();
    const r = await p.request().input('uid', sql.Int, userId).input('gid', sql.Int, gameId)
        .query(`DELETE FROM favorites WHERE user_id = @uid AND game_id = @gid`);
    return r.rowsAffected[0] > 0;
}

export async function getFavorites(userId: number) {
    const p = await getPool();
    const r = await p.request().input('uid', sql.Int, userId)
        .query(`SELECT game_id FROM favorites WHERE user_id = @uid ORDER BY created_at DESC`);
    return r.recordset.map((row: { game_id: number }) => row.game_id);
}

export async function isFavorite(userId: number, gameId: number) {
    const p = await getPool();
    const r = await p.request().input('uid', sql.Int, userId).input('gid', sql.Int, gameId)
        .query(`SELECT 1 AS found FROM favorites WHERE user_id = @uid AND game_id = @gid`);
    return r.recordset.length > 0;
}

export async function getGameFavoriteCount(gameId: number) {
    const p = await getPool();
    const r = await p.request().input('gid', sql.Int, gameId)
        .query(`SELECT COUNT(*) AS cnt FROM favorites WHERE game_id = @gid`);
    return r.recordset[0].cnt;
}

// COMMENTS
export async function createComment(userId: number, gameId: number, commentText: string, parentId: number | null = null) {
    const p = await getPool();
    const req = p.request()
        .input('uid', sql.Int, userId)
        .input('gid', sql.Int, gameId)
        .input('txt', sql.NVarChar, commentText)
        .input('pid', parentId ? sql.Int : sql.Int, parentId);
    const r = await req.query(`INSERT INTO game_comments (user_id, game_id, comment_text, parent_id) OUTPUT INSERTED.id VALUES (@uid, @gid, @txt, @pid)`);
    return r.recordset[0].id;
}

async function fetchCommentWithUser(p: DbPool, id: number) {
    const r = await p.request().input('id', sql.Int, id).query(`
        SELECT gc.id, gc.game_id, gc.comment_text, gc.created_at, gc.updated_at,
               u.id AS user_id, u.name AS user_name, u.email AS user_email
        FROM game_comments gc JOIN users u ON gc.user_id = u.id
        WHERE gc.id = @id`);
    return r.recordset[0] || null;
}

export async function getCommentsByGameId(gameId: number) {
    const p = await getPool();
    const r = await p.request().input('gid', sql.Int, gameId).query(`
        SELECT gc.id, gc.game_id, gc.comment_text, gc.created_at, gc.updated_at, gc.parent_id,
               u.id AS user_id, u.name AS user_name, u.email AS user_email
        FROM game_comments gc JOIN users u ON gc.user_id = u.id
        WHERE gc.game_id = @gid ORDER BY gc.created_at ASC`);
    return r.recordset;
}

export async function getCommentsByUserId(userId: number) {
    const p = await getPool();
    const r = await p.request().input('uid', sql.Int, userId).query(`
        SELECT gc.id, gc.game_id, gc.comment_text, gc.created_at, gc.updated_at,
               u.id AS user_id, u.name AS user_name, u.email AS user_email
        FROM game_comments gc JOIN users u ON gc.user_id = u.id
        WHERE gc.user_id = @uid ORDER BY gc.created_at DESC`);
    return r.recordset;
}

export async function getCommentById(id: number) {
    const p = await getPool();
    return fetchCommentWithUser(p, id);
}

export async function updateComment(commentId: number, userId: number, commentText: string) {
    const p = await getPool();
    const check = await p.request().input('cid', sql.Int, commentId).input('uid', sql.Int, userId)
        .query(`SELECT game_id FROM game_comments WHERE id = @cid AND user_id = @uid`);
    if (!check.recordset.length) return null;
    await p.request().input('txt', sql.NVarChar, commentText)
        .input('cid', sql.Int, commentId).input('uid', sql.Int, userId)
        .query(`UPDATE game_comments SET comment_text = @txt, updated_at = GETDATE() WHERE id = @cid AND user_id = @uid`);
    return check.recordset[0].game_id;
}

export async function deleteComment(commentId: number, userId: number) {
    const p = await getPool();
    const replies = await p.request().input('pid', sql.Int, commentId)
        .query(`SELECT COUNT(*) AS cnt FROM game_comments WHERE parent_id = @pid`);
    if (replies.recordset[0].cnt > 0) {
        const r = await p.request().input('cid', sql.Int, commentId).input('uid', sql.Int, userId)
            .query(`UPDATE game_comments SET comment_text = '[comment deleted]', updated_at = GETDATE() WHERE id = @cid AND user_id = @uid`);
        return r.rowsAffected[0] > 0;
    }
    const r = await p.request().input('cid', sql.Int, commentId).input('uid', sql.Int, userId)
        .query(`DELETE FROM game_comments WHERE id = @cid AND user_id = @uid`);
    return r.rowsAffected[0] > 0;
}

// GAME VISITS
export async function recordGameVisit(userId: number | null | undefined, gameId: number) {
    const p = await getPool();
    if (userId) {
        await p.request().input('uid', sql.Int, userId).input('gid', sql.Int, gameId)
            .query(`DELETE FROM game_visits WHERE user_id = @uid AND game_id = @gid`);
        await p.request().input('uid', sql.Int, userId).input('gid', sql.Int, gameId)
            .query(`INSERT INTO game_visits (user_id, game_id) VALUES (@uid, @gid)`);
    } else {
        await p.request().input('gid', sql.Int, gameId)
            .query(`INSERT INTO game_visits (game_id) VALUES (@gid)`);
    }
}

export async function getRecentlyVisitedGames(userId: number | null | undefined, limit = 10) {
    if (!userId) return [];
    const p = await getPool();
    const r = await p.request().input('uid', sql.Int, userId).input('lim', sql.Int, limit).query(`
        SELECT TOP (@lim) game_id, MAX(visited_at) AS last_visited
        FROM game_visits WHERE user_id = @uid
        GROUP BY game_id ORDER BY last_visited DESC`);
    return r.recordset.map((row: { game_id: number }) => row.game_id);
}

// GAME PRICES
export async function getGamePricesBulk(igdbGameIds: number[]) {
    if (!igdbGameIds.length) return {};
    const p = await getPool();
    const idList = igdbGameIds.join(',');
    const r = await p.request().query(`SELECT igdb_game_id, price FROM game_prices WHERE igdb_game_id IN (${idList})`);
    const map: Record<number, number> = {};
    r.recordset.forEach((row: { igdb_game_id: number; price: string | number }) => { map[row.igdb_game_id] = parseFloat(String(row.price)); });
    return map;
}

export async function updateGamePrice(igdbGameId: number, price: number) {
    const p = await getPool();
    const r = await p.request()
        .input('gid', sql.Int, igdbGameId)
        .input('price', sql.Decimal(10, 2), price)
        .query(`UPDATE game_prices SET price = @price WHERE igdb_game_id = @gid`);
    return r.rowsAffected[0] > 0;
}

export async function updateListingPrice(listingId: number, price: number) {
    const p = await getPool();
    const r = await p.request()
        .input('id', sql.Int, listingId)
        .input('price', sql.Decimal(10, 2), price)
        .query(`UPDATE seller_listings SET price = @price, updated_at = GETDATE() WHERE id = @id`);
    return r.rowsAffected[0] > 0;
}

// SELLERS
export async function createSellerProfile(userId: number, displayName: string, description: string) {
    const p = await getPool();
    const r = await p.request()
        .input('uid', sql.Int, userId)
        .input('name', sql.NVarChar, displayName)
        .input('desc', sql.NVarChar, description || '')
        .query(`INSERT INTO seller_profiles (user_id, display_name, description)
                OUTPUT INSERTED.id VALUES (@uid, @name, @desc)`);
    return r.recordset[0].id;
}

export async function getSellerByUserId(userId: number) {
    const p = await getPool();
    const r = await p.request().input('uid', sql.Int, userId).query(`
        SELECT sp.*, u.name AS user_name, u.email AS user_email
        FROM seller_profiles sp JOIN users u ON sp.user_id = u.id
        WHERE sp.user_id = @uid`);
    return r.recordset[0] || null;
}

export async function getSellerById(sellerId: number) {
    const p = await getPool();
    const r = await p.request().input('id', sql.Int, sellerId).query(`
        SELECT sp.*, u.name AS user_name, u.email AS user_email
        FROM seller_profiles sp JOIN users u ON sp.user_id = u.id
        WHERE sp.id = @id`);
    return r.recordset[0] || null;
}

export async function createListing(sellerId: number, igdbGameId: number, price: number, description: string) {
    const p = await getPool();
    const r = await p.request()
        .input('sid', sql.Int, sellerId)
        .input('gid', sql.Int, igdbGameId)
        .input('price', sql.Decimal(10, 2), price)
        .input('desc', sql.NVarChar, description || '')
        .query(`INSERT INTO seller_listings (seller_id, igdb_game_id, price, description)
                OUTPUT INSERTED.id VALUES (@sid, @gid, @price, @desc)`);
    return r.recordset[0].id;
}

export async function getListingByGameId(igdbGameId: number) {
    const p = await getPool();
    const r = await p.request().input('gid', sql.Int, igdbGameId).query(`
        SELECT sl.*, sp.display_name AS seller_name, sp.id AS seller_profile_id,
               sp.rating AS seller_rating, sp.total_sales, sp.is_verified,
               u.id AS seller_user_id
        FROM seller_listings sl
        JOIN seller_profiles sp ON sl.seller_id = sp.id
        JOIN users u ON sp.user_id = u.id
        WHERE sl.igdb_game_id = @gid AND sl.is_active = 1`);
    return r.recordset[0] || null;
}

export async function getListingById(listingId: number) {
    const p = await getPool();
    const r = await p.request().input('id', sql.Int, listingId).query(`
        SELECT sl.*, sp.display_name AS seller_name, sp.id AS seller_profile_id,
               sp.rating AS seller_rating, sp.total_sales, sp.is_verified,
               u.id AS seller_user_id
        FROM seller_listings sl
        JOIN seller_profiles sp ON sl.seller_id = sp.id
        JOIN users u ON sp.user_id = u.id
        WHERE sl.id = @id`);
    return r.recordset[0] || null;
}

export async function getListingsBySellerId(sellerId: number) {
    const p = await getPool();
    const r = await p.request().input('sid', sql.Int, sellerId).query(`
        SELECT TOP 10000 * FROM seller_listings WHERE seller_id = @sid
        ORDER BY created_at DESC`);
    return r.recordset;
}

// CART
export async function addToCart(userId: number, listingId: number) {
    const p = await getPool();
    try {
        await p.request()
            .input('uid', sql.Int, userId)
            .input('lid', sql.Int, listingId)
            .query(`INSERT INTO cart_items (user_id, listing_id) VALUES (@uid, @lid)`);
        return true;
    } catch (e: unknown) {
        if (isSqlDuplicateKeyError(e) && (e.number === 2627 || e.number === 2601)) return false;
        throw e;
    }
}

export async function removeFromCart(userId: number, listingId: number) {
    const p = await getPool();
    const r = await p.request()
        .input('uid', sql.Int, userId)
        .input('lid', sql.Int, listingId)
        .query(`DELETE FROM cart_items WHERE user_id = @uid AND listing_id = @lid`);
    return r.rowsAffected[0] > 0;
}

export async function getCart(userId: number) {
    const p = await getPool();
    const r = await p.request().input('uid', sql.Int, userId).query(`
        SELECT ci.id, ci.listing_id, ci.added_at,
               sl.igdb_game_id, sl.price, sl.description AS listing_description,
               sp.display_name AS seller_name, sp.id AS seller_profile_id,
               sp.rating AS seller_rating, sp.is_verified
        FROM cart_items ci
        JOIN seller_listings sl ON ci.listing_id = sl.id
        JOIN seller_profiles sp ON sl.seller_id = sp.id
        WHERE ci.user_id = @uid
          AND sl.igdb_game_id NOT IN (SELECT igdb_game_id FROM hidden_games)
        ORDER BY ci.added_at DESC`);
    return r.recordset;
}

export async function isInCart(userId: number, listingId: number) {
    const p = await getPool();
    const r = await p.request()
        .input('uid', sql.Int, userId)
        .input('lid', sql.Int, listingId)
        .query(`SELECT 1 AS found FROM cart_items WHERE user_id = @uid AND listing_id = @lid`);
    return r.recordset.length > 0;
}

// ADMIN
export async function getAllUsers() {
    const p = await getPool();
    const r = await p.request().query(`SELECT id, email, name, role, is_banned, created_at FROM users ORDER BY created_at DESC`);
    return r.recordset.map((u: { is_banned: boolean | number } & Record<string, unknown>) => ({ ...u, is_banned: u.is_banned === true || u.is_banned === 1 }));
}

export async function banUser(userId: number, isBanned: boolean) {
    const p = await getPool();
    const r = await p.request()
        .input('id', sql.Int, userId)
        .input('banned', sql.Bit, isBanned ? 1 : 0)
        .query(`UPDATE users SET is_banned = @banned WHERE id = @id`);
    return r.rowsAffected[0] > 0;
}

export async function setUserRole(userId: number, role: string) {
    const p = await getPool();
    const r = await p.request()
        .input('id', sql.Int, userId)
        .input('role', sql.NVarChar, role)
        .query(`UPDATE users SET role = @role WHERE id = @id`);
    return r.rowsAffected[0] > 0;
}

export async function hideGame(igdbGameId: number, adminId: number, reason: string) {
    const p = await getPool();
    try {
        await p.request()
            .input('gid', sql.Int, igdbGameId)
            .input('aid', sql.Int, adminId)
            .input('reason', sql.NVarChar, reason || '')
            .query(`INSERT INTO hidden_games (igdb_game_id, hidden_by, reason) VALUES (@gid, @aid, @reason)`);
        return true;
    } catch (e: unknown) {
        if (isSqlDuplicateKeyError(e) && (e.number === 2627 || e.number === 2601)) return false;
        throw e;
    }
}

export async function unhideGame(igdbGameId: number) {
    const p = await getPool();
    const r = await p.request().input('gid', sql.Int, igdbGameId)
        .query(`DELETE FROM hidden_games WHERE igdb_game_id = @gid`);
    return r.rowsAffected[0] > 0;
}

export async function getHiddenGames() {
    const p = await getPool();
    const r = await p.request().query(`
        SELECT hg.igdb_game_id, hg.reason, hg.hidden_at, u.name AS hidden_by_name
        FROM hidden_games hg JOIN users u ON hg.hidden_by = u.id
        ORDER BY hg.hidden_at DESC`);
    return r.recordset;
}

export async function isGameHidden(igdbGameId: number) {
    const p = await getPool();
    const r = await p.request().input('gid', sql.Int, igdbGameId)
        .query(`SELECT 1 AS found FROM hidden_games WHERE igdb_game_id = @gid`);
    return r.recordset.length > 0;
}

export async function getHiddenGameIds() {
    const p = await getPool();
    const r = await p.request().query(`SELECT igdb_game_id FROM hidden_games`);
    return new Set(r.recordset.map((row: { igdb_game_id: number }) => row.igdb_game_id));
}

export async function removeHiddenGameFromCartsAndFavorites(igdbGameId: number) {
    const p = await getPool();

    await p.request().input('gid', sql.Int, igdbGameId).query(`
        DELETE FROM cart_items
        WHERE listing_id IN (
            SELECT id FROM seller_listings WHERE igdb_game_id = @gid
        )`);
    await p.request().input('gid', sql.Int, igdbGameId).query(`
        DELETE FROM favorites WHERE game_id = @gid`);

    await p.request().input('gid', sql.Int, igdbGameId).query(`
        DELETE FROM game_visits WHERE game_id = @gid`);
}

// USER BALANCE
export async function getUserBalance(userId: number) {
    const p = await getPool();
    const r = await p.request().input('uid', sql.Int, userId)
        .query(`SELECT balance FROM user_balances WHERE user_id = @uid`);
    return r.recordset[0] ? parseFloat(r.recordset[0].balance) : 0;
}

export async function addToBalance(userId: number, amount: number) {
    const p = await getPool();
    await p.request()
        .input('uid', sql.Int, userId)
        .input('amount', sql.Decimal(10, 2), amount)
        .query(`UPDATE user_balances SET balance = balance + @amount, updated_at = GETDATE() WHERE user_id = @uid`);
    return getUserBalance(userId);
}

// PUBLIC PROFILE
export async function getPublicProfile(userId: number) {
    const p = await getPool();
    const ur = await p.request().input('uid', sql.Int, userId).query(`
        SELECT id, name, email, role, avatar_url, created_at
        FROM users WHERE id = @uid AND (is_banned = 0 OR is_banned IS NULL)`);
    if (!ur.recordset.length) return null;
    const user = ur.recordset[0];

    if (user.role === 'seller') {
        const sr = await p.request().input('uid', sql.Int, userId).query(`
            SELECT sp.id AS seller_id, sp.display_name, sp.description,
                   sp.is_verified, sp.total_sales, sp.rating
            FROM seller_profiles sp WHERE sp.user_id = @uid`);
        if (sr.recordset.length) user.seller = sr.recordset[0];
    }

    return user;
}

// USER ORDERS
export async function getUserOrders(userId: number) {
    const p = await getPool();
    const r = await p.request().input('uid', sql.Int, userId).query(`
        SELECT o.id, o.igdb_game_id, o.amount, o.status, o.created_at,
               o.key_sent_at, o.buyer_confirmed_at, o.completed_at,
               o.game_key, o.listing_id,
               sp.display_name AS seller_name, sp.id AS seller_id, sp.user_id AS seller_user_id,
               CASE WHEN pr.id IS NOT NULL THEN 1 ELSE 0 END AS has_review
        FROM orders o
        JOIN seller_listings sl ON o.listing_id = sl.id
        JOIN seller_profiles sp ON sl.seller_id = sp.id
        LEFT JOIN product_ratings pr ON pr.order_id = o.id AND pr.buyer_id = @uid
        WHERE o.buyer_id = @uid
        ORDER BY o.created_at DESC`);
    return r.recordset;
}

export async function getSellerOrders(sellerUserId: number) {
    const p = await getPool();
    const r = await p.request().input('uid', sql.Int, sellerUserId).query(`
        SELECT o.id, o.igdb_game_id, o.amount, o.status, o.created_at,
               o.key_sent_at, o.buyer_confirmed_at, o.game_key,
               u.name AS buyer_name, u.email AS buyer_email
        FROM orders o
        JOIN seller_profiles sp ON o.seller_id = sp.user_id
        JOIN users u ON o.buyer_id = u.id
        WHERE o.seller_id = @uid
        ORDER BY o.created_at DESC`);
    return r.recordset;
}

export async function createOrder(buyerId: number, sellerId: number, listingId: number, igdbGameId: number, amount: number) {
    const p = await getPool();
    const r = await p.request()
        .input('buyerId', sql.Int, buyerId)
        .input('sellerId', sql.Int, sellerId)
        .input('listingId', sql.Int, listingId)
        .input('igdbGameId', sql.Int, igdbGameId)
        .input('amount', sql.Decimal(10, 2), amount)
        .query(`
            INSERT INTO orders (buyer_id, seller_id, listing_id, igdb_game_id, amount, status)
            OUTPUT INSERTED.id
            VALUES (@buyerId, @sellerId, @listingId, @igdbGameId, @amount, 'pending_key')`);
    return r.recordset[0].id;
}

export async function sellerSendKey(orderId: number, sellerUserId: number, gameKey: string) {
    const p = await getPool();
    const r = await p.request()
        .input('id', sql.Int, orderId)
        .input('uid', sql.Int, sellerUserId)
        .input('key', sql.NVarChar(500), gameKey)
        .query(`
            UPDATE orders
            SET status = 'key_sent', game_key = @key, key_sent_at = GETDATE()
            WHERE id = @id AND seller_id = @uid AND status = 'pending_key'`);
    return r.rowsAffected[0] > 0;
}

export async function buyerConfirmOrder(orderId: number, buyerId: number) {
    const p = await getPool();

    const or = await p.request().input('id', sql.Int, orderId).input('uid', sql.Int, buyerId)
        .query(`SELECT * FROM orders WHERE id = @id AND buyer_id = @uid AND status = 'key_sent'`);
    if (!or.recordset.length) return false;
    const order = or.recordset[0];

    await p.request()
        .input('sellerId', sql.Int, order.seller_id)
        .input('amount', sql.Decimal(10, 2), order.amount)
        .query(`UPDATE user_balances SET balance = balance + @amount, updated_at = GETDATE() WHERE user_id = @sellerId`);

    await p.request().input('id', sql.Int, orderId)
        .query(`UPDATE orders SET status = 'completed', buyer_confirmed_at = GETDATE(), completed_at = GETDATE() WHERE id = @id`);

    await p.request().input('sellerId', sql.Int, order.seller_id)
        .query(`UPDATE seller_profiles SET total_sales = total_sales + 1 WHERE user_id = @sellerId`);

    return true;
}

export async function cancelOrder(orderId: number, userId: number) {
    const p = await getPool();
    const or2 = await p.request().input('id', sql.Int, orderId).input('uid', sql.Int, userId)
        .query(`SELECT * FROM orders WHERE id = @id AND (buyer_id = @uid OR seller_id = @uid) AND status = 'pending_key'`);
    if (!or2.recordset.length) return false;
    const order = or2.recordset[0];

    await p.request()
        .input('buyerId', sql.Int, order.buyer_id)
        .input('amount', sql.Decimal(10, 2), order.amount)
        .query(`UPDATE user_balances SET balance = balance + @amount, updated_at = GETDATE() WHERE user_id = @buyerId`);

    await p.request().input('id', sql.Int, orderId)
        .query(`UPDATE orders SET status = 'cancelled', cancelled_at = GETDATE() WHERE id = @id`);

    return true;
}

export async function migrateOrdersTable() {
    const p = await getPool();
    try {
        await p.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('orders') AND name = 'game_key')
            ALTER TABLE orders ADD game_key NVARCHAR(500) NULL`);
    } catch { }
}

// CHAT
export async function migrateCommentsTable() {
    const p = await getPool();
    try {
        await p.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('game_comments') AND name = 'parent_id')
            ALTER TABLE game_comments ADD parent_id INT NULL REFERENCES game_comments(id)`);
    } catch { }
}

export async function migrateMessagesTable() {
    const p = await getPool();
    try {
        await p.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('messages') AND name = 'is_edited')
            ALTER TABLE messages ADD is_edited BIT DEFAULT 0`);
    } catch { }
    try {
        await p.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('messages') AND name = 'is_deleted')
            ALTER TABLE messages ADD is_deleted BIT DEFAULT 0`);
    } catch { }
}

export async function migrateReviewsTable() {
    const p = await getPool();
    try {
        await p.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('product_ratings') AND name = 'seller_reply')
            ALTER TABLE product_ratings ADD seller_reply NVARCHAR(MAX) NULL`);
    } catch { }
}

export async function migrateConversationsTable() {
    const p = await getPool();
    try {
        await p.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('conversations') AND name = 'igdb_game_id')
            ALTER TABLE conversations ADD igdb_game_id INT NULL`);
    } catch { }
    try {
        await p.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('conversations') AND name = 'game_name')
            ALTER TABLE conversations ADD game_name NVARCHAR(500) NULL`);
    } catch { }
    try {

        await p.request().query(`
            IF EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID('conversations') AND name = 'order_id' AND is_nullable = 0
            )
            ALTER TABLE conversations ALTER COLUMN order_id INT NULL`);
    } catch { }
    try {

        await p.request().query(`
            DECLARE @cname NVARCHAR(255);
            SELECT TOP 1 @cname = kc.name
            FROM sys.key_constraints kc
            JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
            JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE kc.parent_object_id = OBJECT_ID('conversations') AND kc.type = 'UQ' AND c.name = 'order_id';
            IF @cname IS NOT NULL
                EXEC('ALTER TABLE conversations DROP CONSTRAINT [' + @cname + ']')`);
    } catch { }
}

export async function getOrCreateConversation(buyerId: number, sellerUserId: number, igdbGameId: number, gameName: string) {
    const p = await getPool();

    const existing = await p.request()
        .input('bid', sql.Int, buyerId)
        .input('sid', sql.Int, sellerUserId)
        .input('gid', sql.Int, igdbGameId)
        .query(`SELECT id FROM conversations WHERE buyer_id = @bid AND seller_id = @sid AND igdb_game_id = @gid`);
    if (existing.recordset.length) return existing.recordset[0].id;

    const r = await p.request()
        .input('bid', sql.Int, buyerId)
        .input('sid', sql.Int, sellerUserId)
        .input('gid', sql.Int, igdbGameId)
        .input('gname', sql.NVarChar, gameName || '')
        .query(`INSERT INTO conversations (buyer_id, seller_id, igdb_game_id, game_name)
                OUTPUT INSERTED.id VALUES (@bid, @sid, @gid, @gname)`);
    return r.recordset[0].id;
}

export async function getConversationById(convId: number) {
    const p = await getPool();
    const r = await p.request().input('id', sql.Int, convId).query(`
        SELECT c.*, 
               ub.name AS buyer_name, us.name AS seller_name
        FROM conversations c
        JOIN users ub ON c.buyer_id = ub.id
        JOIN users us ON c.seller_id = us.id
        WHERE c.id = @id`);
    return r.recordset[0] || null;
}

export async function getUserConversations(userId: number) {
    const p = await getPool();
    const r = await p.request().input('uid', sql.Int, userId).query(`
        SELECT c.id, c.igdb_game_id, c.game_name, c.created_at,
               ub.id AS buyer_id, ub.name AS buyer_name,
               us.id AS seller_id, us.name AS seller_name,
               (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_read = 0 AND m.sender_id != @uid) AS unread_count,
               (SELECT TOP 1 content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC) AS last_message,
               (SELECT TOP 1 created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC) AS last_message_at
        FROM conversations c
        JOIN users ub ON c.buyer_id = ub.id
        JOIN users us ON c.seller_id = us.id
        WHERE c.buyer_id = @uid OR c.seller_id = @uid
        ORDER BY last_message_at DESC`);
    return r.recordset;
}

export async function getConversationMessages(convId: number) {
    const p = await getPool();
    const r = await p.request().input('cid', sql.Int, convId).query(`
        SELECT m.id, m.sender_id, m.content, m.is_read, m.created_at,
               ISNULL(m.is_edited, 0) AS is_edited,
               ISNULL(m.is_deleted, 0) AS is_deleted,
               u.name AS sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = @cid
        ORDER BY m.created_at ASC`);
    return r.recordset;
}

export async function saveMessage(convId: number, senderId: number, content: string) {
    const p = await getPool();
    const r = await p.request()
        .input('cid', sql.Int, convId)
        .input('sid', sql.Int, senderId)
        .input('content', sql.NVarChar, content)
        .query(`INSERT INTO messages (conversation_id, sender_id, content)
                OUTPUT INSERTED.id, INSERTED.created_at
                VALUES (@cid, @sid, @content)`);
    return r.recordset[0];
}

export async function editMessage(messageId: number, senderId: number, content: string) {
    const p = await getPool();
    const r = await p.request()
        .input('id', sql.Int, messageId)
        .input('sid', sql.Int, senderId)
        .input('content', sql.NVarChar, content)
        .query(`UPDATE messages SET content = @content, is_edited = 1 WHERE id = @id AND sender_id = @sid`);
    return r.rowsAffected[0] > 0;
}

export async function deleteMessage(messageId: number, senderId: number) {
    const p = await getPool();
    const r = await p.request()
        .input('id', sql.Int, messageId)
        .input('sid', sql.Int, senderId)
        .query(`UPDATE messages SET content = '[message deleted]', is_deleted = 1 WHERE id = @id AND sender_id = @sid`);
    return r.rowsAffected[0] > 0;
}

export async function markMessagesRead(convId: number, userId: number) {
    const p = await getPool();
    await p.request()
        .input('cid', sql.Int, convId)
        .input('uid', sql.Int, userId)
        .query(`UPDATE messages SET is_read = 1 WHERE conversation_id = @cid AND sender_id != @uid AND is_read = 0`);
}

export async function getTotalUnread(userId: number) {
    const p = await getPool();
    const r = await p.request().input('uid', sql.Int, userId).query(`
        SELECT COUNT(*) AS cnt
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.is_read = 0 AND m.sender_id != @uid
          AND (c.buyer_id = @uid OR c.seller_id = @uid)`);
    return r.recordset[0].cnt;
}

// REVIEWS
export async function createReview(orderId: number, buyerId: number, listingId: number, sellerUserId: number, rating: number, review: string) {
    const p = await getPool();
    try {
        await p.request()
            .input('orderId', sql.Int, orderId)
            .input('buyerId', sql.Int, buyerId)
            .input('listingId', sql.Int, listingId)
            .input('rating', sql.Int, rating)
            .input('review', sql.NVarChar, review || '')
            .query(`INSERT INTO product_ratings (order_id, buyer_id, listing_id, rating, review)
                    VALUES (@orderId, @buyerId, @listingId, @rating, @review)`);

        await p.request().input('uid', sql.Int, sellerUserId).query(`
            UPDATE seller_profiles
            SET rating = (
                SELECT AVG(CAST(pr.rating AS FLOAT))
                FROM product_ratings pr
                JOIN seller_listings sl ON pr.listing_id = sl.id
                JOIN seller_profiles sp2 ON sl.seller_id = sp2.id
                WHERE sp2.user_id = @uid
            )
            WHERE user_id = @uid`);
        return true;
    } catch (e: unknown) {
        if (isSqlDuplicateKeyError(e) && (e.number === 2627 || e.number === 2601)) return false;
        throw e;
    }
}

export async function getSellerReviews(sellerUserId: number, limit = 50) {
    const p = await getPool();
    const r = await p.request()
        .input('uid', sql.Int, sellerUserId)
        .input('lim', sql.Int, limit)
        .query(`
            SELECT TOP (@lim)
                pr.id, pr.rating, pr.review, pr.created_at,
                pr.order_id, pr.listing_id,
                ISNULL(pr.seller_reply, '') AS seller_reply,
                o.igdb_game_id,
                u.name AS buyer_name,
                u.id AS buyer_id
            FROM product_ratings pr
            JOIN orders o ON pr.order_id = o.id
            JOIN seller_listings sl ON pr.listing_id = sl.id
            JOIN seller_profiles sp ON sl.seller_id = sp.id
            JOIN users u ON pr.buyer_id = u.id
            WHERE sp.user_id = @uid
            ORDER BY pr.created_at DESC`);
    return r.recordset;
}

export async function hasReview(orderId: number, buyerId: number) {
    const p = await getPool();
    const r = await p.request()
        .input('oid', sql.Int, orderId)
        .input('uid', sql.Int, buyerId)
        .query(`SELECT 1 AS found FROM product_ratings WHERE order_id = @oid AND buyer_id = @uid`);
    return r.recordset.length > 0;
}


