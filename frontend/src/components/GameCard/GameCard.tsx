import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { addFavorite, removeFavorite, checkFavorite } from '../../services/api';
import type {Game} from '../../services/api';
import './GameCard.css';

interface GameCardProps {
    game: Game;
    onClick?: () => void;
    onFavoriteChange?: (gameId: number, isFavorited: boolean) => void;
}

const GameCard = ({game, onClick, onFavoriteChange}: GameCardProps) => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [isFavorited, setIsFavorited] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else {
            navigate(`/game/${game.id}`);
        }
    };

    const formatRating = (rating: number | undefined): string => {
        if(!rating) {
         return "This game doesn't have a rating yet.";
        } else {
            return `${Math.round(rating)}/100`;
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            const loadFavoriteStatus = async () => {
                try {
                    const favorited = await checkFavorite(game.id);
                    setIsFavorited(favorited);
                } catch (error) {
                    console.error('Error checking favorite status:', error);
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
            console.error('Error toggling favorite:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getCoverUrl = (): string | null => {
        if (!game.cover?.url) {
            return null;
        }
        
        if (game.cover.url.startsWith('http://') || game.cover.url.startsWith('https://')) {
            return game.cover.url;
        }
        
        const imageId = game.cover.url.split('/').pop()?.replace('.jpg', '').replace('.png', '');
        if (imageId) {
            return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
        }
        
        return null;
    };
    
    return(
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
        >
            <div className="game-card__cover">
                {getCoverUrl() ? (
                    <img 
                        src={getCoverUrl()!} 
                        alt={`Cover art for ${game.name}`}
                        loading='lazy'
                    />
                ):(
                    <div className="game-card__no-cover" aria-label="No cover image available">
                        No image
                    </div>
                )}
                {isAuthenticated && (
                    <button
                        className={`game-card__favorite ${isFavorited ? 'favorited' : ''}`}
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

                {game.pegi && (
                    <div className="game-card__pegi" aria-label={`Age rating: PEGI ${game.pegi}`}>
                        PEGI: {game.pegi}+
                    </div>
                )}

                {game.genres && game.genres.length > 0 && (
                    <div className="game-card__genres" role="list" aria-label="Genres">
                        {game.genres
                            .filter((genre): genre is { id: number; name: string } => genre !== undefined && genre !== null && genre.name !== undefined)
                            .slice(0,3)
                            .map(genre => (
                                <span key={genre.name} className="game-card__genre-tag" role="listitem">
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