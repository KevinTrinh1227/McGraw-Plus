/**
 * McGraw Plus - API Bridge Script
 * Runs in the isolated content script world to bridge MAIN world events to chrome.storage
 * Receives custom events from api-interceptor.js and saves data to extension storage
 */

(function() {
  'use strict';

  // Prevent double initialization
  if (window.__mcgrawPlusBridgeInitialized) return;
  window.__mcgrawPlusBridgeInitialized = true;

  // Track if context has been invalidated
  let contextInvalidated = false;

  // Storage keys
  const STORAGE_KEYS = {
    USER_PROFILE: 'mp_user_profile',
    COURSES: 'mp_courses',
    SECTIONS: 'mp_sections',
    DUE_DATES: 'mp_due_dates',
    INSTRUCTORS: 'mp_instructors',
    BOOKS: 'mp_books',
    CAPTURE_STATE: 'mp_capture_state',
  };

  // Event name from api-interceptor.js
  const DATA_CAPTURED_EVENT = 'mcgraw-plus-data-captured';

  /**
   * Check if extension context is still valid
   */
  function isContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  /**
   * Handle context invalidation
   */
  function handleContextInvalidated() {
    if (contextInvalidated) return;
    contextInvalidated = true;
    console.log('[McGraw Plus Bridge] Extension context invalidated');
    window.removeEventListener(DATA_CAPTURED_EVENT, handleCapturedData);
  }

  /**
   * Save data to chrome storage
   */
  async function saveData(key, data) {
    if (contextInvalidated || !isContextValid()) return false;

    try {
      await chrome.storage.local.set({ [key]: data });
      console.log('[McGraw Plus Bridge] Saved:', key);
      return true;
    } catch (err) {
      if (err.message?.includes('Extension context invalidated')) {
        handleContextInvalidated();
        return false;
      }
      console.warn('[McGraw Plus Bridge] Failed to save:', key, err.message);
      return false;
    }
  }

  /**
   * Handle captured data events from MAIN world
   */
  async function handleCapturedData(event) {
    if (contextInvalidated || !isContextValid()) return;

    const { type, data, timestamp } = event.detail || {};

    if (!type || !data) return;

    console.log('[McGraw Plus Bridge] Received:', type);

    try {
      switch (type) {
        case 'userProfile':
          await saveData(STORAGE_KEYS.USER_PROFILE, data);
          break;

        case 'assignments':
          await saveData(STORAGE_KEYS.DUE_DATES, data);
          break;

        case 'courses':
          await saveData(STORAGE_KEYS.COURSES, data);
          break;

        case 'sections':
          await saveData(STORAGE_KEYS.SECTIONS, data);
          break;

        case 'instructors':
          await saveData(STORAGE_KEYS.INSTRUCTORS, data);
          break;

        case 'books':
          await saveData(STORAGE_KEYS.BOOKS, data);
          break;

        case 'complete':
          // Profile data already saved separately
          // Update capture state and notify service worker
          await saveData(STORAGE_KEYS.CAPTURE_STATE, {
            complete: true,
            partial: data.partial || false,
            summary: data.summary,
            timestamp: timestamp || Date.now(),
          });

          // Notify service worker that data is available
          if (!contextInvalidated && isContextValid()) {
            try {
              chrome.runtime.sendMessage({
                type: 'DATA_AVAILABLE',
                profile: data.profile,
                summary: data.summary,
                partial: data.partial,
              });
            } catch (err) {
              if (err.message?.includes('Extension context invalidated')) {
                handleContextInvalidated();
              }
              // Extension context may not be available
            }
          }
          break;
      }
    } catch (err) {
      if (err.message?.includes('Extension context invalidated')) {
        handleContextInvalidated();
        return;
      }
      console.warn('[McGraw Plus Bridge] Error handling data:', err);
    }
  }

  // Listen for custom events from MAIN world
  window.addEventListener(DATA_CAPTURED_EVENT, handleCapturedData);

  console.log('[McGraw Plus Bridge] Initialized, listening for data events');
})();
