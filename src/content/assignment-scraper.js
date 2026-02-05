/**
 * McGraw Plus - Assignment Scraper
 * Automatically scrapes courses and assignments from McGraw-Hill Connect
 * Similar to how Better Canvas works - fast, automatic, and persistent
 */

(function () {
  'use strict';

  // Prevent double initialization
  if (window.MP_AssignmentScraper) return;

  const AssignmentScraper = {
    // State
    isInitialized: false,
    isScanning: false,
    lastScanTime: 0,
    observer: null,
    courses: [],
    assignments: [],
    tabCoordinatorId: null,
    retryCount: 0,

    // Config
    SCAN_DEBOUNCE_MS: 1000,
    MIN_SCAN_INTERVAL_MS: 5000,
    MAX_RETRY_COUNT: 3,
    RETRY_DELAY_MS: 2000,
    STORAGE_KEY: 'mp_due_dates',
    COURSES_KEY: 'mp_courses',
    USER_PROFILE_KEY: 'mp_user_profile',
    TAB_COORDINATOR_KEY: 'mp_active_scraper_tab',

    // Selectors for McGraw-Hill Connect (including newconnect)
    SELECTORS: {
      // User profile selectors (expanded for newconnect sidebar)
      userProfile: [
        '.cui-user-menu .user-name',
        '.profile-name',
        '[class*="user-name"]',
        '.mhe-account-name',
        '.student-name',
        '[data-testid="user-name"]',
        '[data-testid="user-profile-name"]',
        '.account-name',
        '.user-display-name',
        '.header-user-name',
        // newconnect sidebar selectors
        '.nav-sidebar .user-name',
        '.sidebar-profile .name',
        '.sidebar-user-name',
        '.nav-user-name',
        '[class*="UserMenu"] [class*="name"]',
        '[class*="profile"] [class*="name"]',
        '.user-info .name',
        '.user-menu-name',
      ],

      // Dashboard course cards
      courseCard: '.course-card, .course-tile, [data-course-id], .cui-card',
      courseName: '.course-card-title, .course-title, .cui-card-title, h3, h4',
      courseLink: 'a[href*="section"], a[href*="course"]',

      // Assignment list selectors
      assignmentRow: '.assignment-row, .assignment-item, [data-assignment-id], tr[data-id], .activity-row',
      assignmentName: '.assignment-name, .activity-name, .assignment-title, td:first-child a, .name-column',
      assignmentDueDate: '.due-date, .due-column, td.due, [data-due], .date-column',
      assignmentStatus: '.status, .status-column, .completion-status, .grade-column',
      assignmentType: '.type, .type-column, .assignment-type',

      // Progress indicators
      progressBar: '.progress-bar, .completion-bar, [role="progressbar"]',
      progressText: '.progress-text, .completion-text',

      // Section/Chapter navigation
      chapterItem: '.chapter-item, .section-item, .toc-item, .module-item',
      chapterName: '.chapter-title, .section-title, .module-title',

      // Table-based layouts
      assignmentTable: 'table.assignments, table.activities, .assignment-list table',
      tableRow: 'tbody tr',

      // To-Do list page selectors
      todoItem: '.todo-item, .task-item, [class*="todo"], .upcoming-item, .due-soon-item',
      todoName: '.task-name, .todo-title, .item-title',
      todoDue: '.task-due-date, .todo-due, .item-due',

      // Results page selectors
      resultRow: '.result-row, .grade-row, [class*="result"], .submission-row',
      resultScore: '.assignment-score, .grade-value, .score-column',
      resultDate: '.submission-date, .completed-date',

      // Classes/Sections page selectors
      classCard: '.class-card, .section-card, .enrolled-section',
      className: '.class-name, .section-name, .course-section-name',
      instructorName: '.instructor-name, .teacher-name, .professor-name',

      // Calendar page selectors
      calendarEvent: '.calendar-event, [class*="event"], .fc-event',
      eventTitle: '.event-title, .event-name, .fc-title',
      eventDate: '.event-date, [data-date], .fc-day',
    },

    /**
     * Initialize the scraper
     */
    async init() {
      if (this.isInitialized) return;

      // Only run on Connect dashboard pages
      if (!this.isConnectPage()) {
        return;
      }

      // Generate unique tab ID
      this.tabCoordinatorId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Check if another tab is already scraping this domain
      const canScrape = await this.acquireScraperLock();
      if (!canScrape) {
        console.log('[McGraw Plus] Another tab is scraping, skipping initialization');
        // Still load cached data for display
        await this.loadCachedData();
        return;
      }

      this.isInitialized = true;
      console.log('[McGraw Plus] Assignment scraper initializing...', this.getPageType());

      // Load cached data first for instant display
      await this.loadCachedData();

      // Initial scan with retry logic
      await this.scanWithRetry();

      // Set up MutationObserver for dynamic content
      this.setupObserver();

      // Set up navigation listener for SPA navigation
      this.setupNavigationListener();

      // Set up visibility change listener
      this.setupVisibilityListener();

      // Release lock on page unload
      window.addEventListener('beforeunload', () => this.releaseScraperLock());

      console.log('[McGraw Plus] Assignment scraper ready');
    },

    /**
     * Acquire scraper lock for multi-tab coordination
     */
    async acquireScraperLock() {
      try {
        const domain = window.location.hostname;
        const lockKey = `${this.TAB_COORDINATOR_KEY}_${domain}`;

        const result = await chrome.storage.local.get(lockKey);
        const existingLock = result[lockKey];

        // Check if lock is stale (older than 30 seconds)
        if (existingLock && Date.now() - existingLock.timestamp < 30000) {
          // Another tab has the lock
          return false;
        }

        // Acquire lock
        await chrome.storage.local.set({
          [lockKey]: {
            tabId: this.tabCoordinatorId,
            timestamp: Date.now(),
          },
        });

        // Start heartbeat to keep lock alive
        this.lockHeartbeat = setInterval(async () => {
          await chrome.storage.local.set({
            [lockKey]: {
              tabId: this.tabCoordinatorId,
              timestamp: Date.now(),
            },
          });
        }, 10000);

        return true;
      } catch (error) {
        console.error('[McGraw Plus] Lock acquisition error:', error);
        return true; // Proceed anyway on error
      }
    },

    /**
     * Release scraper lock
     */
    async releaseScraperLock() {
      try {
        if (this.lockHeartbeat) {
          clearInterval(this.lockHeartbeat);
        }
        const domain = window.location.hostname;
        const lockKey = `${this.TAB_COORDINATOR_KEY}_${domain}`;
        await chrome.storage.local.remove(lockKey);
      } catch (error) {
        // Ignore errors on unload
      }
    },

    /**
     * Setup visibility change listener
     */
    setupVisibilityListener() {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // Refresh data when tab becomes visible
          this.lastScanTime = 0;
          setTimeout(() => this.scan(), 500);
        }
      });
    },

    /**
     * Scan with retry logic
     */
    async scanWithRetry() {
      try {
        await this.scan();
        this.retryCount = 0;
      } catch (error) {
        console.error('[McGraw Plus] Scan error:', error);
        if (this.retryCount < this.MAX_RETRY_COUNT) {
          this.retryCount++;
          const delay = this.RETRY_DELAY_MS * Math.pow(2, this.retryCount - 1);
          console.log(`[McGraw Plus] Retrying in ${delay}ms (attempt ${this.retryCount})`);
          setTimeout(() => this.scanWithRetry(), delay);
        }
      }
    },

    /**
     * Check if current page is a Connect page
     */
    isConnectPage() {
      const url = window.location.href;
      return url.includes('connect.mheducation.com') ||
             url.includes('learning.mheducation.com') ||
             url.includes('newconnect.mheducation.com') ||
             url.includes('connect.router.integration.prod.mheducation.com');
    },

    /**
     * Detect the page type for better scraping
     */
    getPageType() {
      const url = window.location.href.toLowerCase();
      const path = window.location.pathname.toLowerCase();

      // newconnect pages
      if (url.includes('newconnect.mheducation.com')) {
        if (path.includes('/student/todo')) return 'newconnect-todo';
        if (path.includes('/student/calendar')) return 'newconnect-calendar';
        if (path.includes('/student/class/section')) return 'newconnect-class';
        if (path.includes('/student/results')) return 'newconnect-results';
        return 'newconnect-dashboard';
      }

      // router integration pages
      if (url.includes('connect.router.integration.prod.mheducation.com')) {
        if (path.includes('/coversheet')) return 'router-coversheet';
        return 'router-page';
      }

      // Legacy connect pages
      if (url.includes('/connect/')) {
        if (path.includes('/home')) return 'connect-home';
        if (path.includes('/section')) return 'connect-section';
        if (path.includes('/course')) return 'connect-course';
        return 'connect-dashboard';
      }

      // SmartBook pages
      if (url.includes('learning.mheducation.com')) {
        return 'smartbook';
      }

      return 'unknown';
    },

    /**
     * Check if current page is the dashboard/home
     */
    isDashboard() {
      const url = window.location.href;
      return url.includes('/connect/') &&
             (url.includes('/home') ||
              url.includes('/section') ||
              url.endsWith('/connect/') ||
              url.includes('/course/'));
    },

    /**
     * Load cached data from storage
     */
    async loadCachedData() {
      try {
        const result = await chrome.storage.local.get([this.STORAGE_KEY, this.COURSES_KEY]);
        this.assignments = result[this.STORAGE_KEY] || [];
        this.courses = result[this.COURSES_KEY] || [];
        console.log(`[McGraw Plus] Loaded ${this.courses.length} courses, ${this.assignments.length} assignments from cache`);
      } catch (error) {
        console.error('[McGraw Plus] Failed to load cached data:', error);
      }
    },

    /**
     * Save data to storage
     */
    async saveData() {
      try {
        await chrome.storage.local.set({
          [this.STORAGE_KEY]: this.assignments,
          [this.COURSES_KEY]: this.courses,
        });
        console.log(`[McGraw Plus] Saved ${this.courses.length} courses, ${this.assignments.length} assignments`);
      } catch (error) {
        console.error('[McGraw Plus] Failed to save data:', error);
      }
    },

    /**
     * Set up MutationObserver for dynamic content
     */
    setupObserver() {
      if (this.observer) {
        this.observer.disconnect();
      }

      let scanTimeout = null;

      this.observer = new MutationObserver((mutations) => {
        // Check if any mutations are relevant
        const hasRelevantChanges = mutations.some(m => {
          const target = m.target;
          if (m.type === 'childList' && m.addedNodes.length > 0) {
            // Check if added nodes might be assignments or courses
            for (const node of m.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const html = node.outerHTML || '';
                if (html.includes('assignment') ||
                    html.includes('course') ||
                    html.includes('due') ||
                    html.includes('activity') ||
                    html.includes('section')) {
                  return true;
                }
              }
            }
          }
          return false;
        });

        if (hasRelevantChanges) {
          // Debounce scans
          if (scanTimeout) clearTimeout(scanTimeout);
          scanTimeout = setTimeout(() => {
            this.scan();
          }, this.SCAN_DEBOUNCE_MS);
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    },

    /**
     * Set up listener for SPA navigation
     */
    setupNavigationListener() {
      // Listen for URL changes (SPA navigation)
      let lastUrl = location.href;

      const checkNavigation = () => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          console.log('[McGraw Plus] Navigation detected, rescanning...');
          setTimeout(() => this.scan(), 500);
        }
      };

      // Check periodically for URL changes
      setInterval(checkNavigation, 1000);

      // Also listen for popstate
      window.addEventListener('popstate', () => {
        setTimeout(() => this.scan(), 500);
      });
    },

    /**
     * Main scan function - scrapes all visible data
     */
    async scan() {
      // Rate limit scans
      const now = Date.now();
      if (now - this.lastScanTime < this.MIN_SCAN_INTERVAL_MS) {
        return;
      }
      this.lastScanTime = now;

      if (this.isScanning) return;
      this.isScanning = true;

      console.log('[McGraw Plus] Starting scan...');

      try {
        // Scan user profile
        const userProfile = this.scanUserProfile();
        if (userProfile) {
          await this.saveUserProfile(userProfile);
        }

        // Scan courses from dashboard
        const newCourses = this.scanCourses();

        // Scan assignments from current page
        const newAssignments = this.scanAssignments();

        // Scan additional page types
        const todoAssignments = this.scanTodoList();
        const calendarAssignments = this.scanCalendar();

        // Combine all assignments
        const allNewAssignments = [
          ...newAssignments,
          ...todoAssignments,
          ...calendarAssignments,
        ];

        // Merge with existing data (keep old data, update with new)
        this.mergeCourses(newCourses);
        this.mergeAssignments(allNewAssignments);

        // Save to storage
        await this.saveData();

        // Notify popup if open
        this.notifyUpdate();

      } catch (error) {
        console.error('[McGraw Plus] Scan failed:', error);
      } finally {
        this.isScanning = false;
      }
    },

    /**
     * Scan for user profile information
     */
    scanUserProfile() {
      // Try all profile selectors
      for (const selector of this.SELECTORS.userProfile) {
        try {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim()) {
            const name = el.textContent.trim();
            // Basic validation - name should be reasonable length and not be a button/link text
            if (name.length >= 2 && name.length <= 100 && !this.isCommonUIText(name)) {
              return {
                name,
                scrapedAt: Date.now(),
                source: 'selector',
              };
            }
          }
        } catch (e) {
          // Ignore invalid selectors
        }
      }

      // Try alternate method: look in meta tags or data attributes
      const metaSelectors = [
        'meta[name="user-name"]',
        'meta[property="user:name"]',
        'meta[name="user"]',
        '[data-user-name]',
        '[data-username]',
      ];

      for (const selector of metaSelectors) {
        try {
          const el = document.querySelector(selector);
          const value = el?.content || el?.dataset?.userName || el?.dataset?.username;
          if (value && value.trim().length >= 2) {
            return {
              name: value.trim(),
              scrapedAt: Date.now(),
              source: 'meta',
            };
          }
        } catch (e) {
          // Ignore
        }
      }

      // Try looking for first/last name combination
      const firstNameEl = document.querySelector('[data-first-name], .first-name, .given-name');
      const lastNameEl = document.querySelector('[data-last-name], .last-name, .family-name');

      if (firstNameEl || lastNameEl) {
        const firstName = firstNameEl?.textContent?.trim() || '';
        const lastName = lastNameEl?.textContent?.trim() || '';
        const fullName = `${firstName} ${lastName}`.trim();

        if (fullName.length >= 2) {
          return {
            name: fullName,
            scrapedAt: Date.now(),
            source: 'combined',
          };
        }
      }

      return null;
    },

    /**
     * Check if text is common UI text (not a name)
     */
    isCommonUIText(text) {
      const commonTexts = [
        'sign in', 'sign out', 'log in', 'log out', 'login', 'logout',
        'menu', 'profile', 'account', 'settings', 'home', 'dashboard',
        'courses', 'assignments', 'grades', 'help', 'support',
      ];
      return commonTexts.includes(text.toLowerCase());
    },

    /**
     * Save user profile to storage
     */
    async saveUserProfile(profile) {
      if (!profile) return;

      try {
        const existing = await chrome.storage.local.get(this.USER_PROFILE_KEY);
        const current = existing[this.USER_PROFILE_KEY];

        // Only update if we have new data or no existing data
        if (!current || profile.scrapedAt > (current.scrapedAt || 0)) {
          await chrome.storage.local.set({ [this.USER_PROFILE_KEY]: profile });
          console.log('[McGraw Plus] Saved user profile:', profile.name);
        }
      } catch (error) {
        console.error('[McGraw Plus] Failed to save user profile:', error);
      }
    },

    /**
     * Scan for courses on the page
     */
    scanCourses() {
      const courses = [];

      // Try multiple selectors for course cards
      const courseElements = document.querySelectorAll(this.SELECTORS.courseCard);

      courseElements.forEach((el, index) => {
        try {
          const nameEl = el.querySelector(this.SELECTORS.courseName) || el.querySelector('h3, h4, .title');
          const linkEl = el.querySelector(this.SELECTORS.courseLink) || el.querySelector('a');

          if (nameEl) {
            const name = nameEl.textContent.trim();
            const link = linkEl?.href || '';
            const id = this.generateId(name);

            if (name && name.length > 0) {
              courses.push({
                id,
                name,
                link,
                scrapedAt: Date.now(),
              });
            }
          }
        } catch (e) {
          // Skip malformed course cards
        }
      });

      // Also look for course info in the page header/breadcrumb
      const breadcrumb = document.querySelector('.breadcrumb, .page-header, .course-header');
      if (breadcrumb) {
        const courseName = breadcrumb.textContent.trim().split('\n')[0];
        if (courseName && !courses.find(c => c.name === courseName)) {
          courses.push({
            id: this.generateId(courseName),
            name: courseName,
            link: window.location.href,
            scrapedAt: Date.now(),
          });
        }
      }

      console.log(`[McGraw Plus] Found ${courses.length} courses`);
      return courses;
    },

    /**
     * Scan for assignments on the page
     */
    scanAssignments() {
      const assignments = [];
      const currentCourse = this.getCurrentCourseName();

      // Method 1: Table-based layouts
      const tables = document.querySelectorAll(this.SELECTORS.assignmentTable + ', table');
      tables.forEach(table => {
        const rows = table.querySelectorAll(this.SELECTORS.tableRow);
        rows.forEach(row => {
          const assignment = this.parseAssignmentRow(row, currentCourse);
          if (assignment) {
            assignments.push(assignment);
          }
        });
      });

      // Method 2: Card/List-based layouts
      const assignmentElements = document.querySelectorAll(this.SELECTORS.assignmentRow);
      assignmentElements.forEach(el => {
        const assignment = this.parseAssignmentElement(el, currentCourse);
        if (assignment) {
          // Avoid duplicates from table scan
          if (!assignments.find(a => a.id === assignment.id)) {
            assignments.push(assignment);
          }
        }
      });

      // Method 3: Look for any elements with due dates
      const elementsWithDates = document.querySelectorAll('[class*="due"], [data-due], [class*="deadline"]');
      elementsWithDates.forEach(el => {
        const assignment = this.parseGenericDueElement(el, currentCourse);
        if (assignment && !assignments.find(a => a.id === assignment.id)) {
          assignments.push(assignment);
        }
      });

      console.log(`[McGraw Plus] Found ${assignments.length} assignments`);
      return assignments;
    },

    /**
     * Parse an assignment from a table row
     */
    parseAssignmentRow(row, courseName) {
      try {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return null;

        // Try to find name
        const nameEl = row.querySelector(this.SELECTORS.assignmentName) || cells[0];
        const name = nameEl?.textContent?.trim();
        if (!name || name.length < 2) return null;

        // Try to find due date
        const dueEl = row.querySelector(this.SELECTORS.assignmentDueDate);
        const dueDate = dueEl ? this.parseDate(dueEl.textContent) : null;

        // Try to find status/completion
        const statusEl = row.querySelector(this.SELECTORS.assignmentStatus);
        const statusText = statusEl?.textContent?.toLowerCase() || '';
        const completed = statusText.includes('complete') ||
                         statusText.includes('submitted') ||
                         statusText.includes('100%');

        // Try to find type
        const typeEl = row.querySelector(this.SELECTORS.assignmentType);
        const type = typeEl?.textContent?.trim() || this.inferType(name);

        // Get link if available
        const linkEl = row.querySelector('a');
        const link = linkEl?.href || '';

        return {
          id: this.generateId(name + (courseName || '')),
          name,
          courseName: courseName || 'Unknown Course',
          dueDate,
          completed,
          type,
          link,
          scrapedAt: Date.now(),
        };
      } catch (e) {
        return null;
      }
    },

    /**
     * Parse an assignment from a card/list element
     */
    parseAssignmentElement(el, courseName) {
      try {
        const nameEl = el.querySelector(this.SELECTORS.assignmentName) ||
                       el.querySelector('a, .title, h4, h5');
        const name = nameEl?.textContent?.trim();
        if (!name || name.length < 2) return null;

        const dueEl = el.querySelector(this.SELECTORS.assignmentDueDate) ||
                      el.querySelector('[class*="due"], [class*="date"]');
        const dueDate = dueEl ? this.parseDate(dueEl.textContent) : null;

        const statusEl = el.querySelector(this.SELECTORS.assignmentStatus) ||
                        el.querySelector('[class*="status"], [class*="complete"]');
        const statusText = statusEl?.textContent?.toLowerCase() || '';
        const completed = statusText.includes('complete') ||
                         statusText.includes('submitted') ||
                         statusText.includes('100%') ||
                         el.classList.contains('completed');

        const progressEl = el.querySelector(this.SELECTORS.progressBar);
        const progress = progressEl ? parseInt(progressEl.getAttribute('aria-valuenow') || '0') : null;

        const linkEl = el.querySelector('a');
        const link = linkEl?.href || '';

        return {
          id: this.generateId(name + (courseName || '')),
          name,
          courseName: courseName || 'Unknown Course',
          dueDate,
          completed: completed || progress === 100,
          progress,
          type: this.inferType(name),
          link,
          scrapedAt: Date.now(),
        };
      } catch (e) {
        return null;
      }
    },

    /**
     * Parse generic element with due date
     */
    parseGenericDueElement(el, courseName) {
      try {
        // Find the parent container that might have the assignment name
        const parent = el.closest('tr, .assignment, .activity, .card, .item, li');
        if (!parent) return null;

        const nameEl = parent.querySelector('a, .title, .name, h4, h5, td:first-child');
        const name = nameEl?.textContent?.trim();
        if (!name || name.length < 2) return null;

        const dueDate = this.parseDate(el.textContent);
        if (!dueDate) return null;

        return {
          id: this.generateId(name + (courseName || '')),
          name,
          courseName: courseName || 'Unknown Course',
          dueDate,
          completed: false,
          type: this.inferType(name),
          link: parent.querySelector('a')?.href || '',
          scrapedAt: Date.now(),
        };
      } catch (e) {
        return null;
      }
    },

    /**
     * Scan To-Do list page for assignments
     */
    scanTodoList() {
      const assignments = [];
      const currentCourse = this.getCurrentCourseName();

      // Check if we're on a todo/tasks page
      const url = window.location.href.toLowerCase();
      const isTodoPage = url.includes('todo') || url.includes('task') || url.includes('upcoming');

      // Scan todo items
      const todoItems = document.querySelectorAll(this.SELECTORS.todoItem);
      todoItems.forEach(item => {
        try {
          const nameEl = item.querySelector(this.SELECTORS.todoName) ||
                        item.querySelector('a, .title, h4, h5');
          const name = nameEl?.textContent?.trim();
          if (!name || name.length < 2) return;

          const dueEl = item.querySelector(this.SELECTORS.todoDue) ||
                       item.querySelector('[class*="due"], [class*="date"]');
          const dueDate = dueEl ? this.parseDate(dueEl.textContent) : null;

          const isCompleted = item.classList.contains('completed') ||
                             item.querySelector('[class*="complete"], [class*="done"]');

          assignments.push({
            id: this.generateId(name + (currentCourse || '') + 'todo'),
            name,
            courseName: currentCourse || 'To-Do',
            dueDate,
            completed: !!isCompleted,
            type: this.inferType(name),
            source: 'todo',
            link: nameEl?.closest('a')?.href || '',
            scrapedAt: Date.now(),
          });
        } catch (e) {
          // Skip malformed items
        }
      });

      if (assignments.length > 0) {
        console.log(`[McGraw Plus] Found ${assignments.length} items from To-Do list`);
      }

      return assignments;
    },

    /**
     * Scan Calendar page for assignments/events
     */
    scanCalendar() {
      const assignments = [];

      // Check if we're on a calendar page
      const url = window.location.href.toLowerCase();
      const isCalendarPage = url.includes('calendar') || document.querySelector('.calendar, .fc, [class*="calendar"]');

      if (!isCalendarPage) return assignments;

      // Scan calendar events
      const events = document.querySelectorAll(this.SELECTORS.calendarEvent);
      events.forEach(event => {
        try {
          const titleEl = event.querySelector(this.SELECTORS.eventTitle) ||
                         event.querySelector('.title, .name, span');
          const title = titleEl?.textContent?.trim();
          if (!title || title.length < 2) return;

          // Get date from event or parent day cell
          let dueDate = null;
          const dateEl = event.querySelector(this.SELECTORS.eventDate);
          if (dateEl) {
            dueDate = this.parseDate(dateEl.textContent || dateEl.dataset.date);
          } else {
            // Try to get from parent cell or data attribute
            const dateAttr = event.dataset.date || event.closest('[data-date]')?.dataset.date;
            if (dateAttr) {
              dueDate = this.parseDate(dateAttr);
            }
          }

          // Skip events without dates
          if (!dueDate) return;

          assignments.push({
            id: this.generateId(title + dueDate + 'calendar'),
            name: title,
            courseName: 'Calendar',
            dueDate,
            completed: event.classList.contains('past') || event.classList.contains('completed'),
            type: this.inferType(title),
            source: 'calendar',
            link: event.querySelector('a')?.href || '',
            scrapedAt: Date.now(),
          });
        } catch (e) {
          // Skip malformed events
        }
      });

      if (assignments.length > 0) {
        console.log(`[McGraw Plus] Found ${assignments.length} events from Calendar`);
      }

      return assignments;
    },

    /**
     * Parse a date string into ISO format
     */
    parseDate(text) {
      if (!text) return null;

      text = text.trim();

      // Common date patterns
      const patterns = [
        // "Jan 15, 2026"
        /(\w{3})\s+(\d{1,2}),?\s+(\d{4})/,
        // "January 15, 2026"
        /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
        // "01/15/2026" or "1/15/2026"
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        // "2026-01-15"
        /(\d{4})-(\d{2})-(\d{2})/,
        // "15 Jan 2026"
        /(\d{1,2})\s+(\w{3})\s+(\d{4})/,
        // "Due: Jan 15" (assumes current/next year)
        /(?:due|deadline):\s*(\w{3})\s+(\d{1,2})/i,
      ];

      // Also look for time
      const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
      let hours = 23, minutes = 59;
      if (timeMatch) {
        hours = parseInt(timeMatch[1]);
        minutes = parseInt(timeMatch[2]);
        if (timeMatch[3]?.toLowerCase() === 'pm' && hours !== 12) hours += 12;
        if (timeMatch[3]?.toLowerCase() === 'am' && hours === 12) hours = 0;
      }

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          try {
            let date;

            if (pattern.source.includes('\\d{4})-')) {
              // ISO format
              date = new Date(`${match[1]}-${match[2]}-${match[3]}`);
            } else if (pattern.source.startsWith('(\\d{1,2})\\/')) {
              // MM/DD/YYYY
              date = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
            } else if (pattern.source.includes('due|deadline')) {
              // Month Day only - assume current/next year
              const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
              const monthIndex = monthNames.indexOf(match[1].toLowerCase().substring(0, 3));
              const day = parseInt(match[2]);
              const now = new Date();
              let year = now.getFullYear();
              date = new Date(year, monthIndex, day);
              if (date < now) {
                date = new Date(year + 1, monthIndex, day);
              }
            } else {
              // Try to parse with Date constructor
              date = new Date(text);
            }

            if (!isNaN(date.getTime())) {
              date.setHours(hours, minutes, 0, 0);
              return date.toISOString();
            }
          } catch (e) {
            continue;
          }
        }
      }

      // Last resort: try native Date parsing
      try {
        const date = new Date(text);
        if (!isNaN(date.getTime())) {
          date.setHours(hours, minutes, 0, 0);
          return date.toISOString();
        }
      } catch (e) {
        // Ignore
      }

      return null;
    },

    /**
     * Get current course name from page context
     */
    getCurrentCourseName() {
      // Try breadcrumb
      const breadcrumb = document.querySelector('.breadcrumb, .page-title, .course-name, .header-title');
      if (breadcrumb) {
        const text = breadcrumb.textContent.trim();
        if (text.length > 2 && text.length < 100) {
          return text.split('\n')[0].split(' > ')[0].trim();
        }
      }

      // Try page title
      const title = document.title;
      if (title && !title.includes('McGraw') && !title.includes('Connect')) {
        return title.split(' - ')[0].split(' | ')[0].trim();
      }

      return null;
    },

    /**
     * Infer assignment type from name
     */
    inferType(name) {
      const lower = name.toLowerCase();

      if (lower.includes('smartbook') || lower.includes('adaptive')) return 'SmartBook';
      if (lower.includes('quiz')) return 'Quiz';
      if (lower.includes('exam') || lower.includes('test')) return 'Exam';
      if (lower.includes('homework') || lower.includes('hw')) return 'Homework';
      if (lower.includes('reading')) return 'Reading';
      if (lower.includes('chapter')) return 'Chapter';
      if (lower.includes('video') || lower.includes('watch')) return 'Video';
      if (lower.includes('discussion')) return 'Discussion';
      if (lower.includes('lab')) return 'Lab';
      if (lower.includes('project')) return 'Project';
      if (lower.includes('paper') || lower.includes('essay')) return 'Paper';

      return 'Assignment';
    },

    /**
     * Generate a unique ID for an item
     */
    generateId(text) {
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return 'mp_' + Math.abs(hash).toString(36);
    },

    /**
     * Merge new courses with existing data
     */
    mergeCourses(newCourses) {
      const courseMap = new Map();

      // Add existing courses
      this.courses.forEach(c => courseMap.set(c.id, c));

      // Update with new courses
      newCourses.forEach(c => {
        const existing = courseMap.get(c.id);
        if (!existing || c.scrapedAt > existing.scrapedAt) {
          courseMap.set(c.id, c);
        }
      });

      this.courses = Array.from(courseMap.values());
    },

    /**
     * Merge new assignments with existing data
     */
    mergeAssignments(newAssignments) {
      const assignmentMap = new Map();

      // Add existing assignments
      this.assignments.forEach(a => assignmentMap.set(a.id, a));

      // Update with new assignments
      newAssignments.forEach(a => {
        const existing = assignmentMap.get(a.id);
        if (!existing || a.scrapedAt > existing.scrapedAt) {
          // Preserve completion status if it was true
          if (existing?.completed && !a.completed) {
            a.completed = true;
          }
          assignmentMap.set(a.id, a);
        }
      });

      // Clean up old assignments (older than 90 days and completed)
      const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
      const cleaned = Array.from(assignmentMap.values()).filter(a => {
        if (a.completed && a.dueDate) {
          const dueTime = new Date(a.dueDate).getTime();
          return dueTime > cutoff;
        }
        return true;
      });

      this.assignments = cleaned;
    },

    /**
     * Notify popup of data update
     */
    notifyUpdate() {
      try {
        chrome.runtime.sendMessage({
          type: 'DUE_DATES_UPDATED',
          count: this.assignments.length,
        });
      } catch (e) {
        // Popup might not be open, ignore
      }
    },

    /**
     * Get upcoming assignments
     */
    getUpcoming(limit = 5) {
      const now = Date.now();
      return this.assignments
        .filter(a => a.dueDate && new Date(a.dueDate).getTime() > now && !a.completed)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, limit);
    },

    /**
     * Get overdue assignments
     */
    getOverdue() {
      const now = Date.now();
      return this.assignments
        .filter(a => a.dueDate && new Date(a.dueDate).getTime() < now && !a.completed);
    },

    /**
     * Manual refresh
     */
    async refresh() {
      this.lastScanTime = 0;
      await this.scan();
    },

    /**
     * Cleanup
     */
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.isInitialized = false;
    },
  };

  // Export to window
  window.MP_AssignmentScraper = AssignmentScraper;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AssignmentScraper.init());
  } else {
    AssignmentScraper.init();
  }
})();
