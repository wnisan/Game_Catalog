import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, getMyBalance, getMyOrders, getPublicProfile, updateListingPrice } from '../services/api';
import type { PublicProfile } from '../services/api';
import TopUpModal from '../components/TopUpModal/TopUpModal';
import './UserPage.css';

function avatarColor(name: string): string {
    const colors = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777', '#0891b2', '#65a30d'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    admin: { label: 'Администратор', color: '#f85149' },
    seller: { label: 'Продавец', color: '#f0883e' },
    buyer: { label: 'Покупатель', color: '#58a6ff' },
};

const UserPage: React.FC = () => {
    const { user, refreshUser, logout } = useAuth();
    const navigate = useNavigate();

    const [editMode, setEditMode] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [balance, setBalance] = useState<number | null>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [profile, setProfile] = useState<PublicProfile | null>(null);
    const [showTopUp, setShowTopUp] = useState(false);
    const [sellerOrders, setSellerOrders] = useState<any[]>([]);
    const [sellerOrdersLoading, setSellerOrdersLoading] = useState(false);
    const [sendKeyOrderId, setSendKeyOrderId] = useState<number | null>(null);
    const [gameKeyInput, setGameKeyInput] = useState('');
    const [orderActionLoading, setOrderActionLoading] = useState<number | null>(null);
    const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewText, setReviewText] = useState('');
    const [reviewLoading, setReviewLoading] = useState(false);

    const [showDelete, setShowDelete] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');

    const [editPriceListingId, setEditPriceListingId] = useState<number | null>(null);
    const [editPriceValue, setEditPriceValue] = useState('');
    const [editPriceLoading, setEditPriceLoading] = useState(false);

    const [sellerDescription, setSellerDescription] = useState('');
    const [editingDescription, setEditingDescription] = useState(false);
    const [descLoading, setDescLoading] = useState(false);

    const [sellerReviews, setSellerReviews] = useState<any[]>([]);
    const [replyingReviewId, setReplyingReviewId] = useState<number | null>(null);
    const [replyText, setReplyText] = useState('');
    const [replyLoading, setReplyLoading] = useState(false);
    const [reviewGameNames, setReviewGameNames] = useState<Record<number, string>>({});
    const [reviewGameSlugs, setReviewGameSlugs] = useState<Record<number, string | number>>({});

    const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());

    const [orderGameNames, setOrderGameNames] = useState<Record<number, string>>({});
    const [orderGameCovers, setOrderGameCovers] = useState<Record<number, string>>({});
    const [orderGameSlugs, setOrderGameSlugs] = useState<Record<number, string | number>>({});

    const [sellerOrderGameNames, setSellerOrderGameNames] = useState<Record<number, string>>({});
    const [sellerOrderGameCovers, setSellerOrderGameCovers] = useState<Record<number, string>>({});
    const [sellerOrderGameSlugs, setSellerOrderGameSlugs] = useState<Record<number, string | number>>({});

    const [listingGameNames, setListingGameNames] = useState<Record<number, string>>({});
    const [listingGameCovers, setListingGameCovers] = useState<Record<number, string>>({});

    const [myComments, setMyComments] = useState<any[]>([]);
    const [commentGames, setCommentGames] = useState<Record<number, any>>({});
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editingCommentText, setEditingCommentText] = useState('');

    const PAGE_SIZE = 6;
    const [listingsPage, setListingsPage] = useState(0);

    useEffect(() => {
        if (!user) return;
        setName(user.name || '');
        setEmail(user.email || '');

        const run = async () => {
            if (user.role !== 'admin') {
                getMyBalance(user.id).then(setBalance).catch(() => setBalance(0));
                setOrdersLoading(true);
                getMyOrders(user.id)
                    .then(async (data) => {
                        setOrders(data);
                        if (data.length > 0) {
                            const ids = [...new Set(data.map((o: any) => o.igdb_game_id))];
                            try {
                                const res = await api.post('/games/bulk', { ids });
                                const names: Record<number, string> = {};
                                const covers: Record<number, string> = {};
                                const slugs: Record<number, string | number> = {};
                                (res.data.games || []).forEach((g: any) => {
                                    names[g.id] = g.name;
                                    slugs[g.id] = g.slug || g.id;
                                    if (g.cover?.url) {
                                        const raw: string = g.cover.url;
                                        const imageId = raw.split('/').pop()?.replace(/\.(jpg|png)$/, '');
                                        covers[g.id] = `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
                                    }
                                });
                                setOrderGameNames(names);
                                setOrderGameCovers(covers);
                                setOrderGameSlugs(slugs);
                            } catch { }
                        }
                    })
                    .catch(() => setOrders([]))
                    .finally(() => setOrdersLoading(false));
            }

            if (user.role === 'seller') {
                setSellerOrdersLoading(true);
                api.get('/orders/selling')
                    .then(async r => {
                        const data = r.data.orders || [];
                        setSellerOrders(data);
                        if (data.length > 0) {
                            const ids = [...new Set(data.map((o: any) => o.igdb_game_id))];
                            try {
                                const res = await api.post('/games/bulk', { ids });
                                const names: Record<number, string> = {};
                                const covers: Record<number, string> = {};
                                const slugs: Record<number, string | number> = {};
                                (res.data.games || []).forEach((g: any) => {
                                    names[g.id] = g.name;
                                    slugs[g.id] = g.slug || g.id;
                                    if (g.cover?.url) {
                                        const raw: string = g.cover.url;
                                        const imageId = raw.split('/').pop()?.replace(/\.(jpg|png)$/, '');
                                        covers[g.id] = `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
                                    }
                                });
                                setSellerOrderGameNames(names);
                                setSellerOrderGameCovers(covers);
                                setSellerOrderGameSlugs(slugs);
                            } catch { }
                        }
                    })
                    .catch(() => setSellerOrders([]))
                    .finally(() => setSellerOrdersLoading(false));
            }

            getPublicProfile(user.id).then(async p => {
                setProfile(p);
                if (p?.seller?.listings && p.seller.listings.length > 0) {
                    const ids = [...new Set(p.seller.listings.map((l: any) => l.igdb_game_id))];
                    try {
                        const res = await api.post('/games/bulk', { ids });
                        const names: Record<number, string> = {};
                        const covers: Record<number, string> = {};
                        (res.data.games || []).forEach((g: any) => {
                            names[g.id] = g.name;
                            if (g.cover?.url) {
                                const imageId = g.cover.url.split('/').pop()?.replace(/\.(jpg|png)$/, '');
                                covers[g.id] = `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
                            }
                        });
                        setListingGameNames(names);
                        setListingGameCovers(covers);
                    } catch { }
                }
            }).catch(() => { });

            if (user.role === 'seller') {
                api.get(`/reviews/seller/${user.id}`)
                    .then(async r => {
                        const reviews = r.data.reviews || [];
                        setSellerReviews(reviews);
                        if (reviews.length > 0) {
                            const ids = [...new Set(reviews.map((rv: any) => rv.igdb_game_id))];
                            try {
                                const res = await api.post('/games/bulk', { ids });
                                const names: Record<number, string> = {};
                                const slugs: Record<number, string | number> = {};
                                (res.data.games || []).forEach((g: any) => { names[g.id] = g.name; slugs[g.id] = g.slug || g.id; });
                                setReviewGameNames(names);
                                setReviewGameSlugs(slugs);
                            } catch { }
                        }
                    })
                    .catch(() => { });
            }


            const { getUserComments, getGamesBulk } = await import('../services/api').catch(() => ({ getUserComments: null, getGamesBulk: null }));
            if (getUserComments && getGamesBulk) {
                getUserComments().then(async (comments: any[]) => {
                    setMyComments(comments);
                    const ids = [...new Set(comments.map((c: any) => c.game_id))];
                    if (ids.length > 0) {
                        const games = await getGamesBulk(ids as number[]).catch(() => []);
                        const map: Record<number, any> = {};
                        games.forEach((g: any) => { map[g.id] = g; });
                        setCommentGames(map);
                    }
                }).catch(() => { });
            }
        };
        run();
    }, [user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setSuccess('');
        if (!name.trim()) return setError('Имя обязательно');
        if (newPassword && !currentPassword) return setError('Требуется текущий пароль для смены пароля');
        if (newPassword && newPassword !== confirmPassword) return setError('Пароли не совпадают');
        setIsLoading(true);
        try {
            const body: any = { name: name.trim(), email: email.trim() };
            if (newPassword.trim()) {
                body.password = newPassword.trim();
                body.currentPassword = currentPassword.trim();
            }
            await api.put('/auth/me', body);
            setSuccess('Профиль обновлен!');
            await refreshUser();
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
            setEditMode(false);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Не удалось обновить профиль');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmOrder = async (orderId: number) => {
        setOrderActionLoading(orderId);
        try {
            await api.post(`/orders/${orderId}/confirm`);
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'completed' } : o));
        } catch (err: any) {
            alert(err.response?.data?.error || 'Не удалось подтвердить заказ');
        } finally { setOrderActionLoading(null); }
    };

    const handleCancelOrder = async (orderId: number) => {
        if (!window.confirm('Отменить этот заказ? Баланс будет возвращён.')) return;
        setOrderActionLoading(orderId);
        try {
            await api.post(`/orders/${orderId}/cancel`);
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o));
            getMyBalance(user!.id).then(setBalance).catch(() => { });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Не удалось отменить заказ');
        } finally { setOrderActionLoading(null); }
    };

    const handleSendKey = async (orderId: number) => {
        if (!gameKeyInput.trim()) return;
        setOrderActionLoading(orderId);
        try {
            await api.post(`/orders/${orderId}/send-key`, { gameKey: gameKeyInput.trim() });
            setSellerOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'key_sent', game_key: gameKeyInput.trim() } : o));
            setSendKeyOrderId(null);
            setGameKeyInput('');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Не удалось отправить ключ');
        } finally { setOrderActionLoading(null); }
    };

    const handleSubmitReview = async (order: any) => {
        setReviewLoading(true);
        try {
            await api.post('/reviews', {
                orderId: order.id,
                listingId: order.listing_id,
                sellerUserId: order.seller_user_id,
                rating: reviewRating,
                review: reviewText.trim(),
            });
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, has_review: 1 } : o));
            setReviewOrderId(null);
            setReviewText('');
            setReviewRating(5);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Не удалось отправить отзыв');
        } finally { setReviewLoading(false); }
    };

    const handleDelete = async () => {
        if (!deletePassword) return setDeleteError('Требуется пароль');
        if (!window.confirm('Удалить аккаунт? Это действие нельзя отменить.')) return;
        try {
            const { deleteAccount } = await import('../services/api');
            await deleteAccount(deletePassword);
            logout();
            navigate('/auth');
        } catch (err: any) {
            setDeleteError(err.response?.data?.error || 'Не удалось удалить аккаунт');
        }
    };

    const handleReplyToReview = async (reviewId: number) => {
        if (!replyText.trim()) return;
        setReplyLoading(true);
        try {
            await api.patch(`/reviews/${reviewId}/reply`, { reply: replyText.trim() });
            setSellerReviews(prev => prev.map(r => r.id === reviewId ? { ...r, seller_reply: replyText.trim() } : r));
            setReplyingReviewId(null);
            setReplyText('');
        } catch { }
        finally { setReplyLoading(false); }
    };

    const handleSaveDescription = async () => {
        setDescLoading(true);
        try {
            await api.patch('/sellers/description', { description: sellerDescription.trim() });
            setProfile(prev => prev?.seller ? { ...prev, seller: { ...prev.seller, description: sellerDescription.trim() } } : prev);
            setEditingDescription(false);
        } catch { }
        finally { setDescLoading(false); }
    };

    const handleUpdatePrice = async (listingId: number) => {
        const price = parseFloat(editPriceValue);
        if (isNaN(price) || price <= 0) return;
        setEditPriceLoading(true);
        try {
            await updateListingPrice(listingId, price);

            setProfile(prev => {
                if (!prev?.seller?.listings) return prev;
                return {
                    ...prev,
                    seller: {
                        ...prev.seller,
                        listings: prev.seller.listings.map(l =>
                            l.id === listingId ? { ...l, price } : l
                        ),
                    },
                };
            });
            setEditPriceListingId(null);
            setEditPriceValue('');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Не удалось обновить цену');
        } finally { setEditPriceLoading(false); }
    };

    if (!user) {
        return (
            <div className="up-page">
                <div className="up-container">
                    <div className="up-card">
                        <p className="up-muted">
                            Войдите, чтобы посмотреть ваш профиль: <Link to="/auth" className="up-link">вход</Link>.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const roleInfo = ROLE_LABELS[user.role || 'buyer'] || ROLE_LABELS.buyer;
    const color = avatarColor(user.name || 'U');
    const joinedDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' })
        : null;

    return (
        <div className="up-page">
            <div className="up-container">


                <div className="up-card">
                    <div className="up-profile-header">
                        <div className="up-avatar" style={{ background: color }}>
                            {initials(user.name || 'U')}
                        </div>
                        <div className="up-profile-meta">
                            <div className="up-profile-top">
                                <h1 className="up-name">
                                    {user.role === 'seller' && profile?.seller
                                        ? profile.seller.display_name
                                        : user.name}
                                </h1>
                                <span
                                    className="up-role-badge"
                                    style={{
                                        background: roleInfo.color + '22',
                                        color: roleInfo.color,
                                        border: `1px solid ${roleInfo.color}55`,
                                    }}
                                >
                                    {roleInfo.label}
                                </span>
                            </div>
                            <p className="up-email">{user.email}</p>
                            {joinedDate && <p className="up-joined">Участник с {joinedDate}</p>}
                        </div>
                        <button
                            className="up-edit-btn"
                            onClick={() => { setEditMode(!editMode); setError(''); setSuccess(''); }}
                        >
                            {editMode ? 'Отмена' : 'Редактировать профиль'}
                        </button>
                    </div>
                </div>


                {user.role === 'seller' && profile?.seller && (
                    <div className="up-card">
                        <div className="up-stats-row">
                            <div className="up-stat">
                                <span className="up-stat-value">
                                    {profile.seller.rating > 0 ? Number(profile.seller.rating).toFixed(1) : '—'}
                                </span>
                                <span className="up-stat-label">Рейтинг</span>
                            </div>
                            <div className="up-stat">
                                <span className="up-stat-value">{profile.seller.total_sales}</span>
                                <span className="up-stat-label">Продажи</span>
                            </div>
                            <div className="up-stat">
                                <span className="up-stat-value">{profile.seller.listings?.length ?? 0}</span>
                                <span className="up-stat-label">Лоты</span>
                            </div>
                        </div>
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #21262d' }}>
                            {editingDescription ? (
                                <div className="up-field">
                                    <label>Описание</label>
                                    <textarea
                                        rows={3}
                                        className="up-review-input"
                                        value={sellerDescription}
                                        onChange={e => setSellerDescription(e.target.value)}
                                    />
                                    <div className="up-form-actions" style={{ marginTop: 8 }}>
                                        <button className="up-confirm-btn" disabled={descLoading} onClick={handleSaveDescription}>{descLoading ? '...' : 'Сохранить'}</button>
                                        <button className="up-cancel-order-btn" onClick={() => setEditingDescription(false)}>Отмена</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    <p className="up-description" style={{ flex: 1, margin: 0 }}>
                                        {profile.seller.description || <span className="up-muted">Пока нет описания.</span>}
                                    </p>
                                    <button className="up-edit-price-btn" onClick={() => { setSellerDescription(profile.seller?.description || ''); setEditingDescription(true); }}>
                                        Изменить
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}


                {user.role !== 'admin' && (
                    <div className="up-card up-balance-card">
                        <div className="up-balance-left">
                            <span className="up-balance-label">Баланс</span>
                            <span className="up-balance-amount">
                                ${balance !== null ? balance.toFixed(2) : '—'}
                            </span>
                        </div>
                        <button className="up-topup-btn" type="button" onClick={() => setShowTopUp(true)}>
                            + Пополнить
                        </button>
                    </div>
                )}

                {showTopUp && (
                    <TopUpModal
                        onClose={() => setShowTopUp(false)}
                        onSuccess={(newBalance) => {
                            setBalance(newBalance);
                            setShowTopUp(false);
                        }}
                    />
                )}


                {editMode && (
                    <div className="up-card">
                        <h2 className="up-section-title">Редактировать профиль</h2>
                        <form className="up-form" onSubmit={handleSave}>
                            <div className="up-field">
                                <label>Имя</label>
                                <input value={name} onChange={e => setName(e.target.value)} disabled={isLoading} />
                            </div>
                            <div className="up-field">
                                <label>Почта</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading} />
                            </div>
                            <div className="up-divider" />
                            <p className="up-hint">Оставьте поля пароля пустыми, чтобы сохранить текущий пароль</p>
                            <div className="up-field">
                                <label>Текущий пароль</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    disabled={isLoading}
                                    placeholder="Обязательно только для смены пароля"
                                />
                            </div>
                            <div className="up-field">
                                <label>Новый пароль</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    disabled={isLoading}
                                    placeholder="Оставьте пустым, чтобы сохранить текущий"
                                />
                            </div>
                            {newPassword && (
                                <div className="up-field">
                                    <label>Подтвердите новый пароль</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            )}
                            {error && <div className="up-error">{error}</div>}
                            {success && <div className="up-success">{success}</div>}
                            <div className="up-form-actions">
                                <button type="submit" className="up-save-btn" disabled={isLoading}>
                                    {isLoading ? 'Сохраняем...' : 'Сохранить изменения'}
                                </button>
                                <button type="button" className="up-danger-btn" onClick={() => setShowDelete(!showDelete)}>
                                    Удалить аккаунт
                                </button>
                            </div>
                        </form>

                        {showDelete && (
                            <div className="up-delete-box">
                                <p className="up-delete-warning">
                                    Это навсегда удалит ваш аккаунт и все ваши данные.
                                </p>
                                <input
                                    type="password"
                                    placeholder="Введите пароль для подтверждения"
                                    value={deletePassword}
                                    onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                                    className="up-delete-input"
                                />
                                {deleteError && <div className="up-error">{deleteError}</div>}
                                <div className="up-form-actions">
                                    <button className="up-cancel-btn" onClick={() => setShowDelete(false)}>Отмена</button>
                                    <button className="up-danger-btn" onClick={handleDelete}>Подтвердить удаление</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {user.role !== 'seller' && (
                    <div className="up-card">
                        <h2 className="up-section-title">
                            Заказы
                            {orders.length > 0 && <span className="up-count">{orders.length}</span>}
                        </h2>
                        {ordersLoading ? (
                            <p className="up-muted">Загрузка...</p>
                        ) : orders.length === 0 ? (
                            <p className="up-muted">
                                Пока нет заказов.{' '}
                                <Link to="/explore" className="up-link">Просмотреть игры</Link>
                            </p>
                        ) : (
                            <div className="up-orders-list">
                                {orders.map(order => {
                                    const gameName = orderGameNames[order.igdb_game_id] || `Игра №${order.igdb_game_id}`;
                                    const gameCover = orderGameCovers[order.igdb_game_id];
                                    const gameSlug = orderGameSlugs[order.igdb_game_id] || order.igdb_game_id;
                                    const statusMap: Record<string, { label: string; color: string }> = {
                                        pending_key: { label: 'Ожидает ключ', color: '#f0883e' },
                                        key_sent: { label: 'Ключ отправлен', color: '#58a6ff' },
                                        completed: { label: 'Завершено', color: '#3fb950' },
                                        cancelled: { label: 'Отменено', color: '#f85149' },
                                    }; const st = statusMap[order.status] || { label: order.status, color: '#8b949e' };
                                    return (
                                        <div key={order.id} className="up-order-card">

                                            <Link to={`/game/${gameSlug}`} className="up-order-cover-link">
                                                {gameCover
                                                    ? <img className="up-order-cover" src={gameCover} alt={gameName} />
                                                    : <div className="up-order-cover up-order-cover--empty">🎮</div>
                                                }
                                            </Link>


                                            <div className="up-order-body">
                                                <div className="up-order-top">
                                                    <Link to={`/game/${gameSlug}`} className="up-order-game-name">{gameName}</Link>
                                                    <span className="up-order-price">${parseFloat(order.amount).toFixed(2)}</span>
                                                </div>
                                                <div className="up-order-meta">
                                                    <span className="up-order-id">Заказ №{order.id}</span>
                                                    <span className="up-order-dot">·</span>
                                                    <Link to={`/profile/${order.seller_user_id}`} className="up-order-seller-link">
                                                        {order.seller_name}
                                                    </Link>
                                                </div>


                                                {order.status === 'key_sent' && order.game_key && (
                                                    <div className="up-order-key-row">
                                                        <span className="up-order-key-label">🔑 Key:</span>
                                                        <code className="up-order-key">{order.game_key}</code>
                                                        <button className="up-confirm-btn" disabled={orderActionLoading === order.id} onClick={() => handleConfirmOrder(order.id)}>
                                                            {orderActionLoading === order.id ? '...' : 'Подтвердить'}
                                                        </button>
                                                    </div>
                                                )}


                                                {order.status === 'pending_key' && (
                                                    <button className="up-cancel-order-btn" disabled={orderActionLoading === order.id} onClick={() => handleCancelOrder(order.id)}>
                                                        {orderActionLoading === order.id ? '...' : 'Отмена и возврат'}
                                                    </button>
                                                )}


                                                {order.status === 'completed' && (order.game_key || !order.has_review) && (
                                                    <div className="up-order-key-row">
                                                        {order.game_key && (
                                                            <>
                                                                <span className="up-order-key-label">🔑 Steam-ключ:</span>
                                                                {revealedKeys.has(order.id) ? (
                                                                    <>
                                                                        <code className="up-order-key">{order.game_key}</code>
                                                                        <button className="up-cancel-order-btn" onClick={() => setRevealedKeys(prev => { const s = new Set(prev); s.delete(order.id); return s; })}>Скрыть</button>
                                                                    </>
                                                                ) : (
                                                                    <button className="up-confirm-btn" onClick={() => setRevealedKeys(prev => new Set(prev).add(order.id))}>Показать ключ</button>
                                                                )}
                                                            </>
                                                        )}
                                                        {!order.has_review && reviewOrderId !== order.id && (
                                                            <button className="up-review-btn" onClick={() => setReviewOrderId(order.id)}>★ Оставить отзыв</button>
                                                        )}
                                                    </div>
                                                )}


                                                {order.status === 'completed' && !order.has_review && reviewOrderId === order.id && (
                                                    <div className="up-review-form">
                                                        <div className="up-stars-row">
                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                <button key={s} type="button" className={`up-star ${reviewRating >= s ? 'up-star--active' : ''}`} onClick={() => setReviewRating(s)}>★</button>
                                                            ))}
                                                        </div>
                                                        <textarea className="up-review-input" placeholder="Напишите ваш отзыв (по желанию)..." value={reviewText} onChange={e => setReviewText(e.target.value)} rows={2} />
                                                        <div className="up-form-actions" style={{ marginTop: 8 }}>
                                                            <button className="up-confirm-btn" disabled={reviewLoading} onClick={() => handleSubmitReview(order)}>{reviewLoading ? '...' : 'Отправить'}</button>
                                                            <button className="up-cancel-order-btn" onClick={() => { setReviewOrderId(null); setReviewText(''); setReviewRating(5); }}>Отмена</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>


                                            <div className="up-order-status-col">
                                                <span className="up-order-status-badge" style={{ color: st.color, borderColor: st.color + '44', background: st.color + '18' }}>
                                                    {st.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}


                {user.role !== 'admin' && myComments.length > 0 && (
                    <div className="up-card">
                        <h2 className="up-section-title">
                            Мои комментарии
                            <span className="up-count">{myComments.length}</span>
                        </h2>
                        <div className="up-comments-list">
                            {myComments.map((comment: any) => {
                                const game = commentGames[comment.game_id];
                                const gameSlug = game?.slug || game?.id || comment.game_id;
                                const coverUrl = game?.cover?.url
                                    ? (() => { const id = game.cover.url.split('/').pop()?.replace(/\.(jpg|png)$/, ''); return `https://images.igdb.com/igdb/image/upload/t_cover_big/${id}.jpg`; })()
                                    : null;
                                return (
                                    <div key={comment.id} className="up-comment-item">
                                        {coverUrl
                                            ? <img className="up-comment-cover" src={coverUrl} alt={game?.name || ''} onClick={() => navigate(`/game/${gameSlug}`)} />
                                            : <div className="up-comment-cover up-comment-cover--empty" onClick={() => navigate(`/game/${gameSlug}`)}>🎮</div>
                                        }
                                        <div className="up-comment-body">
                                            <button className="up-comment-game-link" onClick={() => navigate(`/game/${gameSlug}`)}>
                                                {game?.name || `Игра №${comment.game_id}`}
                                            </button>
                                            {editingCommentId === comment.id ? (
                                                <>
                                                    <textarea className="up-review-input" rows={2} value={editingCommentText} onChange={e => setEditingCommentText(e.target.value)} />
                                                    <div className="up-form-actions" style={{ marginTop: 6 }}>
                                                        <button className="up-confirm-btn" onClick={async () => {
                                                            const { updateComment } = await import('../services/api');
                                                            const updated = await updateComment(comment.id, editingCommentText.trim());
                                                            setMyComments((prev: any[]) => prev.map((c: any) => c.id === comment.id ? updated : c));
                                                            setEditingCommentId(null);
                                                        }}>Сохранить</button>
                                                        <button className="up-cancel-order-btn" onClick={() => setEditingCommentId(null)}>Отмена</button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="up-comment-text">{comment.comment_text}</p>
                                                    <div className="up-form-actions" style={{ marginTop: 4 }}>
                                                        <button className="up-edit-price-btn" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.comment_text); }}>Изменить</button>
                                                        <button className="up-cancel-order-btn" style={{ fontSize: 12 }} onClick={async () => {
                                                            if (!confirm('Удалить этот комментарий?')) return;
                                                            const { deleteComment } = await import('../services/api');
                                                            await deleteComment(comment.id);
                                                            setMyComments((prev: any[]) => prev.filter((c: any) => c.id !== comment.id));
                                                        }}>Удалить</button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <span className="up-comment-date">{new Date(comment.created_at).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}


                {user.role === 'seller' && (
                    <div className="up-card">
                        <h2 className="up-section-title">
                            Заказы
                            {sellerOrders.filter(o => o.status === 'pending_key').length > 0 && (
                                <span className="up-count up-count-alert">
                                    {sellerOrders.filter(o => o.status === 'pending_key').length} новых
                                </span>
                            )}
                        </h2>
                        {sellerOrdersLoading ? (
                            <p className="up-muted">Загрузка...</p>
                        ) : sellerOrders.length === 0 ? (
                            <p className="up-muted">Пока нет заказов.</p>
                        ) : (
                            <div className="up-orders-list">
                                {sellerOrders.map(order => {
                                    const gameName = sellerOrderGameNames[order.igdb_game_id] || `Игра №${order.igdb_game_id}`;
                                    const gameCover = sellerOrderGameCovers[order.igdb_game_id];
                                    const gameSlug = sellerOrderGameSlugs[order.igdb_game_id] || order.igdb_game_id;
                                    const statusMap: Record<string, { label: string; color: string }> = {
                                        pending_key: { label: 'Ожидает ключ', color: '#f0883e' },
                                        key_sent: { label: 'Ключ отправлен', color: '#58a6ff' },
                                        completed: { label: 'Завершено', color: '#3fb950' },
                                        cancelled: { label: 'Отменено', color: '#f85149' },
                                    };
                                    const st = statusMap[order.status] || { label: order.status, color: '#8b949e' };
                                    return (
                                        <div key={order.id} className="up-order-card">
                                            <Link to={`/game/${gameSlug}`} className="up-order-cover-link">
                                                {gameCover
                                                    ? <img className="up-order-cover" src={gameCover} alt={gameName} />
                                                    : <div className="up-order-cover up-order-cover--empty">🎮</div>
                                                }
                                            </Link>
                                            <div className="up-order-body">
                                                <div className="up-order-top">
                                                    <Link to={`/game/${gameSlug}`} className="up-order-game-name">{gameName}</Link>
                                                    <span className="up-order-price">${parseFloat(order.amount).toFixed(2)}</span>
                                                </div>
                                                <div className="up-order-meta">
                                                    <span className="up-order-id">Заказ №{order.id}</span>
                                                    <span className="up-order-dot">·</span>
                                                    <span className="up-order-seller-link">{order.buyer_name}</span>
                                                </div>
                                                {order.status === 'pending_key' && (
                                                    <div className="up-order-key-row">
                                                        {sendKeyOrderId === order.id ? (
                                                            <>
                                                                <input className="up-key-input" placeholder="Введите ключ игры (например, XXXX-XXXX-XXXX)" value={gameKeyInput} onChange={e => setGameKeyInput(e.target.value)} />
                                                                <button className="up-confirm-btn" disabled={!gameKeyInput.trim() || orderActionLoading === order.id} onClick={() => handleSendKey(order.id)}>
                                                                    {orderActionLoading === order.id ? '...' : 'Отправить ключ'}
                                                                </button>
                                                                <button className="up-cancel-order-btn" onClick={() => { setSendKeyOrderId(null); setGameKeyInput(''); }}>Отмена</button>
                                                            </>
                                                        ) : (
                                                            <button className="up-confirm-btn" onClick={() => setSendKeyOrderId(order.id)}>Отправить ключ игры</button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="up-order-status-col">
                                                <span className="up-order-status-badge" style={{ color: st.color, borderColor: st.color + '44', background: st.color + '18' }}>
                                                    {st.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}


                {user.role === 'seller' && profile?.seller && (
                    <div className="up-card">
                        <h2 className="up-section-title">
                            Мои объявления
                            {profile.seller.listings && <span className="up-count">{profile.seller.listings.length}</span>}
                        </h2>
                        {!profile.seller.listings || profile.seller.listings.length === 0 ? (
                            <p className="up-muted">Нет активных объявлений.</p>
                        ) : (() => {
                            const total = profile.seller.listings.length;
                            const totalPages = Math.ceil(total / PAGE_SIZE);
                            const page = Math.min(listingsPage, totalPages - 1);
                            const slice = profile.seller.listings.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
                            return (
                                <>
                                    <div className="up-listings">
                                        {slice.map((l: any) => (
                                            <div key={l.id} className="up-listing-card">
                                                <Link to={`/game/${l.igdb_game_id}`} className="up-listing-cover-link">
                                                    {listingGameCovers[l.igdb_game_id]
                                                        ? <img className="up-listing-cover" src={listingGameCovers[l.igdb_game_id]} alt={listingGameNames[l.igdb_game_id] || ''} />
                                                        : <div className="up-listing-cover up-listing-cover--empty">🎮</div>
                                                    }
                                                </Link>
                                                <div className="up-listing-body">
                                                    <div className="up-listing-body-left">
                                                        <Link to={`/game/${l.igdb_game_id}`} className="up-listing-name">
                                                            {listingGameNames[l.igdb_game_id] || `Игра №${l.igdb_game_id}`}
                                                        </Link>
                                                        <span className="up-listing-id">#{l.igdb_game_id}</span>
                                                    </div>
                                                    <div className="up-listing-body-right">
                                                        {editPriceListingId === l.id ? (
                                                            <div className="up-price-edit">
                                                                <input className="up-price-input" type="number" min="0.01" step="0.01" value={editPriceValue} onChange={e => setEditPriceValue(e.target.value)} autoFocus />
                                                                <button className="up-confirm-btn" disabled={editPriceLoading} onClick={() => handleUpdatePrice(l.id)}>{editPriceLoading ? '...' : 'Сохранить'}</button>
                                                                <button className="up-cancel-order-btn" onClick={() => { setEditPriceListingId(null); setEditPriceValue(''); }}>Отмена</button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <span className="up-listing-price">${parseFloat(l.price).toFixed(2)}</span>
                                                                <button className="up-edit-price-btn" onClick={() => { setEditPriceListingId(l.id); setEditPriceValue(parseFloat(l.price).toFixed(2)); }}>Изменить</button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {totalPages > 1 && (
                                        <div className="up-pagination">
                                            <button className="up-page-btn" onClick={() => setListingsPage(0)} disabled={page === 0}>«</button>
                                            <button className="up-page-btn" onClick={() => setListingsPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹</button>
                                            <span className="up-page-info">{page + 1} / {totalPages}</span>
                                            <button className="up-page-btn" onClick={() => setListingsPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>›</button>
                                            <button className="up-page-btn" onClick={() => setListingsPage(totalPages - 1)} disabled={page === totalPages - 1}>»</button>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}


                {user.role === 'seller' && sellerReviews.length > 0 && (
                    <div className="up-card">
                        <h2 className="up-section-title">
                            Отзывы
                            <span className="up-count">{sellerReviews.length}</span>
                        </h2>
                        <div className="up-reviews-list">
                            {sellerReviews.map(r => (
                                <div key={r.id} className="up-review-card">
                                    <div className="up-review-top">
                                        <span className="up-review-stars">
                                            {[1, 2, 3, 4, 5].map(s => <span key={s} style={{ color: s <= r.rating ? '#fbbf24' : '#30363d' }}>★</span>)}
                                        </span>
                                        <Link to={`/profile/${r.buyer_id}`} className="up-review-buyer">{r.buyer_name}</Link>
                                        <span className="up-review-date">{new Date(r.created_at).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                    </div>
                                    {r.review && <p className="up-review-text">{r.review}</p>}
                                    <Link to={`/game/${reviewGameSlugs[r.igdb_game_id] || r.igdb_game_id}`} className="up-review-game-link">
                                        {reviewGameNames[r.igdb_game_id] || `Игра №${r.igdb_game_id}`}
                                    </Link>
                                    {r.seller_reply ? (
                                        <div className="up-review-reply">
                                            <span className="up-review-reply-label">Ваш ответ:</span>
                                            <p>{r.seller_reply}</p>
                                            <button className="up-edit-price-btn" onClick={() => { setReplyingReviewId(r.id); setReplyText(r.seller_reply); }}>Изменить ответ</button>
                                        </div>
                                    ) : (
                                        replyingReviewId === r.id ? null : (
                                            <button className="up-edit-price-btn" onClick={() => { setReplyingReviewId(r.id); setReplyText(''); }}>↩ Ответить</button>
                                        )
                                    )}
                                    {replyingReviewId === r.id && (
                                        <div className="up-review-reply-form">
                                            <textarea className="up-review-input" rows={2} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Напишите ваш ответ..." />
                                            <div className="up-form-actions" style={{ marginTop: 6 }}>
                                                <button className="up-confirm-btn" disabled={replyLoading} onClick={() => handleReplyToReview(r.id)}>{replyLoading ? '...' : 'Сохранить'}</button>
                                                <button className="up-cancel-order-btn" onClick={() => setReplyingReviewId(null)}>Отмена</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default UserPage;
