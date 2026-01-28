import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { InitialFilters, type GameFilters } from '../types/filters';
import { useAuth } from './AuthContext';

const getStorageKey = (userId?: number | null) => userId ? `gameFilters_${userId}` : 'gameFilters_guest';

const loadFiltersFromStorage = (storageKey: string): GameFilters => {
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                ...InitialFilters,
                ...parsed
            };
        }
    } catch (error) {
        console.error('Error loading filters from storage:', error);
    }
    return InitialFilters;
};

const saveFiltersToStorage = (storageKey: string, filters: GameFilters) => {
    try {
        localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (error) {
        console.error('Error saving filters to storage:', error);
    }
};

interface FiltersContextType {
    filters: GameFilters;
    updateFilter: <K extends keyof GameFilters>(key: K, value: GameFilters[K]) => void;
    updateMultipleFilter: (updates: Partial<GameFilters>) => void;
    resetFilters: () => void;
    hasActiveFilters: () => boolean;
    getActiveFiltersCount: () => number;
}

const FiltersContext = createContext<FiltersContextType | undefined>(undefined);

interface FiltersProviderProps {
    children: ReactNode;
}

export const FiltersProvider: React.FC<FiltersProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const storageKey = getStorageKey(user?.id);
    const [filters, setFilters] = useState<GameFilters>(loadFiltersFromStorage(storageKey));

    useEffect(() => {
        const handleFiltersReset = () => {
            setFilters(InitialFilters);
            localStorage.removeItem(storageKey);
        };

        window.addEventListener('filtersReset', handleFiltersReset);
        return () => {
            window.removeEventListener('filtersReset', handleFiltersReset);
        };
    }, [storageKey]);

    useEffect(() => {
        setFilters(loadFiltersFromStorage(storageKey));
    }, [storageKey]);

    const updateFilter = useCallback(<K extends keyof GameFilters>(
        key: K,
        value: GameFilters[K]
    ) => {
        setFilters(prev => {
            const newFilters = {
                ...prev,
                [key]: value
            };
            saveFiltersToStorage(storageKey, newFilters);
            return newFilters;
        });
    }, [storageKey]);

    const updateMultipleFilter = useCallback((updates: Partial<GameFilters>) => {
        setFilters(prev => {
            const newFilters = {
                ...prev,
                ...updates
            };
            saveFiltersToStorage(storageKey, newFilters);
            return newFilters;
        });
    }, [storageKey]);

    const resetFilters = useCallback(() => {
        setFilters(InitialFilters);
        localStorage.removeItem(storageKey);
    }, [storageKey]);

    const hasActiveFilters = useCallback((): boolean => {
        return (
            filters.genres.length > 0 ||
            filters.platforms.length > 0 ||
            filters.engines.length > 0 ||
            filters.ratingMin > 0 ||
            filters.ratingMax < 100 ||
            !!filters.releaseDateMin ||
            !!filters.releaseDateMax ||
            filters.sortBy !== 'release-desc'
        );
    }, [filters]);

    const getActiveFiltersCount = useCallback((): number => {
        let count = 0;
        if (filters.genres.length > 0) count++;
        if (filters.platforms.length > 0) count++;
        if (filters.engines.length > 0) count++;
        if (filters.ratingMin > 0) count++;
        if (filters.ratingMax < 100) count++;
        if (filters.releaseDateMin) count++;
        if (filters.releaseDateMax) count++;
        if (filters.sortBy !== 'release-desc') count++;
        return count;
    }, [filters]);

    return (
        <FiltersContext.Provider value={{
            filters,
            updateFilter,
            updateMultipleFilter,
            resetFilters,
            hasActiveFilters,
            getActiveFiltersCount
        }}>
            {children}
        </FiltersContext.Provider>
    );
};

export const useFilters = () => {
    const context = useContext(FiltersContext);
    if (context === undefined) {
        throw new Error('useFilters must be used within a FiltersProvider');
    }
    return context;
};
