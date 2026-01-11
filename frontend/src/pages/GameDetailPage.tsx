import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type Game } from '../services/api';
import { useFilters } from '../hooks/useFilters';
import LoadingSpinner from '../components/Loading/LoadingSpinner';
import './GameDetailPage.css';

const GameDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateFilter } = useFilters();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Очищаем поиск при входе на страницу игры
  useEffect(() => {
    updateFilter('search', '');
  }, [updateFilter]);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/games/${id}`);
        const gameData = response.data;
       
        setGame(gameData);
      } catch (err) {
        setError('Failed to load game details');
        console.error('Error loading game:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchGame();
    }
  }, [id]);

  // получение картинки (обложки)
  const getCoverUrl = (): string | null => {
    if (!game?.cover?.url) {
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

  // форматирование даты
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  // спинер при загрузке
  if (loading) {
    return (
      <div className="game-detail-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="game-detail-page">
        <div className="game-detail-page__error">
          <h2>{error || 'Game not found'}</h2>
          <button onClick={() => navigate('/')} className="game-detail-page__back-btn">
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-detail-page">
      <button onClick={() => navigate(-1)} className="game-detail-page__back-btn">
        ← Back
      </button>

      <div className="game-detail-page__content">
        <div className="game-detail-page__cover">
          {getCoverUrl() ? (
            <img src={getCoverUrl()!} alt={game.name} />
          ) : (
            <div className="game-detail-page__no-cover">
              No image available
            </div>
          )}
        </div>

        <div className="game-detail-page__info">
          <h1 className="game-detail-page__title">{game.name}</h1>

          {game.rating !== undefined && (
            <div className="game-detail-page__rating">
              <span className="game-detail-page__rating-label">Rating:</span>
              <span className="game-detail-page__rating-value">
                {Math.round(game.rating)}/100
              </span>
            </div>
          )}

          {game.releaseDate && (
            <div className="game-detail-page__release-date">
              <span className="game-detail-page__label">Release Date:</span>
              <span>{formatDate(game.releaseDate)}</span>
            </div>
          )}

          {game.pegi && (
            <div className="game-detail-page__pegi">
              <span className="game-detail-page__label">PEGI:</span>
              <span className="game-detail-page__pegi-value">{game.pegi}+</span>
            </div>
          )}

          {game.summary && (
            <div className="game-detail-page__summary">
              <h2>Description</h2>
              <p>{game.summary}</p>
            </div>
          )}

          {game.genres && game.genres.length > 0 && (
            <div className="game-detail-page__genres">
              <h2>Genres</h2>
              <div className="game-detail-page__tags">
                {game.genres.map(genre => (
                  <span key={genre.id} className="game-detail-page__tag">
                    {genre.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {game.platforms && game.platforms.length > 0 && (
            <div className="game-detail-page__platforms">
              <h2>Platforms</h2>
              <div className="game-detail-page__tags">
                {game.platforms.map(platform => (
                  <span key={platform.id} className="game-detail-page__tag">
                    {platform.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {game.engines && game.engines.length > 0 && (
            <div className="game-detail-page__engines">
              <h2>Game Engines</h2>
              <div className="game-detail-page__tags">
                {game.engines.map(engine => (
                  <span key={engine.id} className="game-detail-page__tag">
                    {engine.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {game.externalLinks && (game.externalLinks.steam || game.externalLinks.epic || game.externalLinks.gog || game.externalLinks.playstation || game.externalLinks.xbox) && (
            <div className="game-detail-page__external-links">
              <h2>Where to Buy</h2>
              <div className="game-detail-page__links">
                {game.externalLinks.steam && (
                  <a 
                    href={game.externalLinks.steam} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="game-detail-page__link game-detail-page__link--steam"
                  >
                    Buy on Steam
                  </a>
                )}
                {game.externalLinks.epic && (
                  <a 
                    href={game.externalLinks.epic} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="game-detail-page__link game-detail-page__link--epic"
                  >
                    Get on Epic Games
                  </a>
                )}
                {game.externalLinks.gog && (
                  <a 
                    href={game.externalLinks.gog} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="game-detail-page__link game-detail-page__link--gog"
                  >
                    Buy on GOG
                  </a>
                )}
                {game.externalLinks.playstation && (
                  <a 
                    href={game.externalLinks.playstation} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="game-detail-page__link game-detail-page__link--playstation"
                  >
                    PlayStation Store
                  </a>
                )}
                {game.externalLinks.xbox && (
                  <a 
                    href={game.externalLinks.xbox} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="game-detail-page__link game-detail-page__link--xbox"
                  >
                    Xbox Store
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameDetailPage;

