/**
 * McGraw Plus - Service Worker
 * Handles background tasks, alarms, notifications, and update checks
 */

// Storage keys
const STORAGE_KEYS = {
  SETTINGS: 'mp_settings',
  STATS: 'mp_stats',
  DUE_DATES: 'mp_due_dates',
  UPDATE_AVAILABLE: 'mp_update_available',
  UPDATE_VERSION: 'mp_update_version',
  UPDATE_URL: 'mp_update_url',
  FIRST_INSTALL: 'mp_first_install',
  ONBOARDING_COMPLETE: 'mp_onboarding_complete',
  SOLVER_ENABLED: 'isBotEnabled', // Legacy key for compatibility
  BLOCK_DATA: 'mp_block_data',
  LAST_BLOCK_CHECK: 'mp_last_block_check',
};

// GitHub repo info
const REPO_OWNER = 'KevinTrinh1227';
const REPO_NAME = 'McGraw-Plus';
const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

// Version control JSON URL (for kill switch and force update)
const VERSION_JSON_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/version.json`;

// Message types
const MSG = {
  SOLVER_ACTIVATE: 'SOLVER_ACTIVATE',
  SOLVER_DEACTIVATE: 'SOLVER_DEACTIVATE',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  CHECK_UPDATE: 'CHECK_UPDATE',
  SHOW_NOTIFICATION: 'SHOW_NOTIFICATION',
  PING: 'PING',
};

/**
 * Compare semantic versions
 */
function compareSemver(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * Check kill switch and force update status
 * This runs periodically and blocks the extension if needed
 */
async function checkBlockStatus() {
  try {
    const response = await fetch(VERSION_JSON_URL, {
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
      downloadUrl: data.downloadUrl || `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
    };

    // Check if current version is below minimum required
    if (compareSemver(currentVersion, blockData.minVersion) < 0) {
      blockData.forceUpdate = true;
    }

    // Store block data
    await chrome.storage.local.set({
      [STORAGE_KEYS.BLOCK_DATA]: blockData,
      [STORAGE_KEYS.LAST_BLOCK_CHECK]: Date.now(),
    });

    // If blocked, disable the solver and show badge
    if (blockData.killSwitch || blockData.forceUpdate) {
      await chrome.storage.local.set({ [STORAGE_KEYS.SOLVER_ENABLED]: false });
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      console.log('[McGraw Plus] Extension blocked:', blockData.killSwitch ? 'Kill switch' : 'Force update');
    }
  } catch (err) {
    console.warn('[McGraw Plus] Failed to check block status:', err.message);
  }
}

/**
 * Check for updates
 */
async function checkForUpdate() {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn('[McGraw Plus] GitHub API returned', response.status);
      return;
    }

    const release = await response.json();
    const latestVersion = release.tag_name;
    const currentVersion = chrome.runtime.getManifest().version;

    // Find the ZIP asset URL for direct download
    let downloadUrl = release.html_url;
    if (release.assets && release.assets.length > 0) {
      const zipAsset = release.assets.find(
        (asset) => asset.name.endsWith('.zip') && asset.browser_download_url
      );
      if (zipAsset) {
        downloadUrl = zipAsset.browser_download_url;
      }
    }

    if (compareSemver(latestVersion, currentVersion) > 0) {
      console.log(`[McGraw Plus] New version available: ${latestVersion} (current: ${currentVersion})`);

      await chrome.storage.local.set({
        [STORAGE_KEYS.UPDATE_AVAILABLE]: true,
        [STORAGE_KEYS.UPDATE_VERSION]: latestVersion.replace(/^v/, ''),
        [STORAGE_KEYS.UPDATE_URL]: downloadUrl,
      });

      // Show badge
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    } else {
      console.log('[McGraw Plus] Already on latest version:', currentVersion);
      await chrome.storage.local.set({ [STORAGE_KEYS.UPDATE_AVAILABLE]: false });
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.warn('[McGraw Plus] Failed to check for updates:', err.message);
  }
}

/**
 * Show a notification
 */
