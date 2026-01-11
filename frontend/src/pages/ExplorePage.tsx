import { useState, useEffect, useCallback } from "react";
import { getGames, type Game } from '../services/api';
import GameCard from "../components/GameCard/GameCard";
import LoadingSpinner from "../components/Loading/LoadingSpinner";
import LoadingMore from '../components/LoadingMore/LoadingMore';
import FilterPanel from '../components/FilterPanel/FilterPanel';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useFilters } from '../hooks/useFilters';
import { type GameFilters } from '../types/filters';
import './ExplorePage.css';

const ExplorePage = () => {
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { filters, updateMultipleFilter } = useFilters();
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // бесконечная прокрутка
  const fetchMoreGames = useCallback(async (page: number): Promise<Game[]> => {
    try {
      const limit = 20;
      const offset = (page + 1) * limit; // смещение для след страницы
      console.log('Fetching more games:', { page, offset, limit });
      const result = await getGames(filters, limit, offset, 0, false);

      // Проверяем, вернулся ли объект с games или просто массив
      const newGames = (result && typeof result === 'object' && 'games' in result)
        ? (result as { games: Game[]; totalCount: number }).games
        : (result as Game[]);

      console.log('Fetched games:', newGames.length);

      // Добавляем новые загружаемые игры к существующим
      setAllGames(prev => {
        // Проверяем, нет ли дубликатов
        const existingIds = new Set(prev.map(g => g.id));
        const uniqueNewGames = newGames.filter(g => !existingIds.has(g.id));
        console.log('Adding games:', uniqueNewGames.length, 'Total:', prev.length + uniqueNewGames.length);
        return [...prev, ...uniqueNewGames];
      });

      return newGames;
    } catch (err) {
      console.error('Error loading more games:', err);
      throw err;
    }
  }, [filters]);

  // если еще игры
  const computedHasMore = totalCount !== null
    ? filteredGames.length < totalCount && totalCount > 0
    : true;

  const {
    isLoading: isLoadingMore,
    hasMore: hasMoreFromHook,
    sentinelRef,
    reset: resetInfiniteScroll
  } = useInfiniteScroll(fetchMoreGames, {
    threshold: 200,
    enabled: !initialLoading && !error && computedHasMore,
    rootMargin: '200px'
  });

  const hasMore = totalCount !== null
    ? (totalCount > 0 && filteredGames.length < totalCount)
    : hasMoreFromHook;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const loadData = async () => {
    resetInfiniteScroll();
    setAllGames([]);
        setTotalCount(null);
        setError('');
        await loadInitialGames();
      };
      loadData();
    }, filters.search ? 800 : 100); // задержка

    return () => clearTimeout(timeoutId);
  }, [filters]);

  // начальная загрузка
  const loadInitialGames = async () => {
    try {
      setInitialLoading(true);
      setError('');
      resetInfiniteScroll();
      console.log('loadInitialGames - filters:', filters);
      console.log('loadInitialGames - filters.pegi:', filters.pegi);
      const result = await getGames(filters, 20, 0, 0, true);

      if (result && typeof result === 'object' && 'games' in result) {
        const { games, totalCount: count } = result as { games: Game[]; totalCount: number };
        setAllGames(games);
        setTotalCount(count);
        console.log('Initial games loaded:', games.length, 'Total count:', count);
      } else {
        const games = result as Game[];
        setAllGames(games);
        setTotalCount(null);
        console.log('Initial games loaded:', games.length, 'Total count: unknown');
      }
    } catch (error) {
      setError('Failed to load games. Please try again later.');
      console.error('Error loading games:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  // применение фильтров
  const applyFilters = () => {
    setFilteredGames(allGames);
  };

  useEffect(() => {
    applyFilters();
  }, [allGames, filters]);

  // бработка изменений
  const handleFiltersChange = (newFilters: GameFilters) => {
    updateMultipleFilter(newFilters);
  };

  return (
    <div className="explore-page">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="explore-page__header">
        <h1>Game Catalog</h1>
      </header>

      <FilterPanel
        onFiltersChange={handleFiltersChange}
        allGames={allGames}
      />

      {!initialLoading && (
        <div className="explore-page__results-info" id="main-content" tabIndex={-1}>
          <h2>
            {filters.search ? `Search: "${filters.search}"` : 'All Games'}
            <span className="explore-page__count" aria-label={`Total games: ${totalCount !== null ? totalCount : filteredGames.length > 0 ? filteredGames.length : 0}`}>
              {totalCount !== null ? ` (${totalCount} games)` : filteredGames.length > 0 ? ` (${filteredGames.length} games)` : ' (0 games)'}
            </span>
          </h2>
        </div>
      )}

      {error && (
        <div className="explore-page__error">
          <p>{error}</p>
          <button onClick={loadInitialGames} className="explore-page__retry-btn">
            Try Again
          </button>
        </div>
      )}

      {initialLoading && <LoadingSpinner />}

      {!initialLoading && filteredGames.length > 0 && (
        <>
          <div className="explore-page__games-grid">
            {filteredGames.map(game => (
              <GameCard
                key={`${game.id}-${game.name}`}
                game={game}
              />
            ))}
          </div>
          {hasMore && (
            <>
          <div ref={sentinelRef} style={{ height: '1px' }}></div>
          <LoadingMore isLoading={isLoadingMore} hasMore={hasMore} />
            </>
          )}
        </>
      )}

      {!initialLoading && filteredGames.length === 0 && allGames.length > 0 && (
        <div className="explore-page__empty">
          <h3>No games match your filters</h3>
        </div>
      )}

      {!initialLoading && allGames.length === 0 && !error && (
        <div className="explore-page__empty">
          <h3>No games available</h3>
        </div>
      )}
    </div>
  );
};

export default ExplorePage;
