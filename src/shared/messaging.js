/**
 * McGraw Plus - Messaging Module
 * Handles communication between popup, background, and content scripts
 */

const Messaging = {
  // Message types
  TYPES: {
    // Feature toggles
    TOGGLE_FEATURE: 'TOGGLE_FEATURE',
    GET_FEATURE_STATUS: 'GET_FEATURE_STATUS',

    // Solver
    SOLVER_ACTIVATE: 'SOLVER_ACTIVATE',
    SOLVER_DEACTIVATE: 'SOLVER_DEACTIVATE',
    SOLVER_STATUS: 'SOLVER_STATUS',

    // Stats
    RECORD_QUESTION: 'RECORD_QUESTION',
    GET_SESSION_STATS: 'GET_SESSION_STATS',
    SESSION_START: 'SESSION_START',
    SESSION_END: 'SESSION_END',

    // Due dates
    SYNC_DUE_DATES: 'SYNC_DUE_DATES',
    GET_DUE_DATES: 'GET_DUE_DATES',

    // Flashcards
    SAVE_FLASHCARD: 'SAVE_FLASHCARD',
    GET_FLASHCARDS: 'GET_FLASHCARDS',
    EXPORT_FLASHCARDS: 'EXPORT_FLASHCARDS',

    // Notifications
    SHOW_NOTIFICATION: 'SHOW_NOTIFICATION',

    // Settings
    SETTINGS_CHANGED: 'SETTINGS_CHANGED',
    GET_SETTINGS: 'GET_SETTINGS',

    // Updates
    CHECK_UPDATE: 'CHECK_UPDATE',
    UPDATE_AVAILABLE: 'UPDATE_AVAILABLE',

    // Content script
    PING: 'PING',
    PONG: 'PONG',
  },

  /**
   * Send message to background script
   * @param {string} type - Message type
   * @param {object} data - Message data
   * @returns {Promise<any>} Response
   */
  async sendToBackground(type, data = {}) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type, data }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * Send message to content script in active tab
   * @param {string} type - Message type
   * @param {object} data - Message data
   * @returns {Promise<any>} Response
   */
  async sendToActiveTab(type, data = {}) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
          reject(new Error('No active tab'));
          return;
        }

        chrome.tabs.sendMessage(tabs[0].id, { type, data }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    });
  },

  /**
   * Send message to specific tab
   * @param {number} tabId - Tab ID
   * @param {string} type - Message type
   * @param {object} data - Message data
   * @returns {Promise<any>} Response
   */
  async sendToTab(tabId, type, data = {}) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type, data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  },

  /**
   * Listen for messages
   * @param {function} handler - Called with (message, sender, sendResponse)
   */
  onMessage(handler) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Normalize old-style string messages
      if (typeof message === 'string') {
        message = { type: message, data: {} };
      }

      const result = handler(message, sender, sendResponse);

      // If handler returns a promise, handle it
      if (result instanceof Promise) {
        result
          .then((response) => sendResponse(response))
          .catch((error) => sendResponse({ error: error.message }));
        return true; // Keep channel open for async response
      }

      return result;
    });
  },

  /**
   * Check if content script is loaded in active tab
   * @returns {Promise<boolean>}
   */
  async isContentScriptLoaded() {
    try {
      await this.sendToActiveTab(this.TYPES.PING);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Inject content scripts into active tab if not already loaded
   * @param {string[]} scripts - Array of script paths
   */
  async ensureContentScripts(scripts) {
    const isLoaded = await this.isContentScriptLoaded();
    if (isLoaded) return true;

    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs[0]) {
          reject(new Error('No active tab'));
          return;
        }

        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: scripts,
          });
          resolve(true);
        } catch (e) {
          reject(e);
        }
      });
    });
  },
};

// Export for different contexts
if (typeof window !== 'undefined') {
  window.MP_Messaging = Messaging;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Messaging;
}