function showNotification(title, message, type = 'basic') {
  chrome.notifications.create({
    type,
    iconUrl: 'assets/icons/icon-128.png',
    title,
    message,
    priority: 1,
  });
}

/**
 * Handle due date reminders
 */
async function checkDueDateReminders() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DUE_DATES);
  const dueDates = result[STORAGE_KEYS.DUE_DATES] || [];

  const now = Date.now();
  const reminders = [];

  for (const assignment of dueDates) {
    if (!assignment.dueDate || assignment.completed) continue;

    const dueTime = new Date(assignment.dueDate).getTime();
    const timeUntilDue = dueTime - now;

    // 24 hours
    if (timeUntilDue > 0 && timeUntilDue <= 86400000 && !assignment.reminded24h) {
      reminders.push({
        assignment,
        message: `${assignment.name} is due in less than 24 hours`,
        flag: 'reminded24h',
      });
    }

    // 3 hours
    if (timeUntilDue > 0 && timeUntilDue <= 10800000 && !assignment.reminded3h) {
      reminders.push({
        assignment,
        message: `${assignment.name} is due in less than 3 hours!`,
        flag: 'reminded3h',
      });
    }

    // 1 hour
    if (timeUntilDue > 0 && timeUntilDue <= 3600000 && !assignment.reminded1h) {
      reminders.push({
        assignment,
        message: `${assignment.name} is due in less than 1 hour!`,
        flag: 'reminded1h',
      });
    }
  }

  // Show notifications and update flags
  for (const reminder of reminders) {
    showNotification('Assignment Reminder', reminder.message);
    reminder.assignment[reminder.flag] = true;
  }

  if (reminders.length > 0) {
    await chrome.storage.local.set({ [STORAGE_KEYS.DUE_DATES]: dueDates });
  }
}

/**
 * Run daily storage cleanup
 */
async function dailyCleanup() {
  const result = await chrome.storage.local.get('responseMap');
  const map = result.responseMap || {};
  const json = JSON.stringify(map);
  const sizeBytes = new Blob([json]).size;
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  if (sizeBytes > MAX_SIZE) {
    const keys = Object.keys(map);
    const pruneCount = Math.ceil(keys.length * 0.2);
    console.log('[McGraw Plus] Pruning', pruneCount, 'old entries');

    for (let i = 0; i < pruneCount; i++) {
      delete map[keys[i]];
    }

    await chrome.storage.local.set({ responseMap: map });
  }

  console.log('[McGraw Plus] Daily cleanup complete');
}

/**
 * Handle tab updates - reactivate solver if enabled
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;

  const isMcGrawHill =
    tab.url.includes('learning.mheducation.com') ||
    tab.url.includes('connect.mheducation.com');

  if (isMcGrawHill && changeInfo.status === 'complete') {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SOLVER_ENABLED);
    const isEnabled = result[STORAGE_KEYS.SOLVER_ENABLED] === true;

    if (isEnabled) {
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { type: MSG.SOLVER_ACTIVATE }, () => {
          if (chrome.runtime.lastError) {
            // Content script may not be ready yet
          }
        });
      }, 500);
    }
  }
});

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Normalize string messages
  if (typeof message === 'string') {
    message = { type: message };
  }

  switch (message.type) {
    case 'activate':
    case MSG.SOLVER_ACTIVATE:
      // Forward to content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: MSG.SOLVER_ACTIVATE });
        }
      });
      break;

    case 'deactivate':
    case MSG.SOLVER_DEACTIVATE:
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: MSG.SOLVER_DEACTIVATE });
        }
      });
      break;

    case MSG.CHECK_UPDATE:
      checkForUpdate().then(() => sendResponse({ success: true }));
      return true;

    case MSG.SHOW_NOTIFICATION:
      showNotification(message.data?.title, message.data?.message);
      sendResponse({ success: true });
      break;

    case MSG.PING:
      sendResponse({ type: 'PONG' });
      break;

    default:
      // Unknown message type
      break;
  }

  return false;
});

/**
 * Handle alarms
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  switch (alarm.name) {
    case 'checkBlockStatus':
      checkBlockStatus();
      break;

    case 'checkForUpdate':
    case 'initialUpdateCheck':
      checkForUpdate();
      break;

    case 'dueDateReminders':
      checkDueDateReminders();
      break;

    case 'dailyCleanup':
      dailyCleanup();
      break;
  }
});

/**
 * Handle extension install/update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[McGraw Plus] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First install - open onboarding
    await chrome.storage.local.set({ [STORAGE_KEYS.FIRST_INSTALL]: Date.now() });

    // Open onboarding page
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding/onboarding.html'),
    });

    // Run migration from old extension if data exists
    await migrateFromLegacy();
  } else if (details.reason === 'update') {
    // Check if we need to migrate
    await migrateFromLegacy();
  }

  // Setup context menu
  setupContextMenu();

  // Setup alarms
  setupAlarms();

  // Check block status and updates
  checkBlockStatus();
  checkForUpdate();
});

/**
 * Setup context menu
 */
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'open-dashboard',
      title: 'Open Dashboard',
      contexts: ['action'],
    });
  });
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-dashboard') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('dashboard/dashboard.html'),
    });
  }
});

