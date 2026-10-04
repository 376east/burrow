import type { ProviderCatalogSearchResultItem } from '@shared/contracts';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../../features/modpacks/hooks/useModpackNavigation';
const FAVORITES_STORAGE_KEY = 'modpack-favorites';
const HISTORY_STORAGE_KEY = 'modpack-history';
const ITEMS_PER_PAGE_STORAGE_KEY = 'modpack-items-per-page';
export const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48] as const;

export function safeStorageRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return null;
  }
}

export function safeStorageWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Error writing ${key}:`, error);
  }
}

export function safeStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing ${key}:`, error);
  }
}

export function readFavorites(): Set<string> {
  const raw = safeStorageRead(FAVORITES_STORAGE_KEY);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch (error) {
    console.error('Error loading favorites:', error);
    return new Set();
  }
}

function isCatalogHistoryItem(value: unknown): value is ProviderCatalogSearchResultItem {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProviderCatalogSearchResultItem>;
  return (candidate.platform === 'modrinth' || candidate.platform === 'curseforge')
    && typeof candidate.projectId === 'string'
    && candidate.projectId.length > 0
    && typeof candidate.title === 'string'
    && candidate.title.length > 0;
}

export function readHistory(): ProviderCatalogSearchResultItem[] {
  const raw = safeStorageRead(HISTORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCatalogHistoryItem).slice(0, 50) : [];
  } catch (error) {
    console.error('Error loading history:', error);
    return [];
  }
}

export function resolveItemsPerPage(initialValue: number): number {
  const normalizedInitial = ITEMS_PER_PAGE_OPTIONS.includes(initialValue as (typeof ITEMS_PER_PAGE_OPTIONS)[number])
    ? initialValue
    : DEFAULT_MODPACK_BROWSER_STATE.itemsPerPage;
  if (normalizedInitial !== DEFAULT_MODPACK_BROWSER_STATE.itemsPerPage) return normalizedInitial;

  const saved = Number(safeStorageRead(ITEMS_PER_PAGE_STORAGE_KEY));
  return ITEMS_PER_PAGE_OPTIONS.includes(saved as (typeof ITEMS_PER_PAGE_OPTIONS)[number])
    ? saved
    : normalizedInitial;
}

