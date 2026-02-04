import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type Game, addFavorite, removeFavorite, checkFavorite } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useFilters } from '../contexts/FiltersContext';
import { useInfiniteCarousel } from '../hooks/useInfiniteCarousel';
import LoadingSpinner from '../components/Loading/LoadingSpinner';
import Comments from '../components/Comments/Comments';
import './GameDetailPage.css';

const GameDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { updateFilter } = useFilters();
  const { isAuthenticated } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentScreenshotIndex, setCurrentScreenshotIndex] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [isHoveringCover, setIsHoveringCover] = useState(false);
  const [playTrailer, setPlayTrailer] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [recentlyVisited, setRecentlyVisited] = useState<Game[]>([]);

  const nextSimilarSlide = () => {
    if (game?.similar_games && game.similar_games.length > 0) {
      similarNext();
    }
  };

  const prevSimilarSlide = () => {
    if (game?.similar_games && game.similar_games.length > 0) {
      similarPrev();
    }
  };

  const { index: similarIndex, next: similarNext, prev: similarPrev, trackRef: similarTrackRef, withTransition: similarWithTransition } = useInfiniteCarousel(game?.similar_games?.length || 0, 6);

  const recentCarousel = useInfiniteCarousel(
    Math.max(recentlyVisited.length, 6),
    6
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    updateFilter('search', '');
  }, [updateFilter]);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        setLoading(true);
        setError('');
        window.scrollTo(0, 0);
        console.log('Fetching game with slug:', slug);
        const response = await api.get(`/games/${slug}`);
        const gameData = response.data;
        console.log('Game data received:', gameData);

        setGame(gameData);

        if (gameData?.id) {
          try {
            const favCountResponse = await api.get(`/games/${gameData.id}/favorite-count`);
            setFavoriteCount(favCountResponse.data.count || 0);

            if (isAuthenticated) {
              // Записываем посещение
              console.log('Recording visit for game:', gameData.id);
              try {
                const visitResponse = await api.post('/games/visit', { gameId: gameData.id });
                console.log('Visit response:', visitResponse.data);

                // Загружаем обновленный список недавно посещенных игр
                const recentResponse = await api.get('/games/recently-visited');
                console.log('Recently visited response:', recentResponse.data);
                setRecentlyVisited(recentResponse.data.games || []);
              } catch (visitError) {
                console.error('Error recording visit:', visitError);
                // Не блокируем загрузку страницы из-за ошибки записи посещения

                // Пробуем загрузить недавно посещенные игры отдельно
                try {
                  const recentResponse = await api.get('/games/recently-visited');
                  console.log('Recently visited response (fallback):', recentResponse.data);
                  setRecentlyVisited(recentResponse.data.games || []);
                } catch (recentError) {
                  console.error('Error loading recently visited games:', recentError);
                  setRecentlyVisited([]);
                }
              }
            } else {
              console.log('User not authenticated, skipping visit recording');
              setRecentlyVisited([]);
            }
          } catch (err) {
            console.error('Error loading additional data:', err);
          }
        }
      } catch (err) {
        setError('Failed to load game details');
        console.error('Error loading game:', err);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchGame();
    }
  }, [slug, isAuthenticated]);

  useEffect(() => {
    const loadFavorite = async () => {
      if (!isAuthenticated || !game?.id) {
        setIsFavorited(false);
        return;
      }
      try {
        const fav = await checkFavorite(game.id);
        setIsFavorited(fav);
      } catch {
        setIsFavorited(false);
      }
    };
    loadFavorite();
  }, [isAuthenticated, game?.id]);



  const formatCountdown = (targetIso?: string): { days: number; hours: number; minutes: number; seconds: number } | null => {
    if (!targetIso) return null;
    const target = new Date(targetIso).getTime();
    const diff = Math.max(0, target - nowTick);
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
  };

  const getCoverUrl = (): string | null => {
    if (!game?.cover?.url) return null;

    if (game.cover.url.startsWith('http')) {
      return game.cover.url;
    }

    const imageId = game.cover.url.split('/').pop()?.replace(/\.(jpg|png)$/, '');
    return imageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg` : null;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  const getSocialMediaIcon = (url: string): { icon: string; color: string } | null => {
    if (url.includes('twitter.com') || url.includes('x.com')) {
      return { icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/twitter.svg', color: '#1DA1F2' };
    }
    if (url.includes('facebook.com')) {
      return { icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/facebook.svg', color: '#1877F2' };
    }
    if (url.includes('instagram.com')) {
      return { icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/instagram.svg', color: '#E4405F' };
    }
    if (url.includes('youtube.com')) {
      return { icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/youtube.svg', color: '#FF0000' };
    }
    if (url.includes('twitch.tv')) {
      return { icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/twitch.svg', color: '#9146FF' };
    }
    if (url.includes('discord.com')) {
      return { icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/discord.svg', color: '#5865F2' };
    }
    if (url.includes('reddit.com')) {
      return { icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/reddit.svg', color: '#FF4500' };
    }
    if (url.includes('tiktok.com')) {
      return { icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/tiktok.svg', color: '#000000' };
    }
    return null;
  };

  const getSocialMediaName = (url: string): string => {
    if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter';
    if (url.includes('facebook.com')) return 'Facebook';
    if (url.includes('instagram.com')) return 'Instagram';
    if (url.includes('youtube.com')) return 'YouTube';
    if (url.includes('twitch.tv')) return 'Twitch';
    if (url.includes('discord.com')) return 'Discord';
    if (url.includes('reddit.com')) return 'Reddit';
    if (url.includes('tiktok.com')) return 'TikTok';
    return 'Website';
  };



  if (loading) {
    return (
      <div className="game-detail-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

  const hasExternalLinks = !!(game.externalLinks && (game.externalLinks?.steam || game.externalLinks?.epic || game.externalLinks?.gog || game.externalLinks?.playstation || game.externalLinks?.xbox));
  const hasSocialLinks = !!(game.websites && game.websites.some(w => w.url && getSocialMediaIcon(w.url)));
  const hasLeftColumn = hasExternalLinks || hasSocialLinks;

  return (
    <div className="game-detail-page">
      <div className="game-detail-page__top-row">
        <button onClick={() => navigate(-1)} className="game-detail-page__back-btn">
          ← Back
        </button>

        {game.releaseDate && new Date(game.releaseDate) > new Date() && (
          <div className="game-detail-page__countdown">
            <div className="game-detail-page__countdown-content">
              <h3>Release Countdown</h3>
              {(() => {
                const countdown = formatCountdown(game.releaseDate);
                if (!countdown) return null;
                return (
                  <div className="game-detail-page__countdown-timer">
                    <div className="game-detail-page__countdown-item">
                      <span className="game-detail-page__countdown-value">{countdown.days}</span>
                      <span className="game-detail-page__countdown-label">days</span>
                    </div>
                    <div className="game-detail-page__countdown-item">
                      <span className="game-detail-page__countdown-value">{String(countdown.hours).padStart(2, '0')}</span>
                      <span className="game-detail-page__countdown-label">hours</span>
                    </div>
                    <div className="game-detail-page__countdown-item">
                      <span className="game-detail-page__countdown-value">{String(countdown.minutes).padStart(2, '0')}</span>
                      <span className="game-detail-page__countdown-label">minutes</span>
                    </div>
                    <div className="game-detail-page__countdown-item">
                      <span className="game-detail-page__countdown-value">{String(countdown.seconds).padStart(2, '0')}</span>
                      <span className="game-detail-page__countdown-label">seconds</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        <div></div>
      </div>

      <div className="game-detail-page__hero">
        <div
          className="game-detail-page__cover"
          onMouseEnter={() => setIsHoveringCover(true)}
          onMouseLeave={() => setIsHoveringCover(false)}
        >
          {playTrailer && game.trailerVideoId ? (
            <iframe
              className="game-detail-page__trailer"
              src={`https://www.youtube.com/embed/${game.trailerVideoId}?autoplay=1&mute=1&controls=0`}
              title={`${game.name} trailer`}
              allow="autoplay; encrypted-media"
            />
          ) : (
            <>
              {getCoverUrl() ? (
                <img src={getCoverUrl()!} alt={game.name} />
              ) : (
                <div className="game-detail-page__no-cover">
                  No image available
                </div>
              )}
              {isHoveringCover && game.trailerVideoId && (
                <button
                  className="game-detail-page__play"
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
        </div>

        <div className="game-detail-page__header">
          <div className="game-detail-page__title-row">
            <h1 className="game-detail-page__title">{game.name}</h1>
            <button
              type="button"
              className={`game-detail-page__favorite ${isFavorited ? 'favorited' : ''}`}
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={isFavorited}
              disabled={favoriteLoading}
              onClick={async () => {
                if (!game?.id) return;
                if (!isAuthenticated) {
                  navigate('/auth');
                  return;
                }
                setFavoriteLoading(true);
                try {
                  if (isFavorited) {
                    await removeFavorite(game.id);
                    setIsFavorited(false);
                    setFavoriteCount(prev => Math.max(0, prev - 1));
                  } else {
                    await addFavorite(game.id);
                    setIsFavorited(true);
                    setFavoriteCount(prev => prev + 1);
                  }
                } finally {
                  setFavoriteLoading(false);
                }
              }}
              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <span aria-hidden="true">{isFavorited ? '❤️' : '🤍'}</span>
              {favoriteCount > 0 && (
                <span className="game-detail-page__favorite-count">{favoriteCount}</span>
              )}
            </button>
          </div>
          <div className="game-detail-page__meta">
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

          </div>
          {game.summary && (
            <div className="game-detail-page__description-block">
              <h2 className="game-detail-page__description-title">Description</h2>
              <p className="game-detail-page__description">{game.summary}</p>
            </div>
          )}
        </div>
      </div>

      <div className="game-detail-page__content">
        <div className="game-detail-page__info">
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

          <div className={`game-detail-page__bottom-section ${hasLeftColumn ? '' : 'game-detail-page__bottom-section--right-only'}`}>
            {hasLeftColumn && (
              <div className="game-detail-page__left-column">
                {hasExternalLinks && (
                  <div className="game-detail-page__external-links">
                    <h2>Where to Buy</h2>
                    <div className="game-detail-page__links">
                      {game.externalLinks?.steam && (
                        <a
                          href={game.externalLinks.steam}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="game-detail-page__link game-detail-page__link--steam"
                        >
                          Buy on Steam
                        </a>
                      )}
                      {game.externalLinks?.epic && (
                        <a
                          href={game.externalLinks.epic}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="game-detail-page__link game-detail-page__link--epic"
                        >
                          Get on Epic Games
                        </a>
                      )}
                      {game.externalLinks?.gog && (
                        <a
                          href={game.externalLinks.gog}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="game-detail-page__link game-detail-page__link--gog"
                        >
                          Buy on GOG
                        </a>
                      )}
                      {game.externalLinks?.playstation && (
                        <a
                          href={game.externalLinks.playstation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="game-detail-page__link game-detail-page__link--playstation"
                        >
                          PlayStation Store
                        </a>
                      )}
                      {game.externalLinks?.xbox && (
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

                {hasSocialLinks && (
                  <div className="game-detail-page__social-links">
                    <h2>Social Media</h2>
                    <div className="game-detail-page__social-icons">
                      {game.websites
                        ?.filter(w => w.url && getSocialMediaIcon(w.url))
                        .map((website, index) => {
                          const iconData = getSocialMediaIcon(website.url);
                          const name = getSocialMediaName(website.url);
                          return iconData ? (
                            <a
                              key={index}
                              href={website.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="game-detail-page__social-icon"
                              title={name}
                              aria-label={`Visit ${name}`}
                              style={{ backgroundColor: iconData.color }}
                            >
                              <img src={iconData.icon} alt={name} />
                            </a>
                          ) : null;
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="game-detail-page__right-column">
              {game.screenshots && game.screenshots.length > 0 && (
                <div className="game-detail-page__screenshots">
                  <div className="game-detail-page__screenshot-carousel">
                    <button
                      className="game-detail-page__screenshot-nav game-detail-page__screenshot-nav--prev"
                      onClick={() => setCurrentScreenshotIndex((prev) => (prev - 1 + game.screenshots!.length) % game.screenshots!.length)}
                      aria-label="Previous screenshot"
                      disabled={game.screenshots.length === 1}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <div className="game-detail-page__screenshot-main">
                      <img
                        src={game.screenshots[currentScreenshotIndex].url}
                        alt={`Screenshot ${currentScreenshotIndex + 1} of ${game.screenshots.length}`}
                      />
                      <div className="game-detail-page__screenshot-counter">
                        {currentScreenshotIndex + 1} / {game.screenshots.length}
                      </div>
                    </div>
                    <button
                      className="game-detail-page__screenshot-nav game-detail-page__screenshot-nav--next"
                      onClick={() => setCurrentScreenshotIndex((prev) => (prev + 1) % game.screenshots!.length)}
                      aria-label="Next screenshot"
                      disabled={game.screenshots.length === 1}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                  {game.screenshots.length > 1 && (
                    <div
                      className="game-detail-page__screenshot-thumbnails"
                      data-count={game.screenshots.length}
                    >
                      {game.screenshots.map((screenshot, index) => (
                        <button
                          key={index}
                          className={`game-detail-page__screenshot-thumb ${index === currentScreenshotIndex ? 'active' : ''}`}
                          onClick={() => setCurrentScreenshotIndex(index)}
                          aria-label={`View screenshot ${index + 1}`}
                        >
                          <img src={screenshot.url} alt={`Thumbnail ${index + 1}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={`game-detail-page__languages-engines ${!game.engines || game.engines.length === 0 ? 'game-detail-page__languages-engines--languages-only' : ''}`}>
            {game.language_supports && game.language_supports.length > 0 && (
              <div className="game-detail-page__languages">
                <h2>Supported Languages</h2>
                <div className="game-detail-page__tags">
                  {Array.from(new Set(game.language_supports
                    .filter(ls => ls.language)
                    .map(ls => ls.language)
                  )).map((lang, index) => (
                    <span key={index} className="game-detail-page__tag">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {game.engines && game.engines.length > 0 && (
              <div className={`game-detail-page__engines ${!game.language_supports || game.language_supports.length === 0 ? 'game-detail-page__engines--full-width' : ''}`}>
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
          </div>
        </div>
      </div>

      {game && <Comments gameId={game.id} />}

      <div className="game-detail-page__additional-info">
        <div className="game-detail-page__themes-modes-row">
          {game.themes && game.themes.length > 0 && (
            <div className="game-detail-page__themes-block">
              <h2>Themes</h2>
              <div className="game-detail-page__tags">
                {game.themes
                  .filter((theme): theme is { id: number; name: string } =>
                    typeof theme === 'object' && theme !== null && 'name' in theme && theme.name !== undefined
                  )
                  .map(theme => (
                    <span key={theme.id} className="game-detail-page__tag">
                      {theme.name}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {game.game_modes && game.game_modes.length > 0 && (
            <div className="game-detail-page__game-modes-block">
              <h2>Game Modes</h2>
              <div className="game-detail-page__tags">
                {game.game_modes
                  .filter((mode): mode is { id: number; name: string } =>
                    typeof mode === 'object' && mode !== null && 'name' in mode && mode.name !== undefined
                  )
                  .map(mode => (
                    <span key={mode.id} className="game-detail-page__tag">
                      {mode.name}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="game-detail-page__keywords-perspectives-row">
          {game.keywords && game.keywords.length > 0 && (
            <div className="game-detail-page__keywords-block">
              <h2>Keywords</h2>
              <div className="game-detail-page__tags">
                {game.keywords
                  .filter((keyword): keyword is { id: number; name: string } =>
                    typeof keyword === 'object' && keyword !== null && 'name' in keyword && keyword.name !== undefined
                  )
                  .slice(0, 10)
                  .map(keyword => (
                    <span key={keyword.id} className="game-detail-page__tag game-detail-page__tag--small">
                      {keyword.name}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {game.player_perspectives && game.player_perspectives.length > 0 && (
            <div className="game-detail-page__perspectives-block">
              <h2>Player Perspectives</h2>
              <div className="game-detail-page__tags">
                {game.player_perspectives
                  .filter((perspective): perspective is { id: number; name: string } =>
                    typeof perspective === 'object' && perspective !== null && 'name' in perspective && perspective.name !== undefined
                  )
                  .map(perspective => (
                    <span key={perspective.id} className="game-detail-page__tag">
                      {perspective.name}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {game?.similar_games && game.similar_games.length > 0 && (
        <div className="game-detail-page__similar">
          <h2>Similar Games</h2>
          <div className="game-detail-page__similar-carousel">
            {game.similar_games.length > 5 && (
              <button
                className="game-detail-page__similar-nav game-detail-page__similar-nav--prev"
                onClick={prevSimilarSlide}
                aria-label="Previous games"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <div className="game-detail-page__similar-window">
              <div
                ref={similarTrackRef}
                className="game-detail-page__similar-track"
                style={{
                  transform: `translateX(-${similarIndex * 220}px)`,
                  transition: similarWithTransition ? 'transform 0.4s ease' : 'none'
                }}
              >
                {(() => {
                  if (!game?.similar_games || game.similar_games.length === 0) return null;
                  const VISIBLE_CARDS = 6;
                  const extendedSimilar = [
                    ...game.similar_games.slice(-VISIBLE_CARDS),
                    ...game.similar_games,
                    ...game.similar_games.slice(0, VISIBLE_CARDS)
                  ];
                  return extendedSimilar.map((similarGame, index) => {
                    const gameSlug = similarGame.slug || similarGame.id;
                    return (
                      <div
                        key={`${similarGame.id}-${index}`}
                        className="game-detail-page__similar-item"
                        onClick={() => navigate(`/game/${gameSlug}`)}
                      >
                        {similarGame.cover?.url ? (
                          <img src={similarGame.cover.url} alt={similarGame.name} />
                        ) : (
                          <div className="game-detail-page__similar-no-cover">No image</div>
                        )}
                        <div className="game-detail-page__similar-info">
                          <h3>{similarGame.name}</h3>
                          {similarGame.rating !== undefined && (
                            <div className="game-detail-page__similar-rating">
                              {Math.round(similarGame.rating)}/100
                            </div>
                          )}
                          {(similarGame as any).genres && (similarGame as any).genres.length > 0 && (
                            <div className="game-detail-page__similar-genres">
                              {(similarGame as any).genres
                                .filter((genre: any) => genre !== undefined && genre !== null && genre.name !== undefined)
                                .slice(0, 2)
                                .map((genre: any) => (
                                  <span key={genre.id} className="game-detail-page__similar-genre-tag">
                                    {genre.name}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            {game.similar_games.length > 5 && (
              <button
                className="game-detail-page__similar-nav game-detail-page__similar-nav--next"
                onClick={nextSimilarSlide}
                aria-label="Next games"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {recentlyVisited.length > 0 && (
        <div className="game-detail-page__recent">
          <h2>Recently Visited</h2>

          {/* 1–5 игр — простая сетка */}
          {recentlyVisited.length <= 5 && (
            <div className={`game-detail-page__recent-grid ${recentlyVisited.length > 0 && recentlyVisited.length <= 5 ? 'compact' : ''}`}>
              {recentlyVisited.map((recentGame) => {
                const gameSlug = recentGame.slug || recentGame.id;
                return (
                  <div
                    key={recentGame.id}
                    className="game-detail-page__recent-item"
                    onClick={() => navigate(`/game/${gameSlug}`)}
                  >
                    {recentGame.cover?.url ? (
                      <img src={
                        recentGame.cover.url.startsWith('http://') || recentGame.cover.url.startsWith('https://')
                          ? recentGame.cover.url
                          : `https://images.igdb.com/igdb/image/upload/t_cover_big/${recentGame.cover.url.split('/').pop()?.replace('.jpg', '').replace('.png', '')}.jpg`
                      } alt={recentGame.name} />
                    ) : (
                      <div className="game-detail-page__recent-no-cover">No image</div>
                    )}
                    <div className="game-detail-page__recent-info">
                      <h3>{recentGame.name}</h3>
                      {recentGame.rating !== undefined && (
                        <div className="game-detail-page__recent-rating">
                          {Math.round(recentGame.rating)}/100
                        </div>
                      )}
                      {recentGame.genres && recentGame.genres.length > 0 && (
                        <div className="game-detail-page__recent-genres">
                          {recentGame.genres
                            .filter((genre): genre is { id: number; name: string } => genre !== undefined && genre !== null && genre.name !== undefined)
                            .slice(0, 2)
                            .map(genre => (
                              <span key={genre.id} className="game-detail-page__recent-genre-tag">
                                {genre.name}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 6+ игр — бесконечная карусель */}
          {recentlyVisited.length >= 6 && (
            <div className="game-detail-page__recent-carousel">
              <button
                className="game-detail-page__recent-nav game-detail-page__recent-nav--prev"
                onClick={recentCarousel.prev}
                aria-label="Previous games"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>

              <div className="game-detail-page__recent-window">
                <div
                  ref={recentCarousel.trackRef}
                  className="game-detail-page__recent-track"
                  style={{
                    transform: `translateX(-${recentCarousel.index * 220}px)`,
                    transition: recentCarousel.withTransition ? 'transform 0.4s ease' : 'none'
                  }}
                >
                  {[
                    ...recentlyVisited.slice(-6),
                    ...recentlyVisited,
                    ...recentlyVisited.slice(0, 6)
                  ].map((recentGame, index) => {
                    const gameSlug = recentGame.slug || recentGame.id;
                    return (
                      <div
                        key={`${recentGame.id}-${index}`}
                        className="game-detail-page__recent-item"
                        onClick={() => navigate(`/game/${gameSlug}`)}
                      >
                        {recentGame.cover?.url ? (
                          <img src={
                            recentGame.cover.url.startsWith('http://') || recentGame.cover.url.startsWith('https://')
                              ? recentGame.cover.url
                              : `https://images.igdb.com/igdb/image/upload/t_cover_big/${recentGame.cover.url.split('/').pop()?.replace('.jpg', '').replace('.png', '')}.jpg`
                          } alt={recentGame.name} />
                        ) : (
                          <div className="game-detail-page__recent-no-cover">No image</div>
                        )}
                        <div className="game-detail-page__recent-info">
                          <h3>{recentGame.name}</h3>
                          {recentGame.rating !== undefined && (
                            <div className="game-detail-page__recent-rating">
                              {Math.round(recentGame.rating)}/100
                            </div>
                          )}
                          {recentGame.genres && recentGame.genres.length > 0 && (
                            <div className="game-detail-page__recent-genres">
                              {recentGame.genres
                                .filter((genre): genre is { id: number; name: string } => genre !== undefined && genre !== null && genre.name !== undefined)
                                .slice(0, 2)
                                .map(genre => (
                                  <span key={genre.id} className="game-detail-page__recent-genre-tag">
                                    {genre.name}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                className="game-detail-page__recent-nav game-detail-page__recent-nav--next"
                onClick={recentCarousel.next}
                aria-label="Next games"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div >
  );
};

export default GameDetailPage;

