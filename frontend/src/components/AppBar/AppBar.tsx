import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './AppBar.css';

const AppBar: React.FC = () => {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/auth');
    };

    return (
        <header className="app-bar" role="banner">
            <div className="app-bar__container">
                {isAuthenticated ? (
                    <nav className="app-bar__nav" aria-label="Main navigation">
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

                            <li className="app-bar__nav-item" role="listitem">
                                <Link 
                                    to="/my-games" 
                                    className="app-bar__nav-link"
                                    aria-label="View my favorite games"
                                >
                                    My Games
                                </Link>
                            </li>

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
                    </nav>
                ) : (
                    <div className="app-bar__auth">
                        <Link 
                            to="/auth" 
                            className="app-bar__login-btn"
                            aria-label="Go to login page"
                        >
                            Sign In / Sign Up
                        </Link>
                    </div>
                )}
            </div>
        </header>
    );
};

export default AppBar;