import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFavorites, type Game } from '../services/api';
import { useInfiniteCarousel } from '../hooks/useInfiniteCarousel';
import GameCard from '../components/GameCard/GameCard';
import LoadingSpinner from '../components/Loading/LoadingSpinner';
import './UserGamesPage.css';

const UserGamesPage: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [favoriteGames, setFavoriteGames] = useState<Game[]>([]);
    const [similarGames, setSimilarGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    const VISIBLE = 6;
    const CARD_W = 230; // 220 + 10px gap
    const carousel = useInfiniteCarousel(Math.max(similarGames.length, 1), VISIBLE);
    const extendedSimilar = similarGames.length >= VISIBLE ? [
        ...similarGames.slice(-VISIBLE), ...similarGames, ...similarGames.slice(0, VISIBLE)
    ] : similarGames;

    useEffect(() => {
        if (!user) return;

        const loadFavorites = async () => {
            try {
                setLoading(true);
                setError('');
                const gameIds = await getFavorites();
                if (gameIds.length > 0) {
                    const { getGamesBulk } = await import('../services/api');
                    const games = await getGamesBulk(gameIds);
                    setFavoriteGames(games);

                    const allSimilarIds = new Set<number>();
                    games.forEach(g => g.similar_games?.forEach(sg => {
                        if (sg.id && !games.find(fg => fg.id === sg.id)) allSimilarIds.add(sg.id);
                    }));
                    const ids = Array.from(allSimilarIds).slice(0, 20);
                    if (ids.length > 0) {
                        const similar = await getGamesBulk(ids);
                        setSimilarGames(similar);
                    } else {

                        const { getPopularGames } = await import('../services/api');
                        const popular = await getPopularGames(20);
                        const filtered = popular.filter(g => !games.find(fg => fg.id === g.id));
                        setSimilarGames(filtered.slice(0, 20));
                    }
                } else {
                    setFavoriteGames([]);
                }
            } catch {
                setError('Не удалось загрузить избранные игры');
            } finally {
                setLoading(false);
            }
        };

        loadFavorites();
    }, [user]);

    const handleFavoriteChange = (gameId: number, isFavorited: boolean) => {
        if (!isFavorited) setFavoriteGames(prev => prev.filter(g => g.id !== gameId));
    };

    const getCoverUrl = (url?: string) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        const imageId = url.split('/').pop()?.replace(/\.(jpg|png)$/, '');
        return imageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg` : null;
    };

    if (!isAuthenticated) {
        return (
            <div className="user-games-page">
                <header className="user-games-page__header"><h1>Избранное</h1></header>
                <div className="user-games-page__auth-required">
                    <h2>Требуется вход</h2>
                    <p>Войдите, чтобы смотреть ваши избранные игры.</p>
                    <Link to="/auth" className="user-games-page__auth-btn">Вход / Регистрация</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="user-games-page">
            <header className="user-games-page__header">
                <h1>Мои избранные игры</h1>
            </header>

   
            <div className="user-games-page__games">
                {loading ? <LoadingSpinner /> : error ? (
                    <div className="user-games-page__error"><p>{error}</p></div>
                ) : favoriteGames.length > 0 ? (
                    <div className="user-games-page__games-grid">
                        {favoriteGames.map(game => (
                            <GameCard key={game.id} game={game} onFavoriteChange={handleFavoriteChange} />
                        ))}
                    </div>
                ) : (
                    <div className="user-games-page__empty">
                        <h3>Пока нет добавленных игр</h3>
                        <p>Начните изучать и добавляйте игры в избранное!</p>
                    </div>
                )}
            </div>

    
            {similarGames.length > 0 && (
                <div className="user-games-page__similar">
                    <h2>Вам также может понравиться</h2>
                    <div className="ugp-carousel">
                        <button className="ugp-carousel-nav" onClick={carousel.prev} aria-label="Предыдущие">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                        </button>
                        <div className="ugp-carousel-window">
                            <div ref={carousel.trackRef} className="ugp-carousel-track"
                                style={{ transform: `translateX(-${carousel.index * CARD_W}px)`, transition: carousel.withTransition ? 'transform 0.4s ease' : 'none' }}>
                                {extendedSimilar.map((g, idx) => {
                                    const cover = getCoverUrl(g.cover?.url);
                                    return (
                                        <div key={`${g.id}-${idx}`} className="ugp-carousel-item" onClick={() => navigate(`/game/${g.slug || g.id}`)}>
                                            {cover ? <img src={cover} alt={g.name} /> : <div className="ugp-carousel-no-cover">Нет изображения</div>}
                                            <div className="ugp-carousel-info">
                                                <span className="ugp-carousel-title">{g.name}</span>
                                                {g.rating !== undefined && <span className="ugp-carousel-rating">{Math.round(g.rating)}/100</span>}
                                                {g.genres && g.genres.length > 0 && (
                                                    <div className="ugp-carousel-genres">
                                                        {g.genres
                                                            .filter((genre: any) => genre?.name)
                                                            .slice(0, 3)
                                                            .map((genre: any) => (
                                                                <span key={genre.id ?? genre.name} className="ugp-carousel-genre-tag">{genre.name}</span>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <button className="ugp-carousel-nav" onClick={carousel.next} aria-label="Следующие">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserGamesPage;
