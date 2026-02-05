/**
 * McGraw Plus - Dashboard Main Script
 * Handles tab navigation, data loading, and component initialization
 */

(function () {
  'use strict';

  // DOM Elements
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  // State
  let currentTab = 'overview';
  let isDevMode = false;
  let data = {
    stats: null,
    dueDates: [],
    courses: [],
    flashcards: [],
    responseMap: {},
    userProfile: null,
    userName: null,
  };

  // Components
  let calendarComponent = null;
  let todoComponent = null;
  let statsComponent = null;
  let flashcardsComponent = null;
  let exportComponent = null;

  /**
   * Initialize dashboard
   */
  async function init() {
    await checkDevMode();
    showVersion();
    await loadAllData();
    initComponents();
    setupEventListeners();
    setupDevTools();
    renderOverview();
    setupStorageListener();
  }

  /**
   * Check if dev mode is enabled
   */
  async function checkDevMode() {
    const result = await chrome.storage.local.get(['mp_dev_mode']);
    isDevMode = result.mp_dev_mode === true;

    if (isDevMode) {
      document.body.classList.add('dev-mode');
      const devBadge = $('dev-badge');
      if (devBadge) devBadge.classList.remove('hidden');
    }
  }

  /**
   * Show version in footer and sidebar
   */
  function showVersion() {
    const version = chrome.runtime.getManifest().version;
    const versionEl = $('version');
    const footerVersionEl = $('footer-version');
    if (versionEl) versionEl.textContent = version;
    if (footerVersionEl) footerVersionEl.textContent = version;
  }

  /**
   * Load all data from storage
   */
  async function loadAllData() {
    const result = await chrome.storage.local.get([
      'mp_stats',
      'mp_due_dates',
      'mp_courses',
      'mp_flashcards',
      'mp_user_profile',
      'mp_terms_name',
      'responseMap',
    ]);

    data.stats = result.mp_stats || {
      totalQuestions: 0,
      correctFirstTry: 0,
      totalTimeMs: 0,
      streakDays: 0,
      dailyLog: {},
      byType: {
        multipleChoice: 0,
        fillInBlank: 0,
        dragAndDrop: 0,
      },
    };

    data.dueDates = result.mp_due_dates || [];
    data.courses = result.mp_courses || [];
    data.flashcards = result.mp_flashcards || [];
    data.userProfile = result.mp_user_profile || null;
    data.userName = result.mp_terms_name || null;
    data.responseMap = result.responseMap || {};

    // Show greeting - prefer terms name, fallback to user profile
    const displayName = data.userName || data.userProfile?.name;
    if (displayName) {
      const greeting = getGreeting();
      $('user-greeting').textContent = `${greeting}, ${displayName}`;
    }
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
   * Initialize all components
   */
  function initComponents() {
    calendarComponent = new CalendarComponent({
      container: $('calendar-grid'),
      detailsContainer: $('details-list'),
      detailsDate: $('details-date'),
      monthYear: $('cal-month-year'),
      prevBtn: $('cal-prev'),
      nextBtn: $('cal-next'),
      todayBtn: $('cal-today'),
      assignments: data.dueDates,
    });

    todoComponent = new TodoComponent({
      container: $('todo-list'),
      assignments: data.dueDates,
      onToggle: handleAssignmentToggle,
    });

    statsComponent = new StatsComponent({
      heatmapGrid: $('heatmap-grid'),
      heatmapMonths: $('heatmap-months'),
      pieChart: $('pie-chart'),
      chartLegend: $('chart-legend'),
      streakNumber: $('stats-streak'),
      bestStreak: $('best-streak'),
      totalTime: $('total-time'),
      avgSession: $('avg-session'),
      accuracyRing: $('accuracy-ring'),
      statsAccuracy: $('stats-accuracy'),
      correctCount: $('correct-count'),
      totalCount: $('total-count'),
      stats: data.stats,
    });

    flashcardsComponent = new FlashcardsComponent({
      grid: $('flashcard-grid'),
      countEl: $('flashcard-count'),
      generateBtn: $('generate-flashcards'),
      startReviewBtn: $('start-review'),
      reviewMode: $('review-mode'),
      currentCard: $('current-card'),
      cardFrontText: $('card-front-text'),
      cardBackText: $('card-back-text'),
      reviewProgress: $('review-progress'),
      prevCardBtn: $('prev-card'),
      flipCardBtn: $('flip-card'),
      nextCardBtn: $('next-card'),
      exitReviewBtn: $('exit-review'),
      flashcards: data.flashcards,
      responseMap: data.responseMap,
      onSave: handleFlashcardsSave,
    });

    exportComponent = new ExportComponent({
      icsBtn: $('export-ics'),
      ankiBtn: $('export-anki'),
      quizletBtn: $('export-quizlet'),
      notionBtn: $('export-notion'),
      notionSettingsBtn: $('notion-settings-btn'),
      jsonBtn: $('export-json'),
      csvBtn: $('export-csv'),
      notionModal: $('notion-modal'),
      closeNotionModalBtn: $('close-notion-modal'),
      notionApiKey: $('notion-api-key'),
      notionDatabaseId: $('notion-database-id'),
      saveNotionSettingsBtn: $('save-notion-settings'),
      assignments: data.dueDates,
      flashcards: data.flashcards,
      stats: data.stats,
      responseMap: data.responseMap,
      onToast: showToast,
    });
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Tab navigation
    $$('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });

    // View all link (from overview to todo)
    $$('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.goto;
        switchTab(tab);
      });
    });

    // Filter buttons (todo)
    $$('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        if (todoComponent) todoComponent.setFilter(filter);
      });
    });

    // Sort select (todo)
    $('todo-sort').addEventListener('change', (e) => {
      if (todoComponent) todoComponent.setSort(e.target.value);
    });

    // View toggle (flashcards)
    $$('.view-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.view-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.view;
        if (flashcardsComponent) flashcardsComponent.setView(view);
      });
    });
  }

  /**
   * Switch tab
   */
  function switchTab(tab) {
    currentTab = tab;

    // Update nav
    $$('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update panels
    $$('.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `tab-${tab}`);
    });

    // Update title
    const titles = {
      overview: 'Overview',
      calendar: 'Calendar',
      todo: 'To-Do List',
      stats: 'Statistics',
      flashcards: 'Flashcards',
      export: 'Export',
      settings: 'Settings',
      dev: 'Developer Tools',
    };
    $('page-title').textContent = titles[tab] || 'Dashboard';

    // Render components if needed
    if (tab === 'calendar' && calendarComponent) {
      calendarComponent.render();
    } else if (tab === 'todo' && todoComponent) {
      todoComponent.render();
    } else if (tab === 'stats' && statsComponent) {
      statsComponent.render();
    } else if (tab === 'flashcards' && flashcardsComponent) {
      flashcardsComponent.render();
    } else if (tab === 'settings') {
      loadSettingsTab();
    } else if (tab === 'dev' && isDevMode) {
      refreshStorageInspector();
    }
  }

  /**
   * Render overview tab
   */
  function renderOverview() {
    // Quick stats
    const stats = data.stats;
    $('overview-questions').textContent = stats.totalQuestions || 0;

    const accuracy = stats.totalQuestions > 0
      ? Math.round((stats.correctFirstTry / stats.totalQuestions) * 100)
      : 0;
    $('overview-accuracy').textContent = `${accuracy}%`;

    $('overview-time').textContent = formatDuration(stats.totalTimeMs || 0);
    $('overview-streak').textContent = stats.streakDays || 0;

    // Overdue warning
    const now = Date.now();
    const overdue = data.dueDates.filter(
      (a) => !a.completed && new Date(a.dueDate).getTime() < now
    );
    const warningBanner = $('overdue-warning');
    if (overdue.length > 0) {
      warningBanner.classList.remove('hidden');
      $('overdue-text').textContent = `You have ${overdue.length} overdue assignment${overdue.length > 1 ? 's' : ''}!`;
    } else {
      warningBanner.classList.add('hidden');
    }

    // Upcoming assignments
    renderUpcomingAssignments();

    // Recent activity
    renderRecentActivity();
  }

  /**
   * Render upcoming assignments
   */
  function renderUpcomingAssignments() {
    const container = $('upcoming-list');
    const now = Date.now();

    const upcoming = data.dueDates
      .filter((a) => !a.completed && new Date(a.dueDate).getTime() >= now)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5);

    if (upcoming.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No upcoming assignments</p></div>';
      return;
    }

    container.innerHTML = upcoming
      .map((a) => {
        const dueTime = new Date(a.dueDate).getTime();
        const timeUntil = dueTime - now;
        const isSoon = timeUntil < 86400000; // 24 hours

        return `
          <div class="assignment-item">
            <div class="assignment-info">
              <div class="assignment-name">${escapeHtml(a.name || 'Untitled')}</div>
              <div class="assignment-meta">
                ${a.courseName ? `<span class="assignment-course">${escapeHtml(a.courseName)}</span>` : ''}
                <span class="assignment-due ${isSoon ? 'soon' : ''}">${formatDueDate(a.dueDate)}</span>
              </div>
            </div>
            ${a.link ? `
              <a href="${escapeHtml(a.link)}" target="_blank" class="assignment-link" title="Open in Connect">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ` : ''}
          </div>
        `;
      })
      .join('');
  }

  /**
   * Render recent activity
   */
  function renderRecentActivity() {
    const container = $('recent-activity');
    const dailyLog = data.stats.dailyLog || {};
    const dates = Object.keys(dailyLog).sort().reverse().slice(0, 5);

    if (dates.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No recent activity</p></div>';
      return;
    }

    container.innerHTML = dates
      .map((date) => {
        const entry = dailyLog[date];
        const questions = entry.questions || entry;
        const d = new Date(date);
        const isToday = date === new Date().toISOString().split('T')[0];
        const isYesterday = date === new Date(Date.now() - 86400000).toISOString().split('T')[0];

        let dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (isToday) dateLabel = 'Today';
        else if (isYesterday) dateLabel = 'Yesterday';

        return `
          <div class="activity-item">
            <div class="activity-dot"></div>
            <span class="activity-text">Answered ${questions} question${questions !== 1 ? 's' : ''}</span>
            <span class="activity-time">${dateLabel}</span>
          </div>
        `;
      })
      .join('');
  }

  /**
   * Handle assignment toggle (completion)
   */
  async function handleAssignmentToggle(assignmentId, completed) {
    const index = data.dueDates.findIndex((a) => a.id === assignmentId);
    if (index === -1) return;

    data.dueDates[index].completed = completed;
    await chrome.storage.local.set({ mp_due_dates: data.dueDates });

    // Update overview if visible
    if (currentTab === 'overview') {
      renderOverview();
    }

    // Update calendar
    if (calendarComponent) {
      calendarComponent.setAssignments(data.dueDates);
    }

    showToast(completed ? 'Marked as complete' : 'Marked as incomplete');
  }

  /**
   * Handle flashcards save
   */
  async function handleFlashcardsSave(flashcards) {
    data.flashcards = flashcards;
    await chrome.storage.local.set({ mp_flashcards: flashcards });
    showToast('Flashcards saved');
  }

  /**
   * Setup storage change listener
   */
  function setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      let needsRefresh = false;

      if (changes.mp_stats) {
        data.stats = changes.mp_stats.newValue;
        needsRefresh = true;
        if (statsComponent) statsComponent.setStats(data.stats);
      }

      if (changes.mp_due_dates) {
        data.dueDates = changes.mp_due_dates.newValue || [];
        needsRefresh = true;
        if (calendarComponent) calendarComponent.setAssignments(data.dueDates);
        if (todoComponent) todoComponent.setAssignments(data.dueDates);
        if (exportComponent) exportComponent.setAssignments(data.dueDates);
      }

      if (changes.mp_flashcards) {
        data.flashcards = changes.mp_flashcards.newValue || [];
        if (flashcardsComponent) flashcardsComponent.setFlashcards(data.flashcards);
        if (exportComponent) exportComponent.setFlashcards(data.flashcards);
      }

      if (changes.responseMap) {
        data.responseMap = changes.responseMap.newValue || {};
        if (flashcardsComponent) flashcardsComponent.setResponseMap(data.responseMap);
        if (exportComponent) exportComponent.setResponseMap(data.responseMap);
      }

      if (changes.mp_terms_name) {
        data.userName = changes.mp_terms_name.newValue || null;
        const displayName = data.userName || data.userProfile?.name;
        if (displayName) {
          const greeting = getGreeting();
          $('user-greeting').textContent = `${greeting}, ${displayName}`;
        }
      }

      if (changes.mp_dev_mode) {
        isDevMode = changes.mp_dev_mode.newValue === true;
        if (isDevMode) {
          document.body.classList.add('dev-mode');
          const devBadge = $('dev-badge');
          if (devBadge) devBadge.classList.remove('hidden');
        } else {
          document.body.classList.remove('dev-mode');
          const devBadge = $('dev-badge');
          if (devBadge) devBadge.classList.add('hidden');
          // Switch away from dev tab if currently on it
          if (currentTab === 'dev') {
            switchTab('overview');
          }
        }
      }

      if (needsRefresh && currentTab === 'overview') {
        renderOverview();
      }
    });
  }

  /**
   * Show toast message
   */
  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  /**
   * Format duration in milliseconds
   */
  function formatDuration(ms) {
    if (!ms || ms < 0) return '0h';
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  }

  /**
   * Format due date for display
   */
  function formatDueDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = d - now;

    // Past due
    if (diff < 0) {
      return 'Past due';
    }

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h`;
    }

    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d`;
    }

    // Otherwise show date
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /**
   * Escape HTML for safe display
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Setup dev tools event listeners
   */
  function setupDevTools() {
    if (!isDevMode) return;

    // Refresh storage button
    const refreshBtn = $('refresh-storage');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', refreshStorageInspector);
    }

    // Clear star verification
    const clearStarBtn = $('clear-star-verification');
    if (clearStarBtn) {
      clearStarBtn.addEventListener('click', async () => {
        await chrome.storage.local.remove(['mp_star_verified', 'mp_star_username']);
        showToast('Star verification cleared');
        refreshStorageInspector();
      });
    }

    // Clear terms
    const clearTermsBtn = $('clear-terms');
    if (clearTermsBtn) {
      clearTermsBtn.addEventListener('click', async () => {
        await chrome.storage.local.remove(['mp_terms_accepted', 'mp_terms_name']);
        showToast('Terms acceptance cleared');
        refreshStorageInspector();
      });
    }

    // Toggle extension
    const toggleExtBtn = $('toggle-extension');
    if (toggleExtBtn) {
      toggleExtBtn.addEventListener('click', async () => {
        const result = await chrome.storage.local.get(['mp_extension_enabled']);
        const newState = !result.mp_extension_enabled;
        await chrome.storage.local.set({ mp_extension_enabled: newState });
        showToast(`Extension ${newState ? 'enabled' : 'disabled'}`);
        refreshStorageInspector();
      });
    }

    // Export all data
    const exportAllBtn = $('export-all-data');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', async () => {
        const allData = await chrome.storage.local.get(null);
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mcgraw-plus-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported');
      });
    }

    // Add test assignments
    const testAssignmentsBtn = $('add-test-assignments');
    if (testAssignmentsBtn) {
      testAssignmentsBtn.addEventListener('click', async () => {
        const testAssignments = generateTestAssignments();
        const existing = data.dueDates || [];
        await chrome.storage.local.set({ mp_due_dates: [...existing, ...testAssignments] });
        showToast('Test assignments added');
        refreshStorageInspector();
      });
    }

    // Add test stats
    const testStatsBtn = $('add-test-stats');
    if (testStatsBtn) {
      testStatsBtn.addEventListener('click', async () => {
        const testStats = generateTestStats();
        await chrome.storage.local.set({ mp_stats: testStats });
        showToast('Test stats added');
        refreshStorageInspector();
      });
    }

    // Add test flashcards
    const testFlashcardsBtn = $('add-test-flashcards');
    if (testFlashcardsBtn) {
      testFlashcardsBtn.addEventListener('click', async () => {
        const testFlashcards = generateTestFlashcards();
        const existing = data.flashcards || [];
        await chrome.storage.local.set({ mp_flashcards: [...existing, ...testFlashcards] });
        showToast('Test flashcards added');
        refreshStorageInspector();
      });
    }
  }

  /**
   * Refresh storage inspector display
   */
  async function refreshStorageInspector() {
    const storageDump = $('storage-dump');
    if (!storageDump) return;

    try {
      const allData = await chrome.storage.local.get(null);
      // Truncate large values for readability
      const displayData = {};
      for (const [key, value] of Object.entries(allData)) {
        if (typeof value === 'object' && value !== null) {
          const str = JSON.stringify(value);
          if (str.length > 500) {
            displayData[key] = `[Object - ${str.length} chars]`;
          } else {
            displayData[key] = value;
          }
        } else {
          displayData[key] = value;
        }
      }
      storageDump.textContent = JSON.stringify(displayData, null, 2);
    } catch (err) {
      storageDump.textContent = `Error: ${err.message}`;
    }
  }

  /**
   * Generate test assignments
   */
  function generateTestAssignments() {
    const now = Date.now();
    const day = 86400000;
    const courses = ['BIO 101', 'CHEM 201', 'MATH 150', 'PHYS 110'];
    const types = ['smartbook', 'quiz', 'homework', 'exam'];

    return [
      {
        id: `test-${now}-1`,
        name: 'Chapter 5 SmartBook',
        courseName: courses[Math.floor(Math.random() * courses.length)],
        type: types[0],
        dueDate: new Date(now - day).toISOString(), // Overdue
        completed: false,
        progress: 45,
      },
      {
        id: `test-${now}-2`,
        name: 'Midterm Review Quiz',
        courseName: courses[Math.floor(Math.random() * courses.length)],
        type: types[1],
        dueDate: new Date(now + day * 0.5).toISOString(), // Due soon
        completed: false,
        progress: 0,
      },
      {
        id: `test-${now}-3`,
        name: 'Chapter 6 Homework',
        courseName: courses[Math.floor(Math.random() * courses.length)],
        type: types[2],
        dueDate: new Date(now + day * 3).toISOString(), // Upcoming
        completed: false,
        progress: 20,
      },
      {
        id: `test-${now}-4`,
        name: 'Unit 2 Practice Exam',
        courseName: courses[Math.floor(Math.random() * courses.length)],
        type: types[3],
        dueDate: new Date(now + day * 7).toISOString(), // Future
        completed: false,
        progress: 0,
      },
      {
        id: `test-${now}-5`,
        name: 'Chapter 4 Review',
        courseName: courses[Math.floor(Math.random() * courses.length)],
        type: types[0],
        dueDate: new Date(now - day * 2).toISOString(),
        completed: true,
        progress: 100,
      },
    ];
  }

  /**
   * Generate test stats
   */
  function generateTestStats() {
    const dailyLog = {};
    const now = new Date();

    // Generate activity for last 60 days
    for (let i = 0; i < 60; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Random activity (some days active, some not)
      if (Math.random() > 0.4) {
        dailyLog[dateStr] = {
          questions: Math.floor(Math.random() * 30) + 5,
          timeMs: Math.floor(Math.random() * 3600000) + 600000,
        };
      }
    }

    return {
      totalQuestions: 247,
      correctFirstTry: 189,
      totalTimeMs: 18720000, // About 5.2 hours
      streakDays: 7,
      bestStreak: 14,
      dailyLog: dailyLog,
      byType: {
        multipleChoice: 156,
        fillInBlank: 62,
        dragAndDrop: 29,
      },
    };
  }

  /**
   * Generate test flashcards
   */
  function generateTestFlashcards() {
    const now = Date.now();
    return [
      {
        id: `fc-${now}-1`,
        front: 'What is the powerhouse of the cell?',
        back: 'Mitochondria',
        tags: ['biology', 'cell-biology'],
      },
      {
        id: `fc-${now}-2`,
        front: 'What is the chemical formula for water?',
        back: 'H2O (two hydrogen atoms and one oxygen atom)',
        tags: ['chemistry', 'basics'],
      },
      {
        id: `fc-${now}-3`,
        front: 'What is the derivative of x²?',
        back: '2x (using the power rule)',
        tags: ['math', 'calculus'],
      },
      {
        id: `fc-${now}-4`,
        front: 'What is Newton\'s Second Law?',
        back: 'F = ma (Force equals mass times acceleration)',
        tags: ['physics', 'mechanics'],
      },
      {
        id: `fc-${now}-5`,
        front: 'What is the process by which plants convert sunlight to energy?',
        back: 'Photosynthesis',
        tags: ['biology', 'plants'],
      },
    ];
  }

  /**
   * Load settings tab
   */
  async function loadSettingsTab() {
    // Load developer mode state
    const result = await chrome.storage.local.get([
      'mp_developer_mode_enabled',
      'mp_quiz_solver_provider',
      'mp_quiz_solver_api_key',
      'mp_quiz_solver_model',
    ]);

    const devModeToggle = $('developer-mode-toggle');
    const quizSolverSettings = $('quiz-solver-settings');

    if (devModeToggle) {
      devModeToggle.checked = result.mp_developer_mode_enabled === true;
    }

    // Show/hide quiz solver settings based on dev mode
    if (quizSolverSettings) {
      quizSolverSettings.classList.toggle('hidden', !result.mp_developer_mode_enabled);
    }

    // Load quiz solver settings
    const providerSelect = $('quiz-solver-provider');
    const apiKeyInput = $('quiz-solver-api-key');
    const modelSelect = $('quiz-solver-model');

    if (providerSelect && result.mp_quiz_solver_provider) {
      providerSelect.value = result.mp_quiz_solver_provider;
    }
    if (apiKeyInput && result.mp_quiz_solver_api_key) {
      apiKeyInput.value = result.mp_quiz_solver_api_key;
    }
    if (modelSelect && result.mp_quiz_solver_model) {
      modelSelect.value = result.mp_quiz_solver_model;
    }

    // Show version
    const settingsVersion = $('settings-version');
    if (settingsVersion) {
      settingsVersion.textContent = chrome.runtime.getManifest().version;
    }

    // Setup settings event listeners if not already done
    setupSettingsListeners();
  }

  /**
   * Setup settings event listeners
   */
  let settingsListenersSetup = false;
  function setupSettingsListeners() {
    if (settingsListenersSetup) return;
    settingsListenersSetup = true;

    // Developer mode toggle
    const devModeToggle = $('developer-mode-toggle');
    if (devModeToggle) {
      devModeToggle.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        await chrome.storage.local.set({ mp_developer_mode_enabled: enabled });

        // Show/hide quiz solver settings
        const quizSolverSettings = $('quiz-solver-settings');
        if (quizSolverSettings) {
          quizSolverSettings.classList.toggle('hidden', !enabled);
        }

        showToast(enabled ? 'Developer mode enabled' : 'Developer mode disabled');
      });
    }

    // Save quiz solver settings
    const saveQuizSolverBtn = $('save-quiz-solver-btn');
    if (saveQuizSolverBtn) {
      saveQuizSolverBtn.addEventListener('click', async () => {
        const provider = $('quiz-solver-provider')?.value || 'groq';
        const apiKey = $('quiz-solver-api-key')?.value || '';
        const model = $('quiz-solver-model')?.value || 'auto';

        await chrome.storage.local.set({
          mp_quiz_solver_provider: provider,
          mp_quiz_solver_api_key: apiKey,
          mp_quiz_solver_model: model,
        });

        showToast('Quiz solver settings saved');
      });
    }

    // Test quiz solver connection
    const testQuizSolverBtn = $('test-quiz-solver-btn');
    if (testQuizSolverBtn) {
      testQuizSolverBtn.addEventListener('click', async () => {
        const statusEl = $('quiz-solver-status');
        const apiKey = $('quiz-solver-api-key')?.value || '';
        const provider = $('quiz-solver-provider')?.value || 'groq';

        if (!apiKey) {
          if (statusEl) {
            statusEl.classList.remove('hidden', 'success');
            statusEl.classList.add('error');
            statusEl.querySelector('.status-text').textContent = 'Please enter an API key first';
          }
          return;
        }

        // Show testing status
        if (statusEl) {
          statusEl.classList.remove('hidden', 'success', 'error');
          statusEl.querySelector('.status-text').textContent = 'Testing connection...';
        }

        try {
          // Simple API test based on provider
          let testUrl, testHeaders, testBody;

          if (provider === 'groq') {
            testUrl = 'https://api.groq.com/openai/v1/models';
            testHeaders = { 'Authorization': `Bearer ${apiKey}` };
          } else if (provider === 'openai') {
            testUrl = 'https://api.openai.com/v1/models';
            testHeaders = { 'Authorization': `Bearer ${apiKey}` };
          } else if (provider === 'anthropic') {
            testUrl = 'https://api.anthropic.com/v1/messages';
            testHeaders = {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            };
            testBody = JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'test' }],
            });
          }

          const response = await fetch(testUrl, {
            method: testBody ? 'POST' : 'GET',
            headers: testHeaders,
            body: testBody,
          });

          if (statusEl) {
            if (response.ok || response.status === 401) {
              // 401 means API is reachable but key might be invalid - still show error
              if (response.status === 401) {
                statusEl.classList.remove('success');
                statusEl.classList.add('error');
                statusEl.querySelector('.status-text').textContent = 'Invalid API key';
              } else {
                statusEl.classList.remove('error');
                statusEl.classList.add('success');
                statusEl.querySelector('.status-text').textContent = 'Connection successful!';
              }
            } else {
              statusEl.classList.remove('success');
              statusEl.classList.add('error');
              statusEl.querySelector('.status-text').textContent = `Connection failed: ${response.status}`;
            }
          }
        } catch (err) {
          if (statusEl) {
            statusEl.classList.remove('success');
            statusEl.classList.add('error');
            statusEl.querySelector('.status-text').textContent = `Error: ${err.message}`;
          }
        }
      });
    }

    // Clear stats
    const clearStatsBtn = $('clear-stats-btn');
    if (clearStatsBtn) {
      clearStatsBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all statistics? This cannot be undone.')) {
          await chrome.storage.local.remove(['mp_stats']);
          showToast('Statistics cleared');
        }
      });
    }

    // Clear flashcards
    const clearFlashcardsBtn = $('clear-flashcards-btn');
    if (clearFlashcardsBtn) {
      clearFlashcardsBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all flashcards? This cannot be undone.')) {
          await chrome.storage.local.remove(['mp_flashcards']);
          showToast('Flashcards cleared');
        }
      });
    }

    // Clear response cache
    const clearCacheBtn = $('clear-response-cache-btn');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear the response cache? This may affect solver accuracy until rebuilt.')) {
          await chrome.storage.local.remove(['responseMap']);
          showToast('Response cache cleared');
        }
      });
    }

    // Reset all data
    const resetAllBtn = $('reset-all-btn');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', async () => {
        if (confirm('Are you absolutely sure? This will delete ALL data and reset the extension to default settings. This action cannot be undone.')) {
          if (confirm('This is your final warning. ALL DATA WILL BE LOST. Continue?')) {
            await chrome.storage.local.clear();
            showToast('All data has been reset');
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }
      });
    }
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
