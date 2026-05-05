import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type Game, addFavorite, removeFavorite, checkFavorite } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useFilters } from '../contexts/FiltersContext';
import { useInfiniteCarousel } from '../hooks/useInfiniteCarousel';
import LoadingSpinner from '../components/Loading/LoadingSpinner';
import Comments from '../components/Comments/Comments';
import SellerBlock from '../components/SellerBlock/SellerBlock';
import AuthPromptModal from '../components/AuthPromptModal/AuthPromptModal';
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
  const thumbnailsRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!thumbnailsRef.current) return;
    const thumb = thumbnailsRef.current.children[currentScreenshotIndex] as HTMLElement;
    if (thumb) thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentScreenshotIndex]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [trailerModal, setTrailerModal] = useState(false);
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
       
              console.log('Recording visit for game:', gameData.id);
              try {
                const visitResponse = await api.post('/games/visit', { gameId: gameData.id });
                console.log('Visit response:', visitResponse.data);

                const recentResponse = await api.get('/games/recently-visited');
                console.log('Recently visited response:', recentResponse.data);
                setRecentlyVisited(recentResponse.data.games || []);
              } catch (visitError) {
                console.error('Error recording visit:', visitError);

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
    if (!dateString) return 'Неизвестно';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Неизвестно';
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
    if (url.includes('twitter.com') || url.includes('x.com')) return 'Твиттер';
    if (url.includes('facebook.com')) return 'Фейсбук';
    if (url.includes('instagram.com')) return 'Инстаграм';
    if (url.includes('youtube.com')) return 'Ютуб';
    if (url.includes('twitch.tv')) return 'Твич';
    if (url.includes('discord.com')) return 'Дискорд';
    if (url.includes('reddit.com')) return 'Реддит';
    if (url.includes('tiktok.com')) return 'Тик-Ток';
    return 'Сайт';
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
          <h2>{error || 'Игра не найдена'}</h2>
          <button onClick={() => navigate('/')} className="game-detail-page__back-btn">
            Назад к играм
          </button>
        </div>
      </div>
    );
  }

  const hasSocialLinks = !!(game.websites && game.websites.some(w => w.url && getSocialMediaIcon(w.url)));

  const screenshotsJSX = () => (
    <div className="game-detail-page__screenshots">
      <div className="game-detail-page__screenshot-carousel">
        <button
          className="game-detail-page__screenshot-nav game-detail-page__screenshot-nav--prev"
          onClick={() => setCurrentScreenshotIndex((prev) => (prev - 1 + game!.screenshots!.length) % game!.screenshots!.length)}
          aria-label="Предыдущий скриншот"
          disabled={game!.screenshots!.length === 1}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="game-detail-page__screenshot-main">
          <img src={game!.screenshots![currentScreenshotIndex].url} alt={`Скриншот ${currentScreenshotIndex + 1}`} />
          <div className="game-detail-page__screenshot-counter">{currentScreenshotIndex + 1} / {game!.screenshots!.length}</div>
        </div>
        <button
          className="game-detail-page__screenshot-nav game-detail-page__screenshot-nav--next"
          onClick={() => setCurrentScreenshotIndex((prev) => (prev + 1) % game!.screenshots!.length)}
          aria-label="Следующий скриншот"
          disabled={game!.screenshots!.length === 1}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
      {game!.screenshots!.length > 1 && (
        <div ref={thumbnailsRef} className="game-detail-page__screenshot-thumbnails" data-count={game!.screenshots!.length}>
          {game!.screenshots!.map((screenshot, index) => (
            <button key={index} className={`game-detail-page__screenshot-thumb ${index === currentScreenshotIndex ? 'active' : ''}`}
              onClick={() => setCurrentScreenshotIndex(index)} aria-label={`Просмотреть скриншот ${index + 1}`}>
              <img src={screenshot.url} alt={`Миниатюра ${index + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="game-detail-page">
      <div className="game-detail-page__top-row">
        <button onClick={() => navigate(-1)} className="game-detail-page__back-btn">
          ← Назад
        </button>

        {game.releaseDate && new Date(game.releaseDate) > new Date() && (
          <div className="game-detail-page__countdown">
            <div className="game-detail-page__countdown-content">
              <h3>Отсчет до релиза</h3>
              {(() => {
                const countdown = formatCountdown(game.releaseDate);
                if (!countdown) return null;
                return (
                  <div className="game-detail-page__countdown-timer">
                    <div className="game-detail-page__countdown-item">
                      <span className="game-detail-page__countdown-value">{countdown.days}</span>
                      <span className="game-detail-page__countdown-label">дней</span>
                    </div>
                    <div className="game-detail-page__countdown-item">
                      <span className="game-detail-page__countdown-value">{String(countdown.hours).padStart(2, '0')}</span>
                      <span className="game-detail-page__countdown-label">часов</span>
                    </div>
                    <div className="game-detail-page__countdown-item">
                      <span className="game-detail-page__countdown-value">{String(countdown.minutes).padStart(2, '0')}</span>
                      <span className="game-detail-page__countdown-label">минут</span>
                    </div>
                    <div className="game-detail-page__countdown-item">
                      <span className="game-detail-page__countdown-value">{String(countdown.seconds).padStart(2, '0')}</span>
                      <span className="game-detail-page__countdown-label">секунд</span>
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
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <iframe
                className="game-detail-page__trailer"
                src={`https://www.youtube.com/embed/${game.trailerVideoId}?autoplay=1&mute=1&controls=0`}
                title={`${game.name} трейлер`}
                allow="autoplay; encrypted-media"
              />
              <button
                className="game-detail-page__trailer-expand"
                onClick={() => setTrailerModal(true)}
                title="Развернуть трейлер"
              >
                ⛶
              </button>
            </div>
          ) : (
            <>
              {getCoverUrl() ? (
                <img src={getCoverUrl()!} alt={game.name} />
              ) : (
                <div className="game-detail-page__no-cover">
                  Нет изображения
                </div>
              )}
              {isHoveringCover && game.trailerVideoId && (
                <button
                  className="game-detail-page__play"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlayTrailer(true);
                  }}
                  aria-label={`Воспроизвести трейлер ${game.name}`}
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
              className={`game-detail-page__favorite ${isFavorited ? 'добавлено в избранное' : ''}`}
              aria-label={isFavorited ? 'Удаление из избранного' : 'Добавление в избранное'}
              aria-pressed={isFavorited}
              disabled={favoriteLoading}
              onClick={async () => {
                if (!game?.id) return;
                if (!isAuthenticated) {
                  setShowAuthPrompt(true);
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
              title={isFavorited ? 'Удаление из избранного' : 'Добавление в избранное'}
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
                <span className="game-detail-page__rating-label">Рейтинг:</span>
                <span className="game-detail-page__rating-value">
                  {Math.round(game.rating)}/100
                </span>
              </div>
            )}

            {game.releaseDate && (
              <div className="game-detail-page__release-date">
                <span className="game-detail-page__label">Дата релиза:</span>
                <span>{formatDate(game.releaseDate)}</span>
              </div>
            )}

          </div>
          {game.summary && (
            <div className="game-detail-page__description-block">
              <h2 className="game-detail-page__description-title">Описание</h2>
              <p className="game-detail-page__description">{game.summary}</p>
            </div>
          )}

          <SellerBlock gameId={game.id} gameName={game.name} onOpenCart={() => window.dispatchEvent(new Event('openCart'))} />
        </div>
      </div>

      {showAuthPrompt && (
        <AuthPromptModal
          onClose={() => setShowAuthPrompt(false)}
          message="Войдите, чтобы добавить игры в избранное."
        />
      )}

    
      {trailerModal && game.trailerVideoId && (
        <div className="game-detail-page__trailer-overlay" onClick={() => setTrailerModal(false)}>
          <div className="game-detail-page__trailer-modal" onClick={e => e.stopPropagation()}>
            <button className="game-detail-page__trailer-close" onClick={() => setTrailerModal(false)}>✕</button>
            <iframe
              src={`https://www.youtube.com/embed/${game.trailerVideoId}?autoplay=1&controls=1`}
              title={`${game.name} трейлер`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
            />
          </div>
        </div>
      )}

      <div className="game-detail-page__content">
        <div className="game-detail-page__info">
          {(() => {
            const hasScreenshots = !!(game.screenshots && game.screenshots.length > 0);
            const hasLeft = hasSocialLinks || (game.genres && game.genres.length > 0) || (game.platforms && game.platforms.length > 0);

            const leftBlocks = [
              game.genres && game.genres.length > 0 && (
                <div key="genres" className="game-detail-page__genres">
                  <h2>Жанры</h2>
                  <div className="game-detail-page__tags">
                    {game.genres.map(genre => <span key={genre.id} className="game-detail-page__tag">{genre.name}</span>)}
                  </div>
                </div>
              ),
              game.platforms && game.platforms.length > 0 && (
                <div key="platforms" className="game-detail-page__platforms">
                  <h2>Платформы</h2>
                  <div className="game-detail-page__tags">
                    {game.platforms.map(p => <span key={p.id} className="game-detail-page__tag">{p.name}</span>)}
                  </div>
                </div>
              ),
              hasSocialLinks && (
                <div key="social" className="game-detail-page__social-links">
                  <h2>Социальные сети</h2>
                  <div className="game-detail-page__social-icons">
                    {game.websites?.filter(w => w.url && getSocialMediaIcon(w.url)).map((website, index) => {
                      const iconData = getSocialMediaIcon(website.url);
                      const name = getSocialMediaName(website.url);
                      return iconData ? (
                        <a key={index} href={website.url} target="_blank" rel="noopener noreferrer"
                          className="game-detail-page__social-icon" title={name} aria-label={`Перейти на ${name}`}
                          style={{ backgroundColor: iconData.color }}>
                          <img src={iconData.icon} alt={name} />
                        </a>
                      ) : null;
                    })}
                  </div>
                </div>
              ),
            ].filter(Boolean);

            if (hasScreenshots && hasLeft) {
              // Normal: left 35% | screenshots 65%
              return (
                <div className="game-detail-page__bottom-section">
                  <div className="game-detail-page__left-column">{leftBlocks}</div>
                  <div className="game-detail-page__right-column">
                    {screenshotsJSX()}
                  </div>
                </div>
              );
            }
            if (hasScreenshots && !hasLeft) {
              // Screenshots only — full width centered
              return (
                <div className="game-detail-page__bottom-section--screenshots-only">
                  {screenshotsJSX()}
                </div>
              );
            }
            if (!hasScreenshots && hasLeft) {
              // Left blocks only — horizontal row, equal width
              return (
                <div className="game-detail-page__left-only-row">
                  {leftBlocks}
                </div>
              );
            }
            return null;
          })()}

       
          {game.language_supports && game.language_supports.length > 0 && (
            <div className="game-detail-page__platforms">
              <h2>Поддерживаемые языки</h2>
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
            <div className="game-detail-page__engines">
              <h2>Игровые движки</h2>
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

      {game && <Comments gameId={game.id} />}

      <div className="game-detail-page__additional-info">
        <div className="game-detail-page__themes-modes-row">
          {game.themes && game.themes.length > 0 && (
            <div className="game-detail-page__themes-block">
              <h2>Темы</h2>
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
              <h2>Игровые режимы</h2>
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
              <h2>Ключевые слова</h2>
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
              <h2>Точки зрения игрока</h2>
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
          <h2>Похожие игры</h2>
          <div className="game-detail-page__similar-carousel">
            {game.similar_games.length > 5 && (
              <button
                className="game-detail-page__similar-nav game-detail-page__similar-nav--prev"
                onClick={prevSimilarSlide}
                aria-label="Предыдущие игры"
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
                          <div className="game-detail-page__similar-no-cover">Нет изображения</div>
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
                aria-label="Следующие игры"
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
          <h2>Недавно просмотренные</h2>

        
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
                      <div className="game-detail-page__recent-no-cover">Нет изображения</div>
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

          
          {recentlyVisited.length >= 6 && (
            <div className="game-detail-page__recent-carousel">
              <button
                className="game-detail-page__recent-nav game-detail-page__recent-nav--prev"
                onClick={recentCarousel.prev}
                aria-label="Предыдущие игры"
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
                          <div className="game-detail-page__recent-no-cover">Нет изображения</div>
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
                aria-label="Следующие игры"
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

