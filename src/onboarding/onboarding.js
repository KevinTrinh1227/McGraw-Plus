/**
 * McGraw Plus - Onboarding Script v2.7.0
 * Clean, minimal onboarding flow
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
    DUE_DATES: 'mp_due_dates',
    COURSES: 'mp_courses',
    SECTIONS: 'mp_sections',
    USER_PROFILE: 'mp_user_profile',
    INSTRUCTORS: 'mp_instructors',
    BOOKS: 'mp_books',
  };

  // Default settings
  const DEFAULT_SETTINGS = {
    darkMode: false,
    keyboardShortcuts: false,
    dueDateTracker: true,
    statsTracker: false,
    notifications: true,
    quickCopy: true,
    flashcardGenerator: false,
    focusMode: false,
    pdfExport: false,
    studyTimer: true,
    progressBar: false,
    readability: false,
    tabTitle: false,
    autoResume: false,
    confidenceMarker: false,
    antiCopy: false,
    solverEnabled: false,
  };

  // State
  let currentSlide = 0;
  const totalSlides = 4;
  let userName = '';
  let termsScrolledToEnd = false;

  // DOM Elements
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const elements = {
    slides: $$('.slide'),
    progressDots: $$('.progress-dot'),
    // Slide 0
    userNameDisplay: $('user-name-display'),
    profileName: $('profile-name'),
    profileEmail: $('profile-email'),
    profileUserId: $('profile-user-id'),
    profileInstitution: $('profile-institution'),
    institutionRow: $('institution-row'),
    setupDate: $('setup-date'),
    setupTime: $('setup-time'),
    viewTermsBtn: $('view-terms-btn'),
    slide0Next: $('slide-0-next'),
    // Slide 1
    statCourses: $('stat-courses'),
    statAssignments: $('stat-assignments'),
    statCompleted: $('stat-completed'),
    statPending: $('stat-pending'),
    overdueWarning: $('overdue-warning'),
    overdueText: $('overdue-text'),
    noDataWarning: $('no-data-warning'),
    instructorSection: $('instructor-section'),
    instructorList: $('instructor-list'),
    booksSection: $('books-section'),
    booksList: $('books-list'),
    slide1Back: $('slide-1-back'),
    slide1Next: $('slide-1-next'),
    // Slide 2
    slide2Back: $('slide-2-back'),
    slide2Next: $('slide-2-next'),
    // Terms Modal
    termsModal: $('terms-modal'),
    closeTermsModal: $('close-terms-modal'),
    termsScrollContainer: $('terms-scroll-container'),
    termsConfirmBtn: $('terms-confirm-btn'),
    // Toast
    connectionToast: $('connection-toast'),
    // Confetti
    confettiCanvas: $('confetti-canvas'),
  };

  /**
   * Initialize onboarding
   */
  async function init() {
    showConnectionToast();
    await loadUserData();
    setTimestamp();
    setupEventListeners();
    showSlide(0);
  }

  /**
   * Show connection toast
   */
  function showConnectionToast() {
    const toast = elements.connectionToast;
    if (toast) {
      toast.classList.remove('hidden');
      setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
          toast.classList.add('hidden');
          toast.classList.remove('fade-out');
        }, 300);
      }, 2000);
    }
  }

  /**
   * Load user data from storage
   */
  async function loadUserData() {
    const result = await chrome.storage.local.get([
      KEYS.COURSES,
      KEYS.SECTIONS,
      KEYS.DUE_DATES,
      KEYS.USER_PROFILE,
      KEYS.INSTRUCTORS,
      KEYS.BOOKS,
    ]);

    const courses = result[KEYS.COURSES] || [];
    const sections = result[KEYS.SECTIONS] || [];
    const assignments = result[KEYS.DUE_DATES] || [];
    const userProfile = result[KEYS.USER_PROFILE] || {};
    const instructors = result[KEYS.INSTRUCTORS] || [];
    const books = result[KEYS.BOOKS] || [];

    // Course count (use sections as fallback)
    const courseCount = courses.length > 0 ? courses.length : sections.length;

    // Get user name
    userName = userProfile.name || '';
    if (!userName && (userProfile.firstName || userProfile.lastName)) {
      userName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim();
    }
    if (!userName && courses.length > 0) {
      userName = courses[0].userName || '';
    }
    if (!userName) {
      userName = 'User';
    }

    // Update name displays
    if (elements.userNameDisplay) elements.userNameDisplay.textContent = userName;
    if (elements.profileName) elements.profileName.textContent = userName;

    // Update profile card
    if (elements.profileEmail) {
      elements.profileEmail.textContent = userProfile.email || 'Not available';
    }
    if (elements.profileUserId) {
      const userId = userProfile.userId || userProfile.id || userProfile.accountId;
      elements.profileUserId.textContent = userId ? formatUserId(userId) : 'Not available';
    }
    if (elements.profileInstitution && elements.institutionRow) {
      const institution = userProfile.institutionName || userProfile.schoolName;
      if (institution) {
        elements.profileInstitution.textContent = institution;
      } else {
        elements.institutionRow.style.display = 'none';
      }
    }

    // Calculate stats
    const completedAssignments = assignments.filter(a => {
      return a.completed === true ||
             a.status === 'completed' ||
             a.status === 'COMPLETED' ||
             a.status === 'COMPLETE' ||
             a.status === 'Completed' ||
             a.progress === 100 ||
             a.percentComplete === 100;
    });
    const pendingAssignments = assignments.filter(a => {
      const isCompleted = a.completed === true ||
                          a.status === 'completed' ||
                          a.status === 'COMPLETED' ||
                          a.status === 'COMPLETE' ||
                          a.status === 'Completed' ||
                          a.progress === 100 ||
                          a.percentComplete === 100;
      return !isCompleted;
    });
    const now = Date.now();
    const overdueAssignments = pendingAssignments.filter(a => {
      if (!a.dueDate) return false;
      const dueDate = new Date(a.dueDate).getTime();
      return !isNaN(dueDate) && dueDate < now;
    });

    // Update stats
    if (elements.statCourses) elements.statCourses.textContent = courseCount;
    if (elements.statAssignments) elements.statAssignments.textContent = assignments.length;
    if (elements.statCompleted) elements.statCompleted.textContent = completedAssignments.length;
    if (elements.statPending) elements.statPending.textContent = pendingAssignments.length;

    // Overdue warning
    if (overdueAssignments.length > 0 && elements.overdueWarning) {
      elements.overdueWarning.classList.remove('hidden');
      if (elements.overdueText) {
        elements.overdueText.textContent = `${overdueAssignments.length} overdue assignment${overdueAssignments.length > 1 ? 's' : ''}`;
      }
    }

    // No data warning
    if (courseCount === 0 && assignments.length === 0 && elements.noDataWarning) {
      elements.noDataWarning.classList.remove('hidden');
    }

    // Display instructors
    if (instructors.length > 0 && elements.instructorSection && elements.instructorList) {
      elements.instructorSection.classList.remove('hidden');
      elements.instructorList.innerHTML = instructors.map(instructor => `
        <div class="data-item">
          <span class="data-item-icon">👨‍🏫</span>
          <div class="data-item-info">
            <span class="data-item-name">${escapeHtml(instructor.name)}</span>
            ${instructor.email ? `<span class="data-item-detail">${escapeHtml(instructor.email)}</span>` : ''}
          </div>
        </div>
      `).join('');
    }

    // Display books
    if (books.length > 0 && elements.booksSection && elements.booksList) {
      elements.booksSection.classList.remove('hidden');
      elements.booksList.innerHTML = books.map(book => `
        <div class="data-item">
          <span class="data-item-icon">📖</span>
          <div class="data-item-info">
            <span class="data-item-name">${escapeHtml(book.title)}</span>
            ${book.author ? `<span class="data-item-detail">by ${escapeHtml(book.author)}</span>` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  /**
   * Escape HTML
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format user ID
   */
  function formatUserId(userId) {
    if (!userId) return 'Not available';
    const id = String(userId);
    if (id.length > 20) {
      return id.substring(0, 8) + '...' + id.substring(id.length - 6);
    }
    return id;
  }

  /**
   * Set timestamp
   */
  function setTimestamp() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (elements.setupDate) elements.setupDate.textContent = dateStr;
    if (elements.setupTime) elements.setupTime.textContent = timeStr;
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

    currentSlide = num;

    // Complete onboarding on last slide
    if (num === totalSlides - 1) {
      completeOnboarding();
      triggerConfetti();
    }
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // View terms
    if (elements.viewTermsBtn) {
      elements.viewTermsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        elements.termsModal.classList.remove('hidden');
      });
    }

    // Close terms modal
    if (elements.closeTermsModal) {
      elements.closeTermsModal.addEventListener('click', () => {
        elements.termsModal.classList.add('hidden');
      });
    }

    // Terms scroll detection
    if (elements.termsScrollContainer) {
      elements.termsScrollContainer.addEventListener('scroll', () => {
        const container = elements.termsScrollContainer;
        const scrolledToBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

        if (scrolledToBottom && !termsScrolledToEnd) {
          termsScrolledToEnd = true;
          if (elements.termsConfirmBtn) {
            elements.termsConfirmBtn.disabled = false;
          }
        }
      });
    }

    // Terms confirm
    if (elements.termsConfirmBtn) {
      elements.termsConfirmBtn.addEventListener('click', () => {
        elements.termsModal.classList.add('hidden');
      });
    }

    // Navigation
    if (elements.slide0Next) {
      elements.slide0Next.addEventListener('click', () => showSlide(1));
    }
    if (elements.slide1Back) {
      elements.slide1Back.addEventListener('click', () => showSlide(0));
    }
    if (elements.slide1Next) {
      elements.slide1Next.addEventListener('click', () => showSlide(2));
    }
    if (elements.slide2Back) {
      elements.slide2Back.addEventListener('click', () => showSlide(1));
    }
    if (elements.slide2Next) {
      elements.slide2Next.addEventListener('click', () => showSlide(3));
    }

    // Close modal on outside click
    if (elements.termsModal) {
      elements.termsModal.addEventListener('click', (e) => {
        if (e.target === elements.termsModal) {
          elements.termsModal.classList.add('hidden');
        }
      });
    }

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !elements.termsModal.classList.contains('hidden')) {
        elements.termsModal.classList.add('hidden');
      }
    });
  }

  /**
   * Complete onboarding
   */
  async function completeOnboarding() {
    const now = Date.now();

    await chrome.storage.local.set({
      [KEYS.SETTINGS]: DEFAULT_SETTINGS,
      [KEYS.ONBOARDING_COMPLETE]: true,
      [KEYS.ONBOARDING_COMPLETED_AT]: now,
      [KEYS.TERMS_ACCEPTED]: true,
      [KEYS.TERMS_ACCEPTED_AT]: now,
      [KEYS.USER_NAME]: userName,
    });
  }

  /**
   * Trigger confetti
   */
  function triggerConfetti() {
    const canvas = elements.confettiCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    const particles = [];
    const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

    for (let i = 0; i < 100; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.5) * 16 - 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }

    let frame = 0;
    const maxFrames = 120;

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
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

  // Initialize
  init();
});
