/**
 * McGraw Plus - Popup Script
 * Clean, minimal UI with power toggle, star verification, and settings
 */

(function () {
  'use strict';

  // Config
  const CONFIG = {
    VERSION_URL: 'https://raw.githubusercontent.com/KevinTrinh1227/McGraw-Plus/main/version.json',
    REPO_URL: 'https://github.com/KevinTrinh1227/McGraw-Plus',
    RELEASES_URL: 'https://github.com/KevinTrinh1227/McGraw-Plus/releases/latest',
    REPO_OWNER: 'KevinTrinh1227',
    REPO_NAME: 'McGraw-Plus',
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
    STAR_VERIFIED: 'mp_star_verified',
    STAR_USERNAME: 'mp_star_username',
    TERMS_ACCEPTED: 'mp_terms_accepted',
    USER_NAME: 'mp_user_name',
    ONBOARDING_COMPLETE: 'mp_onboarding_complete',
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
    termsOverlay: $('terms-overlay'),
    termsNameInput: $('terms-name-input'),
    acceptTermsBtn: $('accept-terms-btn'),
    // Header
    helpBtn: $('help-btn'),
    shareBtn: $('share-btn'),
    settingsBtn: $('settings-btn'),
    // Main view
    userGreeting: $('user-greeting'),
    powerToggle: $('power-toggle'),
    powerStatus: $('power-status'),
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
    // Star verification
    starCard: $('star-card'),
    starVerifiedBadge: $('star-verified-badge'),
    githubUsername: $('github-username'),
    verifyStarBtn: $('verify-star-btn'),
    starStatus: $('star-status'),
    // Main toggles (now in settings)
    toggleDarkMode: $('toggle-dark-mode'),
    toggleKeyboard: $('toggle-keyboard'),
    // Settings toggles
    settingDueDates: $('setting-due-dates'),
    settingNotifications: $('setting-notifications'),
    settingProgressBar: $('setting-progress-bar'),
    settingTabTitle: $('setting-tab-title'),
    settingAntiCopy: $('setting-anti-copy'),
    // Profile
    profileName: $('profile-name'),
    saveProfileBtn: $('save-profile-btn'),
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
    version: $('version'),
    footerVersion: $('footer-version'),
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
    await checkTermsAccepted();
    await loadSettings();
    await loadStats();
    await loadUserProfile();
    await loadStarStatus();
    await loadPowerStatus();
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
    if (el.footerVersion) el.footerVersion.textContent = version;
  }

  /**
   * Check if terms have been accepted
   */
  async function checkTermsAccepted() {
    const result = await chrome.storage.local.get(KEYS.TERMS_ACCEPTED);
    if (!result[KEYS.TERMS_ACCEPTED]) {
      el.termsOverlay.classList.remove('hidden');
    }
  }

  /**
   * Check if extension should be blocked (kill switch or force update)
   */
  async function checkBlockStatus() {
    try {
      const cached = await chrome.storage.local.get([KEYS.BLOCK_DATA, KEYS.LAST_VERSION_CHECK]);
      const now = Date.now();
      const lastCheck = cached[KEYS.LAST_VERSION_CHECK] || 0;

      if (cached[KEYS.BLOCK_DATA] && (now - lastCheck < CONFIG.CHECK_INTERVAL)) {
        handleBlockData(cached[KEYS.BLOCK_DATA]);
        return;
      }

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

      if (compareVersions(currentVersion, blockData.minVersion) < 0) {
        blockData.forceUpdate = true;
      }

      await chrome.storage.local.set({
        [KEYS.BLOCK_DATA]: blockData,
        [KEYS.LAST_VERSION_CHECK]: now,
      });

      handleBlockData(blockData);
    } catch (error) {
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
   * Load star verification status
   */
  async function loadStarStatus() {
    const result = await chrome.storage.local.get([KEYS.STAR_VERIFIED, KEYS.STAR_USERNAME]);

    if (result[KEYS.STAR_VERIFIED]) {
      el.starCard.classList.add('hidden');
      el.starVerifiedBadge.classList.remove('hidden');
      if (result[KEYS.STAR_USERNAME]) {
        el.githubUsername.value = result[KEYS.STAR_USERNAME];
      }
    } else {
      el.starCard.classList.remove('hidden');
      el.starVerifiedBadge.classList.add('hidden');
      if (result[KEYS.STAR_USERNAME]) {
        el.githubUsername.value = result[KEYS.STAR_USERNAME];
      }
    }
  }

  /**
   * Verify GitHub star
   */
  async function verifyGitHubStar() {
    const username = el.githubUsername.value.trim();

    if (!username) {
      showStarStatus('Please enter your GitHub username', 'error');
      return;
    }

    showStarStatus('Verifying...', 'loading');

    try {
      // GitHub API: Get stargazers (case-insensitive comparison)
      const response = await fetch(
        `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/stargazers?per_page=100`,
        {
          headers: { Accept: 'application/vnd.github.v3+json' },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch stargazers');
      }

      const stargazers = await response.json();

      // Case-insensitive search
      const found = stargazers.some(
        (user) => user.login.toLowerCase() === username.toLowerCase()
      );

      if (found) {
        // Save verification
        await chrome.storage.local.set({
          [KEYS.STAR_VERIFIED]: true,
          [KEYS.STAR_USERNAME]: username,
        });

        showStarStatus('Star verified! Thank you!', 'success');

        // Update UI after short delay
        setTimeout(() => {
          el.starCard.classList.add('hidden');
          el.starVerifiedBadge.classList.remove('hidden');
        }, 1500);
      } else {
        // Check if they might have starred recently (paginated results)
        // Try fetching more pages
        let page = 2;
        let verified = false;

        while (page <= 10 && !verified) {
          const nextResponse = await fetch(
            `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/stargazers?per_page=100&page=${page}`,
            {
              headers: { Accept: 'application/vnd.github.v3+json' },
              signal: AbortSignal.timeout(10000),
            }
          );

          if (!nextResponse.ok) break;

          const nextStargazers = await nextResponse.json();
          if (nextStargazers.length === 0) break;

          const foundInPage = nextStargazers.some(
            (user) => user.login.toLowerCase() === username.toLowerCase()
          );

          if (foundInPage) {
            verified = true;
            await chrome.storage.local.set({
              [KEYS.STAR_VERIFIED]: true,
              [KEYS.STAR_USERNAME]: username,
            });

            showStarStatus('Star verified! Thank you!', 'success');
            setTimeout(() => {
              el.starCard.classList.add('hidden');
              el.starVerifiedBadge.classList.remove('hidden');
            }, 1500);
          }

          page++;
        }

        if (!verified) {
          // Save username for convenience
          await chrome.storage.local.set({ [KEYS.STAR_USERNAME]: username });
          showStarStatus('Star not found. Please star the repo first!', 'error');
        }
      }
    } catch (error) {
      showStarStatus('Error verifying. Try again later.', 'error');
      console.error('Star verification error:', error);
    }
  }

  /**
   * Show star status message
   */
  function showStarStatus(message, type) {
    el.starStatus.textContent = message;
    el.starStatus.className = `star-status ${type}`;
    el.starStatus.classList.remove('hidden');
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
    // Terms acceptance
    el.termsNameInput.addEventListener('input', () => {
      el.acceptTermsBtn.disabled = el.termsNameInput.value.trim().length === 0;
    });

    el.acceptTermsBtn.addEventListener('click', async () => {
      const name = el.termsNameInput.value.trim();
      if (name) {
        await chrome.storage.local.set({
          [KEYS.TERMS_ACCEPTED]: true,
          [KEYS.USER_NAME]: name,
        });
        el.termsOverlay.classList.add('hidden');
        await loadUserProfile();
        showToast('Welcome to McGraw Plus!');
      }
    });

    // Power toggle
    el.powerToggle.addEventListener('click', togglePower);

    // Star verification
    el.verifyStarBtn.addEventListener('click', verifyGitHubStar);
    el.githubUsername.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') verifyGitHubStar();
    });

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

    // Profile
    el.saveProfileBtn.addEventListener('click', async () => {
      const name = el.profileName.value.trim();
      if (name) {
        await chrome.storage.local.set({ [KEYS.USER_NAME]: name });
        await loadUserProfile();
        showToast('Name saved!');
      }
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
      if (changes[KEYS.USER_NAME]) loadUserProfile();
    });
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
