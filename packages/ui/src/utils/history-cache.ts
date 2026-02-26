import { HistoryEntry } from '@/stores/multi-project-store';

const HISTORY_CACHE_KEY = 'overture_history_cache';
const CACHE_VERSION = 1;

interface CachedHistory {
  version: number;
  timestamp: number;
  entries: HistoryEntry[];
}

/**
 * Client-side cache for history entries using localStorage.
 * This ensures history is available immediately on page load,
 * even before the WebSocket connection is established.
 */
export const historyCache = {
  /**
   * Save history entries to localStorage
   */
  save(entries: HistoryEntry[]): void {
    try {
      const cached: CachedHistory = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        entries,
      };
      localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(cached));
      console.log('[Overture] History cached locally:', entries.length, 'entries');
    } catch (error) {
      console.error('[Overture] Failed to cache history:', error);
    }
  },

  /**
   * Load history entries from localStorage
   */
  load(): HistoryEntry[] | null {
    try {
      const raw = localStorage.getItem(HISTORY_CACHE_KEY);
      if (!raw) return null;

      const cached: CachedHistory = JSON.parse(raw);

      // Validate version
      if (cached.version !== CACHE_VERSION) {
        console.log('[Overture] Cache version mismatch, clearing cache');
        this.clear();
        return null;
      }

      console.log('[Overture] Loaded cached history:', cached.entries.length, 'entries');
      return cached.entries;
    } catch (error) {
      console.error('[Overture] Failed to load cached history:', error);
      return null;
    }
  },

  /**
   * Clear the history cache
   */
  clear(): void {
    try {
      localStorage.removeItem(HISTORY_CACHE_KEY);
      console.log('[Overture] History cache cleared');
    } catch (error) {
      console.error('[Overture] Failed to clear history cache:', error);
    }
  },

  /**
   * Get the timestamp of when the cache was last updated
   */
  getLastUpdated(): number | null {
    try {
      const raw = localStorage.getItem(HISTORY_CACHE_KEY);
      if (!raw) return null;

      const cached: CachedHistory = JSON.parse(raw);
      return cached.timestamp;
    } catch {
      return null;
    }
  },

  /**
   * Check if cache is stale (older than specified milliseconds)
   */
  isStale(maxAgeMs: number = 60000): boolean {
    const lastUpdated = this.getLastUpdated();
    if (!lastUpdated) return true;
    return Date.now() - lastUpdated > maxAgeMs;
  },
};
