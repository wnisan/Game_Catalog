import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import gameRoutes from './routes/games.js';
import authRoutes from './routes/auth.js';
import favoriteRoutes from './routes/favorites.js';
import commentRoutes from './routes/comments.js';
import filterRoutes from './routes/filters.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.get('/', (request, response) => {
    response.json({ message: 'The backend is working!' })
});

app.use('/games', gameRoutes);
app.use('/auth', authRoutes);
app.use('/favorites', favoriteRoutes);
app.use('/comments', commentRoutes);
app.use('/filters', filterRoutes);

app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}`);
});

export default app;