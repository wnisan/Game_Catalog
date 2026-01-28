import React, { createContext, useState, useContext, useCallback, type ReactNode } from 'react';

interface User {
    id: number;
    email: string;
    name: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

// создание контекста
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const isAuthenticated = !!user;

    const login = async (email: string, password: string): Promise<void> => {
        const { login: loginApi } = await import('../services/api');
        const { user } = await loginApi(email, password);

        setUser(user);
        setToken('cookie'); // Токен хранится в cookie
    };

    const register = async (name: string, email: string, password: string): Promise<void> => {
        const { register: registerApi } = await import('../services/api');
        const { user } = await registerApi(email, name, password);

        setUser(user);
        setToken('cookie');
    };

    const refreshUser = useCallback(async (): Promise<void> => {
        try {
            const { getMe } = await import('../services/api');
            const result = await getMe();

            if (result && result.user) {
                setUser(result.user);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Error refreshing user:', error);
        }
    }, []);

    const logout = useCallback(async (): Promise<void> => {
        try {
            const { logout: logoutApi } = await import('../services/api');
            await logoutApi();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            setToken(null);
            // Очищаем фильтры при выходе из аккаунта
            localStorage.removeItem('gameFilters');
            // Отправляем событие для сброса фильтров в компонентах
            window.dispatchEvent(new CustomEvent('filtersReset'));
        }
    }, []);

    React.useEffect(() => {
        const loadUser = async () => {
            try {
                // Проверяем токен на сервере 
                const { getMe } = await import('../services/api');
                const result = await getMe();

                // Если пользователь есть, устанавливаем его
                if (result && result.user) {
                    setUser(result.user);
                    setToken('cookie');
                } else {
                    setUser(null);
                    setToken(null);
                }
            } catch (error: any) {
                if (error.response?.status && error.response.status !== 401) {
                    console.error('Token validation failed:', error);
                }
                setUser(null);
                setToken(null);
            } finally {
                setIsLoading(false);
            }
        };
        loadUser();
    }, []);

    const value: AuthContextType = {
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        refreshUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Кастомный хук для удобного использования контекста
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};