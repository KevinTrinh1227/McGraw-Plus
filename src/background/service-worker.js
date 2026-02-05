/**
 * McGraw Plus - Service Worker
 * Handles background tasks, alarms, notifications, and update checks
 */

// Storage keys
const STORAGE_KEYS = {
  SETTINGS: 'mp_settings',
  STATS: 'mp_stats',
  DUE_DATES: 'mp_due_dates',
  FIRST_INSTALL: 'mp_first_install',
  ONBOARDING_COMPLETE: 'mp_onboarding_complete',
  SOLVER_ENABLED: 'isBotEnabled', // Legacy key for compatibility
  DASHBOARD_TAB_ID: 'mp_dashboard_tab_id',
  USER_PROFILE: 'mp_user_profile',
  COURSES: 'mp_courses',
  SECTIONS: 'mp_sections',
  INSTRUCTORS: 'mp_instructors',
  BOOKS: 'mp_books',
  ONBOARDING_TAB_ID: 'mp_onboarding_tab_id',
  ONBOARDING_LOCK: 'mp_onboarding_lock',
};

// Message types
const MSG = {
  SOLVER_ACTIVATE: 'SOLVER_ACTIVATE',
  SOLVER_DEACTIVATE: 'SOLVER_DEACTIVATE',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  SHOW_NOTIFICATION: 'SHOW_NOTIFICATION',
  DATA_AVAILABLE: 'DATA_AVAILABLE',
  PING: 'PING',
};

// McGraw-Hill domains
const MCGRAW_HILL_DOMAINS = [
  'learning.mheducation.com',
  'connect.mheducation.com',
  'newconnect.mheducation.com',
  'connect.edu.mheducation.com',
  'connect.router.integration.prod.mheducation.com',
];

/**
 * Check if URL is a McGraw-Hill domain
 */
function isMcGrawHillUrl(url) {
  if (!url) return false;
  return MCGRAW_HILL_DOMAINS.some(domain => url.includes(domain));
}

/**
 * Open or focus the dashboard tab
 * Reuses existing tab if available, otherwise opens new one
 */
async function openOrFocusDashboard() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.DASHBOARD_TAB_ID);
    const existingTabId = result[STORAGE_KEYS.DASHBOARD_TAB_ID];

    // Try to focus existing tab
    if (existingTabId) {
      try {
        const tab = await chrome.tabs.get(existingTabId);
        if (tab && tab.url && tab.url.includes('dashboard.html')) {
          await chrome.tabs.update(existingTabId, { active: true });
          await chrome.windows.update(tab.windowId, { focused: true });
          return;
        }
      } catch (err) {
        // Tab doesn't exist anymore
      }
    }

    // Create new dashboard tab
    const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
    const newTab = await chrome.tabs.create({ url: dashboardUrl });

    // Store the tab ID
    await chrome.storage.local.set({ [STORAGE_KEYS.DASHBOARD_TAB_ID]: newTab.id });
  } catch (err) {
    console.warn('[McGraw Plus] Failed to open dashboard:', err.message);
  }
}

/**
 * Acquire onboarding lock to prevent duplicate tabs
 * Returns true if lock acquired, false if already locked
 */
async function acquireOnboardingLock() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ONBOARDING_LOCK);
  const lock = result[STORAGE_KEYS.ONBOARDING_LOCK];

  // Check if lock exists and is still valid (expires after 30 seconds)
  if (lock && lock.timestamp && (Date.now() - lock.timestamp < 30000)) {
    console.log('[McGraw Plus] Onboarding lock already held');
    return false;
  }

  // Acquire lock
  await chrome.storage.local.set({
    [STORAGE_KEYS.ONBOARDING_LOCK]: {
      timestamp: Date.now(),
      holder: 'service-worker',
    },
  });

  return true;
}

/**
 * Release onboarding lock
 */
async function releaseOnboardingLock() {
  await chrome.storage.local.remove(STORAGE_KEYS.ONBOARDING_LOCK);
}

/**
 * Open onboarding page when user profile AND actual data is captured
 * Only opens if:
 * - Onboarding not yet complete
 * - We have complete profile data (name + email/userId)
 * - We have at least SOME course or assignment data
 * Uses lock mechanism to prevent duplicate tabs
 */
