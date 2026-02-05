/**
 * McGraw Plus - Onboarding Script v2.2.0
 * New flow: Version Check -> Terms -> Welcome -> Login -> Features -> Pin -> Complete
 */

document.addEventListener('DOMContentLoaded', () => {
  // Storage keys
  const KEYS = {
    SETTINGS: 'mp_settings',
    ONBOARDING_COMPLETE: 'mp_onboarding_complete',
    ONBOARDING_COMPLETED_AT: 'mp_onboarding_completed_at',
    TERMS_ACCEPTED: 'mp_terms_accepted',
    TERMS_ACCEPTED_AT: 'mp_terms_accepted_at',
    USER_NAME: 'mp_user_name',
    PIN_PROMPT_SHOWN_AT: 'mp_pin_prompt_shown_at',
    DUE_DATES: 'mp_due_dates',
    COURSES: 'mp_courses',
  };

  // Config
  const CONFIG = {
    VERSION_URL: 'https://raw.githubusercontent.com/KevinTrinh1227/McGraw-Plus/main/version.json',
    VERSION_RETRY_COUNT: 3,
    VERSION_RETRY_DELAY: 1000,
  };

  // Feature definitions (from defaults.json)
  const FEATURES = {
    darkMode: { id: 'darkMode', name: 'Dark Mode', description: 'Comfortable dark theme for studying', icon: '🌙', default: true, category: 'appearance' },
    keyboardShortcuts: { id: 'keyboardShortcuts', name: 'Keyboard Shortcuts', description: 'Use 1-4 or A-D to select answers', icon: '⌨️', default: true, category: 'productivity' },
    dueDateTracker: { id: 'dueDateTracker', name: 'Due Date Tracker', description: 'Track assignment deadlines', icon: '📅', default: true, category: 'organization' },
    statsTracker: { id: 'statsTracker', name: 'Stats Tracker', description: 'Track your study progress', icon: '📊', default: true, category: 'analytics' },
    notifications: { id: 'notifications', name: 'Notifications', description: 'Reminders for due dates', icon: '🔔', default: true, category: 'organization' },
    quickCopy: { id: 'quickCopy', name: 'Quick Copy', description: 'Copy questions with one click', icon: '📋', default: false, category: 'productivity' },
    flashcardGenerator: { id: 'flashcardGenerator', name: 'Flashcards', description: 'Create flashcards from questions', icon: '🎴', default: false, category: 'study' },
    focusMode: { id: 'focusMode', name: 'Focus Mode', description: 'Hide distractions while studying', icon: '🎯', default: false, category: 'productivity' },
    pdfExport: { id: 'pdfExport', name: 'PDF Export', description: 'Export Q&A to PDF', icon: '📄', default: false, category: 'study' },
    studyTimer: { id: 'studyTimer', name: 'Study Timer', description: 'Pomodoro timer for sessions', icon: '⏱️', default: false, category: 'productivity' },
    progressBar: { id: 'progressBar', name: 'Progress Bar', description: 'Visual completion indicator', icon: '📈', default: true, category: 'analytics' },
    readability: { id: 'readability', name: 'Readability', description: 'Improve text formatting', icon: '📖', default: false, category: 'appearance' },
    tabTitle: { id: 'tabTitle', name: 'Tab Title Progress', description: 'Show progress in browser tab', icon: '📑', default: true, category: 'productivity' },
    autoResume: { id: 'autoResume', name: 'Auto Resume', description: 'Continue where you left off', icon: '▶️', default: false, category: 'productivity' },
    confidenceMarker: { id: 'confidenceMarker', name: 'Confidence Marker', description: 'Track confidence on questions', icon: '💪', default: false, category: 'study' },
    antiCopy: { id: 'antiCopy', name: 'Text Selection', description: 'Enable copy on restricted pages', icon: '✂️', default: false, category: 'accessibility' },
  };

  // State
  let currentSlide = 0;
  const totalSlides = 7; // 0-6
  let isLoggedIn = false;
  let loginCheckInterval = null;
  let userName = '';
  let selectedFeatures = {};
  let versionCheckPassed = false;
  let versionRetryCount = 0;

  // Initialize selected features with defaults
  Object.keys(FEATURES).forEach(key => {
    selectedFeatures[key] = FEATURES[key].default;
  });

  // DOM Elements
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const elements = {
    slides: $$('.slide'),
    progressDots: $$('.progress-dot'),
    skipBtn: $('skip-btn'),
    backBtn: $('back-btn'),
    nextBtn: $('next-btn'),
    // Version check
    versionChecking: $('version-checking'),
    versionOk: $('version-ok'),
    versionOutdated: $('version-outdated'),
    versionError: $('version-error'),
    currentVersion: $('current-version'),
    yourVersion: $('your-version'),
    latestVersion: $('latest-version'),
    retryVersionBtn: $('retry-version-btn'),
    // Terms
    termsNameInput: $('terms-name-input'),
    // Welcome
    welcomeName: $('welcome-name'),
    // Login
    loginStatus: $('login-status'),
    loginBtn: $('login-btn'),
    checkLoginBtn: $('check-login-btn'),
    // Features
    featuresGrid: $('features-grid'),
    enableAllBtn: $('enable-all-btn'),
    disableAllBtn: $('disable-all-btn'),
    // Pin
    pinArrow: $('pin-arrow'),
    // Complete
    completeName: $('complete-name'),
    completeDate: $('complete-date'),
    completeTime: $('complete-time'),
    // Confetti
    confettiCanvas: $('confetti-canvas'),
  };

  /**
   * Detect browser type for pin arrow positioning
   */
  function detectBrowser() {
    const ua = navigator.userAgent.toLowerCase();

    if (ua.includes('arc')) return 'arc';
    if (ua.includes('vivaldi')) return 'vivaldi';
    if (ua.includes('opera') || ua.includes('opr')) return 'opera';
    if (ua.includes('brave')) return 'brave';
    if (ua.includes('edg')) return 'edge';
    if (ua.includes('chrome')) return 'chrome';
    if (ua.includes('firefox')) return 'firefox';
    if (ua.includes('safari')) return 'safari';

    return 'chrome'; // default
  }

  /**
   * Position pin arrow based on browser
   */
  function positionPinArrow() {
    const browser = detectBrowser();
    const arrow = elements.pinArrow;

    if (!arrow) return;

    // Remove any existing position classes
    arrow.classList.remove('chrome', 'edge', 'brave', 'opera', 'vivaldi', 'arc');

    // Add browser-specific class
    arrow.classList.add(browser);
    arrow.classList.remove('hidden');
  }

  /**
   * Check version against remote
   */
  async function checkVersion() {
    showVersionStatus('checking');

    const currentVersion = chrome.runtime.getManifest().version;
    elements.currentVersion.textContent = currentVersion;
    elements.yourVersion.textContent = currentVersion;

    try {
      const response = await fetch(CONFIG.VERSION_URL, {
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      });

      if (!response.ok) throw new Error('Failed to fetch version');

      const data = await response.json();
      const minVersion = data.minVersion || '0.0.0';
      const latestVersion = data.version || currentVersion;

      elements.latestVersion.textContent = latestVersion;

      // Compare versions
      if (compareVersions(currentVersion, minVersion) < 0) {
        // Outdated - block
        showVersionStatus('outdated');
        versionCheckPassed = false;
        return;
      }

      // Version OK
      showVersionStatus('ok');
      versionCheckPassed = true;
      updateNextButton();

    } catch (error) {
      console.error('[McGraw Plus] Version check error:', error);
      versionRetryCount++;

      if (versionRetryCount < CONFIG.VERSION_RETRY_COUNT) {
        // Retry after delay
        setTimeout(checkVersion, CONFIG.VERSION_RETRY_DELAY);
      } else {
        // Show error but allow continue with warning
        showVersionStatus('error');
        versionCheckPassed = true; // Allow to proceed with warning
        updateNextButton();
      }
    }
  }

  /**
   * Show version status
   */
  function showVersionStatus(status) {
    elements.versionChecking.classList.add('hidden');
    elements.versionOk.classList.add('hidden');
    elements.versionOutdated.classList.add('hidden');
    elements.versionError.classList.add('hidden');

    switch (status) {
      case 'checking':
        elements.versionChecking.classList.remove('hidden');
        break;
      case 'ok':
        elements.versionOk.classList.remove('hidden');
        break;
      case 'outdated':
        elements.versionOutdated.classList.remove('hidden');
        break;
      case 'error':
        elements.versionError.classList.remove('hidden');
        break;
    }
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
          <span>${message || 'Connected to McGraw-Hill'}</span>
        </div>
      `,
      'logged-out': `
        <div class="status-indicator logged-out">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>${message || 'Not connected yet'}</span>
        </div>
      `,
    };

    elements.loginStatus.innerHTML = statusHtml[status] || statusHtml.checking;
  }

  /**
   * Check if user is logged in to Connect
   */
  async function checkLoginStatus() {
    updateLoginStatus('checking');

    try {
      // Check cached data
      const result = await chrome.storage.local.get([KEYS.COURSES, KEYS.DUE_DATES]);
      const courses = result[KEYS.COURSES] || [];
      const assignments = result[KEYS.DUE_DATES] || [];

      if (courses.length > 0 || assignments.length > 0) {
        isLoggedIn = true;
        updateLoginStatus('logged-in', `Found ${courses.length} courses`);
        return true;
      }

      // Query open Connect tabs
      const tabs = await chrome.tabs.query({ url: '*://*.mheducation.com/*' });

      if (tabs.length > 0) {
        for (const tab of tabs) {
          try {
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_LOGIN' });
            if (response && response.loggedIn) {
              isLoggedIn = true;
              updateLoginStatus('logged-in', 'Connected to McGraw-Hill');
              return true;
            }
          } catch (e) {
            // Content script might not be loaded
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
   * Build features grid
   */
  function buildFeaturesGrid(category = 'all') {
    const grid = elements.featuresGrid;
    grid.innerHTML = '';

    const featureList = Object.values(FEATURES).filter(f =>
      category === 'all' || f.category === category
    );

    featureList.forEach(feature => {
      const card = document.createElement('label');
      card.className = `feature-card ${selectedFeatures[feature.id] ? 'selected' : ''}`;
      card.dataset.featureId = feature.id;

      card.innerHTML = `
        <input type="checkbox" ${selectedFeatures[feature.id] ? 'checked' : ''} />
        <span class="feature-checkbox"></span>
        <span class="feature-icon">${feature.icon}</span>
        <span class="feature-name">${feature.name}</span>
        <span class="feature-desc">${feature.description}</span>
      `;

      const checkbox = card.querySelector('input');
      checkbox.addEventListener('change', () => {
        selectedFeatures[feature.id] = checkbox.checked;
        card.classList.toggle('selected', checkbox.checked);
      });

      grid.appendChild(card);
    });
  }

  /**
   * Enable/disable all features
   */
  function setAllFeatures(enabled) {
    Object.keys(FEATURES).forEach(key => {
      selectedFeatures[key] = enabled;
    });
    buildFeaturesGrid(getCurrentCategory());
  }

  /**
   * Get current category filter
   */
  function getCurrentCategory() {
    const activeTab = document.querySelector('.feature-tab.active');
    return activeTab?.dataset.category || 'all';
  }

  /**
   * Update next button state based on current slide
   */
  function updateNextButton() {
    let canProceed = true;

    switch (currentSlide) {
      case 0: // Version check
        canProceed = versionCheckPassed;
        break;
      case 1: // Terms
        canProceed = elements.termsNameInput.value.trim().length >= 2;
        break;
      default:
        canProceed = true;
    }

    elements.nextBtn.disabled = !canProceed;
  }

  /**
   * Show slide
   */
  function showSlide(num) {
    elements.slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === num);
    });

    elements.progressDots.forEach((dot, index) => {
      dot.classList.remove('active', 'completed');
      if (index === num) {
        dot.classList.add('active');
      } else if (index < num) {
        dot.classList.add('completed');
      }
    });

    // Update buttons
    elements.backBtn.classList.toggle('hidden', num === 0);

    if (num === totalSlides - 1) {
      elements.nextBtn.textContent = 'Get Started';
      elements.skipBtn.classList.add('hidden');
    } else {
      elements.nextBtn.textContent = 'Next';
      elements.skipBtn.classList.remove('hidden');
    }

    // Slide-specific logic
    switch (num) {
      case 0: // Version check
        checkVersion();
        break;
      case 1: // Terms
        elements.termsNameInput.focus();
        break;
      case 2: // Welcome
        elements.welcomeName.textContent = userName || 'there';
        break;
      case 3: // Login
        checkLoginStatus();
        if (!loginCheckInterval) {
          loginCheckInterval = setInterval(() => {
            if (currentSlide === 3) checkLoginStatus();
          }, 5000);
        }
        break;
      case 4: // Features
        buildFeaturesGrid();
        break;
      case 5: // Pin
        positionPinArrow();
        chrome.storage.local.set({ [KEYS.PIN_PROMPT_SHOWN_AT]: Date.now() });
        break;
      case 6: // Complete
        elements.completeName.textContent = userName || 'User';
        const now = new Date();
        elements.completeDate.textContent = now.toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
        elements.completeTime.textContent = now.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true
        });
        triggerConfetti();
        break;
    }

    // Clear login interval if not on login slide
    if (num !== 3 && loginCheckInterval) {
      clearInterval(loginCheckInterval);
      loginCheckInterval = null;
    }

    currentSlide = num;
    updateNextButton();
  }

  /**
   * Trigger confetti celebration
   */
  function triggerConfetti() {
    const canvas = elements.confettiCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    const particles = [];
    const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

    // Create particles
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20 - 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }

    let frame = 0;
    const maxFrames = 180;

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3; // gravity
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      frame++;
      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else {
        canvas.style.display = 'none';
      }
    }

    animate();
  }

  /**
   * Save settings and complete onboarding
   */
  async function completeOnboarding() {
    const settings = { ...selectedFeatures };

    await chrome.storage.local.set({
      [KEYS.SETTINGS]: settings,
      [KEYS.ONBOARDING_COMPLETE]: true,
      [KEYS.ONBOARDING_COMPLETED_AT]: Date.now(),
      [KEYS.TERMS_ACCEPTED]: true,
      [KEYS.TERMS_ACCEPTED_AT]: Date.now(),
      [KEYS.USER_NAME]: userName,
    });

    // Navigate to Connect
    window.location.href = 'https://connect.mheducation.com/';
  }

  /**
   * Skip onboarding with defaults
   */
  async function skipOnboarding() {
    const settings = {};
    Object.keys(FEATURES).forEach(key => {
      settings[key] = FEATURES[key].default;
    });

    await chrome.storage.local.set({
      [KEYS.SETTINGS]: settings,
      [KEYS.ONBOARDING_COMPLETE]: true,
      [KEYS.ONBOARDING_COMPLETED_AT]: Date.now(),
    });

    window.close();
  }

  /**
   * Handle next button
   */
  function handleNext() {
    // Save terms name when leaving slide 1
    if (currentSlide === 1) {
      userName = elements.termsNameInput.value.trim();
    }

    if (currentSlide === totalSlides - 1) {
      completeOnboarding();
    } else if (currentSlide === 3 && !isLoggedIn) {
      // Warn about not being logged in
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
    if (currentSlide > 0) {
      showSlide(currentSlide - 1);
    }
  });

  elements.skipBtn.addEventListener('click', skipOnboarding);

  elements.retryVersionBtn?.addEventListener('click', () => {
    versionRetryCount = 0;
    checkVersion();
  });

  elements.termsNameInput?.addEventListener('input', updateNextButton);

  elements.checkLoginBtn?.addEventListener('click', checkLoginStatus);

  elements.enableAllBtn?.addEventListener('click', () => setAllFeatures(true));
  elements.disableAllBtn?.addEventListener('click', () => setAllFeatures(false));

  // Feature category tabs
  $$('.feature-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.feature-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      buildFeaturesGrid(tab.dataset.category);
    });
  });

  // Visibility change detection
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentSlide === 3) {
      setTimeout(checkLoginStatus, 1000);
    }
  });

  // Storage change listener
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[KEYS.COURSES] || changes[KEYS.DUE_DATES]) {
      if (currentSlide === 3) {
        checkLoginStatus();
      }
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (!elements.nextBtn.disabled) {
        handleNext();
      }
    } else if (e.key === 'ArrowLeft') {
      if (currentSlide > 0) {
        showSlide(currentSlide - 1);
      }
    } else if (e.key === 'Escape') {
      skipOnboarding();
    }
  });

  // Initialize
  showSlide(0);
});
