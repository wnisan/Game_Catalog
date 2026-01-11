import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import './UserPage.css';

const UserPage: React.FC = () => {
    const { user, refreshUser, isAuthenticated } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email || '');
        }
    }, [user]);

    // валидация формы
    const validateForm = (): boolean => {
        setError('');

        if (!name.trim()) {
            setError('Name is required');
            return false;
        }

        if (!email.trim()) {
            setError('Email is required');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email');
            return false;
        }

        // Если пароль указан, проверяем его и требуем текущий пароль
        if (password) {
            if (!currentPassword) {
                setError('Current password is required to change password');
                return false;
            }

            if (password.length < 6) {
                setError('Password must be at least 6 characters');
                return false;
            }

            if (password !== confirmPassword) {
                setError('Passwords do not match');
                return false;
            }
        }

        return true;
    };

    // обработка отправки
    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const updateData: { name: string; email: string; password?: string; currentPassword?: string } = {
                name: name.trim(),
                email: email.trim()
            };

            // Добавляем пароль и текущий пароль только если новый пароль указан
            if (password.trim()) {
                updateData.password = password.trim();
                updateData.currentPassword = currentPassword.trim();
            }

            const response = await api.put('/auth/me', updateData);

            if (response.data && response.data.user) {
                setSuccess('Profile updated successfully!');
                // Обновляем данные в контексте
                await refreshUser();
                // Очищаем поля пароля после успешного обновления
                setCurrentPassword('');
                setPassword('');
                setConfirmPassword('');
            }
        } catch (err: any) {
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Failed to update profile. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="user-page">
                <div className="user-page__container">
                    <header className="user-page__header">
                        <h1>User Profile</h1>
                        <p>Manage your account settings</p>
                    </header>
                    <div className="user-page__card">
                        <div className="user-page__auth-required">
                            <h2>Sign in required</h2>
                            <p>Please sign in to view and edit your profile.</p>
                            <Link to="/auth" className="user-page__auth-btn">
                                Sign In / Sign Up
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="user-page">
            <div className="user-page__container">
                <header className="user-page__header">
                    <h1>User Profile</h1>
                    <p>Manage your account settings</p>
                </header>

                <div className="user-page__card">
                    <form className="user-page__form" onSubmit={handleSubmit}>
                        <div className="user-page__form-group">
                            <label htmlFor="name" className="user-page__label">
                                Name
                            </label>
                            <input
                                id="name"
                                type="text"
                                className="user-page__input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your name"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="user-page__form-group">
                            <label htmlFor="email" className="user-page__label">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                className="user-page__input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="user-page__form-group">
                            <label htmlFor="currentPassword" className="user-page__label">
                                Current Password
                            </label>
                            <div className="user-page__input-wrapper">
                                <input
                                    id="currentPassword"
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    className="user-page__input"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password (required to change password)"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    className="user-page__password-toggle"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                                    tabIndex={0}
                                >
                                    {showCurrentPassword ? (
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
                            <p className="user-page__hint">
                                Required only if you want to change your password. Leave empty if you're only updating name or email.
                            </p>
                        </div>

                        <div className="user-page__form-group">
                            <label htmlFor="password" className="user-page__label">
                                New Password (Optional)
                            </label>
                            <div className="user-page__input-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="user-page__input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter new password (leave empty to keep current)"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    className="user-page__password-toggle"
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

                        {password && (
                            <div className="user-page__form-group">
                                <label htmlFor="confirmPassword" className="user-page__label">
                                    Confirm New Password
                                </label>
                                <div className="user-page__input-wrapper">
                                    <input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        className="user-page__input"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        className="user-page__password-toggle"
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
                            <div className="user-page__error">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="user-page__success">
                                {success}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="user-page__submit-btn"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UserPage;

