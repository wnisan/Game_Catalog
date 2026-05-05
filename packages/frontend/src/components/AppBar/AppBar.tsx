import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useFilters } from '../../contexts/FiltersContext';
import Cart from '../Cart/Cart';
import ChatInbox from '../Chat/ChatInbox';
import { api } from '../../services/api';
import './AppBar.css';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/chat`;

const AppBar: React.FC = () => {
    const { isAuthenticated, logout, user } = useAuth();
    const { getActiveFiltersCount, updateFilter, filters } = useFilters();
    const navigate = useNavigate();
    const location = useLocation();
    const isExplorePage = location.pathname === '/' || location.pathname === '/explore';
    const activeFiltersCount = getActiveFiltersCount();
    const [cartOpen, setCartOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const handler = () => setCartOpen(true);
        window.addEventListener('openCart', handler);
        return () => window.removeEventListener('openCart', handler);
    }, []);

    useEffect(() => {
        const handler = () => setFiltersOpen(v => !v);
        window.addEventListener('toggleFilters', handler);
        return () => window.removeEventListener('toggleFilters', handler);
    }, []);

    useEffect(() => {
        if (!isExplorePage) setFiltersOpen(false);
    }, [isExplorePage]);

    useEffect(() => {
        if (!isAuthenticated || !user) return;
        let ws: WebSocket;
        let reconnectTimer: ReturnType<typeof setTimeout>;
        const connect = async () => {
            try {
                const r = await api.get('/auth/ws-token');
                ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(r.data.token)}`);
                wsRef.current = ws;
                ws.onmessage = (e) => {
                    try {
                        const msg = JSON.parse(e.data);
                        if (msg.type === 'unread_count') setUnreadCount(msg.count);
                    } catch { }
                };
                ws.onclose = () => { reconnectTimer = setTimeout(connect, 5000); };
                ws.onerror = () => ws.close();
            } catch { }
        };
        api.get('/chat/unread').then(r => setUnreadCount(r.data.count)).catch(() => { });
        connect();
        return () => { clearTimeout(reconnectTimer); ws?.close(); wsRef.current = null; };
    }, [isAuthenticated, user?.id]);

    useEffect(() => {
        setSearchValue(filters.search || '');
    }, [filters.search]);

    const handleLogout = () => { logout(); navigate('/auth'); };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isExplorePage) navigate('/explore');
        updateFilter('search', searchValue);
    };

    const handleSearchChange = (val: string) => {
        setSearchValue(val);
        if (isExplorePage) updateFilter('search', val);
    };

    return (
        <header className="app-bar" role="banner">
            {cartOpen && isAuthenticated && (
                <Cart onClose={() => setCartOpen(false)} onCartChange={() => { }} />
            )}
            <div className="app-bar__container">
                <div className="app-bar__left">
                    <Link to="/explore" className="app-bar__brand">
                        <img src="/icon_mario.png" alt="logo" className="app-bar__brand-icon" />
                        <span className="app-bar__brand-name">GameCatalog</span>
                    </Link>

                    <nav className="app-bar__nav" aria-label="Главная навигация">
                        <Link to="/explore" className={`app-bar__nav-link ${isExplorePage ? 'app-bar__nav-link--active' : ''}`}>
                            Обзор
                        </Link>
                        {isExplorePage && (
                            <button
                                className={`app-bar__nav-link app-bar__filter-btn ${filtersOpen ? 'app-bar__filter-btn--open' : ''}`}
                                onClick={() => window.dispatchEvent(new CustomEvent('toggleFilters'))}
                                type="button"
                            >
                                Фильтры
                                {activeFiltersCount > 0 && <span className="app-bar__filter-badge">{activeFiltersCount}</span>}
                            </button>
                        )}
                        {isAuthenticated && (
                            <Link to="/favourites" className={`app-bar__nav-link ${location.pathname === '/favourites' ? 'app-bar__nav-link--active' : ''}`}>
                                Избранное
                            </Link>
                        )}
                    </nav>
                </div>

                <form className="app-bar__search-form" onSubmit={handleSearch}>
                    <div className="app-bar__search-wrap">
                        <svg className="app-bar__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                        </svg>
                        <input
                            className="app-bar__search-input"
                            type="text"
                            placeholder="Поиск игр..."
                            value={searchValue}
                            onChange={e => handleSearchChange(e.target.value)}
                            aria-label="Поиск игр"
                        />
                        {searchValue && (
                            <button type="button" className="app-bar__search-clear" onClick={() => handleSearchChange('')} aria-label="Очистить поиск">✕</button>
                        )}
                    </div>
                </form>

                <div className="app-bar__right">
                    {isAuthenticated ? (
                        <>
                            <button className="app-bar__nav-link app-bar__nav-btn" onClick={() => setCartOpen(true)} type="button">
                                Корзина
                            </button>

                            <div className="app-bar__chat-wrap">
                                <ChatInbox unreadCount={unreadCount} onUnreadChange={setUnreadCount} />
                            </div>

                            <Link to="/user" className={`app-bar__nav-link app-bar__user-link ${location.pathname === '/user' ? 'app-bar__nav-link--active' : ''}`}>
                                <div className="app-bar__avatar">{(user?.name || 'U')[0].toUpperCase()}</div>
                                {user?.name?.split(' ')[0] || 'Профиль'}
                            </Link>

                            {user?.role === 'admin' && (
                                <Link to="/admin" className={`app-bar__nav-link app-bar__admin-link ${location.pathname === '/admin' ? 'app-bar__nav-link--active' : ''}`}>
                                    Админка
                                </Link>
                            )}

                            <button className="app-bar__nav-link app-bar__nav-btn app-bar__logout-link" onClick={handleLogout} type="button">
                                Выйти
                            </button>
                        </>
                    ) : (
                        <Link to="/auth" className="app-bar__login-btn">
                            Вход / Регистрация
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
};

export default AppBar;
