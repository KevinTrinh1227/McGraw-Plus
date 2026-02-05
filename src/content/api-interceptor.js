/**
 * McGraw Plus - API Response Interceptor v4.0
 * Captures data from McGraw-Hill API endpoints
 * Runs at document_start in MAIN world to intercept all API calls
 *
 * DEBUG MODE: Set window.__MCGRAW_PLUS_DEBUG = true in console to see all captured data
 */

(function() {
  'use strict';

  // Prevent double initialization
  if (window.__mcgrawPlusInterceptorV4) return;
  window.__mcgrawPlusInterceptorV4 = true;

  // Debug mode - set to true to log everything
  const DEBUG = window.__MCGRAW_PLUS_DEBUG || false;

  // Storage for debug/inspection
  window.__mcgrawPlusCaptures = {
    endpoints: [],
    profiles: [],
    courses: [],
    sections: [],
    assignments: [],
    instructors: [],
    books: [],
    rawResponses: [],
  };

  // Event name for bridge communication
  const DATA_CAPTURED_EVENT = 'mcgraw-plus-data-captured';

  // Capture state
  const CaptureState = {
    data: {
      userProfile: null,
      assignments: [],
      courses: [],
      sections: [],
      instructors: [],
      books: [],
    },
    notified: false,
    startTime: Date.now(),
    timeoutMs: 30000,
  };

  /**
   * Debug logger
   */
  function debug(...args) {
    if (DEBUG || window.__MCGRAW_PLUS_DEBUG) {
      console.log('[McGraw Plus DEBUG]', ...args);
    }
  }

  /**
   * Always log important info
   */
  function log(...args) {
    console.log('[McGraw Plus]', ...args);
  }

  /**
   * Dispatch captured data to bridge
   */
  function dispatchData(type, data) {
    window.dispatchEvent(new CustomEvent(DATA_CAPTURED_EVENT, {
      detail: { type, data, timestamp: Date.now() }
    }));
  }

  /**
   * Check if URL matches McGraw-Hill API patterns
   */
  function isRelevantEndpoint(url) {
    if (!url) return false;
    const lower = url.toLowerCase();

    // List of patterns we care about
    const patterns = [
      '/openapi/paam/',
      '/api/ccs/',
      '/caas/api/',
      '/api/ng/',
      '/svc/user/',
      'studentassignments',
      'sectionbooks',
      'instructorinfo',
      'userprofile',
      '/user/details',
      '/student/',
    ];

    return patterns.some(p => lower.includes(p));
  }

  /**
   * Process the main studentAssignments response
   * This is the MAIN endpoint that returns most data
   *
   * Endpoint: /openapi/paam/studentAssignments?student={id}&userType=null
   *
   * Response structure:
   * {
   *   studentAssignments: [...],
   *   attempts: [...],
   *   sections: [...],
   *   courses: [...],
   *   assignmentGroups: [...]
   * }
   */
  function processStudentAssignmentsResponse(data, url) {
    debug('Processing studentAssignments response:', url);

    // Extract COURSES from response
    if (data.courses && Array.isArray(data.courses)) {
      for (const course of data.courses) {
        const courseObj = {
          id: String(course.id),
          name: course.name || '',
          timeZone: course.timeZone || '',
          disciplineId: course.disciplineId || '',
          disciplineName: course.disciplineName || '',
          isSelfStudyEnabled: course.isSelfStudyEnabled || false,
          scrapedAt: Date.now(),
          source: 'studentAssignments',
        };

        // Check if already exists
        if (!CaptureState.data.courses.some(c => c.id === courseObj.id)) {
          CaptureState.data.courses.push(courseObj);
          debug('Added course:', courseObj.name);
        }
      }
      window.__mcgrawPlusCaptures.courses = [...CaptureState.data.courses];
    }

    // Extract SECTIONS from response (these have instructor info!)
    if (data.sections && Array.isArray(data.sections)) {
      for (const section of data.sections) {
        const sectionObj = {
          id: String(section.id),
          name: section.name || '',
          courseId: String(section.course || ''),
          instructorId: section.instructor || '',
          instructorName: section.instructorName || '',
          instructorEmail: section.instructorUserName || section.email || '',
          sectionUrl: section.sectionUrl || '',
          sectionBook: section.sectionBook || '',
          isArchived: section.isArchived || false,
          sectionXid: section.sectionXid || '',
          orgXid: section.orgXid || '',
          sectionAssignments: section.sectionAssignments || [],
          scrapedAt: Date.now(),
          source: 'studentAssignments',
        };

        // Check if already exists
        if (!CaptureState.data.sections.some(s => s.id === sectionObj.id)) {
          CaptureState.data.sections.push(sectionObj);
          debug('Added section:', sectionObj.name);

          // Also extract instructor from section
          if (sectionObj.instructorName) {
            const instructor = {
              id: sectionObj.instructorId,
              name: sectionObj.instructorName,
              email: sectionObj.instructorEmail,
              sectionId: sectionObj.id,
              capturedAt: Date.now(),
              source: 'studentAssignments.sections',
            };
            if (!CaptureState.data.instructors.some(i => i.id === instructor.id)) {
              CaptureState.data.instructors.push(instructor);
              debug('Added instructor:', instructor.name);
            }
          }
        }
      }
      window.__mcgrawPlusCaptures.sections = [...CaptureState.data.sections];
      window.__mcgrawPlusCaptures.instructors = [...CaptureState.data.instructors];
    }

    // Extract ASSIGNMENTS from studentAssignments
    if (data.studentAssignments && Array.isArray(data.studentAssignments)) {
      for (const assignment of data.studentAssignments) {
        // Find the section for this assignment
        const sectionId = assignment.section;
        const section = CaptureState.data.sections.find(s => s.id === sectionId);
        const course = section ? CaptureState.data.courses.find(c => c.id === section.courseId) : null;

        const assignmentObj = {
          id: assignment.id || '',
          sectionAssignment: assignment.sectionAssignment || '',
          sectionId: sectionId || '',
          sectionName: section?.name || '',
          courseName: course?.name || '',
          courseId: course?.id || '',
          status: assignment.status || '',
          // COMPLETE, IN_PROGRESS, NOT_STARTED, etc.
          completed: assignment.status === 'COMPLETE',
          inProgress: assignment.status === 'IN_PROGRESS',
          shpOrder: assignment.shpOrder,
          todoOrder: assignment.todoOrder,
          isTodo: assignment.isTodo || false,
          lateAssignmentAllowed: assignment.lateAssignmentAllowed || false,
          attempts: assignment.attempts || [],
          scrapedAt: Date.now(),
          source: 'studentAssignments',
        };

        if (!CaptureState.data.assignments.some(a => a.id === assignmentObj.id)) {
          CaptureState.data.assignments.push(assignmentObj);
          debug('Added assignment:', assignmentObj.id, 'status:', assignmentObj.status);
        }
      }
      window.__mcgrawPlusCaptures.assignments = [...CaptureState.data.assignments];
    }

    // Process ATTEMPTS for more details (score, progress, etc.)
    if (data.attempts && Array.isArray(data.attempts)) {
      for (const attempt of data.attempts) {
        // Find the matching assignment
        const assignmentId = attempt.studentAssignment;
        const assignment = CaptureState.data.assignments.find(a => a.id === assignmentId);

        if (assignment) {
          // Update assignment with attempt data
          assignment.attemptId = attempt.id;
          assignment.attemptNumber = attempt.attemptNumber;
          assignment.inProgress = attempt.inProgress;
          assignment.startDateTime = attempt.startDateTime;
          assignment.submittedDateTime = attempt.submittedDateTime;
          assignment.machineScore = attempt.machineScore;
          assignment.manualScore = attempt.manualScore;
          assignment.secondsSpent = attempt.secondsSpent;
          assignment.awaitingGrading = attempt.awaitingGrading;

          // Determine completion status
          if (attempt.submittedDateTime) {
            assignment.completed = true;
          } else if (attempt.inProgress) {
            assignment.completed = false;
            assignment.inProgress = true;
          }

          debug('Updated assignment with attempt data:', assignmentId);
        }
      }
    }

    // Dispatch all the data
    dispatchData('courses', CaptureState.data.courses);
    dispatchData('sections', CaptureState.data.sections);
    dispatchData('assignments', CaptureState.data.assignments);
    dispatchData('instructors', CaptureState.data.instructors);

    log('Processed studentAssignments:', {
      courses: CaptureState.data.courses.length,
      sections: CaptureState.data.sections.length,
      assignments: CaptureState.data.assignments.length,
      instructors: CaptureState.data.instructors.length,
    });
  }

  /**
   * Process user profile response
   */
  function processUserProfile(data, url) {
    debug('Processing user profile:', url);

    const profile = {
      firstName: '',
      lastName: '',
      name: '',
      email: '',
      userId: '',
      institutionId: '',
      institutionName: '',
      capturedAt: Date.now(),
      source: url,
    };

    // Try to extract from various nested structures
    function extract(obj) {
      if (!obj || typeof obj !== 'object') return;

      profile.firstName = profile.firstName || obj.firstName || obj.first_name || obj.givenName || '';
      profile.lastName = profile.lastName || obj.lastName || obj.last_name || obj.familyName || '';
      profile.email = profile.email || obj.email || obj.userEmail || obj.emailAddress || '';
      profile.userId = profile.userId || obj.userId || obj.user_id || obj.id || obj.studentId || '';
      profile.institutionId = profile.institutionId || obj.institutionId || obj.institution_id || '';
      profile.institutionName = profile.institutionName || obj.institutionName || obj.institution_name || obj.schoolName || '';

      // Check nested
      if (obj.user) extract(obj.user);
      if (obj.profile) extract(obj.profile);
      if (obj.data) extract(obj.data);
      if (obj.result) extract(obj.result);
    }

    extract(data);

    profile.name = `${profile.firstName} ${profile.lastName}`.trim();

    if (profile.name || profile.email || profile.userId) {
      CaptureState.data.userProfile = profile;
      window.__mcgrawPlusCaptures.profiles.push(profile);
      dispatchData('userProfile', profile);
      log('Captured user profile:', profile.name || profile.email || profile.userId);
    }
  }

  /**
   * Process instructor info response
   * Endpoint: /api/ccs/section/{sectionId}/instructorInfo?user={userId}
   */
  function processInstructorInfo(data, url) {
    debug('Processing instructor info:', url);

    // Extract sectionId from URL
    const sectionMatch = url.match(/section\/(\d+)\//);
    const sectionId = sectionMatch ? sectionMatch[1] : null;

    const instructor = {
      id: data.instructorId || data.id || data.userId || '',
      firstName: data.firstName || data.first_name || '',
      lastName: data.lastName || data.last_name || '',
      name: data.name || data.instructorName || data.displayName || '',
      email: data.email || data.instructorEmail || data.userEmail || '',
      sectionId: sectionId,
      capturedAt: Date.now(),
      source: url,
    };

    if (!instructor.name && (instructor.firstName || instructor.lastName)) {
      instructor.name = `${instructor.firstName} ${instructor.lastName}`.trim();
    }

    if (instructor.name || instructor.email) {
      if (!CaptureState.data.instructors.some(i => i.sectionId === instructor.sectionId)) {
        CaptureState.data.instructors.push(instructor);
        window.__mcgrawPlusCaptures.instructors.push(instructor);
        dispatchData('instructors', CaptureState.data.instructors);
        log('Captured instructor:', instructor.name);
      }
    }
  }

  /**
   * Process section books response
   * Endpoint: /openapi/paam/sectionBooks/{sectionId}
   */
  function processSectionBooks(data, url) {
    debug('Processing section books:', url);

    // Extract sectionId from URL
    const sectionMatch = url.match(/sectionBooks\/(\d+)/);
    const sectionId = sectionMatch ? sectionMatch[1] : null;

    // The response could be a single book or an array
    const books = Array.isArray(data) ? data : (data.books || data.resources || [data]);

    for (const book of books) {
      if (!book || typeof book !== 'object') continue;

      const bookObj = {
        isbn: book.isbn || book.isbn13 || book.isbn10 || '',
        title: book.title || book.bookTitle || book.name || '',
        author: book.author || book.authors || '',
        edition: book.edition || '',
        coverUrl: book.coverUrl || book.imageUrl || book.thumbnail || '',
        sectionId: sectionId,
        capturedAt: Date.now(),
        source: url,
      };

      if (bookObj.title || bookObj.isbn) {
        if (!CaptureState.data.books.some(b => b.isbn === bookObj.isbn || b.title === bookObj.title)) {
          CaptureState.data.books.push(bookObj);
          window.__mcgrawPlusCaptures.books.push(bookObj);
          dispatchData('books', CaptureState.data.books);
          log('Captured book:', bookObj.title || bookObj.isbn);
        }
      }
    }
  }

  /**
   * Process ISBN book info response
   * Endpoint: /api/ccs/tools/sharpen/isbn/{isbn}/info
   */
  function processIsbnInfo(data, url) {
    debug('Processing ISBN info:', url);

    // Extract ISBN from URL
    const isbnMatch = url.match(/isbn\/(\d+)\//);
    const isbn = isbnMatch ? isbnMatch[1] : '';

    const bookObj = {
      isbn: isbn || data.isbn || data.isbn13 || '',
      title: data.title || data.bookTitle || data.name || '',
      author: data.author || data.authors || '',
      edition: data.edition || '',
      coverUrl: data.coverUrl || data.imageUrl || data.thumbnail || '',
      capturedAt: Date.now(),
      source: url,
    };

    if (bookObj.title || bookObj.isbn) {
      if (!CaptureState.data.books.some(b => b.isbn === bookObj.isbn)) {
        CaptureState.data.books.push(bookObj);
        window.__mcgrawPlusCaptures.books.push(bookObj);
        dispatchData('books', CaptureState.data.books);
        log('Captured book (ISBN):', bookObj.title || bookObj.isbn);
      }
    }
  }

  /**
   * Main response processor - routes to specific handlers
   */
  function processResponse(url, data) {
    if (!url || !data) return;

    const lower = url.toLowerCase();

    // Store raw response for debugging
    if (DEBUG || window.__MCGRAW_PLUS_DEBUG) {
      window.__mcgrawPlusCaptures.rawResponses.push({
        url,
        timestamp: Date.now(),
        data: JSON.parse(JSON.stringify(data)), // Clone
      });
      window.__mcgrawPlusCaptures.endpoints.push({
        url,
        timestamp: Date.now(),
        keys: Object.keys(data),
      });
    }

    debug('Intercepted:', url.substring(0, 100));

    try {
      // Route to specific handler based on URL
      if (lower.includes('studentassignments')) {
        processStudentAssignmentsResponse(data, url);
      }
      else if (lower.includes('/user/details') || lower.includes('/userprofile') ||
               lower.includes('/user/profile') || lower.includes('/currentuser')) {
        processUserProfile(data, url);
      }
      else if (lower.includes('instructorinfo')) {
        processInstructorInfo(data, url);
      }
      else if (lower.includes('sectionbooks')) {
        processSectionBooks(data, url);
      }
      else if (lower.includes('/isbn/') && lower.includes('/info')) {
        processIsbnInfo(data, url);
      }
      else {
        // Generic processing - try to extract anything useful
        debug('Generic processing for:', url);

        // Check if response has user-like data
        if (data.userId || data.email || data.firstName) {
          processUserProfile(data, url);
        }
        // Check if response has course-like data
        if (data.courses || data.sections) {
          processStudentAssignmentsResponse(data, url);
        }
      }

      // Check if we should notify completion
      checkAndNotifyComplete();

    } catch (err) {
      console.warn('[McGraw Plus] Error processing response:', err);
    }
  }

  /**
   * Check if we have enough data to notify completion
   */
  function checkAndNotifyComplete() {
    if (CaptureState.notified) return;

    const hasProfile = CaptureState.data.userProfile?.name || CaptureState.data.userProfile?.userId;
    const hasCourses = CaptureState.data.courses.length > 0 || CaptureState.data.sections.length > 0;
    const hasAssignments = CaptureState.data.assignments.length > 0;

    // Need profile AND (courses OR sections OR assignments)
    if (hasProfile && (hasCourses || hasAssignments)) {
      CaptureState.notified = true;

      const summary = {
        hasProfile: true,
        courseCount: CaptureState.data.courses.length,
        sectionCount: CaptureState.data.sections.length,
        assignmentCount: CaptureState.data.assignments.length,
        instructorCount: CaptureState.data.instructors.length,
        bookCount: CaptureState.data.books.length,
      };

      dispatchData('complete', {
        profile: CaptureState.data.userProfile,
        summary,
      });

      log('Data capture complete:', summary);
    } else {
      debug('Waiting for more data. Have:', {
        profile: !!hasProfile,
        courses: CaptureState.data.courses.length,
        sections: CaptureState.data.sections.length,
        assignments: CaptureState.data.assignments.length,
      });
    }
  }

  /**
   * Intercept fetch API
   */
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;

      if (url && isRelevantEndpoint(url)) {
        const clone = response.clone();
        clone.json().then(data => {
          processResponse(url, data);
        }).catch(() => {});
      }
    } catch (err) {}

    return response;
  };

  /**
   * Intercept XMLHttpRequest
   */
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._mpUrl = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    const url = this._mpUrl;

    if (url && isRelevantEndpoint(url)) {
      this.addEventListener('load', function() {
        try {
          let data;
          if (this.responseType === '' || this.responseType === 'text') {
            data = JSON.parse(this.responseText);
          } else if (this.responseType === 'json') {
            data = this.response;
          }
          if (data) processResponse(url, data);
        } catch (err) {}
      });
    }

    return originalXHRSend.apply(this, args);
  };

  /**
   * Timeout - send partial data if we have any
   */
  setTimeout(() => {
    if (!CaptureState.notified) {
      const hasAnyData = CaptureState.data.courses.length > 0 ||
                         CaptureState.data.sections.length > 0 ||
                         CaptureState.data.assignments.length > 0;

      if (hasAnyData || CaptureState.data.userProfile) {
        log('Capture timeout, sending available data');
        CaptureState.notified = true;
        dispatchData('complete', {
          profile: CaptureState.data.userProfile,
          partial: true,
          summary: {
            hasProfile: !!CaptureState.data.userProfile,
            courseCount: CaptureState.data.courses.length,
            sectionCount: CaptureState.data.sections.length,
            assignmentCount: CaptureState.data.assignments.length,
            instructorCount: CaptureState.data.instructors.length,
            bookCount: CaptureState.data.books.length,
          },
        });
      } else {
        log('Capture timeout, no data found');
      }
    }
  }, CaptureState.timeoutMs);

  // Log initialization
  log('API interceptor v4.0 initialized');
  log('Debug mode:', DEBUG ? 'ON' : 'OFF (set window.__MCGRAW_PLUS_DEBUG = true to enable)');
  log('View captures: window.__mcgrawPlusCaptures');
})();
