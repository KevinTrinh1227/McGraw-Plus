/**
 * McGraw Plus - On-page Overlay System
 * Provides status badge, info widget, toast notifications, and debug panel on SmartBook pages
 */

const Overlay = {
  // References
  container: null,
  badge: null,
  toastContainer: null,
  infoWidget: null,
  sessionCard: null,
  debugPanel: null,
  toastQueue: [],

  // State
  debugVisible: false,
  infoWidgetVisible: false,
  lastDebugInfo: null,

  /**
   * Initialize the overlay system
   */
  init() {
    if (this.container) return; // Already initialized

    // Inject CSS
    this.injectStyles();

    // Create main container
    this.container = document.createElement("div");
    this.container.id = "mp-overlay";
    document.body.appendChild(this.container);

    // Create status badge
    this.createStatusBadge();

    // Create toast container
    this.createToastContainer();

    // Create info widget
    this.createInfoWidget();

    // Create session card (hidden by default)
    this.createSessionCard();

    // Create debug panel (hidden by default)
    this.createDebugPanel();

    // Listen for bot status changes
    this.listenForStatusChanges();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Check initial settings
    this.loadSettings();

    console.log("[McGraw Plus] Overlay initialized");
  },

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['mp_settings', 'mp_info_widget_visible']);
      const settings = result.mp_settings || {};

      // Show info widget if enabled
      if (result.mp_info_widget_visible === true) {
        this.showInfoWidget();
      }
    } catch (e) {
      // Ignore errors
    }
  },

  /**
   * Inject CSS styles into the page
   */
  injectStyles() {
    if (document.getElementById("mp-overlay-styles")) return;

    const link = document.createElement("link");
    link.id = "mp-overlay-styles";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("overlay.css");
    document.head.appendChild(link);
  },

  /**
   * Create the floating status badge
   */
  createStatusBadge() {
    this.badge = document.createElement("div");
    this.badge.id = "mp-status-badge";
    this.badge.className = "inactive";
    this.badge.innerHTML = `
      <span class="status-dot"></span>
      <span class="status-text">McGraw Plus</span>
    `;

    // Toggle session card on click
    this.badge.addEventListener("click", () => {
      if (this.sessionCard) {
        this.sessionCard.classList.toggle("visible");
      }
    });

    this.container.appendChild(this.badge);
  },

  /**
   * Create the toast notification container
   */
  createToastContainer() {
    this.toastContainer = document.createElement("div");
    this.toastContainer.id = "mp-toast-container";
    this.container.appendChild(this.toastContainer);
  },

  /**
   * Create the info widget (shows question type, status, etc.)
   */
  createInfoWidget() {
    this.infoWidget = document.createElement("div");
    this.infoWidget.id = "mp-info-widget";
    this.infoWidget.innerHTML = `
      <div class="widget-header">
        <span class="widget-title">Question Info</span>
        <button class="widget-close">&times;</button>
      </div>
      <div class="widget-content">
        <div class="widget-row">
          <span class="widget-label">Type</span>
          <span class="widget-value" id="mp-widget-type">-</span>
        </div>
        <div class="widget-row">
          <span class="widget-label">Status</span>
          <span class="widget-value" id="mp-widget-status">-</span>
        </div>
        <div class="widget-row">
          <span class="widget-label">First Time</span>
          <span class="widget-value" id="mp-widget-first-time">-</span>
        </div>
        <div class="widget-row">
          <span class="widget-label">Attempts</span>
          <span class="widget-value" id="mp-widget-attempts">-</span>
        </div>
        <div class="widget-row">
          <span class="widget-label">Source</span>
          <span class="widget-value" id="mp-widget-source">-</span>
        </div>
      </div>
      <div class="widget-actions">
        <button class="widget-btn" id="mp-widget-copy">Copy Question</button>
      </div>
    `;

    // Close button
    this.infoWidget.querySelector(".widget-close").addEventListener("click", () => {
      this.hideInfoWidget();
    });

    // Copy button
    this.infoWidget.querySelector("#mp-widget-copy").addEventListener("click", () => {
      this.copyCurrentQuestion();
    });

    // Make draggable
    this.makeDraggable(this.infoWidget);

    this.container.appendChild(this.infoWidget);
  },

  /**
   * Make an element draggable
   */
  makeDraggable(element) {
    const header = element.querySelector('.widget-header');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.style.cursor = 'grab';

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      header.style.cursor = 'grabbing';

      const rect = element.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;

      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      element.style.left = (initialLeft + dx) + 'px';
      element.style.top = (initialTop + dy) + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      header.style.cursor = 'grab';
    });
  },

  /**
   * Show info widget
   */
  showInfoWidget() {
    if (!this.infoWidget) return;
    this.infoWidget.classList.add("visible");
    this.infoWidgetVisible = true;
    chrome.storage.local.set({ mp_info_widget_visible: true });
  },

  /**
   * Hide info widget
   */
  hideInfoWidget() {
    if (!this.infoWidget) return;
    this.infoWidget.classList.remove("visible");
    this.infoWidgetVisible = false;
    chrome.storage.local.set({ mp_info_widget_visible: false });
  },

  /**
   * Toggle info widget
   */
  toggleInfoWidget() {
    if (this.infoWidgetVisible) {
      this.hideInfoWidget();
    } else {
      this.showInfoWidget();
    }
  },

  /**
   * Update info widget with current question data
   */
  updateInfoWidget(info) {
    if (!this.infoWidget) return;

    const typeEl = document.getElementById("mp-widget-type");
    const statusEl = document.getElementById("mp-widget-status");
    const firstTimeEl = document.getElementById("mp-widget-first-time");
    const attemptsEl = document.getElementById("mp-widget-attempts");
    const sourceEl = document.getElementById("mp-widget-source");

    if (typeEl && info.type) {
      typeEl.textContent = info.type;
      typeEl.className = "widget-value type-" + info.type.toLowerCase().replace(/\s+/g, '-');
    }

    if (statusEl && info.status) {
      statusEl.textContent = info.status;
      statusEl.className = "widget-value status-" + info.status.toLowerCase();
    }

    if (firstTimeEl) {
      firstTimeEl.textContent = info.firstTime ? "Yes" : "No";
      firstTimeEl.className = "widget-value " + (info.firstTime ? "highlight" : "");
    }

    if (attemptsEl) {
      attemptsEl.textContent = info.attempts || "0";
    }

    if (sourceEl && info.source) {
      sourceEl.textContent = info.source;
      sourceEl.className = "widget-value source-" + info.source.toLowerCase();
    }
  },

  /**
   * Copy current question to clipboard
   */
  async copyCurrentQuestion() {
    try {
      // Try to find the question text on the page
      const questionSelectors = [
        '.question-text',
        '.question-content',
        '[data-automation="question-text"]',
        '.probe-question',
        '.question-stem',
      ];

      let questionText = '';
      for (const selector of questionSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          questionText = el.textContent.trim();
          break;
        }
      }

      if (questionText) {
        await navigator.clipboard.writeText(questionText);
        this.showToast("Copied!", "Question copied to clipboard", "success", 2000);
      } else {
        this.showToast("Error", "Could not find question text", "error", 2000);
      }
    } catch (e) {
      this.showToast("Error", "Failed to copy", "error", 2000);
    }
  },

  /**
   * Create the session stats card
   */
  createSessionCard() {
    this.sessionCard = document.createElement("div");
    this.sessionCard.id = "mp-session-card";
    this.sessionCard.innerHTML = `
      <div class="card-header">
        <span class="card-title">Session Stats</span>
        <button class="close-btn">&times;</button>
      </div>
      <div class="stat-row">
        <span>Questions</span>
        <span class="stat-value" id="mp-stat-questions">0</span>
      </div>
      <div class="stat-row">
        <span>Correct</span>
        <span class="stat-value correct" id="mp-stat-correct">0</span>
      </div>
      <div class="stat-row">
        <span>Learned</span>
        <span class="stat-value" id="mp-stat-learned">0</span>
      </div>
      <div class="stat-row">
        <span>Duration</span>
        <span class="stat-value" id="mp-stat-duration">0:00</span>
      </div>
    `;

    // Close button
    this.sessionCard.querySelector(".close-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.sessionCard.classList.remove("visible");
    });

    this.container.appendChild(this.sessionCard);
  },

  /**
   * Create the debug panel
   */
  createDebugPanel() {
    this.debugPanel = document.createElement("div");
    this.debugPanel.id = "mp-debug-panel";
    this.debugPanel.innerHTML = `
      <div class="debug-header">
        <span class="debug-title">Debug Info</span>
        <button class="debug-close">&times;</button>
      </div>
      <div class="debug-content">
        <div class="debug-row">
          <span class="debug-label">Question Type:</span>
          <span class="debug-value" id="mp-debug-type">-</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Answer Source:</span>
          <span class="debug-value" id="mp-debug-source">-</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Confidence:</span>
          <span class="debug-value" id="mp-debug-confidence">-</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Storage Entries:</span>
          <span class="debug-value" id="mp-debug-entries">-</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Last Action:</span>
          <span class="debug-value" id="mp-debug-action">-</span>
        </div>
      </div>
      <div class="debug-footer">
        <span>Ctrl+Shift+I to toggle info widget</span>
      </div>
    `;

    // Close button
    this.debugPanel.querySelector(".debug-close").addEventListener("click", () => {
      this.hideDebugPanel();
    });

    this.container.appendChild(this.debugPanel);

    // Check if debug panel should be visible from storage
    chrome.storage.local.get("mp_debug_overlay", (result) => {
      if (result.mp_debug_overlay === true) {
        this.showDebugPanel();
      }
    });
  },

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Ctrl+Shift+I - Toggle info widget
      if (e.ctrlKey && e.shiftKey && e.key === "I") {
        e.preventDefault();
        this.toggleInfoWidget();
      }

      // Ctrl+Shift+D - Toggle debug panel (only in dev mode)
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        this.toggleDebugPanel();
      }

      // Ctrl+Shift+S - Toggle bot
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        this.toggleBot();
      }
    });
  },

  /**
   * Toggle bot on/off
   */
  async toggleBot() {
    chrome.storage.local.get("isBotEnabled", (result) => {
      const isActive = result.isBotEnabled === true;
      const newState = !isActive;

      chrome.storage.local.set({ isBotEnabled: newState });

      // Send message to content script
      const action = newState ? "activate" : "deactivate";
      chrome.runtime.sendMessage(action);

      this.showToast(
        newState ? "Solver Activated" : "Solver Deactivated",
        newState ? "Auto-answering enabled" : "Manual mode",
        newState ? "success" : "info",
        2000
      );
    });
  },

  /**
   * Toggle debug panel visibility
   */
  toggleDebugPanel() {
    if (this.debugVisible) {
      this.hideDebugPanel();
    } else {
      this.showDebugPanel();
    }
  },

  /**
   * Show debug panel
   */
  showDebugPanel() {
    if (!this.debugPanel) return;
    this.debugPanel.classList.add("visible");
    this.debugVisible = true;
    chrome.storage.local.set({ mp_debug_overlay: true });
    this.updateDebugStorageCount();
  },

  /**
   * Hide debug panel
   */
  hideDebugPanel() {
    if (!this.debugPanel) return;
    this.debugPanel.classList.remove("visible");
    this.debugVisible = false;
    chrome.storage.local.set({ mp_debug_overlay: false });
  },

  /**
   * Update debug panel with question info
   */
  updateDebugInfo(info) {
    this.lastDebugInfo = info;

    if (!this.debugPanel || !this.debugVisible) return;

    const typeEl = document.getElementById("mp-debug-type");
    const sourceEl = document.getElementById("mp-debug-source");
    const confidenceEl = document.getElementById("mp-debug-confidence");
    const actionEl = document.getElementById("mp-debug-action");

    if (typeEl && info.type) {
      typeEl.textContent = info.type;
    }

    if (sourceEl && info.source) {
      sourceEl.textContent = info.source;
      sourceEl.className = "debug-value " + (info.source === "Stored" ? "success" : info.source === "LLM" ? "info" : "warning");
    }

    if (confidenceEl && info.confidence) {
      confidenceEl.textContent = info.confidence;
      confidenceEl.className = "debug-value " + (info.confidence === "100%" ? "success" : "warning");
    }

    if (actionEl && info.action) {
      actionEl.textContent = info.action;
    }
  },

  /**
   * Update storage entry count in debug panel
   */
  updateDebugStorageCount() {
    chrome.storage.local.get("responseMap", (result) => {
      const count = Object.keys(result.responseMap || {}).length;
      const entriesEl = document.getElementById("mp-debug-entries");
      if (entriesEl) {
        entriesEl.textContent = count.toString();
      }
    });
  },

  /**
   * Update the status badge
   */
  setActive(active) {
    if (!this.badge) return;

    this.badge.className = active ? "active" : "inactive";
    this.badge.querySelector(".status-text").textContent = active ? "Active" : "McGraw Plus";
  },

  /**
   * Show a toast notification
   */
  showToast(title, message, type = "info", duration = 3000) {
    if (!this.toastContainer) return;

    const icons = {
      success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      error: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      info: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      warning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    };

    const toast = document.createElement("div");
    toast.className = `mp-toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ""}
      </div>
    `;

    this.toastContainer.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
      toast.classList.add("removing");
      setTimeout(() => toast.remove(), 300);
    }, duration);

    return toast;
  },

  /**
   * Show session summary toast
   */
  showSessionSummary(session) {
    if (!session) return;

    const accuracy = session.questions > 0
      ? Math.round((session.correct / session.questions) * 100)
      : 0;

    const duration = session.duration
      ? Math.floor(session.duration / 60000) + "m " + Math.floor((session.duration % 60000) / 1000) + "s"
      : "0s";

    this.showToast(
      "Session Complete",
      `${session.questions} questions | ${accuracy}% accuracy | ${duration}`,
      "success",
      5000
    );
  },

  /**
   * Update session stats display
   */
  updateSessionStats(stats) {
    if (!stats) return;

    const questionsEl = document.getElementById("mp-stat-questions");
    const correctEl = document.getElementById("mp-stat-correct");
    const learnedEl = document.getElementById("mp-stat-learned");
    const durationEl = document.getElementById("mp-stat-duration");

    if (questionsEl) questionsEl.textContent = stats.questions || 0;
    if (correctEl) correctEl.textContent = stats.correct || 0;
    if (learnedEl) learnedEl.textContent = stats.wrong || 0;
    if (durationEl && stats.startTime) {
      const elapsed = Date.now() - stats.startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      durationEl.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
  },

  /**
   * Listen for bot status changes
   */
  listenForStatusChanges() {
    // Initial state
    chrome.storage.local.get("isBotEnabled", (result) => {
      this.setActive(result.isBotEnabled === true);
    });

    // Listen for changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.isBotEnabled) {
        const isActive = changes.isBotEnabled.newValue === true;
        this.setActive(isActive);

        if (isActive) {
          this.showToast("Solver Activated", "Auto-answering enabled", "success");
        } else {
          this.showToast("Solver Deactivated", "Manual mode", "info");
        }
      }

      // Update debug storage count when responseMap changes
      if (changes.responseMap && this.debugVisible) {
        this.updateDebugStorageCount();
      }
    });

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TOGGLE_INFO_WIDGET') {
        this.toggleInfoWidget();
      }
      if (message.type === 'UPDATE_INFO_WIDGET') {
        this.updateInfoWidget(message.data);
      }
    });
  },

  /**
   * Clean up the overlay
   */
  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.badge = null;
      this.toastContainer = null;
      this.infoWidget = null;
      this.sessionCard = null;
      this.debugPanel = null;
    }

    const styles = document.getElementById("mp-overlay-styles");
    if (styles) styles.remove();
  },
};

// Initialize overlay when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => Overlay.init());
} else {
  Overlay.init();
}

// Make available globally
if (typeof window !== "undefined") {
  window.MP_Overlay = Overlay;
}
