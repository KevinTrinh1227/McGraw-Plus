/**
 * McGraw Plus - Onboarding Script
 * Guides users through setup and requires Connect login
 */

document.addEventListener('DOMContentLoaded', () => {
  const SETTINGS_KEY = 'mp_settings';
  const ONBOARDING_KEY = 'mp_onboarding_complete';
  const ONBOARDING_COMPLETED_AT_KEY = 'mp_onboarding_completed_at';
  const PIN_PROMPT_SHOWN_AT_KEY = 'mp_pin_prompt_shown_at';
  const DUE_DATES_KEY = 'mp_due_dates';
  const COURSES_KEY = 'mp_courses';

  let currentSlide = 1;
  const totalSlides = 6;
  let isLoggedIn = false;
  let loginCheckInterval = null;
  let initialCheckDone = false;

  const elements = {
    slides: document.querySelectorAll('.slide'),
    progressDots: document.querySelectorAll('.progress-dot'),
    skipBtn: document.getElementById('skip-btn'),
    backBtn: document.getElementById('back-btn'),
    nextBtn: document.getElementById('next-btn'),
    // Login elements
    loginStatus: document.getElementById('login-status'),
    loginBtn: document.getElementById('login-btn'),
    checkLoginBtn: document.getElementById('check-login-btn'),
    // Sync status
    coursesCount: document.getElementById('courses-count'),
    assignmentsCount: document.getElementById('assignments-count'),
    upcomingCount: document.getElementById('upcoming-count'),
    // Preferences
    prefDarkMode: document.getElementById('pref-dark-mode'),
    prefKeyboard: document.getElementById('pref-keyboard'),
    prefDueDates: document.getElementById('pref-due-dates'),
    prefNotifications: document.getElementById('pref-notifications'),
  };

  /**
   * Update login status display
   */
  function updateLoginStatus(status, message) {
    const statusHtml = {
      checking: `
        <div class="status-indicator checking">
          <div class="spinner"></div>
          <span>${message || 'Checking login status...'}</span>
        </div>
      `,
      'logged-in': `
        <div class="status-indicator logged-in">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span>${message || 'Logged in to Connect'}</span>
        </div>
      `,
      'logged-out': `
        <div class="status-indicator logged-out">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>${message || 'Please log in to Connect'}</span>
        </div>
      `,
    };

    elements.loginStatus.innerHTML = statusHtml[status] || statusHtml.checking;
  }

  /**
   * Check if user is logged in to Connect
   * Uses multiple detection methods for reliability
   */
  async function checkLoginStatus() {
    updateLoginStatus('checking');

    try {
      // Method 1: Check cached data (existing users with scraped data)
      const result = await chrome.storage.local.get([COURSES_KEY, DUE_DATES_KEY]);
      const courses = result[COURSES_KEY] || [];
      const assignments = result[DUE_DATES_KEY] || [];

      // If we have recent data, user is logged in
      if (courses.length > 0 || assignments.length > 0) {
        const recentData = courses.some(c => Date.now() - c.scrapedAt < 3600000) ||
                          assignments.some(a => Date.now() - a.scrapedAt < 3600000);
        if (recentData) {
          isLoggedIn = true;
          updateLoginStatus('logged-in', `Found ${courses.length} courses`);
          updateSyncStatus(courses.length, assignments.length);
          return true;
        }
      }

      // Method 2: Query open Connect tabs and ask content script
      const tabs = await chrome.tabs.query({ url: '*://*.mheducation.com/*' });

      if (tabs.length > 0) {
        // Try each tab until we find one with content script loaded
        for (const tab of tabs) {
          try {
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_LOGIN' });
            if (response && response.loggedIn) {
              isLoggedIn = true;
              updateLoginStatus('logged-in', 'Connected to McGraw-Hill');
              console.log('[McGraw Plus] Login detected via:', response.method);
              return true;
            }
          } catch (e) {
            // Content script might not be loaded on this tab, try next
            console.log('[McGraw Plus] Tab check failed:', tab.id, e.message);
          }
        }
      }

      isLoggedIn = false;
      updateLoginStatus('logged-out', 'Please log in to Connect');
      return false;
    } catch (error) {
      console.error('[McGraw Plus] Login check error:', error);
      isLoggedIn = false;
      updateLoginStatus('logged-out', 'Unable to verify login');
      return false;
    }
  }

  /**
   * Update sync status display
   */
  async function updateSyncStatus(coursesOverride, assignmentsOverride) {
    try {
      const result = await chrome.storage.local.get([COURSES_KEY, DUE_DATES_KEY]);
      const courses = result[COURSES_KEY] || [];
      const assignments = result[DUE_DATES_KEY] || [];

      const coursesNum = coursesOverride ?? courses.length;
      const assignmentsNum = assignmentsOverride ?? assignments.length;

      // Count upcoming assignments
      const now = Date.now();
      const upcoming = assignments.filter(a =>
        a.dueDate && new Date(a.dueDate).getTime() > now && !a.completed
      );

      elements.coursesCount.textContent = coursesNum;
      elements.assignmentsCount.textContent = assignmentsNum;
      elements.upcomingCount.textContent = upcoming.length;
    } catch (e) {
      // Ignore errors
    }
  }

  /**
   * Trigger confetti celebration
   */
  function triggerConfetti() {
    // Load confetti script dynamically
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('libs/confetti.min.js');
    script.onload = () => {
      if (typeof confetti === 'function') {
        // Initial burst
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });

        // Side bursts after a delay
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
          });
        }, 250);
      }
    };
    document.head.appendChild(script);
  }

  /**
   * Show slide
   */
  function showSlide(num) {
    elements.slides.forEach((slide, index) => {
      slide.classList.remove('active');
      if (index + 1 === num) {
        slide.classList.add('active');
      }
    });

    elements.progressDots.forEach((dot, index) => {
      dot.classList.remove('active', 'completed');
      if (index + 1 === num) {
        dot.classList.add('active');
      } else if (index + 1 < num) {
        dot.classList.add('completed');
      }
    });

    // Update buttons
    if (num === 1) {
      elements.backBtn.classList.add('hidden');
    } else {
      elements.backBtn.classList.remove('hidden');
    }

    if (num === totalSlides) {
      elements.nextBtn.textContent = 'Get Started';
      elements.skipBtn.classList.add('hidden');
    } else {
      elements.nextBtn.textContent = 'Next';
      elements.skipBtn.classList.remove('hidden');
    }

    // Special handling for slide 2 (login)
    if (num === 2) {
      // Delay initial check to let Connect page load if just opened
      if (!initialCheckDone) {
        setTimeout(() => {
          checkLoginStatus();
          initialCheckDone = true;
        }, 2000);
      } else {
        checkLoginStatus();
      }

      // Start periodic checking while on this slide
      if (!loginCheckInterval) {
        loginCheckInterval = setInterval(() => {
          if (currentSlide === 2) {
            checkLoginStatus();
          }
        }, 5000);
      }
    } else if (loginCheckInterval) {
      clearInterval(loginCheckInterval);
      loginCheckInterval = null;
    }

    // Special handling for slide 5 (pin prompt)
    if (num === 5) {
      // Log that pin prompt was shown
      chrome.storage.local.set({ [PIN_PROMPT_SHOWN_AT_KEY]: Date.now() });
    }

    // Special handling for slide 6 (ready)
    if (num === 6) {
      updateSyncStatus();
      // Trigger confetti celebration
      triggerConfetti();
    }

    currentSlide = num;
  }

  /**
   * Save preferences and complete onboarding
   */
  async function completeOnboarding() {
    const settings = {
      darkMode: elements.prefDarkMode.checked,
      keyboardShortcuts: elements.prefKeyboard.checked,
      dueDateTracker: elements.prefDueDates.checked,
      notifications: elements.prefNotifications.checked,
      statsTracker: true,
      progressBar: true,
      tabTitle: true,
    };

    await chrome.storage.local.set({
      [SETTINGS_KEY]: settings,
      [ONBOARDING_KEY]: true,
      [ONBOARDING_COMPLETED_AT_KEY]: Date.now(),
    });

    // Go to Connect page
    window.location.href = 'https://connect.mheducation.com/';
  }

  /**
   * Skip onboarding
   */
  async function skipOnboarding() {
    // Save default settings
    const settings = {
      darkMode: true,
      keyboardShortcuts: true,
      dueDateTracker: true,
      notifications: true,
      statsTracker: true,
      progressBar: true,
      tabTitle: true,
    };

    await chrome.storage.local.set({
      [SETTINGS_KEY]: settings,
      [ONBOARDING_KEY]: true,
      [ONBOARDING_COMPLETED_AT_KEY]: Date.now(),
    });

    // Close tab
    window.close();
  }

  /**
   * Handle next button
   */
  function handleNext() {
    if (currentSlide === totalSlides) {
      completeOnboarding();
    } else if (currentSlide === 2 && !isLoggedIn) {
      // On login slide, show warning but allow continue
      const proceed = confirm(
        'You haven\'t logged in to Connect yet. ' +
        'Some features like due date tracking won\'t work until you log in.\n\n' +
        'Continue anyway?'
      );
      if (proceed) {
        showSlide(currentSlide + 1);
      }
    } else {
      showSlide(currentSlide + 1);
    }
  }

  // Event listeners
  elements.nextBtn.addEventListener('click', handleNext);

  elements.backBtn.addEventListener('click', () => {
    if (currentSlide > 1) {
      showSlide(currentSlide - 1);
    }
  });

  elements.skipBtn.addEventListener('click', skipOnboarding);

  elements.checkLoginBtn?.addEventListener('click', () => {
    checkLoginStatus();
  });

  // Listen for visibility change (detect returning to this tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentSlide === 2) {
      // Small delay to let Connect page finish loading
      setTimeout(checkLoginStatus, 1000);
    }
  });

  // Listen for storage changes (assignment scraper updates)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[COURSES_KEY] || changes[DUE_DATES_KEY]) {
      if (currentSlide === 2) {
        checkLoginStatus();
      } else if (currentSlide === 6) {
        updateSyncStatus();
      }
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      if (currentSlide > 1) {
        showSlide(currentSlide - 1);
      }
    } else if (e.key === 'Escape') {
      skipOnboarding();
    }
  });

  // Initialize
  showSlide(1);
});
