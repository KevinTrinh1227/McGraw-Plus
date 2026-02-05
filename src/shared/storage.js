/**
 * McGraw Plus - Unified Storage Module
 * Provides a consistent API for chrome.storage with batched writes
 */

const Storage = {
  // Storage keys
  KEYS: {
    // Settings
    SETTINGS: 'mp_settings',
    FEATURES: 'mp_features',

    // Stats
    STATS: 'mp_stats',
    DAILY_STATS: 'mp_daily_stats',

    // User data
    FLASHCARDS: 'mp_flashcards',
    DUE_DATES: 'mp_due_dates',
    COURSES: 'mp_courses',
    USER_PROFILE: 'mp_user_profile',

    // Solver-specific (migrated from old)
    RESPONSE_MAP: 'responseMap',
    SOLVER_UNLOCKED: 'mp_solver_unlocked',

    // Session
    SESSION: 'mp_session',

    // Onboarding
    ONBOARDING_COMPLETE: 'mp_onboarding_complete',
    FIRST_INSTALL: 'mp_first_install',

    // Timestamps for audit trail
    ONBOARDING_COMPLETED_AT: 'mp_onboarding_completed_at',
    SOLVER_TERMS_AGREED_AT: 'mp_solver_terms_agreed_at',
    SOLVER_ENABLED_AT: 'mp_solver_enabled_at',
    PIN_PROMPT_SHOWN_AT: 'mp_pin_prompt_shown_at',

    // Updates
    UPDATE_AVAILABLE: 'mp_update_available',
    UPDATE_VERSION: 'mp_update_version',

    // Legacy (for migration)
    LEGACY_BOT_ENABLED: 'isBotEnabled',
    LEGACY_STATS: 'sbs_stats',
    LEGACY_WEBHOOK: 'sbs_webhook_url',
    LEGACY_LLM_ENABLED: 'sbs_llm_enabled',
    LEGACY_LLM_PROVIDER: 'sbs_llm_provider',
    LEGACY_LLM_API_KEY: 'sbs_llm_api_key',
  },

  // Default settings
  DEFAULTS: {
    settings: {
      darkMode: true,
      keyboardShortcuts: true,
      dueDateTracker: true,
      statsTracker: true,
      notifications: true,
      quickCopy: false,
      flashcardGenerator: false,
      focusMode: false,
      pdfExport: false,
      studyTimer: false,
      progressBar: true,
      readability: false,
      tabTitle: true,
      autoResume: false,
      confidenceMarker: false,
      antiCopy: false,
      // Solver settings (hidden)
      solverEnabled: false,
    },
    stats: {
      totalQuestions: 0,
      correctFirstTry: 0,
      learnedFromFeedback: 0,
      totalSessions: 0,
      totalTimeMs: 0,
      byType: {
        multipleChoice: 0,
        fillInBlank: 0,
        dragAndDrop: 0,
      },
      currentSession: null,
      streakDays: 0,
      lastActiveDate: null,
      dailyLog: {},
    },
  },

  // In-memory cache
  _cache: {},

  // Dirty flags for batched writes
  _dirty: new Set(),

  // Save timer
  _saveTimer: null,
  _saveDebounceMs: 500,

  /**
   * Initialize storage (call on extension load)
   */
  async init() {
    // Load all cached keys
    const keys = Object.values(this.KEYS);
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        this._cache = result;
        resolve(this._cache);
      });
    });
  },

  /**
   * Get a value from storage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if key doesn't exist
   */
  async get(key, defaultValue = null) {
    if (this._cache.hasOwnProperty(key)) {
      return this._cache[key] ?? defaultValue;
    }

    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        this._cache[key] = result[key];
        resolve(result[key] ?? defaultValue);
      });
    });
  },

  /**
   * Set a value in storage (batched)
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   */
  async set(key, value) {
    this._cache[key] = value;
    this._dirty.add(key);
    this._scheduleSave();
  },

  /**
   * Set multiple values at once
   * @param {object} data - Object with key-value pairs
   */
  async setMultiple(data) {
    Object.entries(data).forEach(([key, value]) => {
      this._cache[key] = value;
      this._dirty.add(key);
    });
    this._scheduleSave();
  },

  /**
   * Remove a key from storage
   * @param {string} key - Storage key
   */
  async remove(key) {
    delete this._cache[key];
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  },

  /**
   * Schedule a batched save
   */
  _scheduleSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }

    this._saveTimer = setTimeout(() => {
      this._flushSave();
    }, this._saveDebounceMs);
  },

  /**
   * Immediately flush pending saves
   */
  async _flushSave() {
    if (this._dirty.size === 0) return;

    const dataToSave = {};
    this._dirty.forEach((key) => {
      dataToSave[key] = this._cache[key];
    });
    this._dirty.clear();

    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }

    return new Promise((resolve) => {
      chrome.storage.local.set(dataToSave, resolve);
    });
  },

  /**
   * Force immediate save (for critical moments)
   */
  async save() {
    return this._flushSave();
  },

  /**
   * Get settings with defaults
   */
  async getSettings() {
    const settings = await this.get(this.KEYS.SETTINGS, {});
    return { ...this.DEFAULTS.settings, ...settings };
  },

  /**
   * Update settings
   * @param {object} updates - Partial settings object
   */
  async updateSettings(updates) {
    const current = await this.getSettings();
    const newSettings = { ...current, ...updates };
    await this.set(this.KEYS.SETTINGS, newSettings);
    return newSettings;
  },

  /**
   * Get stats with defaults
   */
  async getStats() {
    const stats = await this.get(this.KEYS.STATS, {});
    return { ...this.DEFAULTS.stats, ...stats };
  },

  /**
   * Update stats
   * @param {object} updates - Partial stats object
   */
  async updateStats(updates) {
    const current = await this.getStats();
    const newStats = { ...current, ...updates };
    await this.set(this.KEYS.STATS, newStats);
    return newStats;
  },

  /**
   * Check if this is a fresh install
   */
  async isFirstInstall() {
    const firstInstall = await this.get(this.KEYS.FIRST_INSTALL);
    return firstInstall === null;
  },

  /**
   * Mark first install as complete
   */
  async markInstalled() {
    await this.set(this.KEYS.FIRST_INSTALL, Date.now());
  },

  /**
   * Check if onboarding is complete
   */
  async isOnboardingComplete() {
    return await this.get(this.KEYS.ONBOARDING_COMPLETE, false);
  },

  /**
   * Mark onboarding as complete
   */
  async completeOnboarding() {
    await this.set(this.KEYS.ONBOARDING_COMPLETE, true);
  },

  /**
   * Listen for storage changes
   * @param {function} callback - Called with (changes, areaName)
   */
  onChange(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        // Update cache
        Object.entries(changes).forEach(([key, { newValue }]) => {
          this._cache[key] = newValue;
        });
        callback(changes, areaName);
      }
    });
  },

  /**
   * Get cached value with TTL check
   * @param {string} key - Storage key
   * @param {number} maxAgeMs - Maximum age in milliseconds
   */
  async getCachedWithTTL(key, maxAgeMs = 3600000) {
    const data = await this.get(key);
    if (!data) return null;

    const timestamp = data.scrapedAt || data.timestamp || data.cachedAt;
    if (!timestamp || Date.now() - timestamp > maxAgeMs) {
      return null; // Expired
    }

    return data;
  },

  /**
   * Set cached value with timestamp
   * @param {string} key - Storage key
   * @param {any} value - Value to cache
   */
  async setCachedWithTimestamp(key, value) {
    const data = {
      ...value,
      cachedAt: Date.now(),
    };
    await this.set(key, data);
    return data;
  },

  /**
   * Invalidate cache for a key
   * @param {string} key - Storage key to invalidate
   */
  async invalidateCache(key) {
    await this.remove(key);
  },

  /**
   * Check if storage was recently cleared (graceful recovery)
   */
  async checkStorageHealth() {
    try {
      const marker = await this.get('mp_storage_marker');
      if (!marker) {
        // Storage was cleared, set marker and return false
        await this.set('mp_storage_marker', { createdAt: Date.now() });
        return false;
      }
      return true;
    } catch (error) {
      console.error('[McGraw Plus] Storage health check failed:', error);
      return false;
    }
  },

  /**
   * Setup unload handler to flush pending saves
   */
  setupUnloadHandler() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this._dirty.size > 0) {
          const dataToSave = {};
          this._dirty.forEach((key) => {
            dataToSave[key] = this._cache[key];
          });
          chrome.storage.local.set(dataToSave);
        }
      });
    }
  },
};

// Auto-setup unload handler
Storage.setupUnloadHandler();

// Export for different contexts
if (typeof window !== 'undefined') {
  window.MP_Storage = Storage;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}
