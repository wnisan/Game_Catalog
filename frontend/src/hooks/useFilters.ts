import { useState, useCallback, useEffect } from "react";
import { InitialFilters, type GameFilters } from "../types/filters";

// для localStorage
const FILTERS_STORAGE_KEY = 'gameFilters';

// Загружаем фильтры из localStorage
const loadFiltersFromStorage = (): GameFilters => {
    try {
        const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
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

// Сохраняем фильтры в localStorage
const saveFiltersToStorage = (filters: GameFilters) => {
    try {
        localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
        console.error('Error saving filters to storage:', error);
    }
};

// загружает из localStorage
export const useFilters = () => {
    const[filters, setFilters] = useState<GameFilters>(loadFiltersFromStorage());

    // сброс фильтров
    useEffect(() => {
        const handleFiltersReset = () => {
            setFilters(InitialFilters);
            localStorage.removeItem(FILTERS_STORAGE_KEY);
        };

        window.addEventListener('filtersReset', handleFiltersReset);
        return () => {
            window.removeEventListener('filtersReset', handleFiltersReset);
        };
    }, []);

    // обновление одного фильтра
    const updateFilter = useCallback(<K extends keyof GameFilters>(
        key: K,
        value: GameFilters[K]
    ) => {
        setFilters(prev => {
            const newFilters = {
                ...prev,
                [key]: value
            };
            saveFiltersToStorage(newFilters);
            return newFilters;
        });
    }, []);

    // делает все поля необязательными
    const updateMultipleFilter = useCallback((updates: Partial<GameFilters>) => {
        setFilters(prev => {
            const newFilters = {
                ...prev,
                ...updates
            };
            saveFiltersToStorage(newFilters);
            return newFilters;
        });
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(InitialFilters);
        // Очищаем localStorage при сбросе фильтров
        localStorage.removeItem(FILTERS_STORAGE_KEY);
    }, []);

    // проверка активных фильтров
    const hasActiveFilters = useCallback((): boolean => {
        return (
            filters.genres.length > 0 ||
            filters.platforms.length > 0 ||
            filters.engines.length > 0 ||
            filters.ratingMin > 0 ||
            filters.ratingMax < 100 ||
            !!filters.releaseDateMin ||
            !!filters.releaseDateMax ||
            filters.pegi.length > 0 ||
            filters.sortBy !== 'release-desc'
        );
    }, [filters]);

    // количесво активных
    const getActiveFiltersCount = useCallback((): number => {
        let count = 0;
        if (filters.genres.length > 0) count++;
        if (filters.platforms.length > 0) count++;
        if (filters.engines.length > 0) count++;
        if (filters.ratingMin > 0) count++;
        if (filters.ratingMax < 100) count++;
        if (filters.releaseDateMin) count++;
        if (filters.releaseDateMax) count++;
        if (filters.pegi.length > 0) count++;
        if (filters.sortBy !== 'release-desc') count++;
        return count;
    }, [filters]);

    return {
      filters,         
      updateFilter, 
      updateMultipleFilter,     
      resetFilters,    
      hasActiveFilters,
      getActiveFiltersCount 
  };
};

export type UseFiltersReturn = ReturnType<typeof useFilters>