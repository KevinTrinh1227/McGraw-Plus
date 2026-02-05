/**
 * McGraw Plus - Content Script Entry Point
 * Loads and manages features based on user settings
 */

(function () {
  'use strict';

  // Feature modules (lazy loaded)
  const Features = {
    darkMode: null,
    keyboardShortcuts: null,
    focusMode: null,
    progressBar: null,
    overlay: null,
    statsTracker: null,
    quickCopy: null,
    tabTitle: null,
    antiCopy: null,
    solver: null,
    assignmentScraper: null,
  };

  // Track loaded scripts
  const loadedScripts = new Set();

  // Current settings
  let settings = {};

  /**
   * Load a script dynamically
   */
  async function loadScript(path) {
    if (loadedScripts.has(path)) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(path);
      script.onload = () => {
        loadedScripts.add(path);
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Load a CSS file dynamically
   */
  function loadCSS(path) {
    const id = `mp-css-${path.replace(/[^a-z0-9]/gi, '-')}`;
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL(path);
    document.head.appendChild(link);
  }

  /**
   * Remove a CSS file
   */
  function removeCSS(path) {
    const id = `mp-css-${path.replace(/[^a-z0-9]/gi, '-')}`;
    const link = document.getElementById(id);
    if (link) link.remove();
  }

  /**
   * Initialize dark mode
   */
  function initDarkMode(enabled) {
    if (enabled) {
      document.documentElement.classList.add('mp-dark-mode');
    } else {
      document.documentElement.classList.remove('mp-dark-mode');
    }
  }

  /**
   * Initialize focus mode
   */
  function initFocusMode(enabled) {
    if (enabled) {
      document.documentElement.classList.add('mp-focus-mode');
    } else {
      document.documentElement.classList.remove('mp-focus-mode');
    }
  }

  /**
   * Initialize keyboard shortcuts
   */
  function initKeyboardShortcuts(enabled) {
    if (Features.keyboardShortcuts) {
      if (enabled) {
        Features.keyboardShortcuts.enable();
      } else {
        Features.keyboardShortcuts.disable();
      }
      return;
    }

    if (!enabled) return;

    // Create keyboard shortcuts handler
    Features.keyboardShortcuts = {
      enabled: false,

      handler(e) {
        // Skip if in input field
        if (
          e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.isContentEditable
        ) {
          return;
        }

        // Ctrl+Shift+D - Toggle dark mode
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
          e.preventDefault();
          const isDark = document.documentElement.classList.toggle('mp-dark-mode');
          if (window.MP_Storage) {
            window.MP_Storage.updateSettings({ darkMode: isDark });
          }
          return;
        }

        // Ctrl+Shift+F - Toggle focus mode
        if (e.ctrlKey && e.shiftKey && e.key === 'F') {
          e.preventDefault();
          const isFocused = document.documentElement.classList.toggle('mp-focus-mode');
          if (window.MP_Storage) {
            window.MP_Storage.updateSettings({ focusMode: isFocused });
          }
          return;
        }

        // Number keys (1-4) or letter keys (A-D) to select answers
        const keyMap = {
          '1': 0, 'a': 0, 'A': 0,
          '2': 1, 'b': 1, 'B': 1,
          '3': 2, 'c': 2, 'C': 2,
          '4': 3, 'd': 3, 'D': 3,
        };

        if (keyMap.hasOwnProperty(e.key)) {
          const index = keyMap[e.key];
          const choices = document.querySelectorAll('.choiceText.rs_preserve, .choice-item');
          if (choices[index]) {
            e.preventDefault();
            choices[index].click();
          }
          return;
        }

        // Enter or Space to submit
        if (e.key === 'Enter' || e.key === ' ') {
          const submitBtn = document.querySelector('.confidence-buttons-container button:not([disabled])');
          if (submitBtn) {
            e.preventDefault();
            submitBtn.click();
          }
          return;
        }

        // Arrow keys for navigation
        if (e.key === 'ArrowRight') {
          const nextBtn = document.querySelector('.next-button-container button:not([disabled])');
          if (nextBtn) {
            e.preventDefault();
            nextBtn.click();
          }
        }
      },

      enable() {
        if (this.enabled) return;
        this.enabled = true;
        document.addEventListener('keydown', this.handler);
      },

      disable() {
        if (!this.enabled) return;
        this.enabled = false;
        document.removeEventListener('keydown', this.handler);
      },
    };

    Features.keyboardShortcuts.enable();
  }

  /**
   * Initialize progress bar
   */
  function initProgressBar(enabled) {
    if (!enabled) {
      const bar = document.getElementById('mp-progress-bar');
      if (bar) bar.remove();
      return;
    }

    // Create or update progress bar
    let bar = document.getElementById('mp-progress-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'mp-progress-bar';
      bar.innerHTML = '<div class="mp-progress-fill"></div><span class="mp-progress-text"></span>';
      document.body.appendChild(bar);
    }

    // Update progress periodically
    function updateProgress() {
      const progressEl = document.querySelector('[class*="progress"], .progress-indicator');
      if (progressEl) {
        const text = progressEl.textContent;
        const match = text.match(/(\d+)\s*\/\s*(\d+)/);
        if (match) {
          const current = parseInt(match[1]);
          const total = parseInt(match[2]);
          const percent = (current / total) * 100;
          bar.querySelector('.mp-progress-fill').style.width = percent + '%';
          bar.querySelector('.mp-progress-text').textContent = `${current}/${total}`;
        }
      }
    }

    // Initial update
    updateProgress();

    // Watch for changes
    const observer = new MutationObserver(updateProgress);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Initialize tab title updater
   */
  function initTabTitle(enabled) {
    if (!enabled) return;

    const originalTitle = document.title;

    function updateTitle() {
      const progressEl = document.querySelector('[class*="progress"], .progress-indicator');
      if (progressEl) {
        const text = progressEl.textContent;
        const match = text.match(/(\d+)\s*\/\s*(\d+)/);
        if (match) {
          document.title = `[${match[1]}/${match[2]}] ${originalTitle}`;
        }
      }
    }

    updateTitle();

    const observer = new MutationObserver(updateTitle);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Initialize anti-copy bypass
   */
  async function initAntiCopy(enabled) {
    if (!enabled) return;

    // Load anti-copy module
    await loadScript('content/anti-copy.js');
  }

  /**
   * Initialize assignment scraper for due date tracking
   */
  function initAssignmentScraper(enabled) {
    if (!enabled) return;

    // Assignment scraper is loaded via manifest, just reference it
    if (window.MP_AssignmentScraper) {
      Features.assignmentScraper = window.MP_AssignmentScraper;
      // Already auto-initializes on DOMContentLoaded
    }
  }

  /**
   * Initialize overlay system
   */
  async function initOverlay() {
    await loadScript('content/overlay.js');
    if (window.MP_Overlay) {
      window.MP_Overlay.init();
      Features.overlay = window.MP_Overlay;
    }
  }

  /**
   * Initialize solver (if unlocked)
   */
  async function initSolver() {
    const result = await chrome.storage.local.get(['isBotEnabled', 'mp_solver_unlocked']);

    // Only load if solver is unlocked
    if (!result.mp_solver_unlocked) return;

    // Load supporting modules first
    await Promise.all([
      loadScript('content/llm.js'),
      loadScript('content/webhook.js'),
    ]);

    await loadScript('content/solver.js');
    if (window.MP_Solver) {
      Features.solver = window.MP_Solver;

      // Auto-activate if was previously enabled
      if (result.isBotEnabled) {
        Features.solver.activate();
      }
    }
  }

  /**
   * Detect if user is logged in to McGraw-Hill Connect
   * Uses multiple methods for reliable detection
   */
  function detectLoginStatus() {
    // Method 1: Check for user profile element
    const profileSelectors = [
      '.user-profile',
      '.profile-name',
      '[class*="user-name"]',
      '.cui-user-menu',
      '.mhe-account',
      '[data-testid="user-profile"]',
      '.account-menu',
      '.user-menu',
      '[class*="account"]',
      '.avatar',
      '.user-avatar',
    ];

    for (const selector of profileSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent?.trim()) {
        return { loggedIn: true, method: 'profile', detail: selector };
      }
    }

    // Method 2: Check for logout button (only exists when logged in)
    const logoutSelectors = [
      '[class*="logout"]',
      '[class*="sign-out"]',
      'a[href*="logout"]',
      'button[onclick*="logout"]',
      '[data-action="logout"]',
    ];

    for (const selector of logoutSelectors) {
      if (document.querySelector(selector)) {
        return { loggedIn: true, method: 'logout-button', detail: selector };
      }
    }

    // Method 3: Check for login form (indicates NOT logged in)
    const loginFormSelectors = [
      'form[action*="login"]',
      'input[name="username"]',
      'input[name="email"][type="email"]',
      '.login-form',
      '#login-form',
      '[class*="login-container"]',
      'input[type="password"]:not([autocomplete="new-password"])',
    ];

    for (const selector of loginFormSelectors) {
      if (document.querySelector(selector)) {
        return { loggedIn: false, method: 'login-form', detail: selector };
      }
    }

    // Method 4: Check for dashboard content (courses visible = logged in)
    const dashboardSelectors = [
      '.course-card',
      '.course-tile',
      '[data-course-id]',
      '.section-card',
      '.assignment-list',
      '.my-courses',
      '.enrolled-courses',
    ];

    for (const selector of dashboardSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return { loggedIn: true, method: 'dashboard', detail: `${elements.length} ${selector}` };
      }
    }

    // Method 5: Check URL patterns
    const url = window.location.href;
    if (url.includes('/section/') || url.includes('/course/') || url.includes('/connect/')) {
      // Being on a course page usually means logged in
      return { loggedIn: true, method: 'url-pattern', detail: url };
    }

    // Unable to determine
    return { loggedIn: false, method: 'unknown', detail: 'No indicators found' };
  }

  /**
   * Load settings and initialize features
   */
  async function init() {
    // Wait for storage module to be available
    if (!window.MP_Storage) {
      console.warn('[McGraw Plus] Storage module not loaded');
      return;
    }

    // Load settings
    settings = await window.MP_Storage.getSettings();

    // Initialize core features
    initDarkMode(settings.darkMode !== false); // Default on
    initKeyboardShortcuts(settings.keyboardShortcuts !== false); // Default on
    initFocusMode(settings.focusMode === true); // Default off
    initProgressBar(settings.progressBar !== false); // Default on
    initTabTitle(settings.tabTitle !== false); // Default on

    // Initialize optional features
    if (settings.antiCopy) {
      initAntiCopy(true);
    }

    // Initialize assignment scraper for due date tracking
    if (settings.dueDateTracker !== false) {
      initAssignmentScraper(true);
    }

    // Initialize overlay
    await initOverlay();

    // Initialize solver (if unlocked)
    await initSolver();

    // Listen for settings changes
    window.MP_Storage.onChange((changes) => {
      if (changes.mp_settings) {
        const newSettings = changes.mp_settings.newValue || {};
        handleSettingsChange(newSettings);
      }
    });

    // Listen for messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Normalize string messages
      if (typeof message === 'string') {
        message = { type: message };
      }

      switch (message.type) {
        case 'PING':
          sendResponse({ type: 'PONG' });
          return true;

        case 'CHECK_LOGIN':
          const loginStatus = detectLoginStatus();
          console.log('[McGraw Plus] Login check:', loginStatus);
          sendResponse(loginStatus);
          return true;

        case 'SOLVER_ACTIVATE':
        case 'activate':
          if (Features.solver) {
            Features.solver.activate();
          } else {
            initSolver().then(() => {
              if (Features.solver) {
                Features.solver.activate();
              }
            });
          }
          sendResponse({ success: true });
          return true;

        case 'SOLVER_DEACTIVATE':
        case 'deactivate':
          if (Features.solver) {
            Features.solver.deactivate();
          }
          sendResponse({ success: true });
          return true;

        case 'GET_FEATURE_STATUS':
          sendResponse({
            darkMode: document.documentElement.classList.contains('mp-dark-mode'),
            focusMode: document.documentElement.classList.contains('mp-focus-mode'),
            solverActive: Features.solver?.isActive || false,
          });
          return true;
      }

      return false;
    });

    console.log('[McGraw Plus] Content script initialized');
  }

  /**
   * Handle settings changes
   */
  function handleSettingsChange(newSettings) {
    if (newSettings.darkMode !== settings.darkMode) {
      initDarkMode(newSettings.darkMode);
    }

    if (newSettings.focusMode !== settings.focusMode) {
      initFocusMode(newSettings.focusMode);
    }

    if (newSettings.keyboardShortcuts !== settings.keyboardShortcuts) {
      initKeyboardShortcuts(newSettings.keyboardShortcuts);
    }

    if (newSettings.progressBar !== settings.progressBar) {
      initProgressBar(newSettings.progressBar);
    }

    if (newSettings.antiCopy !== settings.antiCopy) {
      initAntiCopy(newSettings.antiCopy);
    }

    settings = newSettings;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
