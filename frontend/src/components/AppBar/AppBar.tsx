import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useFilters } from '../../contexts/FiltersContext';
import './AppBar.css';

const AppBar: React.FC = () => {
    const { isAuthenticated, logout } = useAuth();
    const { getActiveFiltersCount } = useFilters();
    const navigate = useNavigate();
    const location = useLocation();
    const isExplorePage = location.pathname === '/' || location.pathname === '/explore';
    const activeFiltersCount = getActiveFiltersCount();

    const handleLogout = () => {
        logout();
        navigate('/auth');
    };

    const handleToggleFilters = () => {
        window.dispatchEvent(new CustomEvent('toggleFilters'));
    };

    return (
        <header className="app-bar" role="banner">
            <div className="app-bar__container">
                {isAuthenticated ? (
                    <nav className="app-bar__nav" aria-label="Main navigation">
                        <div className="app-bar__nav-left">
                            <ul className="app-bar__nav-list" role="list">
                                <li className="app-bar__nav-item" role="listitem">
                                    <Link
                                        to="/explore"
                                        className="app-bar__nav-link"
                                        aria-label="Explore games catalog"
                                    >
                                        Explore
                                    </Link>
                                </li>

                                {isExplorePage && (
                                    <li className="app-bar__nav-item" role="listitem">
                                        <button
                                            className="app-bar__filter-btn"
                                            onClick={handleToggleFilters}
                                            type="button"
                                            aria-label="Toggle filters panel"
                                        >
                                            Filters
                                            {activeFiltersCount > 0 && (
                                                <span className="app-bar__filter-badge">{activeFiltersCount}</span>
                                            )}
                                        </button>
                                    </li>
                                )}

                                <li className="app-bar__nav-item" role="listitem">
                                    <Link
                                        to="/my-games"
                                        className="app-bar__nav-link"
                                        aria-label="View my favorite games"
                                    >
                                        My Games
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        <div className="app-bar__nav-right">
                            <ul className="app-bar__nav-list" role="list">
                                <li className="app-bar__nav-item" role="listitem">
                                    <Link
                                        to="/user"
                                        className="app-bar__nav-link"
                                        aria-label="View and edit user profile"
                                    >
                                        User Page
                                    </Link>
                                </li>

                                <li className="app-bar__nav-item app-bar__user" role="listitem">
                                    <button
                                        className="app-bar__logout-btn"
                                        onClick={handleLogout}
                                        type="button"
                                        aria-label="Logout from account"
                                    >
                                        Logout
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </nav>
                ) : (
                    <div className="app-bar__auth">
                        <div className="app-bar__auth-left">
                            <Link
                                to="/explore"
                                className="app-bar__nav-link"
                                aria-label="Explore games catalog"
                            >
                                Explore
                            </Link>
                            {isExplorePage && (
                                <button
                                    className="app-bar__filter-btn-secondary"
                                    onClick={handleToggleFilters}
                                    type="button"
                                    aria-label="Toggle filters panel"
                                >
                                    Filters
                                    {activeFiltersCount > 0 && (
                                        <span className="app-bar__filter-badge">{activeFiltersCount}</span>
                                    )}
                                </button>
                            )}
                        </div>
                        <div className="app-bar__auth-right">
                            <Link
                                to="/auth"
                                className="app-bar__login-btn"
                                aria-label="Go to login page"
                            >
                                Sign In / Sign Up
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default AppBar;