import type { Filter, Game } from '@game-catalog/shared';

export type GameFilters = Filter;

export const InitialFilters: GameFilters = {
  search: '',
  genres: [],
  platforms: [],
  engines: [],
  sellers: [],
  ratingMin: 0,
  ratingMax: 100,
  releaseDateMin: undefined,
  releaseDateMax: undefined,
  sortBy: 'release-desc',
};

export interface SortOption {
  value: string;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: 'release-desc', label: 'Дата релиза: сначала новые' },
  { value: 'release-asc', label: 'Дата релиза: сначала старые' },
  { value: 'rating-desc', label: 'Рейтинг: сначала высокий' },
  { value: 'rating-asc', label: 'Рейтинг: сначала низкий' },
  { value: 'name-asc', label: 'Имя: от А до Я' },
  { value: 'name-desc', label: 'Имя: от Я до А' },
];

export interface GenreOption {
  id: number;
  name: string;
  count: number;
}

export interface PlatformOption {
  id: number;
  name: string;
  count: number;
}

export interface EngineOption {
  id: number;
  name: string;
  count: number;
}

export const extractGenresFromGames = (games: Game[]): GenreOption[] => {
  const map = new Map<number, GenreOption>();
  games.forEach((game) =>
    game.genres?.forEach((g) => {
      if (!map.has(g.id)) map.set(g.id, { id: g.id, name: g.name, count: 1 });
      else map.get(g.id)!.count++;
    })
  );
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const extractPlatformsFromGames = (games: Game[]): PlatformOption[] => {
  const map = new Map<number, PlatformOption>();
  games.forEach((game) =>
    game.platforms?.forEach((p) => {
      if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name, count: 1 });
      else map.get(p.id)!.count++;
    })
  );
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const extractEnginesFromGames = (games: Game[]): EngineOption[] => {
  const map = new Map<number, EngineOption>();
  games.forEach((game) =>
    game.engines?.forEach((e) => {
      if (!map.has(e.id)) map.set(e.id, { id: e.id, name: e.name, count: 1 });
      else map.get(e.id)!.count++;
    })
  );
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};
