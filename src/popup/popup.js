/**
 * McGraw Plus - Popup Script
 * Clean, minimal UI with kill switch and dev mode support
 */

(function () {
  'use strict';

  // Config
  const CONFIG = {
    VERSION_URL: 'https://raw.githubusercontent.com/KevinTrinh1227/McGraw-Plus/main/version.json',
    REPO_URL: 'https://github.com/KevinTrinh1227/McGraw-Plus',
    RELEASES_URL: 'https://github.com/KevinTrinh1227/McGraw-Plus/releases/latest',
    CHECK_INTERVAL: 3600000, // 1 hour
  };

  // Storage keys
  const KEYS = {
    SETTINGS: 'mp_settings',
    STATS: 'mp_stats',
    BLOCK_DATA: 'mp_block_data',
    LAST_VERSION_CHECK: 'mp_last_version_check',
    WEBHOOK_URL: 'sbs_webhook_url',
    LLM_ENABLED: 'sbs_llm_enabled',
    LLM_PROVIDER: 'sbs_llm_provider',
    LLM_API_KEY: 'sbs_llm_api_key',
  };

  // DOM Elements
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const el = {
    popup: $('popup'),
    blockOverlay: $('block-overlay'),
    blockTitle: $('block-title'),
    blockMessage: $('block-message'),
    blockBtn: $('block-btn'),
    // Header
    helpBtn: $('help-btn'),
    shareBtn: $('share-btn'),
    settingsBtn: $('settings-btn'),
    // Views
    mainView: $('main-view'),
    settingsView: $('settings-view'),
    helpView: $('help-view'),
    shareView: $('share-view'),
    // Status
    statusDot: $('status-dot'),
    statusText: $('status-text'),
    // Stats
    statQuestions: $('stat-questions'),
    statCorrect: $('stat-correct'),
    statStreak: $('stat-streak'),
    // Main toggles
    toggleDarkMode: $('toggle-dark-mode'),
    toggleKeyboard: $('toggle-keyboard'),
    // Settings toggles
    settingDueDates: $('setting-due-dates'),
    settingNotifications: $('setting-notifications'),
    settingProgressBar: $('setting-progress-bar'),
    settingTabTitle: $('setting-tab-title'),
    settingAntiCopy: $('setting-anti-copy'),
    // Webhook
    webhookUrl: $('webhook-url'),
    saveWebhookBtn: $('save-webhook-btn'),
    testWebhookBtn: $('test-webhook-btn'),
    // LLM
    llmEnabled: $('llm-enabled'),
    llmProvider: $('llm-provider'),
    llmApiKey: $('llm-api-key'),
    saveLlmBtn: $('save-llm-btn'),
    testLlmBtn: $('test-llm-btn'),
    // Data
    qaCount: $('qa-count'),
    storageSize: $('storage-size'),
    exportDataBtn: $('export-data-btn'),
    clearDataBtn: $('clear-data-btn'),
    version: $('version'),
    // Share
    copyLinkBtn: $('copy-link-btn'),
    // Dashboard
    openDashboardBtn: $('open-dashboard-btn'),
  };

  // Current view
  let currentView = 'main';

  /**
   * Initialize
   */
  async function init() {
    showVersion();
    await checkBlockStatus();
    await loadSettings();
    await loadStats();
    loadWebhookSettings();
    loadLlmSettings();
    loadStorageInfo();
    setupEventListeners();
    checkPageStatus();
  }

  /**
   * Show version
   */
  function showVersion() {
    const version = chrome.runtime.getManifest().version;
    if (el.version) el.version.textContent = version;
  }

  /**
   * Check if extension should be blocked (kill switch or force update)
   */
  async function checkBlockStatus() {
    try {
      // Check cached block data first
      const cached = await chrome.storage.local.get([KEYS.BLOCK_DATA, KEYS.LAST_VERSION_CHECK]);
      const now = Date.now();
      const lastCheck = cached[KEYS.LAST_VERSION_CHECK] || 0;

      // Use cached data if recent
      if (cached[KEYS.BLOCK_DATA] && (now - lastCheck < CONFIG.CHECK_INTERVAL)) {
        handleBlockData(cached[KEYS.BLOCK_DATA]);
        return;
      }

      // Fetch fresh version data
      const response = await fetch(CONFIG.VERSION_URL, {
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      });

      if (!response.ok) return;

      const data = await response.json();
      const currentVersion = chrome.runtime.getManifest().version;

      const blockData = {
        killSwitch: data.killSwitch === true,
        forceUpdate: data.forceUpdate === true,
        minVersion: data.minVersion || '0.0.0',
        latestVersion: data.version || currentVersion,
        message: data.message || '',
        downloadUrl: data.downloadUrl || CONFIG.RELEASES_URL,
      };

      // Check if current version is below minimum
      if (compareVersions(currentVersion, blockData.minVersion) < 0) {
        blockData.forceUpdate = true;
      }

      // Cache the data
      await chrome.storage.local.set({
        [KEYS.BLOCK_DATA]: blockData,
        [KEYS.LAST_VERSION_CHECK]: now,
      });

      handleBlockData(blockData);
    } catch (error) {
      // Network error - use cached data or allow
      const cached = await chrome.storage.local.get(KEYS.BLOCK_DATA);
      if (cached[KEYS.BLOCK_DATA]) {
        handleBlockData(cached[KEYS.BLOCK_DATA]);
      }
    }
  }

  /**
   * Handle block data (show overlay if needed)
   */
  function handleBlockData(data) {
    if (!data) return;

    if (data.killSwitch) {
      el.blockTitle.textContent = 'Extension Disabled';
      el.blockMessage.textContent = data.message || 'This extension has been temporarily disabled. Please check back later.';
      el.blockBtn.textContent = 'Learn More';
      el.blockBtn.href = CONFIG.REPO_URL;
      el.blockOverlay.classList.remove('hidden');
      return;
    }

    if (data.forceUpdate) {
      el.blockTitle.textContent = 'Update Required';
      el.blockMessage.textContent = data.message || `Version ${data.latestVersion} is available. Please update to continue using McGraw Plus.`;
      el.blockBtn.textContent = 'Download Update';
      el.blockBtn.href = data.downloadUrl || CONFIG.RELEASES_URL;
      el.blockOverlay.classList.remove('hidden');
      return;
    }

    // Not blocked
    el.blockOverlay.classList.add('hidden');
  }

  /**
   * Compare semantic versions
   */
  function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  /**
   * Check if on SmartBook page
   */
  async function checkPageStatus() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tabs[0]?.url || '';
      const isSmartBook = url.includes('mheducation.com');

      if (isSmartBook) {
        el.statusDot.classList.remove('inactive');
        el.statusText.textContent = 'Active on SmartBook';
      } else {
        el.statusDot.classList.add('inactive');
        el.statusText.textContent = 'Navigate to SmartBook';
      }
    } catch {
      el.statusDot.classList.add('inactive');
      el.statusText.textContent = 'Ready';
    }
  }

  /**
   * Load settings
   */
  async function loadSettings() {
    const result = await chrome.storage.local.get(KEYS.SETTINGS);
    const settings = result[KEYS.SETTINGS] || {};

    // Main toggles
    el.toggleDarkMode.checked = settings.darkMode !== false;
    el.toggleKeyboard.checked = settings.keyboardShortcuts !== false;

    // Settings toggles
    el.settingDueDates.checked = settings.dueDateTracker !== false;
    el.settingNotifications.checked = settings.notifications !== false;
    el.settingProgressBar.checked = settings.progressBar !== false;
    el.settingTabTitle.checked = settings.tabTitle !== false;
    el.settingAntiCopy.checked = settings.antiCopy === true;
  }

  /**
   * Save settings
   */
  async function saveSettings(updates) {
    const result = await chrome.storage.local.get(KEYS.SETTINGS);
    const settings = { ...result[KEYS.SETTINGS], ...updates };
    await chrome.storage.local.set({ [KEYS.SETTINGS]: settings });
  }

  /**
   * Load stats
   */
  async function loadStats() {
    const result = await chrome.storage.local.get(KEYS.STATS);
    const stats = result[KEYS.STATS] || {};
    const session = stats.currentSession || {};

    el.statQuestions.textContent = session.questions || stats.totalQuestions || 0;
    el.statCorrect.textContent = session.correct || stats.correctFirstTry || 0;
    el.statStreak.textContent = stats.streakDays || 0;
  }

  /**
   * Load webhook settings
   */
  function loadWebhookSettings() {
    chrome.storage.local.get(KEYS.WEBHOOK_URL, (result) => {
      if (result[KEYS.WEBHOOK_URL]) {
        el.webhookUrl.value = result[KEYS.WEBHOOK_URL];
      }
    });
  }

  /**
   * Load LLM settings
   */
  function loadLlmSettings() {
    chrome.storage.local.get([KEYS.LLM_ENABLED, KEYS.LLM_PROVIDER, KEYS.LLM_API_KEY], (result) => {
      el.llmEnabled.checked = result[KEYS.LLM_ENABLED] === true;
      if (result[KEYS.LLM_PROVIDER]) el.llmProvider.value = result[KEYS.LLM_PROVIDER];
      if (result[KEYS.LLM_API_KEY]) el.llmApiKey.value = result[KEYS.LLM_API_KEY];
    });
  }

  /**
   * Load storage info
   */
  function loadStorageInfo() {
    chrome.storage.local.get('responseMap', (result) => {
      const map = result.responseMap || {};
      const count = Object.keys(map).length;
      const size = new Blob([JSON.stringify(map)]).size;

      el.qaCount.textContent = count;
      el.storageSize.textContent = (size / 1024).toFixed(1) + ' KB';
    });
  }

  /**
   * Switch view with animation
   */
  function switchView(viewId) {
    const views = ['main', 'settings', 'help', 'share'];
    views.forEach((v) => {
      const viewEl = $(`${v}-view`);
      if (viewEl) {
        if (v === viewId) {
          viewEl.classList.add('active');
        } else {
          viewEl.classList.remove('active');
        }
      }
    });
    currentView = viewId;
  }

  /**
   * Show toast message
   */
  function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Header buttons
    el.helpBtn.addEventListener('click', () => switchView('help'));
    el.shareBtn.addEventListener('click', () => switchView('share'));
    el.settingsBtn.addEventListener('click', () => switchView('settings'));

    // Back buttons
    $$('[data-back]').forEach((btn) => {
      btn.addEventListener('click', () => switchView('main'));
    });

    // Tabs
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        $$('.tab').forEach((t) => t.classList.remove('active'));
        $$('.tab-content').forEach((c) => c.classList.remove('active'));
        tab.classList.add('active');
        $(`tab-${tabId}`).classList.add('active');
      });
    });

    // Main toggles
    el.toggleDarkMode.addEventListener('change', () => {
      saveSettings({ darkMode: el.toggleDarkMode.checked });
    });

    el.toggleKeyboard.addEventListener('change', () => {
      saveSettings({ keyboardShortcuts: el.toggleKeyboard.checked });
    });

    // Settings toggles
    el.settingDueDates.addEventListener('change', () => {
      saveSettings({ dueDateTracker: el.settingDueDates.checked });
    });

    el.settingNotifications.addEventListener('change', () => {
      saveSettings({ notifications: el.settingNotifications.checked });
    });

    el.settingProgressBar.addEventListener('change', () => {
      saveSettings({ progressBar: el.settingProgressBar.checked });
    });

    el.settingTabTitle.addEventListener('change', () => {
      saveSettings({ tabTitle: el.settingTabTitle.checked });
    });

    el.settingAntiCopy.addEventListener('change', () => {
      saveSettings({ antiCopy: el.settingAntiCopy.checked });
    });

    // Webhook
    el.saveWebhookBtn.addEventListener('click', () => {
      const url = el.webhookUrl.value.trim();
      if (url && !url.includes('discord.com/api/webhooks/')) {
        showToast('Invalid webhook URL');
        return;
      }
      chrome.storage.local.set({ [KEYS.WEBHOOK_URL]: url || null });
      showToast('Saved!');
    });

    el.testWebhookBtn.addEventListener('click', async () => {
      const url = el.webhookUrl.value.trim();
      if (!url) {
        showToast('Enter a URL first');
        return;
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'McGraw Plus',
            embeds: [{
              title: 'Test',
              description: 'Connection successful!',
              color: 0x6366f1,
            }],
          }),
        });

        showToast(response.ok ? 'Test sent!' : 'Failed');
      } catch {
        showToast('Error sending');
      }
    });

    // LLM
    el.saveLlmBtn.addEventListener('click', () => {
      chrome.storage.local.set({
        [KEYS.LLM_ENABLED]: el.llmEnabled.checked,
        [KEYS.LLM_PROVIDER]: el.llmProvider.value,
        [KEYS.LLM_API_KEY]: el.llmApiKey.value.trim() || null,
      });
      showToast('Saved!');
    });

    el.testLlmBtn.addEventListener('click', async () => {
      const apiKey = el.llmApiKey.value.trim();
      if (!apiKey) {
        showToast('Enter API key first');
        return;
      }

      const provider = el.llmProvider.value;
      const providers = {
        groq: { endpoint: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
        openai: { endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
        anthropic: { endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-3-haiku-20240307' },
      };

      const config = providers[provider];

      try {
        let response;
        if (provider === 'anthropic') {
          response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: config.model,
              max_tokens: 50,
              messages: [{ role: 'user', content: "Say 'ok'" }],
            }),
          });
        } else {
          response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: config.model,
              max_tokens: 50,
              messages: [{ role: 'user', content: "Say 'ok'" }],
            }),
          });
        }

        showToast(response.ok ? 'API working!' : 'API error');
      } catch {
        showToast('Connection failed');
      }
    });

    // Data
    el.exportDataBtn.addEventListener('click', () => {
      chrome.storage.local.get('responseMap', (result) => {
        const data = JSON.stringify(result.responseMap || {}, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mcgraw-plus-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    });

    el.clearDataBtn.addEventListener('click', () => {
      if (confirm('Clear all stored Q&A data?')) {
        chrome.storage.local.remove('responseMap', () => {
          loadStorageInfo();
          showToast('Data cleared');
        });
      }
    });

    // Share
    el.copyLinkBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(CONFIG.REPO_URL);
      showToast('Link copied!');
    });

    // Dashboard
    el.openDashboardBtn.addEventListener('click', () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('dashboard/dashboard.html'),
      });
      window.close();
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes[KEYS.STATS]) loadStats();
      if (changes.responseMap) loadStorageInfo();
    });
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