async function openOnboardingWithProfile() {
  try {
    // Check if we can acquire lock
    const lockAcquired = await acquireOnboardingLock();
    if (!lockAcquired) {
      console.log('[McGraw Plus] Could not acquire onboarding lock, skipping');
      return false;
    }

    const result = await chrome.storage.local.get([
      STORAGE_KEYS.ONBOARDING_COMPLETE,
      STORAGE_KEYS.USER_PROFILE,
      STORAGE_KEYS.ONBOARDING_TAB_ID,
      STORAGE_KEYS.COURSES,
      STORAGE_KEYS.SECTIONS,
      STORAGE_KEYS.DUE_DATES,
    ]);

    // Don't open if onboarding already complete
    if (result[STORAGE_KEYS.ONBOARDING_COMPLETE]) {
      await releaseOnboardingLock();
      return false;
    }

    // Check for COMPLETE profile data (name + email or userId)
    const profile = result[STORAGE_KEYS.USER_PROFILE];
    if (!profile) {
      await releaseOnboardingLock();
      return false;
    }

    // Must have a valid name (not empty, not "User")
    const hasValidName = profile.name && profile.name !== 'User' && profile.name.trim().length > 0;
    // Must have either email or userId
    const hasIdentifier = (profile.email && profile.email.includes('@')) ||
                          (profile.userId && String(profile.userId).length > 0);

    if (!hasValidName || !hasIdentifier) {
      console.log('[McGraw Plus] Waiting for complete profile data. Have:', {
        name: !!hasValidName,
        identifier: !!hasIdentifier,
      });
      await releaseOnboardingLock();
      return false;
    }

    // IMPORTANT: Must have at least SOME actual data (courses OR sections OR assignments)
    // Don't open onboarding if we only have a profile but no courses/sections/assignments
    const courses = result[STORAGE_KEYS.COURSES] || [];
    const sections = result[STORAGE_KEYS.SECTIONS] || [];
    const assignments = result[STORAGE_KEYS.DUE_DATES] || [];
    const hasActualData = courses.length > 0 || sections.length > 0 || assignments.length > 0;

    if (!hasActualData) {
      console.log('[McGraw Plus] Waiting for course/section/assignment data. Have:', {
        courses: courses.length,
        sections: sections.length,
        assignments: assignments.length,
      });
      await releaseOnboardingLock();
      return false;
    }

    // Check if onboarding tab already exists
    const existingTabId = result[STORAGE_KEYS.ONBOARDING_TAB_ID];
    if (existingTabId) {
      try {
        const tab = await chrome.tabs.get(existingTabId);
        if (tab && tab.url && tab.url.includes('onboarding.html')) {
          // Tab exists, just focus it
          await chrome.tabs.update(existingTabId, { active: true });
          await chrome.windows.update(tab.windowId, { focused: true });
          // Reload to show new data
          await chrome.tabs.reload(existingTabId);
          console.log('[McGraw Plus] Focused existing onboarding tab');
          await releaseOnboardingLock();
          return true;
        }
      } catch (err) {
        // Tab doesn't exist anymore, clear the stored ID
        await chrome.storage.local.remove(STORAGE_KEYS.ONBOARDING_TAB_ID);
      }
    }

    // Create new onboarding tab
    const onboardingUrl = chrome.runtime.getURL('onboarding/onboarding.html');
    const newTab = await chrome.tabs.create({ url: onboardingUrl });

    // Store the tab ID
    await chrome.storage.local.set({ [STORAGE_KEYS.ONBOARDING_TAB_ID]: newTab.id });

    console.log('[McGraw Plus] Opened onboarding for:', profile.name);
    await releaseOnboardingLock();
    return true;
  } catch (err) {
    console.warn('[McGraw Plus] Failed to open onboarding:', err.message);
    await releaseOnboardingLock();
    return false;
  }
}

/**
 * Scan all open tabs for McGraw-Hill pages
 * Injects content script if needed to capture user data
 */
