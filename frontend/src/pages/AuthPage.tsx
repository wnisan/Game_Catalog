import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AuthPage.css';

type AuthMode = 'login' | 'register';

const AuthPage: React.FC = () => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const switchMode = (newMode: AuthMode) => {
        setMode(newMode);
        setError('');
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
    };

    const validateForm = (): boolean => {
        setError('');
        if (!email) {
            setError('Email is required');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email');
            return false;
        }

        if (!password) {
            setError('Password is required');
            return false;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return false;
        }

        if (mode === 'register') {
            if (!name) {
                setError('Name is required');
                return false;
            }

            if (password !== confirmPassword) {
                setError('Passwords do not match');
                return false;
            }
        }

        return true;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            if (mode === 'login') {
                await login(email, password);
            } else {
                await register(name, email, password);
            }
            navigate('/explore');

        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An error occurred. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // через гугл
    const handleGoogleAuth = async () => {
        try {
            setIsLoading(true);
            setError('');
            const { getGoogleAuthUrl } = await import('../services/api');
            const authUrl = await getGoogleAuthUrl();
            window.location.href = authUrl;
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Failed to initiate Google authentication');
            }
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-page__container">
                <div className="auth-page__header">
                    <h1>Game Catalog</h1>
                    <p>Please sign in to continue.</p>
                </div>

                {/* Контейнер формы */}
                <div className="auth-page__card">
                    <div className="auth-page__tabs" role="tablist" aria-label="Authentication mode">
                        <button
                            type="button"
                            className={`auth-page__tab ${mode === 'login' ? 'active' : ''}`}
                            onClick={() => switchMode('login')}
                            role="tab"
                            aria-selected={mode === 'login'}
                            aria-controls="auth-form"
                            id="tab-login"
                        >
                            Sign In
                        </button>
                        <button
                            type="button"
                            className={`auth-page__tab ${mode === 'register' ? 'active' : ''}`}
                            onClick={() => switchMode('register')}
                            role="tab"
                            aria-selected={mode === 'register'}
                            aria-controls="auth-form"
                            id="tab-register"
                        >
                            Sign Up
                        </button>
                    </div>

                    <form 
                        className="auth-page__form" 
                        onSubmit={handleSubmit}
                        id="auth-form"
                        role="tabpanel"
                        aria-labelledby={mode === 'login' ? 'tab-login' : 'tab-register'}
                        noValidate
                    >
                        {mode === 'register' && (
                            <div className="auth-page__form-group">
                                <label htmlFor="name" className="auth-page__label">
                                    Name
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    className="auth-page__input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your name"
                                    disabled={isLoading}
                                    aria-required="true"
                                    aria-invalid={error && error.includes('Name') ? 'true' : 'false'}
                                    aria-describedby={error && error.includes('Name') ? 'name-error' : undefined}
                                />
                            </div>
                        )}

                        <div className="auth-page__form-group">
                            <label htmlFor="email" className="auth-page__label">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                className="auth-page__input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                disabled={isLoading}
                                aria-required="true"
                                aria-invalid={error && (error.includes('Email') || error.includes('email')) ? 'true' : 'false'}
                                aria-describedby={error && (error.includes('Email') || error.includes('email')) ? 'email-error' : undefined}
                                autoComplete="email"
                            />
                        </div>

                        <div className="auth-page__form-group">
                            <label htmlFor="password" className="auth-page__label">
                                Password
                            </label>
                            <div className="auth-page__input-wrapper">
                            <input
                                id="password"
                                    type={showPassword ? 'text' : 'password'}
                                className="auth-page__input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                disabled={isLoading}
                                    aria-required="true"
                                    aria-invalid={error && error.includes('Password') ? 'true' : 'false'}
                                    aria-describedby={error && error.includes('Password') ? 'password-error' : undefined}
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                />
                                <button
                                    type="button"
                                    className="auth-page__password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    tabIndex={0}
                                >
                                    {showPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {mode === 'register' && (
                            <div className="auth-page__form-group">
                                <label htmlFor="confirmPassword" className="auth-page__label">
                                    Confirm Password
                                </label>
                                <div className="auth-page__input-wrapper">
                                <input
                                    id="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                    className="auth-page__input"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
                                    disabled={isLoading}
                                        aria-required="true"
                                        aria-invalid={error && error.includes('match') ? 'true' : 'false'}
                                        aria-describedby={error && error.includes('match') ? 'confirm-password-error' : undefined}
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        className="auth-page__password-toggle"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                        tabIndex={0}
                                    >
                                        {showConfirmPassword ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                                <line x1="1" y1="1" x2="23" y2="23"/>
                                            </svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                <circle cx="12" cy="12" r="3"/>
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div 
                                className="auth-page__error" 
                                role="alert"
                                aria-live="assertive"
                                id="auth-error"
                            >
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="auth-page__submit-btn"
                            disabled={isLoading}
                            aria-label={mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
                        >
                            {isLoading ? (
                                'Loading...'
                            ) : mode === 'login' ? (
                                'Sign In'
                            ) : (
                                'Sign Up'
                            )}
                        </button>

                        <div className="auth-page__divider">
                            <span>OR</span>
                        </div>

                        <button
                            type="button"
                            className="auth-page__google-btn"
                            onClick={handleGoogleAuth}
                            disabled={isLoading}
                            aria-label="Sign in with Google account"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            Continue with Google
                        </button>

                        <div className="auth-page__hint">
                            {mode === 'login' ? (
                                <>
                                    Don't have an account?{' '}
                                    <button
                                        type="button"
                                        className="auth-page__switch-btn"
                                        onClick={() => switchMode('register')}
                                    >
                                        Sign Up
                                    </button>
                                </>
                            ) : (
                                <>
                                    Already have an account?{' '}
                                    <button
                                        type="button"
                                        className="auth-page__switch-btn"
                                        onClick={() => switchMode('login')}
                                    >
                                        Sign In
                                    </button>
                                </>
                            )}
                        </div>

                        <button
                            type="button"
                            className="auth-page__guest-btn"
                            onClick={() => navigate('/explore')}
                            disabled={isLoading}
                        >
                            Continue without registration
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;