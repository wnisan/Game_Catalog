import type { Game } from '../services/api';

// фильтры
export interface GameFilters {
  search: string;
  genres: number[];
  platforms: number[];
  engines: number[];
  ratingMin: number;
  ratingMax: number;
  releaseDateMin?: string;
  releaseDateMax?: string;
  pegi: number[];
  sortBy: string;
}

// начальные фильтры
export const InitialFilters: GameFilters = {
  search: '',
  genres: [],
  platforms: [],
  engines: [],
  ratingMin: 0,
  ratingMax: 100,
  releaseDateMin: undefined,
  releaseDateMax: undefined,
  pegi: [],
  sortBy: 'release-desc'
}

// опции сортировки
export interface SortOption {
  value: string;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: 'release-desc', label: 'Release Date: Newest First' },
  { value: 'release-asc', label: 'Release Date: Oldest First' },
  { value: 'rating-desc', label: 'Rating: High to Low' },
  { value: 'rating-asc', label: 'Rating: Low to High' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'name-desc', label: 'Name: Z to A' }
]

// жанры
export interface GenreOption {
  id: number;
  name: string;
  count: number;
}

// платформы
export interface PlatformOption {
  id: number;
  name: string;
  count: number;
}

// движки
export interface EngineOption {
  id: number;
  name: string;
  count: number;
}

// извлечение фанров
export const extractGenresFromGames = (games: Game[]): GenreOption[] => {
  const map = new Map<number, GenreOption>()
  games.forEach(game => game.genres?.forEach(g => {
    if (!map.has(g.id)) map.set(g.id, { id: g.id, name: g.name, count: 1 })
    else map.get(g.id)!.count++
  }))
  return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name))
}

// извлечение платформ
export const extractPlatformsFromGames = (games: Game[]): PlatformOption[] => {
  const map = new Map<number, PlatformOption>()
  games.forEach(game => game.platforms?.forEach(p => {
    if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name, count: 1 })
    else map.get(p.id)!.count++
  }))
  return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name))
}

// извлечение движков
export const extractEnginesFromGames = (games: Game[]): EngineOption[] => {
  const map = new Map<number, EngineOption>()
  games.forEach(game => game.engines?.forEach(e => {
    if (!map.has(e.id)) map.set(e.id, { id: e.id, name: e.name, count: 1 })
    else map.get(e.id)!.count++
  }))
  return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name))
}