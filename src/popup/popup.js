/**
 * McGraw Plus - Popup Script
 * Clean, minimal UI with power toggle, star verification, and settings
 */

(function () {
  'use strict';

  // Config
  const CONFIG = {
    WEBSITE_URL: 'https://mcgrawplus.pages.dev',
    DOCS_URL: 'https://mcgrawplus.pages.dev/docs',
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
    EXTENSION_ENABLED: 'mp_extension_enabled',
    TERMS_ACCEPTED: 'mp_terms_accepted',
    USER_NAME: 'mp_user_name',
    ONBOARDING_COMPLETE: 'mp_onboarding_complete',
    ONBOARDING_WAITING_FOR_CONNECT: 'mp_onboarding_waiting_for_connect',
    ONBOARDING_COMPLETED_AT: 'mp_onboarding_completed_at',
    DEVELOPER_MODE_ENABLED: 'mp_developer_mode_enabled',
    SOLVER_ENABLED: 'mp_solver_enabled',
    SOLVER_TERMS_AGREED: 'mp_solver_terms_agreed',
    QUIZ_SOLVER_ENABLED: 'mp_quiz_solver_enabled',
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
    profileBtn: $('profile-btn'),
    helpBtn: $('help-btn'),
    settingsBtn: $('settings-btn'),
    // Onboarding prompt
    onboardingPrompt: $('onboarding-prompt'),
    // Main view
    userGreeting: $('user-greeting'),
    powerToggle: $('power-toggle'),
    powerStatus: $('power-status'),
    // Views
    mainView: $('main-view'),
    settingsView: $('settings-view'),
    helpView: $('help-view'),
    profileView: $('profile-view'),
    // Status
    statusDot: $('status-dot'),
    statusText: $('status-text'),
    // Stats
    statQuestions: $('stat-questions'),
    statCorrect: $('stat-correct'),
    statStreak: $('stat-streak'),
    // Main toggles (now in settings)
    toggleDarkMode: $('toggle-dark-mode'),
    toggleKeyboard: $('toggle-keyboard'),
    // Settings toggles
    settingDueDates: $('setting-due-dates'),
    settingNotifications: $('setting-notifications'),
    settingProgressBar: $('setting-progress-bar'),
    settingTabTitle: $('setting-tab-title'),
    settingAntiCopy: $('setting-anti-copy'),
    // Experimental tab
    experimentalTab: document.querySelector('.experimental-tab'),
    solverEnabled: $('solver-enabled'),
    quizSolverEnabled: $('quiz-solver-enabled'),
    // Profile view
    profileDisplayName: $('profile-display-name'),
    profileMemberSince: $('profile-member-since'),
    profileQuestions: $('profile-questions'),
    profileAccuracy: $('profile-accuracy'),
    profileStreak: $('profile-streak'),
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
    // Reset
    redoOnboardingBtn: $('redo-onboarding-btn'),
    resyncDataBtn: $('resync-data-btn'),
    resetAllBtn: $('reset-all-btn'),
    // Version
    footerVersion: $('footer-version'),
    // Share
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

    // Always set up onboarding button listeners first
    setupOnboardingListeners();

    const onboardingComplete = await checkOnboardingStatus();
    if (!onboardingComplete) return; // Show onboarding prompt instead of main content

    await loadSettings();
    await loadStats();
    await loadUserProfile();
    await loadProfileStats();
    await loadPowerStatus();
    await loadDeveloperMode();
    await loadExperimentalSettings();
    loadWebhookSettings();
    loadLlmSettings();
    loadStorageInfo();
    setupEventListeners();
    setupFaqToggle();
    checkPageStatus();
  }

  /**
   * Setup onboarding-specific event listeners (called before onboarding check)
   */
  function setupOnboardingListeners() {
    // Listen for onboarding completion to refresh popup
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[KEYS.ONBOARDING_COMPLETE]) {
        if (changes[KEYS.ONBOARDING_COMPLETE].newValue === true) {
          // Onboarding completed, reload popup to show main view
          window.location.reload();
        }
      }
    });
  }

  /**
   * Check onboarding status and show appropriate view
   */
  async function checkOnboardingStatus() {
    const result = await chrome.storage.local.get(KEYS.ONBOARDING_COMPLETE);

    if (result[KEYS.ONBOARDING_COMPLETE]) {
      // Onboarding complete, show main view
      el.onboardingPrompt.classList.add('hidden');
      el.mainView.classList.add('active');
      return true;
    }

    // Onboarding not complete - show simple setup prompt
    el.onboardingPrompt.classList.remove('hidden');
    el.onboardingPrompt.classList.add('active');
    el.mainView.classList.remove('active');

    return false;
  }

  /**
   * Check if user is on McGraw-Hill Connect page
   */
  async function checkConnectPageStatus() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tabs[0]?.url || '';

      // Check if on any McGraw-Hill page
      const isMcGrawHill =
        url.includes('connect.mheducation.com') ||
        url.includes('learning.mheducation.com') ||
        url.includes('newconnect.mheducation.com') ||
        url.includes('connect.edu.mheducation.com') ||
        url.includes('connect.router.integration.prod.mheducation.com');

      return isMcGrawHill;
    } catch {
      return false;
    }
  }

  /**
   * Load developer mode status
   */
  async function loadDeveloperMode() {
    const result = await chrome.storage.local.get(KEYS.DEVELOPER_MODE_ENABLED);
    const devModeEnabled = result[KEYS.DEVELOPER_MODE_ENABLED] === true;

    if (devModeEnabled && el.experimentalTab) {
      el.experimentalTab.classList.remove('hidden');
    }
  }

  /**
   * Load experimental settings
   */
  async function loadExperimentalSettings() {
    const result = await chrome.storage.local.get([
      KEYS.SOLVER_ENABLED,
      KEYS.QUIZ_SOLVER_ENABLED
    ]);

    if (el.solverEnabled) {
      el.solverEnabled.checked = result[KEYS.SOLVER_ENABLED] === true;
    }
    if (el.quizSolverEnabled) {
      el.quizSolverEnabled.checked = result[KEYS.QUIZ_SOLVER_ENABLED] === true;
    }
  }

  /**
   * Load profile stats
   */
  async function loadProfileStats() {
    const result = await chrome.storage.local.get([
      KEYS.STATS,
      KEYS.ONBOARDING_COMPLETED_AT,
      KEYS.USER_NAME
    ]);

    const stats = result[KEYS.STATS] || {};
    const completedAt = result[KEYS.ONBOARDING_COMPLETED_AT];
    const userName = result[KEYS.USER_NAME];

    // Profile name
    if (el.profileDisplayName && userName) {
      el.profileDisplayName.textContent = userName;
    }

    // Member since
    if (el.profileMemberSince && completedAt) {
      const date = new Date(completedAt);
      el.profileMemberSince.textContent = date.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    }

    // Questions answered
    if (el.profileQuestions) {
      el.profileQuestions.textContent = stats.totalQuestions || 0;
    }

    // Accuracy
    if (el.profileAccuracy) {
      const accuracy = stats.totalQuestions > 0
        ? Math.round((stats.correctFirstTry / stats.totalQuestions) * 100)
        : 0;
      el.profileAccuracy.textContent = `${accuracy}%`;
    }

    // Streak
    if (el.profileStreak) {
      el.profileStreak.textContent = `${stats.streakDays || 0} days`;
    }
  }

  /**
   * Show version
   */
  function showVersion() {
    const version = chrome.runtime.getManifest().version;
    if (el.footerVersion) el.footerVersion.textContent = version;
  }

  /**
   * Check if extension should be blocked (kill switch or force update)
   * Note: Version checking disabled - no external version endpoint configured
   */
  async function checkBlockStatus() {
    try {
      // Check cached block data only - version checking disabled
      const cached = await chrome.storage.local.get(KEYS.BLOCK_DATA);
      if (cached[KEYS.BLOCK_DATA]) {
        handleBlockData(cached[KEYS.BLOCK_DATA]);
      }
    } catch (error) {
      // Ignore errors - extension continues normally
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
      el.blockBtn.href = CONFIG.WEBSITE_URL;
      el.blockOverlay.classList.remove('hidden');
      return;
    }

    if (data.forceUpdate) {
      el.blockTitle.textContent = 'Update Required';
      el.blockMessage.textContent = data.message || `Version ${data.latestVersion} is available. Please update to continue using McGraw Plus.`;
      el.blockBtn.textContent = 'Download Update';
      el.blockBtn.href = data.downloadUrl || CONFIG.WEBSITE_URL;
      el.blockOverlay.classList.remove('hidden');
      return;
    }

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
   * Load power status
   */
  async function loadPowerStatus() {
    const result = await chrome.storage.local.get(KEYS.EXTENSION_ENABLED);
    const isEnabled = result[KEYS.EXTENSION_ENABLED] === true;
    updatePowerUI(isEnabled);
  }

  /**
   * Update power toggle UI
   */
  function updatePowerUI(isEnabled) {
    el.powerToggle.classList.toggle('active', isEnabled);
    el.powerStatus.textContent = isEnabled ? 'On' : 'Off';
    el.powerStatus.classList.toggle('on', isEnabled);
    el.powerStatus.classList.toggle('off', !isEnabled);
  }

  /**
   * Toggle power
   */
  async function togglePower() {
    const result = await chrome.storage.local.get(KEYS.EXTENSION_ENABLED);
    const newState = !result[KEYS.EXTENSION_ENABLED];
    await chrome.storage.local.set({ [KEYS.EXTENSION_ENABLED]: newState });
    updatePowerUI(newState);

    // Notify content scripts
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: newState ? 'SOLVER_ACTIVATE' : 'SOLVER_DEACTIVATE',
      }).catch(() => {});
    }

    showToast(newState ? 'Extension enabled' : 'Extension disabled');
  }

  /**
   * Get time-based greeting
   */
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  /**
   * Load user profile
   */
  async function loadUserProfile() {
    const result = await chrome.storage.local.get(KEYS.USER_NAME);
    const userName = result[KEYS.USER_NAME];

    if (userName) {
      el.userGreeting.classList.remove('hidden');
      el.userGreeting.textContent = `${getGreeting()}, ${userName}`;
      if (el.profileName) el.profileName.value = userName;
    } else {
      el.userGreeting.classList.add('hidden');
    }
  }

  /**
   * Load settings
   */
  async function loadSettings() {
    const result = await chrome.storage.local.get(KEYS.SETTINGS);
    const settings = result[KEYS.SETTINGS] || {};

    el.toggleDarkMode.checked = settings.darkMode !== false;
    el.toggleKeyboard.checked = settings.keyboardShortcuts !== false;
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
    const views = ['main', 'settings', 'help', 'profile'];
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

    // Reload profile stats when opening profile view
    if (viewId === 'profile') {
      loadProfileStats();
    }
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
   * Setup FAQ toggle functionality
   */
  function setupFaqToggle() {
    const faqQuestions = $$('.faq-question');
    faqQuestions.forEach((question) => {
      question.addEventListener('click', () => {
        const item = question.closest('.faq-item');
        item.classList.toggle('open');
      });
    });
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Profile button - navigate to profile view
    el.profileBtn.addEventListener('click', () => {
      switchView('profile');
    });

    // Power toggle
    el.powerToggle.addEventListener('click', togglePower);

    // Header buttons
    el.helpBtn.addEventListener('click', () => switchView('help'));
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

    // Main toggles (now in settings)
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

    // Experimental settings
    if (el.solverEnabled) {
      el.solverEnabled.addEventListener('change', async () => {
        const enabled = el.solverEnabled.checked;
        if (enabled) {
          // Check if terms agreed
          const result = await chrome.storage.local.get(KEYS.SOLVER_TERMS_AGREED);
          if (!result[KEYS.SOLVER_TERMS_AGREED]) {
            const agreed = confirm(
              'SmartBook Solver Terms\n\n' +
              'By enabling this feature, you acknowledge:\n\n' +
              '• This tool is for educational purposes only\n' +
              '• You are responsible for your academic integrity\n' +
              '• Use at your own risk\n\n' +
              'Do you agree to these terms?'
            );
            if (!agreed) {
              el.solverEnabled.checked = false;
              return;
            }
            await chrome.storage.local.set({
              [KEYS.SOLVER_TERMS_AGREED]: true,
              mp_solver_terms_agreed_at: Date.now()
            });
          }
        }
        await chrome.storage.local.set({ [KEYS.SOLVER_ENABLED]: enabled });
        showToast(enabled ? 'Solver enabled' : 'Solver disabled');
      });
    }

    if (el.quizSolverEnabled) {
      el.quizSolverEnabled.addEventListener('change', async () => {
        const enabled = el.quizSolverEnabled.checked;
        await chrome.storage.local.set({ [KEYS.QUIZ_SOLVER_ENABLED]: enabled });
        showToast(enabled ? 'Quiz Solver enabled' : 'Quiz Solver disabled');
      });
    }

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

    // Reset options
    el.redoOnboardingBtn.addEventListener('click', async () => {
      if (confirm('Redo onboarding? This will show the setup screens again.')) {
        await chrome.storage.local.remove([KEYS.ONBOARDING_COMPLETE, KEYS.TERMS_ACCEPTED]);
        chrome.tabs.create({
          url: chrome.runtime.getURL('onboarding/onboarding.html'),
        });
        window.close();
      }
    });

    el.resyncDataBtn.addEventListener('click', async () => {
      showToast('Re-syncing data...');
      // Trigger a re-scrape on the active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url?.includes('mheducation.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'RESYNC_DATA' }).catch(() => {});
        showToast('Re-sync requested');
      } else {
        showToast('Navigate to SmartBook first');
      }
    });

    el.resetAllBtn.addEventListener('click', async () => {
      if (confirm('Reset everything? This will clear ALL extension data including settings, stats, and Q&A pairs. This cannot be undone!')) {
        if (confirm('Are you absolutely sure?')) {
          await chrome.storage.local.clear();
          showToast('All data reset');
          setTimeout(() => window.close(), 1000);
        }
      }
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
      if (changes[KEYS.STATS]) {
        loadStats();
        loadProfileStats();
      }
      if (changes.responseMap) loadStorageInfo();
      if (changes[KEYS.USER_NAME]) {
        loadUserProfile();
        loadProfileStats();
      }
      if (changes[KEYS.DEVELOPER_MODE_ENABLED]) {
        const enabled = changes[KEYS.DEVELOPER_MODE_ENABLED].newValue === true;
        if (el.experimentalTab) {
          el.experimentalTab.classList.toggle('hidden', !enabled);
        }
      }
    });
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