/**
 * Handle keyboard commands
 */
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-dashboard') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('dashboard/dashboard.html'),
    });
  }
});

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(() => {
  setupAlarms();
  checkBlockStatus();
  checkForUpdate();
});

/**
 * Setup periodic alarms
 */
function setupAlarms() {
  // Block status check every 1 hour (kill switch / force update)
  chrome.alarms.create('checkBlockStatus', { periodInMinutes: 60 });

  // Update check every 6 hours
  chrome.alarms.create('checkForUpdate', { periodInMinutes: 360 });

  // Check for update 1 minute after startup
  chrome.alarms.create('initialUpdateCheck', { delayInMinutes: 1 });

  // Due date reminders every 30 minutes
  chrome.alarms.create('dueDateReminders', { periodInMinutes: 30 });

  // Daily cleanup at ~3 AM
  const now = new Date();
  const nextCleanup = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    3,
    0,
    0
  );
  const delayMinutes = (nextCleanup - now) / 60000;
  chrome.alarms.create('dailyCleanup', {
    delayInMinutes: delayMinutes,
    periodInMinutes: 1440,
  });
}

/**
 * Migrate data from legacy SmartBook Solver
 */
async function migrateFromLegacy() {
  const result = await chrome.storage.local.get(null);

  // Check if migration needed
  if (result.mp_migrated) {
    return;
  }

  const migrations = {};
  let hasLegacyData = false;

  // Migrate stats
  if (result.sbs_stats) {
    hasLegacyData = true;
    migrations.mp_stats = {
      ...result.sbs_stats,
      migratedFrom: 'sbs_stats',
      migratedAt: Date.now(),
    };
  }

  // Migrate settings
  const legacySettings = {};
  if (result.sbs_webhook_url) {
    legacySettings.webhookUrl = result.sbs_webhook_url;
  }
  if (result.sbs_llm_enabled !== undefined) {
    legacySettings.llmEnabled = result.sbs_llm_enabled;
  }
  if (result.sbs_llm_provider) {
    legacySettings.llmProvider = result.sbs_llm_provider;
  }
  if (result.sbs_llm_api_key) {
    legacySettings.llmApiKey = result.sbs_llm_api_key;
  }
  if (result.sbs_anti_copy_enabled !== undefined) {
    legacySettings.antiCopy = result.sbs_anti_copy_enabled;
  }

  if (Object.keys(legacySettings).length > 0) {
    hasLegacyData = true;
    migrations.mp_settings = {
      ...legacySettings,
      migratedFrom: 'sbs_*',
      migratedAt: Date.now(),
    };
  }

  // Mark migration complete
  migrations.mp_migrated = true;
  migrations.mp_migration_date = Date.now();

  if (hasLegacyData) {
    console.log('[McGraw Plus] Migrating legacy data');
    await chrome.storage.local.set(migrations);
  } else {
    // No legacy data, just mark as migrated
    await chrome.storage.local.set({ mp_migrated: true });
  }
}
