/**
 * McGraw Plus - Utility Functions
 */

const Utils = {
  /**
   * Debounce a function
   * @param {function} fn - Function to debounce
   * @param {number} ms - Delay in milliseconds
   * @returns {function}
   */
  debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  /**
   * Throttle a function
   * @param {function} fn - Function to throttle
   * @param {number} ms - Minimum interval in milliseconds
   * @returns {function}
   */
  throttle(fn, ms) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= ms) {
        lastCall = now;
        return fn.apply(this, args);
      }
    };
  },

  /**
   * Sleep for a duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Format duration in milliseconds
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(ms) {
    if (!ms || ms < 0) return '0s';
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
   * Format time remaining
   * @param {number} ms - Milliseconds remaining
   * @returns {string} Formatted time
   */
  formatTimeRemaining(ms) {
    if (!ms || ms < 0) return 'Now';

    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return 'Now';
    }
  },

  /**
   * Format date for display
   * @param {Date|number|string} date - Date to format
   * @returns {string} Formatted date
   */
  formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = d - now;

    // If less than 24 hours, show relative
    if (Math.abs(diff) < 86400000) {
      if (diff < 0) return 'Past due';
      return this.formatTimeRemaining(diff);
    }

    // Otherwise show date
    const options = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== now.getFullYear()) {
      options.year = 'numeric';
    }
    return d.toLocaleDateString(undefined, options);
  },

  /**
   * Escape HTML for safe display
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Generate a unique ID
   * @returns {string} Unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Deep clone an object
   * @param {object} obj - Object to clone
   * @returns {object} Cloned object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Compare semantic versions
   * @param {string} a - Version A
   * @param {string} b - Version B
   * @returns {number} 1 if a > b, -1 if a < b, 0 if equal
   */
  compareSemver(a, b) {
    const pa = a.replace(/^v/, '').split('.').map(Number);
    const pb = b.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  },

  /**
   * Truncate text with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  },

  /**
   * Check if URL is a McGraw-Hill learning page
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isMcGrawHillUrl(url) {
    if (!url) return false;
    return url.includes('learning.mheducation.com') || url.includes('connect.mheducation.com');
  },

  /**
   * Check if URL is a SmartBook page
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isSmartBookUrl(url) {
    if (!url) return false;
    return url.includes('learning.mheducation.com') &&
           (url.includes('smartbook') || url.includes('/flow/'));
  },

  /**
   * Parse query parameters from URL
   * @param {string} url - URL to parse
   * @returns {object} Query parameters
   */
  parseQueryParams(url) {
    const params = {};
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
    } catch (e) {
      // Invalid URL
    }
    return params;
  },

  /**
   * Create a MutationObserver with automatic cleanup
   * @param {Element} target - Element to observe
   * @param {function} callback - Mutation callback
   * @param {object} options - Observer options
   * @returns {MutationObserver}
   */
  createObserver(target, callback, options = { childList: true, subtree: true }) {
    const observer = new MutationObserver(callback);
    observer.observe(target, options);
    return observer;
  },

  /**
   * Wait for an element to appear in the DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Element|null>}
   */
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      // Check if already exists
      const existing = document.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Timeout
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  },

  /**
   * Calculate streak from daily log
   * @param {object} dailyLog - Object with date keys and activity values
   * @returns {number} Current streak
   */
  calculateStreak(dailyLog) {
    if (!dailyLog || Object.keys(dailyLog).length === 0) return 0;

    const dates = Object.keys(dailyLog).sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Check if user was active today or yesterday
    if (dates[0] !== today && dates[0] !== yesterday) {
      return 0;
    }

    let streak = 0;
    let currentDate = dates[0] === today ? new Date() : new Date(Date.now() - 86400000);

    for (let i = 0; i < dates.length && i < 365; i++) {
      const expectedDate = new Date(currentDate - i * 86400000).toISOString().split('T')[0];
      if (dates.includes(expectedDate)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  },

  /**
   * Get today's date string
   * @returns {string} YYYY-MM-DD format
   */
  getTodayString() {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        return true;
      } finally {
        document.body.removeChild(textarea);
      }
    }
  },

  /**
   * Download data as file
   * @param {string} data - Data to download
   * @param {string} filename - Filename
   * @param {string} type - MIME type
   */
  downloadFile(data, filename, type = 'application/json') {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// Dev mode configuration
// Set mp_dev_mode in storage to enable verbose logging
const DevMode = {
  _enabled: false,
  _initialized: false,

  async init() {
    if (this._initialized) return;
    this._initialized = true;

    try {
      const result = await chrome.storage.local.get('mp_dev_mode');
      this._enabled = result.mp_dev_mode === true;
    } catch {
      this._enabled = false;
    }
  },

  isEnabled() {
    return this._enabled;
  },

  async setEnabled(enabled) {
    this._enabled = enabled;
    try {
      await chrome.storage.local.set({ mp_dev_mode: enabled });
    } catch {
      // Ignore storage errors
    }
  },
};

// Logger utility - respects dev mode
const Logger = {
  _prefix: '[McGraw Plus]',

  _isDevMode() {
    return DevMode.isEnabled();
  },

  error(...args) {
    console.error(this._prefix, '[ERROR]', ...args);
  },

  warn(...args) {
    console.warn(this._prefix, '[WARN]', ...args);
  },

  info(...args) {
    if (this._isDevMode()) {
      console.log(this._prefix, '[INFO]', ...args);
    }
  },

  debug(...args) {
    if (this._isDevMode()) {
      console.log(this._prefix, '[DEBUG]', ...args);
    }
  },

  // Log verbose data (HTML, page structures, etc.) - only in dev mode
  verbose(label, data) {
    if (this._isDevMode()) {
      console.log(this._prefix, '[VERBOSE]', label, data);
    }
  },

  group(label) {
    if (this._isDevMode()) {
      console.group(this._prefix + ' ' + label);
    }
  },

  groupEnd() {
    if (this._isDevMode()) {
      console.groupEnd();
    }
  },

  time(label) {
    if (this._isDevMode()) {
      console.time(this._prefix + ' ' + label);
    }
  },

  timeEnd(label) {
    if (this._isDevMode()) {
      console.timeEnd(this._prefix + ' ' + label);
    }
  },
};

// Initialize dev mode on load
DevMode.init();

// Export for different contexts
if (typeof window !== 'undefined') {
  window.MP_Utils = Utils;
  window.MP_Logger = Logger;
  window.MP_DevMode = DevMode;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Utils, Logger, DevMode };
}
