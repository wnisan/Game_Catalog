import { useEffect, useState } from 'react';
import { useFilters } from '../../contexts/FiltersContext';
import { extractGenresFromGames, extractPlatformsFromGames, extractEnginesFromGames, InitialFilters, type GenreOption, type PlatformOption, type EngineOption, type GameFilters } from '../../types/filters';
import type { Game, SellerOption } from '../../services/api';
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
    updateMultipleFilter,
    resetFilters: _resetFilters,
    hasActiveFilters,
    getActiveFiltersCount
  } = useFilters();

  const [availableGenres, setAvailableGenres] = useState<GenreOption[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<PlatformOption[]>([]);
  const [availableEngines, setAvailableEngines] = useState<EngineOption[]>([]);
  const [availableSellers, setAvailableSellers] = useState<SellerOption[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingSellers, setIsLoadingSellers] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    sort: false,
    genres: false,
    platforms: false,
    engines: false,
    sellers: false,
    release: false,
    rating: false
  });

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
          setAvailableGenres(extractGenresFromGames(allGames));
          setAvailablePlatforms(extractPlatformsFromGames(allGames));
          setAvailableEngines(extractEnginesFromGames(allGames));
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

  useEffect(() => {
    const loadSellers = async () => {
      setIsLoadingSellers(true);
      try {
        const { getAllSellers } = await import('../../services/api');
        const sellers = await getAllSellers();
        setAvailableSellers(sellers);
      } catch {
        setAvailableSellers([]);
      } finally {
        setIsLoadingSellers(false);
      }
    };
    loadSellers();
  }, []);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleFilterChange = <K extends keyof GameFilters>(field: K, value: GameFilters[K]) => {
    const updatedFilters = { ...filters, [field]: value };
    updateFilter(field, value);
    onFiltersChange(updatedFilters);
  };

  const handleReset = () => {
    _resetFilters();
    onFiltersChange(InitialFilters);
  };

  if (!isOpen) return null;

  return (
    <div className="filter-panel">
      <div className="filter-panel__header">
        <h2>Фильтры</h2>
        {hasActiveFilters() && (
          <div className="filter-panel__header-right">
            <span className="filter-panel__active-count">
              {getActiveFiltersCount()} активных
            </span>
            <button
              type="button"
              className="filter-panel__reset-btn"
              onClick={handleReset}
              aria-label="Сбросить все фильтры"
            >
              Сбросить все
            </button>
          </div>
        )}
      </div>

      <FilterSection title="Сортировка" isExpanded={expandedSections.sort} onToggle={() => toggleSection('sort')}>
        <SortSelect value={filters.sortBy} onChange={v => handleFilterChange('sortBy', v)} />
      </FilterSection>

      <FilterSection title="Жанры" isExpanded={expandedSections.genres} onToggle={() => toggleSection('genres')}>
        {isLoadingStats ? (
          <div role="status" aria-live="polite">Загрузка жанров...</div>
        ) : availableGenres.length > 0 ? (
          <div role="group" aria-label="Выберите жанры">
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
                  aria-label={`Фильтр по жанру ${g.name}. Доступно игр: ${g.count || 0}`}
                />
                {g.name} ({g.count || 0})
              </label>
            ))}
          </div>
        ) : (
          <div role="status">Жанры недоступны</div>
        )}
      </FilterSection>

      <FilterSection title="Платформы" isExpanded={expandedSections.platforms} onToggle={() => toggleSection('platforms')}>
        {isLoadingStats ? (
          <div role="status" aria-live="polite">Загрузка платформ...</div>
        ) : availablePlatforms.length > 0 ? (
          <div role="group" aria-label="Выберите платформы">
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
                  aria-label={`Фильтр по платформе ${p.name}. Доступно игр: ${p.count || 0}`}
                />
                {p.name} ({p.count || 0})
              </label>
            ))}
          </div>
        ) : (
          <div role="status">Платформы недоступны</div>
        )}
      </FilterSection>

      <FilterSection title="Игровые движки" isExpanded={expandedSections.engines} onToggle={() => toggleSection('engines')}>
        {isLoadingStats ? (
          <div role="status" aria-live="polite">Загрузка движков...</div>
        ) : availableEngines.length > 0 ? (
          <div role="group" aria-label="Выберите игровые движки">
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
                  aria-label={`Фильтр по движку ${e.name}. Доступно игр: ${e.count || 0}`}
                />
                {e.name} ({e.count || 0})
              </label>
            ))}
          </div>
        ) : (
          <div role="status">Движки недоступны</div>
        )}
      </FilterSection>

      <FilterSection title="Продавцы" isExpanded={expandedSections.sellers} onToggle={() => toggleSection('sellers')}>
        {isLoadingSellers ? (
          <div role="status" aria-live="polite">Загрузка продавцов...</div>
        ) : availableSellers.length > 0 ? (
          <div role="group" aria-label="Выберите продавцов" style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
            {availableSellers.map(s => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  checked={filters.sellers.includes(s.id)}
                  onChange={() => {
                    const newSellers = filters.sellers.includes(s.id)
                      ? filters.sellers.filter(id => id !== s.id)
                      : [...filters.sellers, s.id];
                    const selectedSellers = availableSellers.filter(sel => newSellers.includes(sel.id));
                    const gameIds = [...new Set(selectedSellers.flatMap(sel => sel.game_ids))];
                    const update = { ...filters, sellers: newSellers, sellerGameIds: gameIds };
                    updateMultipleFilter({ sellers: newSellers, sellerGameIds: gameIds });
                    onFiltersChange(update);
                  }}
                  aria-label={`Фильтр по продавцу ${s.display_name}. Доступно игр: ${s.game_ids.length}`}
                />
                {s.display_name}
                {s.is_verified && <span title="Проверенный продавец"> ✓</span>}
              </label>
            ))}
          </div>
        ) : (
          <div role="status">Продавцы недоступны</div>
        )}
      </FilterSection>

      <FilterSection title="Дата релиза" isExpanded={expandedSections.release} onToggle={() => toggleSection('release')}>
        <label htmlFor="release-date-min">
          <span className="sr-only">Минимальная дата релиза</span>
          От:
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
          aria-label="Фильтр игр: релиз не раньше этой даты"
        />
        <label htmlFor="release-date-max">
          <span className="sr-only">Максимальная дата релиза</span>
          До:
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
          aria-label="Фильтр игр: релиз не позже этой даты"
        />
      </FilterSection>

      <FilterSection title="Рейтинг" isExpanded={expandedSections.rating} onToggle={() => toggleSection('rating')}>
        <div style={{ marginBottom: '8px' }}>
          <label htmlFor="rating-min">
            Мин: <span aria-live="polite" aria-atomic="true">{filters.ratingMin}</span>
          </label>
          <input
            id="rating-min"
            type="range"
            min={0}
            max={100}
            value={filters.ratingMin}
            onChange={e => {
              const newMin = Number(e.target.value);
              handleFilterChange('ratingMin', Math.min(newMin, filters.ratingMax));
            }}
            aria-label={`Минимальный рейтинг: ${filters.ratingMin} из 100`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={filters.ratingMin}
          />
        </div>
        <div>
          <label htmlFor="rating-max">
            Макс: <span aria-live="polite" aria-atomic="true">{filters.ratingMax}</span>
          </label>
          <input
            id="rating-max"
            type="range"
            min={0}
            max={100}
            value={filters.ratingMax}
            onChange={e => {
              const newMax = Number(e.target.value);
              handleFilterChange('ratingMax', Math.max(newMax, filters.ratingMin));
            }}
            aria-label={`Максимальный рейтинг: ${filters.ratingMax} из 100`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={filters.ratingMax}
          />
        </div>
        <div style={{ marginTop: '8px', fontWeight: 'bold' }} role="status" aria-live="polite">
          Диапазон рейтинга: {filters.ratingMin} – {filters.ratingMax}
        </div>
      </FilterSection>

    </div>
  );
};

export default FilterPanel;
