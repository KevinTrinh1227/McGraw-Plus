/**
 * Stats tracking system for McGraw-Hill SmartBook Solver
 * Tracks questions answered, accuracy, sessions, and more
 * Optimized with batching and debouncing to reduce storage writes
 */

const Stats = {
  // Storage key
  STORAGE_KEY: "sbs_stats",

  // Default stats structure
  defaults: {
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
    lastUpdated: null,
  },

  // In-memory cache (primary working copy)
  _cache: null,

  // Debounce timer for batched writes
  _saveTimer: null,
  _saveDebounceMs: 500, // Batch writes every 500ms for faster updates

  // Flag to track if there are pending changes
  _dirty: false,

  /**
   * Load stats from storage
   */
  async load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(this.STORAGE_KEY, (result) => {
        this._cache = result[this.STORAGE_KEY] || { ...this.defaults };
        resolve(this._cache);
      });
    });
  },

  /**
   * Save stats to storage (debounced)
   * Batches multiple writes into one for efficiency
   */
  _scheduleSave() {
    this._dirty = true;

    // Clear existing timer
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }

    // Schedule new save
    this._saveTimer = setTimeout(() => {
      this._flushSave();
    }, this._saveDebounceMs);
  },

  /**
   * Immediately flush pending saves to storage
   */
  async _flushSave() {
    if (!this._cache || !this._dirty) return;

    this._dirty = false;
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }

    this._cache.lastUpdated = Date.now();
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: this._cache }, resolve);
    });
  },

  /**
   * Force immediate save (for critical moments like session end)
   */
  async save() {
    return this._flushSave();
  },

  /**
   * Get current stats (cached)
   */
  async get() {
    if (!this._cache) {
      await this.load();
    }
    return this._cache;
  },

  /**
   * Start a new session
   */
  async startSession() {
    await this.load();
    this._cache.totalSessions++;
    this._cache.currentSession = {
      startTime: Date.now(),
      questions: 0,
      correct: 0,
      wrong: 0,
    };
    // Immediately save session start (important event)
    await this.save();
    return this._cache.currentSession;
  },

  /**
   * End the current session
   */
  async endSession() {
    await this.load();
    if (this._cache.currentSession) {
      const session = this._cache.currentSession;
      session.endTime = Date.now();
      session.duration = session.endTime - session.startTime;
      this._cache.totalTimeMs += session.duration;

      // Return session summary before clearing
      const summary = { ...session };
      this._cache.currentSession = null;

      // Immediately save session end (important event)
      await this.save();
      return summary;
    }
    return null;
  },

  /**
   * Record a question answered
   * Uses debounced save to batch multiple questions
   * @param {string} type - 'multipleChoice', 'fillInBlank', or 'dragAndDrop'
   * @param {boolean} correct - Was the answer correct on first try?
   * @param {boolean} learned - Was this learned from feedback (not stored)?
   */
  async recordQuestion(type, correct, learned = false) {
    if (!this._cache) {
      await this.load();
    }

    this._cache.totalQuestions++;

    if (correct) {
      this._cache.correctFirstTry++;
    }

    if (learned) {
      this._cache.learnedFromFeedback++;
    }

    // Track by type
    if (type && this._cache.byType[type] !== undefined) {
      this._cache.byType[type]++;
    }

    // Update current session
    if (this._cache.currentSession) {
      this._cache.currentSession.questions++;
      if (correct) {
        this._cache.currentSession.correct++;
      } else {
        this._cache.currentSession.wrong++;
      }
    }

    // Schedule batched save (doesn't write immediately)
    this._scheduleSave();
  },

  /**
   * Get session stats (current session)
   */
  async getSessionStats() {
    if (!this._cache) {
      await this.load();
    }
    return this._cache.currentSession;
  },

  /**
   * Get lifetime stats
   */
  async getLifetimeStats() {
    if (!this._cache) {
      await this.load();
    }

    const accuracy =
      this._cache.totalQuestions > 0
        ? Math.round((this._cache.correctFirstTry / this._cache.totalQuestions) * 100)
        : 0;

    // Estimate time saved (assume 30 seconds per question manually)
    const timeSavedMs = this._cache.totalQuestions * 30 * 1000;

    return {
      totalQuestions: this._cache.totalQuestions,
      correctFirstTry: this._cache.correctFirstTry,
      learnedFromFeedback: this._cache.learnedFromFeedback,
      accuracy,
      totalSessions: this._cache.totalSessions,
      totalTimeMs: this._cache.totalTimeMs,
      timeSavedMs,
      byType: this._cache.byType,
    };
  },

  /**
   * Reset all stats
   */
  async reset() {
    this._cache = { ...this.defaults };
    await this.save();
  },

  /**
   * Export stats as JSON
   */
  async exportJSON() {
    if (!this._cache) {
      await this.load();
    }
    return JSON.stringify(this._cache, null, 2);
  },

  /**
   * Format duration for display
   */
  formatDuration(ms) {
    if (!ms || ms < 0) return "0s";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  },

  /**
   * Ensure any pending writes are flushed before page unload
   */
  setupUnloadHandler() {
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        if (this._dirty && this._cache) {
          // Synchronous storage write on unload
          this._cache.lastUpdated = Date.now();
          chrome.storage.local.set({ [this.STORAGE_KEY]: this._cache });
        }
      });
    }
  },
};

// Setup unload handler to flush pending saves
Stats.setupUnloadHandler();

// Make available globally
if (typeof window !== "undefined") {
  window.SBS_Stats = Stats;
}