async function scanAllTabsForMcGrawHill() {
  try {
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      if (!tab.url) continue;

      if (isMcGrawHillUrl(tab.url)) {
        console.log('[McGraw Plus] Found McGraw-Hill tab:', tab.id, tab.url);

        // Try to inject/reinject content scripts to capture data
        try {
          // Note: api-interceptor.js runs in MAIN world, so we inject the bridge
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/api-bridge.js'],
          });
        } catch (err) {
          // Script may already be injected or page doesn't allow
        }
      }
    }
  } catch (err) {
    console.warn('[McGraw Plus] Failed to scan tabs:', err.message);
  }
}

/**
 * Track tab lifecycle for dashboard and onboarding
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.DASHBOARD_TAB_ID,
    STORAGE_KEYS.ONBOARDING_TAB_ID,
  ]);

  if (result[STORAGE_KEYS.DASHBOARD_TAB_ID] === tabId) {
    await chrome.storage.local.remove(STORAGE_KEYS.DASHBOARD_TAB_ID);
  }

  if (result[STORAGE_KEYS.ONBOARDING_TAB_ID] === tabId) {
    await chrome.storage.local.remove(STORAGE_KEYS.ONBOARDING_TAB_ID);
  }
});

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

  // Clean up stale locks
  await chrome.storage.local.remove(STORAGE_KEYS.ONBOARDING_LOCK);

  console.log('[McGraw Plus] Daily cleanup complete');
}

/**
 * Handle tab updates - reactivate solver if enabled
 * Also detect Connect page for auto-opening onboarding when profile is captured
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;

  if (isMcGrawHillUrl(tab.url) && changeInfo.status === 'complete') {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.ONBOARDING_COMPLETE,
      STORAGE_KEYS.SOLVER_ENABLED,
    ]);

    // If onboarding not complete, the API interceptor will capture profile
    // and send DATA_AVAILABLE message which triggers openOnboardingWithProfile

    // Check if solver should be activated
    if (result[STORAGE_KEYS.SOLVER_ENABLED] === true) {
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
 * Handle tab activation - check if switching to a McGraw-Hill tab
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!tab.url) return;

    if (isMcGrawHillUrl(tab.url)) {
      const result = await chrome.storage.local.get(STORAGE_KEYS.ONBOARDING_COMPLETE);

      if (!result[STORAGE_KEYS.ONBOARDING_COMPLETE]) {
        // User switched to McGraw-Hill tab and onboarding not complete
        // Try to inject content script to capture data
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/api-bridge.js'],
          });
        } catch (err) {
          // May already be injected
        }
      }
    }
  } catch (err) {
    // Tab may not exist
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

    case MSG.DATA_AVAILABLE:
      // User profile captured - check if should auto-open onboarding
      (async () => {
        const result = await chrome.storage.local.get(STORAGE_KEYS.ONBOARDING_COMPLETE);
        if (!result[STORAGE_KEYS.ONBOARDING_COMPLETE]) {
          // Onboarding not complete, open onboarding with captured profile
          openOnboardingWithProfile();
        }
        // If onboarding already complete, do nothing - don't auto-open dashboard
      })();
      sendResponse({ success: true });
      break;

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
    // First install - mark the install time (NO auto-open onboarding)
    await chrome.storage.local.set({ [STORAGE_KEYS.FIRST_INSTALL]: Date.now() });

    // Run migration from old extension if data exists
    await migrateFromLegacy();
  } else if (details.reason === 'update') {
    // Check if we need to migrate
    await migrateFromLegacy();

    // Clear any stale locks on update
    await chrome.storage.local.remove(STORAGE_KEYS.ONBOARDING_LOCK);
  }

  // Setup context menu
  setupContextMenu();

  // Setup alarms
  setupAlarms();

  // Scan all tabs for McGraw-Hill pages to capture user data
  setTimeout(scanAllTabsForMcGrawHill, 1000);
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

  // Clear any stale locks
  chrome.storage.local.remove(STORAGE_KEYS.ONBOARDING_LOCK);

  // Scan all tabs for McGraw-Hill pages
  setTimeout(scanAllTabsForMcGrawHill, 1000);
});

/**
 * Setup periodic alarms
 */
function setupAlarms() {
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
