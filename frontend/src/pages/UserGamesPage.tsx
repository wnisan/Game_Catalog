import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFavorites, getUserComments, updateComment, deleteComment, type Game, type Comment } from '../services/api';
import GameCard from '../components/GameCard/GameCard';
import LoadingSpinner from '../components/Loading/LoadingSpinner';
import './UserGamesPage.css';

const UserGamesPage: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [favoriteGames, setFavoriteGames] = useState<Game[]>([]);
    const [similarGames, setSimilarGames] = useState<Game[]>([]);
    const [myComments, setMyComments] = useState<Comment[]>([]);
    const [commentGames, setCommentGames] = useState<Map<number, Game>>(new Map());
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editingCommentText, setEditingCommentText] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingSimilar, setLoadingSimilar] = useState(false);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const loadFavorites = async () => {
            try {
                setLoading(true);
                setError('');
                const gameIds = await getFavorites();

                if (gameIds.length > 0) {
                    const { getGamesBulk } = await import('../services/api');
                    const games = await getGamesBulk(gameIds);
                    setFavoriteGames(games);

                    if (games.length > 0) {
                        loadSimilarGames(games);
                    }
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

        const loadMyComments = async () => {
            try {
                const comments = await getUserComments();
                setMyComments(comments);

                const gameIds = [...new Set(comments.map(c => c.game_id))];
                const gamesMap = new Map<number, Game>();
                if (gameIds.length > 0) {
                    const { getGamesBulk } = await import('../services/api');
                    const games = await getGamesBulk(gameIds);
                    games.forEach(g => gamesMap.set(g.id, g));
                }

                setCommentGames(gamesMap);
            } catch (err) {
                console.error('Error loading comments:', err);
            }
        };

        const loadSimilarGames = async (games: Game[]) => {
            try {
                setLoadingSimilar(true);
                const allSimilarIds = new Set<number>();

                for (const game of games) {
                    if (game.similar_games && game.similar_games.length > 0) {
                        game.similar_games.forEach(sg => {
                            if (sg.id && !games.find(fg => fg.id === sg.id)) {
                                allSimilarIds.add(sg.id);
                            }
                        });
                    }
                }

                const similarIdsArray = Array.from(allSimilarIds).slice(0, 12);
                if (similarIdsArray.length > 0) {
                    const { getGamesBulk } = await import('../services/api');
                    const similar = await getGamesBulk(similarIdsArray);
                    setSimilarGames(similar);
                }
            } catch (err) {
                console.error('Error loading similar games:', err);
            } finally {
                setLoadingSimilar(false);
            }
        };

        if (user) {
            loadFavorites();
            loadMyComments();
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
                                const allGenres = favoriteGames
                                    .filter(g => g.genres && g.genres.length > 0)
                                    .flatMap(g => g.genres)
                                    .filter((genre): genre is { id: number; name: string } => genre !== undefined && genre !== null && genre.id !== undefined);

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

            {similarGames.length > 0 && (
                <div className="user-games-page__similar">
                    <h2>Similar Games</h2>
                    {loadingSimilar ? (
                        <LoadingSpinner />
                    ) : (
                        <div className="user-games-page__games-grid">
                            {similarGames.map(game => (
                                <GameCard
                                    key={game.id}
                                    game={game}
                                    onFavoriteChange={handleFavoriteChange}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {myComments.length > 0 && (
                <div className="user-games-page__comments">
                    <h2>My Comments</h2>
                    <div className="user-games-page__comments-list">
                        {myComments.map(comment => {
                            const game = commentGames.get(comment.game_id);
                            const gameSlug = game?.slug || game?.id || comment.game_id;
                            return (
                                <div key={comment.id} className="user-games-page__comment-item">
                                    <div className="user-games-page__comment-game-info">
                                        {game?.cover?.url ? (
                                            <img
                                                src={game.cover.url}
                                                alt={game.name || 'Game cover'}
                                                className="user-games-page__comment-game-cover"
                                                onClick={() => navigate(`/game/${gameSlug}`)}
                                            />
                                        ) : (
                                            <div
                                                className="user-games-page__comment-game-cover user-games-page__comment-game-cover--no-image"
                                                onClick={() => navigate(`/game/${gameSlug}`)}
                                            >
                                                No image
                                            </div>
                                        )}
                                        <div className="user-games-page__comment-content">
                                            <div className="user-games-page__comment-header">
                                                <div className="user-games-page__comment-user-info">
                                                    <button
                                                        className="user-games-page__comment-game-link"
                                                        onClick={() => navigate(`/game/${gameSlug}`)}
                                                    >
                                                        {game?.name || `Game ID: ${comment.game_id}`}
                                                    </button>
                                                    <strong className="user-games-page__comment-username">{comment.user_name || 'Anonymous'}</strong>
                                                </div>
                                                <span className="user-games-page__comment-date">
                                                    {new Date(comment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                </span>
                                            </div>
                                            {editingCommentId === comment.id ? (
                                                <div className="user-games-page__comment-edit">
                                                    <textarea
                                                        className="user-games-page__comment-edit-input"
                                                        rows={3}
                                                        value={editingCommentText}
                                                        onChange={(e) => setEditingCommentText(e.target.value)}
                                                    />
                                                    <div className="user-games-page__comment-actions">
                                                        <button
                                                            type="button"
                                                            className="user-games-page__comment-action user-games-page__comment-action--save"
                                                            onClick={async () => {
                                                                if (!editingCommentText.trim()) return;
                                                                try {
                                                                    const updated = await updateComment(comment.id, editingCommentText.trim());
                                                                    setMyComments(prev =>
                                                                        prev.map(c => c.id === comment.id ? updated : c)
                                                                    );
                                                                    setEditingCommentId(null);
                                                                    setEditingCommentText('');
                                                                } catch (err) {
                                                                    console.error('Error updating comment:', err);
                                                                }
                                                            }}
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="user-games-page__comment-action user-games-page__comment-action--cancel"
                                                            onClick={() => {
                                                                setEditingCommentId(null);
                                                                setEditingCommentText('');
                                                            }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="user-games-page__comment-text">{comment.comment_text}</p>
                                                    <div className="user-games-page__comment-actions">
                                                        <button
                                                            type="button"
                                                            className="user-games-page__comment-action user-games-page__comment-action--edit"
                                                            onClick={() => {
                                                                setEditingCommentId(comment.id);
                                                                setEditingCommentText(comment.comment_text);
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="user-games-page__comment-action user-games-page__comment-action--delete"
                                                            onClick={async () => {
                                                                if (!confirm('Are you sure you want to delete this comment?')) return;
                                                                try {
                                                                    await deleteComment(comment.id);
                                                                    const refreshed = await getUserComments();
                                                                    setMyComments(refreshed);
                                                                } catch (err) {
                                                                    console.error('Error deleting comment:', err);
                                                                }
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserGamesPage;