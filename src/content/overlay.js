/**
 * McGraw Plus - Overlay System
 * Status badge, toasts, session card, and debug panel
 */

const MP_Overlay = {
  container: null,
  badge: null,
  toastContainer: null,
  sessionCard: null,
  debugPanel: null,
  debugVisible: false,

  /**
   * Initialize the overlay system
   */
  init() {
    if (this.container) return;

    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'mp-overlay';
    document.body.appendChild(this.container);

    // Create components
    this.createStatusBadge();
    this.createToastContainer();
    this.createSessionCard();
    this.createDebugPanel();

    // Listen for status changes
    this.listenForChanges();

    console.log('[McGraw Plus] Overlay initialized');
  },

  /**
   * Create status badge
   */
  createStatusBadge() {
    this.badge = document.createElement('div');
    this.badge.id = 'mp-status-badge';
    this.badge.className = 'inactive';
    this.badge.innerHTML = `
      <span class="status-dot"></span>
      <span class="status-text">McGraw Plus</span>
    `;

    this.badge.addEventListener('click', () => {
      if (this.sessionCard) {
        this.sessionCard.classList.toggle('visible');
      }
    });

    this.container.appendChild(this.badge);
  },

  /**
   * Create toast container
   */
  createToastContainer() {
    this.toastContainer = document.createElement('div');
    this.toastContainer.id = 'mp-toast-container';
    this.container.appendChild(this.toastContainer);
  },

  /**
   * Create session card
   */
  createSessionCard() {
    this.sessionCard = document.createElement('div');
    this.sessionCard.id = 'mp-session-card';
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

    this.sessionCard.querySelector('.close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.sessionCard.classList.remove('visible');
    });

    this.container.appendChild(this.sessionCard);
  },

  /**
   * Create debug panel
   */
  createDebugPanel() {
    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'mp-debug-panel';
    this.debugPanel.innerHTML = `
      <div class="debug-header">
        <span class="debug-title">Debug Info</span>
        <button class="debug-close">&times;</button>
      </div>
      <div class="debug-content">
        <div class="debug-row">
          <span class="debug-label">Question Type</span>
          <span class="debug-value" id="mp-debug-type">-</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Answer Source</span>
          <span class="debug-value" id="mp-debug-source">-</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Confidence</span>
          <span class="debug-value" id="mp-debug-confidence">-</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Storage</span>
          <span class="debug-value" id="mp-debug-entries">-</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Last Action</span>
          <span class="debug-value" id="mp-debug-action">-</span>
        </div>
      </div>
      <div class="debug-footer">Ctrl+Shift+D to toggle</div>
    `;

    this.debugPanel.querySelector('.debug-close').addEventListener('click', () => {
      this.hideDebugPanel();
    });

    this.container.appendChild(this.debugPanel);

    // Setup keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggleDebugPanel();
      }
    });
  },

  /**
   * Toggle debug panel
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
    this.debugPanel.classList.add('visible');
    this.debugVisible = true;
    this.updateDebugStorageCount();
  },

  /**
   * Hide debug panel
   */
  hideDebugPanel() {
    if (!this.debugPanel) return;
    this.debugPanel.classList.remove('visible');
    this.debugVisible = false;
  },

  /**
   * Update debug info
   */
  updateDebugInfo(info) {
    if (!this.debugPanel || !this.debugVisible) return;

    if (info.type) {
      const el = document.getElementById('mp-debug-type');
      if (el) el.textContent = info.type;
    }

    if (info.source) {
      const el = document.getElementById('mp-debug-source');
      if (el) {
        el.textContent = info.source;
        el.className = 'debug-value ' +
          (info.source === 'Stored' ? 'success' :
           info.source === 'LLM' ? 'info' : 'warning');
      }
    }

    if (info.confidence) {
      const el = document.getElementById('mp-debug-confidence');
      if (el) {
        el.textContent = info.confidence;
        el.className = 'debug-value ' +
          (info.confidence === '100%' ? 'success' : 'warning');
      }
    }

    if (info.action) {
      const el = document.getElementById('mp-debug-action');
      if (el) el.textContent = info.action;
    }
  },

  /**
   * Update storage count in debug panel
   */
  updateDebugStorageCount() {
    chrome.storage.local.get('responseMap', (result) => {
      const count = Object.keys(result.responseMap || {}).length;
      const el = document.getElementById('mp-debug-entries');
      if (el) el.textContent = count + ' entries';
    });
  },

  /**
   * Set status badge state
   */
  setActive(active) {
    if (!this.badge) return;
    this.badge.className = active ? 'active' : 'inactive';
    this.badge.querySelector('.status-text').textContent =
      active ? 'Solver Active' : 'McGraw Plus';
  },

  /**
   * Show a toast notification
   */
  showToast(title, message, type = 'info', duration = 3000) {
    if (!this.toastContainer) return;

    const icons = {
      success: '✓',
      error: '✗',
      info: 'ℹ',
      warning: '⚠',
    };

    const toast = document.createElement('div');
    toast.className = `mp-toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
    `;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);

    return toast;
  },

  /**
   * Show session summary
   */
  showSessionSummary(session) {
    if (!session) return;

    const accuracy = session.questions > 0
      ? Math.round((session.correct / session.questions) * 100)
      : 0;

    const duration = session.duration
      ? Math.floor(session.duration / 60000) + 'm ' +
        Math.floor((session.duration % 60000) / 1000) + 's'
      : '0s';

    this.showToast(
      'Session Complete',
      `${session.questions} questions | ${accuracy}% accuracy | ${duration}`,
      'success',
      5000
    );
  },

  /**
   * Update session stats
   */
  updateSessionStats(stats) {
    if (!stats) return;

    const questionsEl = document.getElementById('mp-stat-questions');
    const correctEl = document.getElementById('mp-stat-correct');
    const learnedEl = document.getElementById('mp-stat-learned');
    const durationEl = document.getElementById('mp-stat-duration');

    if (questionsEl) questionsEl.textContent = stats.questions || 0;
    if (correctEl) correctEl.textContent = stats.correct || 0;
    if (learnedEl) learnedEl.textContent = stats.wrong || 0;
    if (durationEl && stats.startTime) {
      const elapsed = Date.now() - stats.startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      durationEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  },

  /**
   * Show solver warning modal
   */
  showSolverWarning(isGraded, onProceed, onCancel) {
    const existing = document.getElementById('mp-solver-warning');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'mp-solver-warning';
    modal.innerHTML = `
      <div class="warning-content">
        <div class="warning-icon">${isGraded ? '⚠️' : '⚡'}</div>
        <h2>${isGraded ? 'Graded Assignment Detected' : 'Solver Ready'}</h2>
        <p>${isGraded
          ? 'This appears to be a graded assignment. Using the solver on graded work may violate academic integrity policies. Are you sure you want to proceed?'
          : 'The solver will automatically answer questions. This is meant for SmartBook Concepts (completion-based) assignments only.'
        }</p>
        <div class="warning-actions">
          <button class="btn-cancel">Cancel</button>
          <button class="btn-proceed">${isGraded ? 'Proceed Anyway' : 'Start Solver'}</button>
        </div>
      </div>
    `;

    modal.querySelector('.btn-cancel').addEventListener('click', () => {
      modal.remove();
      if (onCancel) onCancel();
    });

    modal.querySelector('.btn-proceed').addEventListener('click', () => {
      modal.remove();
      if (onProceed) onProceed();
    });

    document.body.appendChild(modal);
  },

  /**
   * Listen for storage changes
   */
  listenForChanges() {
    // Initial state
    chrome.storage.local.get('isBotEnabled', (result) => {
      this.setActive(result.isBotEnabled === true);
    });

    // Listen for changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.isBotEnabled) {
        const isActive = changes.isBotEnabled.newValue === true;
        this.setActive(isActive);

        if (isActive) {
          this.showToast('Solver Activated', 'Answering questions automatically', 'success');
        } else {
          this.showToast('Solver Deactivated', 'Manual mode enabled', 'info');
        }
      }

      if (changes.responseMap && this.debugVisible) {
        this.updateDebugStorageCount();
      }
    });
  },

  /**
   * Destroy overlay
   */
  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.badge = null;
      this.toastContainer = null;
      this.sessionCard = null;
      this.debugPanel = null;
    }
  },
};

// Export
if (typeof window !== 'undefined') {
  window.MP_Overlay = MP_Overlay;
}
