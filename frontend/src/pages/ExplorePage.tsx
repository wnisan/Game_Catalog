import { useState, useEffect, useCallback, lazy, Suspense, useRef } from "react";
import { getGames, type Game } from '../services/api';
import GameCard from "../components/GameCard/GameCard";
import LoadingSpinner from "../components/Loading/LoadingSpinner";
import LoadingMore from '../components/LoadingMore/LoadingMore';
import FilterPanel from '../components/FilterPanel/FilterPanel';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useFilters } from '../contexts/FiltersContext';
import { type GameFilters } from '../types/filters';
import './ExplorePage.css';

const PopularGames = lazy(() => import('../components/PopularGames/PopularGames'));
const UpcomingGames = lazy(() => import('../components/UpcomingGames/UpcomingGames'));

const LIMIT = 20;

const ExplorePage = () => {
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const { filters, updateMultipleFilter } = useFilters();

  const offsetRef = useRef(0);

  const hasMore =
    totalCount !== null ? allGames.length < totalCount : true;

  const fetchMoreGames = useCallback(async (): Promise<Game[]> => {
    try {
      const result = await getGames(
        filters,
        LIMIT,
        offsetRef.current,
        0,
        false
      );

      const newGames =
        typeof result === 'object' && 'games' in result
          ? result.games
          : result;

      setAllGames(prev => {
        const ids = new Set(prev.map(g => g.id));
        const unique = newGames.filter(g => !ids.has(g.id));
        return [...prev, ...unique];
      });

      offsetRef.current += LIMIT;
      return newGames;
    } catch (e) {
      throw e;
    }
  }, [filters]);

  const {
    isLoading: isLoadingMore,
    sentinelRef,
    reset: resetInfiniteScroll
  } = useInfiniteScroll(fetchMoreGames, {
    enabled: !initialLoading && !error && hasMore,
    threshold: 300,
    rootMargin: '200px'
  });

  const loadInitialGames = async () => {
    try {
      setInitialLoading(true);
      setError('');
      resetInfiniteScroll();

      offsetRef.current = 0;

      const result = await getGames(filters, LIMIT, 0, 0, true);

      if (typeof result === 'object' && 'games' in result) {
        setAllGames(result.games);
        setTotalCount(result.totalCount);
      } else {
        setAllGames(result);
        setTotalCount(null);
      }

      offsetRef.current = LIMIT;
    } catch {
      setError('Failed to load games');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadInitialGames, filters.search ? 800 : 100);
    return () => clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    const handler = () => setIsFilterPanelOpen(p => !p);
    window.addEventListener('toggleFilters', handler);
    return () => window.removeEventListener('toggleFilters', handler);
  }, []);

  const handleFiltersChange = (newFilters: GameFilters) => {
    updateMultipleFilter(newFilters);
  };

  return (
    <div className="explore-page">
      <header className="explore-page__header">
        <Suspense fallback={<div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingSpinner /></div>}>
          <PopularGames />
        </Suspense>
        <Suspense fallback={<div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingSpinner /></div>}>
          <UpcomingGames />
        </Suspense>
        <h1>Game Catalog</h1>
      </header>

      <FilterPanel
        onFiltersChange={handleFiltersChange}
        allGames={allGames}
        isOpen={isFilterPanelOpen}
      />

      {!initialLoading && (
        <div className="explore-page__results-info" id="main-content" tabIndex={-1}>
          <h2>
            {filters.search ? `Search: "${filters.search}"` : 'All Games'}
            <span className="explore-page__count" aria-label={`Total games: ${totalCount !== null ? totalCount : allGames.length > 0 ? allGames.length : 0}`}>
              {totalCount !== null ? ` (${totalCount} games)` : allGames.length > 0 ? ` (${allGames.length} games)` : ' (0 games)'}
            </span>
          </h2>
        </div>
      )}

      {initialLoading && <LoadingSpinner />}

      {!initialLoading && allGames.length > 0 && (
        <>
          <div className="explore-page__games-grid">
            {allGames.map((game, index) => (
              <GameCard key={game.id} game={game} isFirst={index === 0} />
            ))}
          </div>

          {hasMore && (
            <>
              <div ref={sentinelRef} style={{ height: 1 }} />
              <LoadingMore isLoading={isLoadingMore} hasMore={hasMore} />
            </>
          )}
        </>
      )}

      {!initialLoading && allGames.length === 0 && (
        <div className="explore-page__empty">
          <h3>No games found</h3>
        </div>
      )}
    </div>
  );
};

export default ExplorePage;
