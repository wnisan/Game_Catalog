import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initDatabase } from './database.js';
import gameRoutes from './routes/games.js';
import authRoutes from './routes/auth.js';
import favoriteRoutes from './routes/favorites.js';
import commentRoutes from './routes/comments.js';
import filterRoutes from './routes/filters.js';
import sellerRoutes from './routes/sellers.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import paymentRoutes from './routes/payments.js';
import orderRoutes from './routes/orders.js';
import chatRoutes from './routes/chat.js';
import reviewRoutes from './routes/reviews.js';
import { initChatWS } from './ws/chatServer.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.get('/', (_, res) => res.json({ message: 'The backend is working!' }));

app.use('/games', gameRoutes);
app.use('/auth', authRoutes);
app.use('/favorites', favoriteRoutes);
app.use('/comments', commentRoutes);
app.use('/filters', filterRoutes);
app.use('/sellers', sellerRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/payments', paymentRoutes);
app.use('/orders', orderRoutes);
app.use('/chat', chatRoutes);
app.use('/reviews', reviewRoutes);

const httpServer = createServer(app);
initChatWS(httpServer);

initDatabase().then(() => {
    httpServer.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

export default app;
