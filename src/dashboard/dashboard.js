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
  let data = {
    stats: null,
    dueDates: [],
    courses: [],
    flashcards: [],
    responseMap: {},
    userProfile: null,
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
    showVersion();
    await loadAllData();
    initComponents();
    setupEventListeners();
    renderOverview();
    setupStorageListener();
  }

  /**
   * Show version in footer
   */
  function showVersion() {
    const version = chrome.runtime.getManifest().version;
    const versionEl = $('version');
    if (versionEl) versionEl.textContent = version;
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
    data.responseMap = result.responseMap || {};

    // Show greeting if user profile exists
    if (data.userProfile?.name) {
      const greeting = getGreeting();
      $('user-greeting').textContent = `${greeting}, ${data.userProfile.name}`;
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

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
