import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getPublicProfile,
  type PublicProfile,
  api,
  getPopularGames,
  type Game,
} from '../services/api';
import { useInfiniteCarousel } from '../hooks/useInfiniteCarousel';
import './PublicProfilePage.css';

function avatarColor(name: string): string {
  const colors = [
    '#7c3aed',
    '#2563eb',
    '#059669',
    '#d97706',
    '#dc2626',
    '#db2777',
    '#0891b2',
    '#65a30d',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: 'Администратор', color: '#f85149' },
  seller: { label: 'Продавец', color: '#f0883e' },
  buyer: { label: 'Покупатель', color: '#58a6ff' },
};

const PublicProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<any[]>([]);
  const [listingsPage, setListingsPage] = useState(0);

  const [listingGameNames, setListingGameNames] = useState<
    Record<number, string>
  >({});
  const [listingGameCovers, setListingGameCovers] = useState<
    Record<number, string>
  >({});
  const [listingGameSlugs, setListingGameSlugs] = useState<
    Record<number, string | number>
  >({});

  const [reviewGameNames, setReviewGameNames] = useState<
    Record<number, string>
  >({});
  const [reviewGameSlugs, setReviewGameSlugs] = useState<
    Record<number, string | number>
  >({});

  const [popularGames, setPopularGames] = useState<Game[]>([]);
  const [recentGames, setRecentGames] = useState<Game[]>([]);

  const VISIBLE = 5;
  const CARD_W = 220;
  const popularCarousel = useInfiniteCarousel(popularGames.length, VISIBLE);
  const recentCarousel = useInfiniteCarousel(recentGames.length, VISIBLE);

  const extendedPopular =
    popularGames.length > 0
      ? [
          ...popularGames.slice(-VISIBLE),
          ...popularGames,
          ...popularGames.slice(0, VISIBLE),
        ]
      : [];
  const extendedRecent =
    recentGames.length > 0
      ? [
          ...recentGames.slice(-VISIBLE),
          ...recentGames,
          ...recentGames.slice(0, VISIBLE),
        ]
      : [];

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getPublicProfile(parseInt(id))
      .then(async (p) => {
        setProfile(p);
        if (p?.role === 'seller') {
          const rv = await api
            .get(`/reviews/seller/${id}`)
            .then((r) => r.data.reviews || [])
            .catch(() => []);
          setReviews(rv);

          if (rv.length > 0) {
            const ids = [...new Set(rv.map((r: any) => r.igdb_game_id))];
            try {
              const res = await api.post('/games/bulk', { ids });
              const names: Record<number, string> = {};
              const slugs: Record<number, string | number> = {};
              (res.data.games || []).forEach((g: any) => {
                names[g.id] = g.name;
                slugs[g.id] = g.slug || g.id;
              });
              setReviewGameNames(names);
              setReviewGameSlugs(slugs);
            } catch {}
          }

          if (p.seller?.listings && p.seller.listings.length > 0) {
            const ids = [
              ...new Set(p.seller.listings.map((l: any) => l.igdb_game_id)),
            ];
            try {
              const res = await api.post('/games/bulk', { ids });
              const names: Record<number, string> = {};
              const covers: Record<number, string> = {};
              const slugs: Record<number, string | number> = {};
              (res.data.games || []).forEach((g: any) => {
                names[g.id] = g.name;
                slugs[g.id] = g.slug || g.id;
                if (g.cover?.url) {
                  const imageId = g.cover.url
                    .split('/')
                    .pop()
                    ?.replace(/\.(jpg|png)$/, '');
                  covers[g.id] =
                    `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
                }
              });
              setListingGameNames(names);
              setListingGameCovers(covers);
              setListingGameSlugs(slugs);
            } catch {}
          }
        }

        if (p?.role === 'buyer') {
          getPopularGames(20)
            .then(setPopularGames)
            .catch(() => {});

          api
            .get('/games/recently-visited')
            .then((r) => setRecentGames(r.data.games || []))
            .catch(() => {});
        }
      })
      .catch(() => setError('Пользователь не найден'))
      .finally(() => setLoading(false));
  }, [id]);

  const getCoverUrl = (url?: string) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const imageId = url
      .split('/')
      .pop()
      ?.replace(/\.(jpg|png)$/, '');
    return imageId
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`
      : null;
  };

  if (loading)
    return (
      <div className="pp-page">
        <div className="pp-container">
          <p className="pp-muted">Загрузка...</p>
        </div>
      </div>
    );

  if (error || !profile) {
    return (
      <div className="pp-page">
        <div className="pp-container">
          <div className="pp-card">
            <p className="pp-muted">Пользователь не найден.</p>
            <Link to="/explore" className="pp-link">
              Назад к обзору
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const roleInfo = ROLE_LABELS[profile.role] || ROLE_LABELS.buyer;
  const color = avatarColor(profile.name);

  const listings = profile.seller?.listings || [];
  const totalPages = Math.ceil(listings.length / 14);
  const page = Math.min(listingsPage, Math.max(0, totalPages - 1));
  const listingsSlice = listings.slice(page * 14, (page + 1) * 14);

  return (
    <div className="pp-page">
      <div className="pp-container">
        {}
        <div className="pp-card pp-profile-card">
          <div className="pp-avatar" style={{ background: color }}>
            {initials(profile.name)}
          </div>
          <div className="pp-profile-info">
            <div className="pp-profile-top">
              <h1 className="pp-name">
                {profile.role === 'seller' && profile.seller
                  ? profile.seller.display_name
                  : profile.name}
              </h1>
              <span
                className="pp-role-badge"
                style={{
                  background: roleInfo.color + '22',
                  color: roleInfo.color,
                  border: `1px solid ${roleInfo.color}55`,
                }}
              >
                {roleInfo.label}
              </span>
              {profile.seller?.is_verified && (
                <span className="pp-verified">✓ Проверенный продавец</span>
              )}
            </div>
            {profile.email && <p className="pp-email">{profile.email}</p>}
            <p className="pp-joined">
              Участник с{' '}
              {new Date(profile.created_at).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
              })}
            </p>
          </div>
        </div>

        {}
        {profile.role === 'seller' && profile.seller && (
          <>
            <div className="pp-card pp-seller-stats">
              <div className="pp-stat">
                <span className="pp-stat-value">
                  {profile.seller.rating > 0
                    ? profile.seller.rating.toFixed(1)
                    : '—'}
                </span>
                <span className="pp-stat-label">Рейтинг</span>
              </div>
              <div className="pp-stat-divider" />
              <div className="pp-stat">
                <span className="pp-stat-value">
                  {profile.seller.total_sales}
                </span>
                <span className="pp-stat-label">Продажи</span>
              </div>
              <div className="pp-stat-divider" />
              <div className="pp-stat">
                <span className="pp-stat-value">{listings.length}</span>
                <span className="pp-stat-label">Лоты</span>
              </div>
            </div>

            {profile.seller.description && (
              <div className="pp-card">
                <h2 className="pp-section-title">О продавце</h2>
                <p className="pp-description">{profile.seller.description}</p>
              </div>
            )}

            {}
            {listings.length > 0 && (
              <div className="pp-card">
                <h2 className="pp-section-title">
                  Игры на продажу
                  <span className="pp-count">{listings.length}</span>
                </h2>
                <div className="pp-listings-grid">
                  {listingsSlice.map((listing: any) => (
                    <Link
                      key={listing.id}
                      to={`/game/${listingGameSlugs[listing.igdb_game_id] || listing.igdb_game_id}`}
                      className="pp-listing-card"
                    >
                      {listingGameCovers[listing.igdb_game_id] ? (
                        <img
                          className="pp-listing-cover"
                          src={listingGameCovers[listing.igdb_game_id]}
                          alt={listingGameNames[listing.igdb_game_id] || ''}
                        />
                      ) : (
                        <div className="pp-listing-cover pp-listing-cover--empty">
                          🎮
                        </div>
                      )}
                      <div className="pp-listing-info">
                        <span className="pp-listing-name">
                          {listingGameNames[listing.igdb_game_id] ||
                            `#${listing.igdb_game_id}`}
                        </span>
                        <span className="pp-listing-price">
                          ${parseFloat(listing.price).toFixed(2)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="pp-pagination">
                    <button
                      className="pp-page-btn"
                      onClick={() => setListingsPage(0)}
                      disabled={page === 0}
                    >
                      «
                    </button>
                    <button
                      className="pp-page-btn"
                      onClick={() => setListingsPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      ‹
                    </button>
                    <span className="pp-page-info">
                      {page + 1} / {totalPages}
                    </span>
                    <button
                      className="pp-page-btn"
                      onClick={() =>
                        setListingsPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={page === totalPages - 1}
                    >
                      ›
                    </button>
                    <button
                      className="pp-page-btn"
                      onClick={() => setListingsPage(totalPages - 1)}
                      disabled={page === totalPages - 1}
                    >
                      »
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="pp-card">
              <h2 className="pp-section-title">
                Отзывы
                {reviews.length > 0 && (
                  <span className="pp-count">{reviews.length}</span>
                )}
              </h2>
              {reviews.length === 0 ? (
                <p className="pp-muted">Пока нет отзывов.</p>
              ) : (
                <div className="pp-reviews">
                  {reviews.map((r) => (
                    <div key={r.id} className="pp-review-item">
                      <div className="pp-review-top">
                        <span className="pp-review-stars">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <span
                              key={s}
                              className={
                                s <= r.rating
                                  ? 'pp-star pp-star--on'
                                  : 'pp-star'
                              }
                            >
                              ★
                            </span>
                          ))}
                        </span>
                        <Link
                          to={`/profile/${r.buyer_id}`}
                          className="pp-review-buyer"
                        >
                          {r.buyer_name}
                        </Link>
                        <span className="pp-review-date">
                          {new Date(r.created_at).toLocaleDateString('ru-RU', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      {r.review && <p className="pp-review-text">{r.review}</p>}
                      <Link
                        to={`/game/${reviewGameSlugs[r.igdb_game_id] || r.igdb_game_id}`}
                        className="pp-review-game-link"
                      >
                        {reviewGameNames[r.igdb_game_id] ||
                          `Game #${r.igdb_game_id}`}
                      </Link>
                      {r.seller_reply && (
                        <div className="pp-review-reply">
                          <span className="pp-review-reply-label">
                            {profile.seller?.display_name || 'Продавец'}{' '}
                            (Продавец):
                          </span>
                          <p>{r.seller_reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {profile.role === 'buyer' && (
          <>
            {popularGames.length > 0 && (
              <div className="pp-section">
                <h2 className="pp-section-title pp-section-title--standalone">
                  Популярные игры
                </h2>
                <div className="pp-carousel">
                  <button
                    className="pp-carousel-nav"
                    onClick={popularCarousel.prev}
                    aria-label="Предыдущие"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <div className="pp-carousel-window">
                    <div
                      ref={popularCarousel.trackRef}
                      className="pp-carousel-track"
                      style={{
                        transform: `translateX(-${popularCarousel.index * CARD_W}px)`,
                        transition: popularCarousel.withTransition
                          ? 'transform 0.4s ease'
                          : 'none',
                      }}
                    >
                      {extendedPopular.map((g, idx) => {
                        const cover = getCoverUrl(g.cover?.url);
                        return (
                          <div
                            key={`${g.id}-${idx}`}
                            className="pp-carousel-item"
                            onClick={() => navigate(`/game/${g.slug || g.id}`)}
                          >
                            {cover ? (
                              <img src={cover} alt={g.name} />
                            ) : (
                              <div className="pp-carousel-no-cover">
                                Нет изображения
                              </div>
                            )}
                            <div className="pp-carousel-info">
                              <span className="pp-carousel-title">
                                {g.name}
                              </span>
                              {g.rating !== undefined && (
                                <span className="pp-carousel-rating">
                                  {Math.round(g.rating)}/100
                                </span>
                              )}
                              {g.genres && g.genres.length > 0 && (
                                <div className="pp-carousel-genres">
                                  {g.genres
                                    .filter((genre: any) => genre?.name)
                                    .slice(0, 3)
                                    .map((genre: any) => (
                                      <span
                                        key={genre.id}
                                        className="pp-carousel-genre-tag"
                                      >
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
                    className="pp-carousel-nav"
                    onClick={popularCarousel.next}
                    aria-label="Следующие"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {recentGames.length > 0 && (
              <div className="pp-section">
                <h2 className="pp-section-title pp-section-title--standalone">
                  Недавно просмотренные
                </h2>
                <div className="pp-carousel">
                  <button
                    className="pp-carousel-nav"
                    onClick={recentCarousel.prev}
                    aria-label="Предыдущие"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <div className="pp-carousel-window">
                    <div
                      ref={recentCarousel.trackRef}
                      className="pp-carousel-track"
                      style={{
                        transform: `translateX(-${recentCarousel.index * CARD_W}px)`,
                        transition: recentCarousel.withTransition
                          ? 'transform 0.4s ease'
                          : 'none',
                      }}
                    >
                      {extendedRecent.map((g, idx) => {
                        const cover = getCoverUrl(g.cover?.url);
                        return (
                          <div
                            key={`${g.id}-${idx}`}
                            className="pp-carousel-item"
                            onClick={() => navigate(`/game/${g.slug || g.id}`)}
                          >
                            {cover ? (
                              <img src={cover} alt={g.name} />
                            ) : (
                              <div className="pp-carousel-no-cover">
                                Нет изображения
                              </div>
                            )}
                            <div className="pp-carousel-info">
                              <span className="pp-carousel-title">
                                {g.name}
                              </span>
                              {g.rating !== undefined && (
                                <span className="pp-carousel-rating">
                                  {Math.round(g.rating)}/100
                                </span>
                              )}
                              {g.genres && g.genres.length > 0 && (
                                <div className="pp-carousel-genres">
                                  {g.genres
                                    .filter((genre: any) => genre?.name)
                                    .slice(0, 3)
                                    .map((genre: any) => (
                                      <span
                                        key={genre.id}
                                        className="pp-carousel-genre-tag"
                                      >
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
                    className="pp-carousel-nav"
                    onClick={recentCarousel.next}
                    aria-label="Следующие"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PublicProfilePage;
