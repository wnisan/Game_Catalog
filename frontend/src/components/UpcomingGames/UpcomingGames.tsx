import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUpcomingGames, type Game } from '../../services/api';
import { useInfiniteCarousel } from '../../hooks/useInfiniteCarousel';
import './UpcomingGames.css';

const formatCountdown = (targetIso?: string, nowTick?: number) => {
  if (!targetIso) return null;
  const now = nowTick || Date.now();
  const target = new Date(targetIso).getTime();
  const diff = Math.max(0, target - now);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
};

const UpcomingGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [nowTick, setNowTick] = useState(Date.now());
  const navigate = useNavigate();

  const VISIBLE_CARDS = 5;
  const CARD_WIDTH = 250;

  const { index, next, prev, trackRef, withTransition } = useInfiniteCarousel(games.length, VISIBLE_CARDS);

  useEffect(() => {
    const load = async () => {
      const data = await getUpcomingGames(50);
      setGames(data || []);
    };
    load();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const getCoverUrl = (coverUrl?: string): string | null => {
    if (!coverUrl) return null;
    if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
      return coverUrl;
    }
    const imageId = coverUrl.split('/').pop()?.replace('.jpg', '').replace('.png', '');
    if (imageId) {
      return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
    }
    return null;
  };

  if (games.length === 0) return null;

  const extendedGames = [
    ...games.slice(-VISIBLE_CARDS),
    ...games,
    ...games.slice(0, VISIBLE_CARDS)
  ];

  return (
    <section className="upcoming-games">
      <div className="upcoming-games__header">
        <h2>Soon</h2>
      </div>

      <div className="upcoming-games__carousel">
        <button
          className="upcoming-games__nav upcoming-games__nav--prev"
          onClick={prev}
          aria-label="Previous games"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="upcoming-games__window">
          <div
            ref={trackRef}
            className="upcoming-games__track"
            style={{
              transform: `translateX(-${index * CARD_WIDTH}px)`,
              transition: withTransition ? 'transform 0.4s ease' : 'none'
            }}
          >
            {extendedGames.map((g, idx) => {
              const c = formatCountdown(g.releaseDate, nowTick);
              const coverUrl = getCoverUrl(g.cover?.url);
              return (
                <div
                  key={`${g.id}-${idx}`}
                  className="upcoming-games__item"
                  onClick={() => navigate(`/game/${g.slug || g.id}`)}
                >
                  <div className="upcoming-games__media">
                    {coverUrl ? (
                      <img src={coverUrl} alt={g.name} />
                    ) : (
                      <div className="upcoming-games__no-cover">No image</div>
                    )}
                    {c && (
                      <div className="upcoming-games__timer">
                        <div className="upcoming-games__timer-item">
                          <span className="upcoming-games__timer-value">{c.days}</span>
                          <span className="upcoming-games__timer-label">days</span>
                        </div>

                        <div className="upcoming-games__timer-item">
                          <span className="upcoming-games__timer-value">{String(c.hours).padStart(2, '0')}</span>
                          <span className="upcoming-games__timer-label">hours</span>
                        </div>

                        <div className="upcoming-games__timer-item">
                          <span className="upcoming-games__timer-value">{String(c.minutes).padStart(2, '0')}</span>
                          <span className="upcoming-games__timer-label">minutes</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="upcoming-games__title">{g.name}</div>
                </div>
              );
            })}
          </div>
        </div>
        <button
          className="upcoming-games__nav upcoming-games__nav--next"
          onClick={next}
          aria-label="Next games"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </section>
  );
};

export default UpcomingGames;