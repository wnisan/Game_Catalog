import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPopularGames, type Game } from '../../services/api';
import { useInfiniteCarousel } from '../../hooks/useInfiniteCarousel';
import './PopularGames.css';

const PopularGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const VISIBLE_CARDS = 5;
  const CARD_WIDTH = 220;

  const { index, next, prev, trackRef, withTransition } = useInfiniteCarousel(games.length, VISIBLE_CARDS);

  const extendedGames = useMemo(() => [
    ...games.slice(-VISIBLE_CARDS),
    ...games,
    ...games.slice(0, VISIBLE_CARDS)
  ], [games]);

  const getCoverUrl = useMemo(() => (coverUrl?: string): string | null => {
    if (!coverUrl) return null;
    if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
      return coverUrl;
    }
    const imageId = coverUrl.split('/').pop()?.replace('.jpg', '').replace('.png', '');
    if (imageId) {
      return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
    }
    return null;
  }, []);

  const getGenreTags = useMemo(() => (genres?: Array<{ id: number; name: string } | undefined | null>) => {
    if (!genres) return [];
    return genres
      .filter((genre): genre is { id: number; name: string } => genre !== undefined && genre !== null && genre.name !== undefined)
      .slice(0, 3)
      .map(genre => (
        <span key={genre.id} className="popular-games__genre-tag">
          {genre.name}
        </span>
      ));
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getPopularGames(20);
        setGames(data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading || games.length === 0) return null;

  return (
    <section className="popular-games">
      <div className="popular-games__header">
        <h2>Popular Games</h2>
      </div>

      <div className="popular-games__carousel">
        <button
          className="popular-games__nav popular-games__nav--prev"
          onClick={prev}
          aria-label="Previous games"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="popular-games__window">
          <div
            ref={trackRef}
            className="popular-games__track"
            style={{
              transform: `translateX(-${index * CARD_WIDTH}px)`,
              transition: withTransition ? 'transform 0.4s ease' : 'none'
            }}
          >
            {extendedGames.map((g, idx) => {
              const coverUrl = getCoverUrl(g.cover?.url);
              return (
                <div
                  key={`${g.id}-${idx}`}
                  className="popular-games__item"
                  onClick={() => navigate(`/game/${g.slug || g.id}`)}
                >
                  <div className="popular-games__media">
                    {coverUrl ? (
                      <img src={coverUrl} alt={g.name} />
                    ) : (
                      <div className="popular-games__no-cover">No image</div>
                    )}
                  </div>
                  <div className="popular-games__content">
                    <div className="popular-games__title">{g.name}</div>
                    {g.rating !== undefined && (
                      <div className="popular-games__rating">
                        {Math.round(g.rating)}/100
                      </div>
                    )}
                    {g.genres && g.genres.length > 0 && (
                      <div className="popular-games__genres">
                        {getGenreTags(g.genres)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <button
          className="popular-games__nav popular-games__nav--next"
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

export default PopularGames;