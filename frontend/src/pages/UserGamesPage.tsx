import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFilters } from '../hooks/useFilters';
import { getFavorites, type Game } from '../services/api';
import { api } from '../services/api';
import GameCard from '../components/GameCard/GameCard';
import LoadingSpinner from '../components/Loading/LoadingSpinner';
import './UserGamesPage.css';

const UserGamesPage: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const { updateFilter } = useFilters();
    const [favoriteGames, setFavoriteGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    // Очищаем поиск при входе на страницу профиля
    useEffect(() => {
        updateFilter('search', '');
    }, [updateFilter]);

    useEffect(() => {
        // загрузка избранных игр
        const loadFavorites = async () => {
            try {
                setLoading(true);
                setError('');
                const gameIds = await getFavorites();
                
                // Загружаем данные об играх
                if (gameIds.length > 0) {
                    const gamesPromises = gameIds.map(id => 
                        api.get(`/games/${id}`).then(res => res.data).catch(() => null)
                    );
                    const games = (await Promise.all(gamesPromises)).filter(Boolean) as Game[];
                    setFavoriteGames(games);
                } else {
                    setFavoriteGames([]);
                }
            } catch (err) {
                setError('Failed to load favorite games');
                console.error('Error loading favorites:', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            loadFavorites();
        }
    }, [user]);

    const handleFavoriteChange = (gameId: number, isFavorited: boolean) => {
        // Если игра удалена из избранного, убираем её из списка
        if (!isFavorited) {
            setFavoriteGames(prev => prev.filter(game => game.id !== gameId));
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="user-games-page">
                <header className="user-games-page__header">
                    <h1>My Games</h1>
                </header>
                <div className="user-games-page__auth-required">
                    <h2>Sign in required</h2>
                    <p>Please sign in to view your favorite games.</p>
                    <Link to="/auth" className="user-games-page__auth-btn">
                        Sign In / Sign Up
                    </Link>
                </div>
            </div>
        );
    }

return (
    <div className="user-games-page">
        <header className="user-games-page__header">
            <h1>My Games</h1>
        </header>

        <div className="user-games-page__games">
            {loading ? (
                <LoadingSpinner />
            ) : error ? (
                <div className="user-games-page__error">
                    <p>{error}</p>
                            </div>
            ) : favoriteGames.length > 0 ? (
                <div className="user-games-page__games-grid">
                    {favoriteGames.map(game => (
                        <GameCard 
                            key={game.id} 
                            game={game} 
                            onFavoriteChange={handleFavoriteChange}
                        />
                    ))}
                </div>
            ) : (
                <div className="user-games-page__empty">
                    <h3>No games added yet</h3>
                    <p>Start exploring and add games to your favorites!</p>
                </div>
            )}
        </div>

        <div className="user-games-page__stats">
            <h2>My Statistics</h2>
            <div className="user-games-page__stats-grid">
                <div className="user-games-page__stat">
                    <div className="user-games-page__stat-value">{favoriteGames.length}</div>
                    <div className="user-games-page__stat-label">Games Saved</div>
                </div>
                <div className="user-games-page__stat">
                    <div className="user-games-page__stat-value">
                        {favoriteGames.length > 0 
                            ? Math.round(favoriteGames.reduce((sum, g) => sum + (g.rating || 0), 0) / favoriteGames.length)
                            : 0
                        }
                    </div>
                    <div className="user-games-page__stat-label">Avg Rating</div>
                </div>
                <div className="user-games-page__stat">
                    <div className="user-games-page__stat-value">
                        {(() => {
                            // Собираем все жанры из всех избранных игр
                            const allGenres = favoriteGames
                                .filter(g => g.genres && g.genres.length > 0)
                                .flatMap(g => g.genres)
                                .filter((genre): genre is { id: number; name: string } => genre !== undefined && genre !== null && genre.id !== undefined);
                            
                            // Находим уникальные жанры по id
                            const uniqueGenreIds = new Set(
                                allGenres.map(genre => genre.id)
                            );
                            
                            return uniqueGenreIds.size;
                        })()}
                    </div>
                    <div className="user-games-page__stat-label">Unique Genres</div>
                </div>
            </div>
        </div>
    </div>
);
};

export default UserGamesPage;