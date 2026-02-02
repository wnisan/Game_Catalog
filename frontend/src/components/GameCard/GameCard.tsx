import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useFilters } from '../../contexts/FiltersContext';
import { addFavorite, removeFavorite, checkFavorite } from '../../services/api';
import type { Game } from '../../services/api';
import './GameCard.css';

interface GameCardProps {
    game: Game;
    onClick?: () => void;
    onFavoriteChange?: (gameId: number, isFavorited: boolean) => void;
    isFirst?: boolean;
}

const GameCard = ({ game, onClick, onFavoriteChange, isFirst = false }: GameCardProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const { updateFilter } = useFilters();
    const [isFavorited, setIsFavorited] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [playTrailer, setPlayTrailer] = useState(false);
    const isExplorePage = location.pathname === '/' || location.pathname === '/explore';
    const [isHovering, setIsHovering] = useState(false);

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else {
            const gameSlug = game.slug || game.id;
            navigate(`/game/${gameSlug}`);
        }
    };

    const formatRating = (rating?: number): string => {
        return rating ? `${Math.round(rating)}/100` : "This game doesn't have a rating yet.";
    };

    useEffect(() => {
        if (isAuthenticated) {
            const loadFavoriteStatus = async () => {
                try {
                    const favorited = await checkFavorite(game.id);
                    setIsFavorited(favorited);
                } catch (error) {
                    if (import.meta.env.DEV) {
                        console.error('Error checking favorite status:', error);
                    }
                }
            };
            loadFavoriteStatus();
        }
    }, [game.id, isAuthenticated]);

    const handleFavoriteClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isAuthenticated) {
            navigate('/auth');
            return;
        }

        setIsLoading(true);
        try {
            if (isFavorited) {
                await removeFavorite(game.id);
                setIsFavorited(false);
                if (onFavoriteChange) {
                    onFavoriteChange(game.id, false);
                }
            } else {
                await addFavorite(game.id);
                setIsFavorited(true);
                if (onFavoriteChange) {
                    onFavoriteChange(game.id, true);
                }
            }
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Error toggling favorite:', error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const getCoverUrl = (): string | null => {
        if (!game.cover?.url) return null;

        if (game.cover.url.startsWith('http')) {
            return game.cover.url;
        }

        const imageId = game.cover.url.split('/').pop()?.replace(/\.(jpg|png)$/, '');
        return imageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg` : null;
    };

    const filteredGenres = useMemo(() => {
        return game.genres
            ?.filter((genre): genre is { id: number; name: string } => genre !== undefined && genre !== null && genre.name !== undefined)
            .slice(0, 3) || [];
    }, [game.genres]);

    return (
        <article
            className="game-card"
            onClick={handleClick}
            role="button"
            tabIndex={0}
            aria-label={`View details for ${game.name}`}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick();
                }
            }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            <div className="game-card__cover">
                {playTrailer && game.trailerVideoId ? (
                    <iframe
                        className="game-card__trailer"
                        src={`https://www.youtube.com/embed/${game.trailerVideoId}?autoplay=1&mute=1&controls=0`}
                        title={`${game.name} trailer`}
                        allow="autoplay; encrypted-media"
                    />
                ) : (
                    <>
                        {getCoverUrl() ? (
                            <img
                                src={getCoverUrl()!}
                                alt={`Cover art for ${game.name}`}
                                loading={isFirst ? 'eager' : 'lazy'}
                                fetchPriority={isFirst ? 'high' : 'auto'}
                                decoding="async"
                                width="140"
                                height="180"
                            />
                        ) : (
                            <div className="game-card__no-cover" aria-label="No cover image available">
                                No image
                            </div>
                        )}
                        {isHovering && game.trailerVideoId && (
                            <button
                                className="game-card__play"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPlayTrailer(true);
                                }}
                                aria-label={`Play ${game.name} trailer`}
                            >
                                ▶
                            </button>
                        )}
                    </>
                )}
                {isAuthenticated && (
                    <button
                        className={`game-card__favorite ${isFavorited ? 'favorited' : ''} ${isHovering ? 'visible' : ''}`}
                        onClick={handleFavoriteClick}
                        disabled={isLoading}
                        aria-label={isFavorited ? `Remove ${game.name} from favorites` : `Add ${game.name} to favorites`}
                        aria-pressed={isFavorited}
                        title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        <span aria-hidden="true">{isFavorited ? '❤️' : '🤍'}</span>
                    </button>
                )}
            </div>

            <div className="game-card__info">
                <h3 className="game-card__title">{game.name}</h3>
                <div className="game-card__rating" aria-label={`Rating: ${formatRating(game.rating)}`}>
                    {formatRating(game.rating)}
                </div>

                {filteredGenres.length > 0 && (
                    <div className="game-card__genres" role="list" aria-label="Genres">
                        {filteredGenres.map(genre => (
                            <span
                                key={genre.name}
                                className="game-card__genre-tag"
                                role="listitem"
                                onClick={(e) => {
                                    if (isExplorePage) {
                                        e.stopPropagation();
                                        const target = e.currentTarget;
                                        target.classList.add('game-card__genre-tag--clicked');
                                        setTimeout(() => {
                                            target.classList.remove('game-card__genre-tag--clicked');
                                        }, 300);
                                        updateFilter('genres', [genre.id]);
                                    }
                                }}
                                style={isExplorePage ? { cursor: 'pointer', transition: 'all 0.2s ease' } : { transition: 'all 0.2s ease' }}
                            >
                                {genre.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </article>
    )

}
export default GameCard;