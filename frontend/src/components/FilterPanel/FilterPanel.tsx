import { useEffect, useState } from 'react';
import { useFilters } from '../../contexts/FiltersContext';
import { extractGenresFromGames, extractPlatformsFromGames, extractEnginesFromGames, InitialFilters, type GenreOption, type PlatformOption, type EngineOption, type GameFilters } from '../../types/filters';
import type { Game } from '../../services/api';
import FilterSection from '../FilterSection/FilterSection';
import SortSelect from '../SortSelect/SortSelect';
import DatePicker from 'react-datepicker';
import { format, parse } from 'date-fns';
import { enGB } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import './FilterPanel.css';

interface FilterPanelProps {
  onFiltersChange: (filters: GameFilters) => void;
  allGames: Game[];
  isOpen?: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ onFiltersChange, allGames, isOpen = false }) => {
  const {
    filters,
    updateFilter,
    resetFilters: _resetFilters,
    hasActiveFilters,
    getActiveFiltersCount
  } = useFilters();

  const [availableGenres, setAvailableGenres] = useState<GenreOption[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<PlatformOption[]>([]);
  const [availableEngines, setAvailableEngines] = useState<EngineOption[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    search: true,
    sort: false,
    genres: false,
    platforms: false,
    engines: false,
    release: false,
    rating: false
  });

  // загрузка статистики фильтров(только при монтировании)
  useEffect(() => {
    const loadFilterStats = async () => {
      setIsLoadingStats(true);
      try {
        const { getFilterStats } = await import('../../services/api');
        const stats = await getFilterStats();
        if (stats && stats.genres && stats.platforms && stats.engines) {
          if (stats.genres.length > 0 || stats.platforms.length > 0 || stats.engines.length > 0) {
            setAvailableGenres(stats.genres || []);
            setAvailablePlatforms(stats.platforms || []);
            setAvailableEngines(stats.engines || []);
          } else {
            throw new Error('Empty filter stats data');
          }
        } else {
          throw new Error('Incomplete filter stats data');
        }
      } catch (error: any) {
        console.error('Error loading filter stats:', error);
        if (allGames.length > 0) {
          const localGenres = extractGenresFromGames(allGames);
          const localPlatforms = extractPlatformsFromGames(allGames);
          const localEngines = extractEnginesFromGames(allGames);
          setAvailableGenres(localGenres);
          setAvailablePlatforms(localPlatforms);
          setAvailableEngines(localEngines);
        } else {
          setAvailableGenres([]);
          setAvailablePlatforms([]);
          setAvailableEngines([]);
        }
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadFilterStats();
  }, []);

  // показать/скрыть
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // обработчик изменения фильтра
  const handleFilterChange = <K extends keyof GameFilters>(field: K, value: GameFilters[K]) => {
    const updatedFilters = { ...filters, [field]: value };
    updateFilter(field, value);
    onFiltersChange(updatedFilters);
  };

  // сброс фильтров
  const handleReset = () => {
    _resetFilters();
    onFiltersChange(InitialFilters);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="filter-panel">
      <div className="filter-panel__header">
        <h2>Filters</h2>
        {hasActiveFilters() && (
          <div className="filter-panel__header-right">
            <span className="filter-panel__active-count">
              {getActiveFiltersCount()} active
            </span>
            <button
              type="button"
              className="filter-panel__reset-btn"
              onClick={handleReset}
              aria-label="Reset all filters"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      <FilterSection title="Search" isExpanded={expandedSections.search} onToggle={() => toggleSection('search')}>
        <label htmlFor="search-input" className="sr-only">Search games by name</label>
        <input
          id="search-input"
          type="text"
          className="filter-panel__search-input"
          placeholder="Search games..."
          value={filters.search || ''}
          onChange={e => handleFilterChange('search', e.target.value)}
          aria-label="Search games by name"
        />
      </FilterSection>


      <FilterSection title="Sorting" isExpanded={expandedSections.sort} onToggle={() => toggleSection('sort')}>
        <SortSelect value={filters.sortBy} onChange={v => handleFilterChange('sortBy', v)} />
      </FilterSection>

      <FilterSection title={`Genres`} isExpanded={expandedSections.genres} onToggle={() => toggleSection('genres')}>
        {isLoadingStats ? (
          <div role="status" aria-live="polite">Loading genres...</div>
        ) : availableGenres.length > 0 ? (
          <div role="group" aria-label="Select genres">
            {availableGenres.map(g => (
              <label key={g.id}>
                <input
                  type="checkbox"
                  checked={filters.genres.includes(g.id)}
                  onChange={() => {
                    const newGenres = filters.genres.includes(g.id)
                      ? filters.genres.filter(id => id !== g.id)
                      : [...filters.genres, g.id];
                    handleFilterChange('genres', newGenres);
                  }}
                  aria-label={`Filter by ${g.name} genre, ${g.count || 0} games available`}
                />
                {g.name} ({g.count || 0})
              </label>
            ))}
          </div>
        ) : (
          <div role="status">No genres available</div>
        )}
      </FilterSection>

      <FilterSection title={`Platforms`} isExpanded={expandedSections.platforms} onToggle={() => toggleSection('platforms')}>
        {isLoadingStats ? (
          <div role="status" aria-live="polite">Loading platforms...</div>
        ) : availablePlatforms.length > 0 ? (
          <div role="group" aria-label="Select platforms">
            {availablePlatforms.map(p => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={filters.platforms.includes(p.id)}
                  onChange={() => {
                    const newPlatforms = filters.platforms.includes(p.id)
                      ? filters.platforms.filter(id => id !== p.id)
                      : [...filters.platforms, p.id];
                    handleFilterChange('platforms', newPlatforms);
                  }}
                  aria-label={`Filter by ${p.name} platform, ${p.count || 0} games available`}
                />
                {p.name} ({p.count || 0})
              </label>
            ))}
          </div>
        ) : (
          <div role="status">No platforms available</div>
        )}
      </FilterSection>

      <FilterSection title={`Game Engines`} isExpanded={expandedSections.engines} onToggle={() => toggleSection('engines')}>
        {isLoadingStats ? (
          <div role="status" aria-live="polite">Loading engines...</div>
        ) : availableEngines.length > 0 ? (
          <div role="group" aria-label="Select game engines">
            {availableEngines.map(e => (
              <label key={e.id}>
                <input
                  type="checkbox"
                  checked={filters.engines.includes(e.id)}
                  onChange={() => {
                    const newEngines = filters.engines.includes(e.id)
                      ? filters.engines.filter(id => id !== e.id)
                      : [...filters.engines, e.id];
                    handleFilterChange('engines', newEngines);
                  }}
                  aria-label={`Filter by ${e.name} engine, ${e.count || 0} games available`}
                />
                {e.name} ({e.count || 0})
              </label>
            ))}
          </div>
        ) : (
          <div role="status">No engines available</div>
        )}
      </FilterSection>

      <FilterSection title="Release Date" isExpanded={expandedSections.release} onToggle={() => toggleSection('release')}>
        <label htmlFor="release-date-min">
          <span className="sr-only">Minimum release date</span>
          From:
        </label>
        <DatePicker
          id="release-date-min"
          selected={filters.releaseDateMin ? parse(filters.releaseDateMin, 'yyyy-MM-dd', new Date()) : null}
          onChange={(date: Date | null) => {
            handleFilterChange('releaseDateMin', date ? format(date, 'yyyy-MM-dd') : '');
          }}
          dateFormat="dd.MM.yyyy"
          locale={enGB}
          placeholderText="dd.mm.yyyy"
          className="filter-panel__date-input"
          aria-label="Filter games released from this date"
        />
        <label htmlFor="release-date-max">
          <span className="sr-only">Maximum release date</span>
          To:
        </label>
        <DatePicker
          id="release-date-max"
          selected={filters.releaseDateMax ? parse(filters.releaseDateMax, 'yyyy-MM-dd', new Date()) : null}
          onChange={(date: Date | null) => {
            handleFilterChange('releaseDateMax', date ? format(date, 'yyyy-MM-dd') : '');
          }}
          dateFormat="dd.MM.yyyy"
          locale={enGB}
          placeholderText="dd.mm.yyyy"
          className="filter-panel__date-input"
          aria-label="Filter games released until this date"
        />
      </FilterSection>

      <FilterSection title="Rating" isExpanded={expandedSections.rating} onToggle={() => toggleSection('rating')}>
        <div style={{ marginBottom: '8px' }}>
          <label htmlFor="rating-min">
            Min: <span aria-live="polite" aria-atomic="true">{filters.ratingMin}</span>
          </label>
          <input
            id="rating-min"
            type="range"
            min={0}
            max={100}
            value={filters.ratingMin}
            onChange={e => {
              const newMin = Number(e.target.value);
              const adjustedMin = Math.min(newMin, filters.ratingMax);
              handleFilterChange('ratingMin', adjustedMin);
            }}
            aria-label={`Minimum rating: ${filters.ratingMin} out of 100`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={filters.ratingMin}
          />
        </div>
        <div>
          <label htmlFor="rating-max">
            Max: <span aria-live="polite" aria-atomic="true">{filters.ratingMax}</span>
          </label>
          <input
            id="rating-max"
            type="range"
            min={0}
            max={100}
            value={filters.ratingMax}
            onChange={e => {
              const newMax = Number(e.target.value);
              const adjustedMax = Math.max(newMax, filters.ratingMin);
              handleFilterChange('ratingMax', adjustedMax);
            }}
            aria-label={`Maximum rating: ${filters.ratingMax} out of 100`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={filters.ratingMax}
          />
        </div>
        <div style={{ marginTop: '8px', fontWeight: 'bold' }} role="status" aria-live="polite">
          Rating range: {filters.ratingMin} – {filters.ratingMax}
        </div>
      </FilterSection>

    </div>
  );
};

export default FilterPanel;
