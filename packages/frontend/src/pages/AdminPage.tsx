import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  adminGetUsers,
  adminBanUser,
  adminSetRole,
  adminGetHiddenGames,
  adminUnhideGame,
  adminHideGame,
  updateListingPrice,
  type AdminUser,
} from '../services/api';
import { api } from '../services/api';
import './AdminPage.css';

type Tab = 'users' | 'hidden' | 'listings';

const ROLES = ['buyer', 'seller', 'admin'];
const ROLE_DISPLAY: Record<string, string> = {
  buyer: 'Покупатель',
  seller: 'Продавец',
  admin: 'Администратор',
};

const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('users');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [hiddenGames, setHiddenGames] = useState<any[]>([]);
  const [hiddenLoading, setHiddenLoading] = useState(false);

  const [hideGameId, setHideGameId] = useState('');
  const [hideReason, setHideReason] = useState('');
  const [hideLoading, setHideLoading] = useState(false);

  const [listings, setListings] = useState<any[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [editPriceId, setEditPriceId] = useState<number | null>(null);
  const [editPriceVal, setEditPriceVal] = useState('');
  const [editPriceLoading, setEditPriceLoading] = useState(false);
  const [listingSearch, setListingSearch] = useState('');
  const [listingsPage, setListingsPage] = useState(0);
  const LISTINGS_PAGE_SIZE = 20;

  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    loadUsers();
  }, [user]);

  useEffect(() => {
    if (tab === 'hidden' && hiddenGames.length === 0) loadHidden();
    if (tab === 'listings' && listings.length === 0) loadListings();
  }, [tab]);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      setUsers(await adminGetUsers());
    } catch {
      setActionMsg('Не удалось загрузить пользователей');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadHidden = async () => {
    setHiddenLoading(true);
    try {
      setHiddenGames(await adminGetHiddenGames());
    } catch {
      setActionMsg('Не удалось загрузить скрытые игры');
    } finally {
      setHiddenLoading(false);
    }
  };

  const loadListings = async () => {
    setListingsLoading(true);
    try {
      const r = await api.get('/admin/listings');
      setListings(r.data.listings || []);
    } catch {
      setActionMsg('Не удалось загрузить объявления');
    } finally {
      setListingsLoading(false);
    }
  };

  const handleUpdateListingPrice = async (listingId: number) => {
    const price = parseFloat(editPriceVal);
    if (isNaN(price) || price <= 0) return;
    setEditPriceLoading(true);
    try {
      await updateListingPrice(listingId, price);
      setListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, price } : l))
      );
      setEditPriceId(null);
      flash('Цена обновлена');
    } catch {
      flash('Не удалось обновить цену');
    } finally {
      setEditPriceLoading(false);
    }
  };

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleBan = async (u: AdminUser) => {
    try {
      await adminBanUser(u.id, !u.is_banned);
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, is_banned: !u.is_banned } : x))
      );
      flash(u.is_banned ? `${u.name} разбанен` : `${u.name} заблокирован`);
    } catch {
      flash('Действие не удалось');
    }
  };

  const handleRole = async (u: AdminUser, role: string) => {
    try {
      await adminSetRole(u.id, role);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
      flash(`${u.name} → ${ROLE_DISPLAY[role] ?? role}`);
    } catch {
      flash('Действие не удалось');
    }
  };

  const handleUnhide = async (igdbGameId: number) => {
    try {
      await adminUnhideGame(igdbGameId);
      setHiddenGames((prev) =>
        prev.filter((g) => g.igdb_game_id !== igdbGameId)
      );
      flash('Игра разблокирована');
    } catch {
      flash('Действие не удалось');
    }
  };

  const handleHide = async () => {
    const id = parseInt(hideGameId);
    if (!id || isNaN(id)) return flash('Введите корректный IGDB game ID');
    setHideLoading(true);
    try {
      await adminHideGame(id, hideReason.trim());
      setHideGameId('');
      setHideReason('');

      setHiddenGames(await adminGetHiddenGames());
      flash(`Игра №${id} скрыта`);
    } catch {
      flash('Действие не удалось');
    } finally {
      setHideLoading(false);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="ap-page">
      <div className="ap-container">
        <div className="ap-header">
          <h1 className="ap-title">Панель администратора</h1>
          <span className="ap-badge">Администратор</span>
        </div>

        {actionMsg && <div className="ap-flash">{actionMsg}</div>}

        <div className="ap-tabs">
          <button
            className={`ap-tab ${tab === 'users' ? 'ap-tab-active' : ''}`}
            onClick={() => setTab('users')}
          >
            Пользователи{' '}
            {users.length > 0 && (
              <span className="ap-tab-count">{users.length}</span>
            )}
          </button>
          <button
            className={`ap-tab ${tab === 'listings' ? 'ap-tab-active' : ''}`}
            onClick={() => setTab('listings')}
          >
            Объявления
          </button>
          <button
            className={`ap-tab ${tab === 'hidden' ? 'ap-tab-active' : ''}`}
            onClick={() => setTab('hidden')}
          >
            Скрытые игры{' '}
            {hiddenGames.length > 0 && (
              <span className="ap-tab-count">{hiddenGames.length}</span>
            )}
          </button>
        </div>

        {}
        {tab === 'users' && (
          <div className="ap-card">
            <div className="ap-search-row">
              <input
                className="ap-search"
                placeholder="Поиск по имени или почте..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {usersLoading ? (
              <p className="ap-muted">Загрузка...</p>
            ) : filtered.length === 0 ? (
              <p className="ap-muted">Пользователи не найдены.</p>
            ) : (
              <div className="ap-table-wrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Имя</th>
                      <th>Почта</th>
                      <th>Роль</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr
                        key={u.id}
                        className={u.is_banned ? 'ap-row-banned' : ''}
                      >
                        <td className="ap-id">#{u.id}</td>
                        <td className="ap-name">{u.name}</td>
                        <td className="ap-email-cell">{u.email}</td>
                        <td>
                          <select
                            className="ap-role-select"
                            value={u.role}
                            onChange={(e) => handleRole(u, e.target.value)}
                            disabled={u.id === user.id}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_DISPLAY[r] ?? r}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span
                            className={`ap-status ${u.is_banned ? 'ap-status-banned' : 'ap-status-active'}`}
                          >
                            {u.is_banned ? 'Заблокирован' : 'Активен'}
                          </span>
                        </td>
                        <td>
                          <button
                            className={`ap-action-btn ${u.is_banned ? 'ap-unban' : 'ap-ban'}`}
                            onClick={() => handleBan(u)}
                            disabled={u.id === user.id}
                          >
                            {u.is_banned ? 'Разблокировать' : 'Заблокировать'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {}
        {tab === 'listings' && (
          <div className="ap-card">
            <div className="ap-search-row">
              <input
                className="ap-search"
                placeholder="Поиск по ID игры или продавцу..."
                value={listingSearch}
                onChange={(e) => {
                  setListingSearch(e.target.value);
                  setListingsPage(0);
                }}
              />
              <span className="ap-muted" style={{ fontSize: 13 }}>
                Всего: {listings.length}
              </span>
            </div>
            {listingsLoading ? (
              <p className="ap-muted">Загрузка...</p>
            ) : listings.length === 0 ? (
              <p className="ap-muted">Объявления не найдены.</p>
            ) : (
              (() => {
                const filtered = listings.filter(
                  (l) =>
                    !listingSearch ||
                    String(l.igdb_game_id).includes(listingSearch) ||
                    l.seller_name
                      ?.toLowerCase()
                      .includes(listingSearch.toLowerCase())
                );
                const totalPages = Math.ceil(
                  filtered.length / LISTINGS_PAGE_SIZE
                );
                const page = Math.min(
                  listingsPage,
                  Math.max(0, totalPages - 1)
                );
                const slice = filtered.slice(
                  page * LISTINGS_PAGE_SIZE,
                  (page + 1) * LISTINGS_PAGE_SIZE
                );
                return (
                  <>
                    <div className="ap-table-wrap">
                      <table className="ap-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>ID игры</th>
                            <th>Продавец</th>
                            <th>Цена</th>
                            <th>Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slice.map((l) => (
                            <tr key={l.id}>
                              <td className="ap-id">#{l.id}</td>
                              <td className="ap-id">#{l.igdb_game_id}</td>
                              <td className="ap-name">{l.seller_name}</td>
                              <td>
                                {editPriceId === l.id ? (
                                  <div className="ap-hide-row">
                                    <input
                                      className="ap-search"
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={editPriceVal}
                                      onChange={(e) =>
                                        setEditPriceVal(e.target.value)
                                      }
                                      style={{ width: 90 }}
                                      autoFocus
                                    />
                                    <button
                                      className="ap-action-btn ap-unban"
                                      disabled={editPriceLoading}
                                      onClick={() =>
                                        handleUpdateListingPrice(l.id)
                                      }
                                    >
                                      {editPriceLoading ? '...' : 'Сохранить'}
                                    </button>
                                    <button
                                      className="ap-action-btn"
                                      onClick={() => setEditPriceId(null)}
                                    >
                                      Отмена
                                    </button>
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      color: '#3fb950',
                                      fontWeight: 700,
                                    }}
                                  >
                                    ${parseFloat(l.price).toFixed(2)}
                                  </span>
                                )}
                              </td>
                              <td>
                                {editPriceId !== l.id && (
                                  <button
                                    className="ap-action-btn ap-ban"
                                    onClick={() => {
                                      setEditPriceId(l.id);
                                      setEditPriceVal(
                                        parseFloat(l.price).toFixed(2)
                                      );
                                    }}
                                  >
                                    Изменить цену
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="ap-pagination">
                        <button
                          className="ap-page-btn"
                          onClick={() => setListingsPage(0)}
                          disabled={page === 0}
                        >
                          «
                        </button>
                        <button
                          className="ap-page-btn"
                          onClick={() =>
                            setListingsPage((p) => Math.max(0, p - 1))
                          }
                          disabled={page === 0}
                        >
                          ‹
                        </button>
                        <span className="ap-page-info">
                          {page + 1} / {totalPages} ({filtered.length} поз.)
                        </span>
                        <button
                          className="ap-page-btn"
                          onClick={() =>
                            setListingsPage((p) =>
                              Math.min(totalPages - 1, p + 1)
                            )
                          }
                          disabled={page === totalPages - 1}
                        >
                          ›
                        </button>
                        <button
                          className="ap-page-btn"
                          onClick={() => setListingsPage(totalPages - 1)}
                          disabled={page === totalPages - 1}
                        >
                          »
                        </button>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}

        {}
        {tab === 'hidden' && (
          <div className="ap-card">
            <div className="ap-hide-form">
              <h3 className="ap-hide-title">Скрыть игру</h3>
              <div className="ap-hide-row">
                <input
                  className="ap-search"
                  placeholder="ID игры (IGDB)"
                  value={hideGameId}
                  onChange={(e) => setHideGameId(e.target.value)}
                  style={{ width: 140 }}
                />
                <input
                  className="ap-search"
                  placeholder="Причина (необязательно)"
                  value={hideReason}
                  onChange={(e) => setHideReason(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="ap-action-btn ap-ban"
                  onClick={handleHide}
                  disabled={hideLoading || !hideGameId}
                >
                  {hideLoading ? '...' : 'Скрыть'}
                </button>
              </div>
            </div>

            {hiddenLoading ? (
              <p className="ap-muted">Загрузка...</p>
            ) : hiddenGames.length === 0 ? (
              <p className="ap-muted">Нет скрытых игр.</p>
            ) : (
              <div className="ap-table-wrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>ID игры</th>
                      <th>Причина</th>
                      <th>Скрыто админом</th>
                      <th>Дата</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hiddenGames.map((g) => (
                      <tr key={g.igdb_game_id}>
                        <td className="ap-id">#{g.igdb_game_id}</td>
                        <td>{g.reason || '—'}</td>
                        <td>{g.hidden_by_name}</td>
                        <td className="ap-date">
                          {new Date(g.hidden_at).toLocaleDateString()}
                        </td>
                        <td>
                          <button
                            className="ap-action-btn ap-unban"
                            onClick={() => handleUnhide(g.igdb_game_id)}
                          >
                            Разблокировать
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
