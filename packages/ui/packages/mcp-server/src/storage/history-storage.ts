import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { HistoryFile, PersistedPlan, HistoryEntry } from '../types.js';

const HISTORY_DIR = path.join(os.homedir(), '.overture');
const HISTORY_FILE = path.join(HISTORY_DIR, 'history.json');
const MAX_HISTORY_ENTRIES = 100; // Keep last 100 plans

/**
 * Manages persistent storage of plan history in a local JSON file.
 * Location: ~/.overture/history.json
 */
class HistoryStorage {
  private cache: HistoryFile | null = null;
  private writeDebounceTimer: NodeJS.Timeout | null = null;
  private writePromise: Promise<void> | null = null;

  /**
   * Ensure the history directory exists
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(HISTORY_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Load history from disk (with caching)
   */
  async load(): Promise<HistoryFile> {
    if (this.cache) return this.cache;

    try {
      await this.ensureDirectory();
      const data = await fs.readFile(HISTORY_FILE, 'utf-8');
      const parsed = JSON.parse(data);

      // Validate structure
      if (!parsed || typeof parsed.version !== 'number') {
        console.error('[Overture] Invalid history file format, but preserving file');
        // Don't overwrite - create empty cache but don't save
        this.cache = {
          version: 1,
          lastUpdated: new Date().toISOString(),
          entries: [],
          plans: {}
        };
        return this.cache;
      }

      this.cache = parsed;
      console.error(`[Overture] Loaded history: ${this.cache.entries.length} entries`);
      return this.cache;
    } catch (error: any) {
      // Only create new file if it truly doesn't exist
      if (error.code === 'ENOENT') {
        console.error('[Overture] History file does not exist, creating new one');
        this.cache = {
          version: 1,
          lastUpdated: new Date().toISOString(),
          entries: [],
          plans: {}
        };
        await this.ensureDirectory();
        await fs.writeFile(HISTORY_FILE, JSON.stringify(this.cache, null, 2));
        console.error('[Overture] Created new history file at', HISTORY_FILE);
        return this.cache;
      }

      // For other errors (parse error, permission error, etc.), log but don't overwrite
      console.error('[Overture] Error loading history file:', error.message);
      console.error('[Overture] NOT overwriting existing file - using empty cache');
      this.cache = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        entries: [],
        plans: {}
      };
      return this.cache;
    }
  }

  /**
   * Initialize history storage (call this on server start)
   */
  async initialize(): Promise<void> {
    const history = await this.load();
    console.error('[Overture] History storage initialized');
    console.error('[Overture] History file:', HISTORY_FILE);
    console.error('[Overture] Entries loaded:', history.entries.length);
    if (history.entries.length > 0) {
      console.error('[Overture] Most recent plan:', history.entries[0].title);
    }
  }

  /**
   * Save history to disk (debounced to avoid excessive writes)
   */
  async save(): Promise<void> {
    // Clear any existing debounce timer
    if (this.writeDebounceTimer) {
      clearTimeout(this.writeDebounceTimer);
    }

    // Return existing write promise if one is pending
    if (this.writePromise) {
      return this.writePromise;
    }

    this.writePromise = new Promise((resolve, reject) => {
      this.writeDebounceTimer = setTimeout(async () => {
        try {
          if (!this.cache) {
            resolve();
            return;
          }

          this.cache.lastUpdated = new Date().toISOString();
          await this.ensureDirectory();
          await fs.writeFile(HISTORY_FILE, JSON.stringify(this.cache, null, 2));
          console.error('[Overture] History saved to', HISTORY_FILE);
          resolve();
        } catch (error) {
          console.error('[Overture] Failed to save history:', error);
          reject(error);
        } finally {
          this.writePromise = null;
        }
      }, 1000); // Write at most once per second
    });

    return this.writePromise;
  }

  /**
   * Force immediate save (bypass debounce)
   */
  async saveNow(): Promise<void> {
    if (this.writeDebounceTimer) {
      clearTimeout(this.writeDebounceTimer);
      this.writeDebounceTimer = null;
    }

    if (!this.cache) return;

    this.cache.lastUpdated = new Date().toISOString();
    await this.ensureDirectory();
    await fs.writeFile(HISTORY_FILE, JSON.stringify(this.cache, null, 2));
    console.error('[Overture] History saved (immediate) to', HISTORY_FILE);
  }

  /**
   * Save or update a plan in history
   */
  async savePlan(plan: PersistedPlan): Promise<void> {
    const history = await this.load();

    // Create history entry
    const entry: HistoryEntry = {
      id: plan.plan.id,
      projectId: plan.plan.projectId,
      workspacePath: plan.plan.workspacePath,
      projectName: path.basename(plan.plan.workspacePath),
      title: plan.plan.title,
      agent: plan.plan.agent,
      status: plan.plan.status,
      createdAt: plan.plan.createdAt,
      updatedAt: new Date().toISOString(),
      nodeCount: plan.nodes.length,
      completedNodeCount: plan.nodes.filter(n => n.status === 'completed').length
    };

    // Update or add entry
    const existingIndex = history.entries.findIndex(e => e.id === plan.plan.id);
    if (existingIndex >= 0) {
      history.entries[existingIndex] = entry;
    } else {
      history.entries.unshift(entry); // Add to front (most recent)
    }

    // Store full plan data
    history.plans[plan.plan.id] = plan;

    // Prune old entries if over limit
    if (history.entries.length > MAX_HISTORY_ENTRIES) {
      const removed = history.entries.splice(MAX_HISTORY_ENTRIES);
      removed.forEach(e => delete history.plans[e.id]);
      console.error(`[Overture] Pruned ${removed.length} old history entries`);
    }

    await this.save();
  }

  /**
   * Get a full plan by ID
   */
  async getPlan(planId: string): Promise<PersistedPlan | null> {
    const history = await this.load();
    return history.plans[planId] || null;
  }

  /**
   * Get history entries filtered by project
   */
  async getEntriesByProject(projectId: string): Promise<HistoryEntry[]> {
    const history = await this.load();
    return history.entries.filter(e => e.projectId === projectId);
  }

  /**
   * Get all history entries
   */
  async getAllEntries(): Promise<HistoryEntry[]> {
    const history = await this.load();
    return history.entries;
  }

  /**
   * Delete a plan from history
   */
  async deletePlan(planId: string): Promise<void> {
    const history = await this.load();
    history.entries = history.entries.filter(e => e.id !== planId);
    delete history.plans[planId];
    await this.save();
  }

  /**
   * Clear all history
   */
  async clearAll(): Promise<void> {
    this.cache = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      entries: [],
      plans: {}
    };
    await this.saveNow();
  }

  /**
   * Get the history file path (for debugging)
   */
  getHistoryPath(): string {
    return HISTORY_FILE;
  }
}

export const historyStorage = new HistoryStorage();
