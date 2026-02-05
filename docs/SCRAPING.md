# Data Capture Guide

## Overview

McGraw Plus captures assignment and course data from McGraw-Hill Connect pages using two methods:
1. **API Interception** - Captures data from API responses (primary method)
2. **DOM Scraping** - Fallback method for pages without API calls

## Supported Domains

| Domain | Purpose |
|--------|---------|
| `learning.mheducation.com` | SmartBook assignments |
| `connect.mheducation.com` | Connect dashboard (legacy) |
| `newconnect.mheducation.com` | New Connect interface |
| `connect.edu.mheducation.com` | Education Connect |
| `connect.router.integration.prod.mheducation.com` | Router integration |

---

## API Interception (Primary Method)

### How It Works

The extension injects `api-interceptor.js` at `document_start` in the **MAIN world** to intercept `fetch` and `XMLHttpRequest` responses before the page processes them.

```
Page loads
    │
    ▼
API Interceptor hooks fetch/XHR
    │
    ▼ Intercepts matching API responses
    │
    ▼ Extracts user/course/assignment data
    │
Custom Event → API Bridge (isolated world)
    │
    ▼
Chrome Storage (mp_user_profile, mp_courses, etc.)
    │
    ▼
Onboarding / Dashboard displays data
```

### Verified API Endpoints

These are the actual McGraw-Hill API endpoints captured by the extension (verified v4.0):

#### Main Data Endpoint: `/openapi/paam/studentAssignments`

**URL Pattern:** `/openapi/paam/studentAssignments?student={studentId}&userType=null`

This is the primary endpoint that returns most data in a single response:

```json
{
  "studentAssignments": [...],
  "attempts": [...],
  "sections": [...],
  "courses": [...],
  "assignmentGroups": [...]
}
```

**`courses[]` Structure:**
```json
{
  "id": 123456,
  "name": "Introduction to Psychology",
  "timeZone": "America/Chicago",
  "disciplineId": "psychology",
  "disciplineName": "Psychology",
  "isSelfStudyEnabled": false
}
```

**`sections[]` Structure (includes instructor!):**
```json
{
  "id": 789012,
  "name": "PSY 101 - Fall 2026",
  "course": 123456,
  "instructor": "i456",
  "instructorName": "Dr. John Smith",
  "instructorUserName": "jsmith@example.edu",
  "sectionUrl": "https://...",
  "sectionBook": "978-0-12-345678-9",
  "isArchived": false,
  "sectionXid": "...",
  "orgXid": "...",
  "sectionAssignments": [...]
}
```

**`studentAssignments[]` Structure:**
```json
{
  "id": "sa123",
  "sectionAssignment": "a456",
  "section": 789012,
  "status": "IN_PROGRESS",
  "shpOrder": 1,
  "todoOrder": 2,
  "isTodo": true,
  "lateAssignmentAllowed": false,
  "attempts": [...]
}
```

**`attempts[]` Structure:**
```json
{
  "id": "att789",
  "studentAssignment": "sa123",
  "attemptNumber": 1,
  "inProgress": true,
  "startDateTime": "2026-02-01T10:00:00Z",
  "submittedDateTime": null,
  "machineScore": 85.5,
  "manualScore": null,
  "secondsSpent": 1800,
  "awaitingGrading": false
}
```

**Status Values:**
- `COMPLETE` - Assignment finished
- `IN_PROGRESS` - Currently working
- `NOT_STARTED` - Not yet begun

---

#### User Profile: `/caas/api/user/details`

**URL Patterns:**
```
/caas/api/user/details
/api/ccs/user/profile
/api/ng/userprofile
/svc/user/profile
```

**Response Structure:**
```json
{
  "userId": "12345678",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane.doe@example.edu",
  "institutionId": "u123",
  "institutionName": "Example University",
  "schoolName": "Example University"
}
```

---

#### Instructor Info: `/api/ccs/section/{sectionId}/instructorInfo`

**URL Pattern:** `/api/ccs/section/{sectionId}/instructorInfo?user={userId}`

**Response Structure:**
```json
{
  "instructorId": "i456",
  "firstName": "John",
  "lastName": "Smith",
  "name": "Dr. John Smith",
  "email": "jsmith@example.edu",
  "displayName": "Dr. John Smith"
}
```

---

#### Section Books: `/openapi/paam/sectionBooks/{sectionId}`

**Response Structure:**
```json
[
  {
    "isbn": "978-0-12-345678-9",
    "isbn13": "9780123456789",
    "title": "Psychology: An Introduction",
    "author": "Smith & Jones",
    "edition": "5th",
    "coverUrl": "https://...",
    "imageUrl": "https://..."
  }
]
```

---

#### Book Info by ISBN: `/api/ccs/tools/sharpen/isbn/{isbn}/info`

**URL Pattern:** `/api/ccs/tools/sharpen/isbn/{isbn}/info?userRole=learner`

**Response Structure:**
```json
{
  "isbn": "978-0-12-345678-9",
  "title": "Psychology: An Introduction",
  "bookTitle": "Psychology: An Introduction",
  "author": "Smith & Jones",
  "edition": "5th Edition",
  "coverUrl": "https://..."
}
```

---

### Intercept Pattern Matching

The interceptor checks URLs against these patterns:

```javascript
const patterns = [
  '/openapi/paam/',         // Main PAAM API
  '/api/ccs/',              // CCS API
  '/caas/api/',             // CAAS API
  '/api/ng/',               // NG API
  '/svc/user/',             // User service
  'studentassignments',     // Assignment endpoint
  'sectionbooks',           // Books endpoint
  'instructorinfo',         // Instructor endpoint
  'userprofile',            // Profile endpoint
  '/user/details',          // User details
  '/student/',              // Student endpoints
];
```

### Data Extraction

The interceptor uses recursive extraction to handle nested response structures:

```javascript
// Searches common field names across nested objects
function extract(obj) {
  if (!obj || typeof obj !== 'object') return;

  profile.firstName = profile.firstName || obj.firstName || obj.first_name || obj.givenName || '';
  profile.lastName = profile.lastName || obj.lastName || obj.last_name || obj.familyName || '';
  profile.email = profile.email || obj.email || obj.userEmail || obj.emailAddress || '';
  // ... more fields

  // Check nested structures
  if (obj.user) extract(obj.user);
  if (obj.profile) extract(obj.profile);
  if (obj.data) extract(obj.data);
  if (obj.result) extract(obj.result);
}
```

---

## DOM Scraping (Fallback)

### When Used

DOM scraping activates when API interception doesn't capture data, or for supplementary information.

### Supported Page Types

| Page Type | Detection |
|-----------|-----------|
| `newconnect-todo` | `/student/todo` path |
| `newconnect-calendar` | `/student/calendar` path |
| `newconnect-class` | `/student/class/section` path |
| `newconnect-results` | `/student/results` path |
| `connect-home` | `connect.mheducation.com/connect/home` |
| `connect-section` | `/connect/section/` path |

### Selectors Reference

**Course Selectors:**
```javascript
courseCard: '.course-card, .course-tile, [data-course-id], .cui-card'
courseName: '.course-card-title, .course-title, .cui-card-title, h3, h4'
courseLink: 'a[href*="section"], a[href*="course"]'
```

**Assignment Selectors:**
```javascript
assignmentRow: '.assignment-row, .assignment-item, [data-assignment-id]'
assignmentName: '.assignment-name, .activity-name, .assignment-title'
assignmentDueDate: '.due-date, .due-column, td.due, [data-due]'
assignmentStatus: '.status, .status-column, .completion-status'
```

**To-Do List Selectors:**
```javascript
todoItem: '.todo-item, .task-item, [class*="todo"]'
todoName: '.task-name, .todo-title, .item-title'
todoDue: '.task-due-date, .todo-due, .item-due'
```

---

## Storage Schema

### User Profile (`mp_user_profile`)
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "name": "Jane Doe",
  "email": "jane.doe@example.edu",
  "userId": "12345678",
  "institutionId": "u123",
  "institutionName": "Example University",
  "capturedAt": 1707166800000,
  "source": "/caas/api/user/details"
}
```

### Courses (`mp_courses`)
```json
[
  {
    "id": "123456",
    "name": "Introduction to Psychology",
    "timeZone": "America/Chicago",
    "disciplineId": "psychology",
    "disciplineName": "Psychology",
    "isSelfStudyEnabled": false,
    "scrapedAt": 1707166800000,
    "source": "studentAssignments"
  }
]
```

### Sections (`mp_sections`)
```json
[
  {
    "id": "789012",
    "name": "PSY 101 - Fall 2026",
    "courseId": "123456",
    "instructorId": "i456",
    "instructorName": "Dr. John Smith",
    "instructorEmail": "jsmith@example.edu",
    "sectionUrl": "https://...",
    "sectionBook": "978-0-12-345678-9",
    "isArchived": false,
    "sectionXid": "...",
    "orgXid": "...",
    "sectionAssignments": [],
    "scrapedAt": 1707166800000,
    "source": "studentAssignments"
  }
]
```

### Assignments (`mp_due_dates`)
```json
[
  {
    "id": "sa123",
    "sectionAssignment": "a456",
    "sectionId": "789012",
    "sectionName": "PSY 101 - Fall 2026",
    "courseName": "Introduction to Psychology",
    "courseId": "123456",
    "status": "IN_PROGRESS",
    "completed": false,
    "inProgress": true,
    "shpOrder": 1,
    "todoOrder": 2,
    "isTodo": true,
    "lateAssignmentAllowed": false,
    "attemptId": "att789",
    "attemptNumber": 1,
    "startDateTime": "2026-02-01T10:00:00Z",
    "submittedDateTime": null,
    "machineScore": 85.5,
    "manualScore": null,
    "secondsSpent": 1800,
    "awaitingGrading": false,
    "scrapedAt": 1707166800000,
    "source": "studentAssignments"
  }
]
```

### Instructors (`mp_instructors`)
```json
[
  {
    "id": "i456",
    "firstName": "John",
    "lastName": "Smith",
    "name": "Dr. John Smith",
    "email": "jsmith@example.edu",
    "sectionId": "789012",
    "capturedAt": 1707166800000,
    "source": "studentAssignments.sections"
  }
]
```

### Books (`mp_books`)
```json
[
  {
    "isbn": "978-0-12-345678-9",
    "title": "Psychology: An Introduction",
    "author": "Smith & Jones",
    "edition": "5th",
    "coverUrl": "https://...",
    "sectionId": "789012",
    "capturedAt": 1707166800000,
    "source": "/openapi/paam/sectionBooks/789012"
  }
]
```

### Capture State (`mp_capture_state`)
```json
{
  "complete": true,
  "partial": false,
  "summary": {
    "hasProfile": true,
    "courseCount": 2,
    "sectionCount": 3,
    "assignmentCount": 15,
    "instructorCount": 2,
    "bookCount": 3
  },
  "timestamp": 1707166800000
}
```

---

## Multi-Tab Coordination

Only one tab per domain actively scrapes to prevent duplicate data:

```javascript
async acquireScraperLock() {
  const domain = window.location.hostname;
  const lockKey = `mp_active_scraper_tab_${domain}`;

  const existingLock = result[lockKey];
  if (existingLock && Date.now() - existingLock.timestamp < 30000) {
    return false; // Another tab has the lock
  }

  // Acquire lock with heartbeat
  // ...
}
```

---

## Date Parsing

Supported date formats:

| Format | Example |
|--------|---------|
| ISO 8601 | `2026-02-15T23:59:00Z` |
| `MMM DD, YYYY` | `Feb 15, 2026` |
| `MMMM DD, YYYY` | `February 15, 2026` |
| `MM/DD/YYYY` | `02/15/2026` |
| `DD MMM YYYY` | `15 Feb 2026` |
| `Due: MMM DD` | `Due: Feb 15` |

---

## Error Handling

### Retry Logic

Failed operations retry with exponential backoff:

```javascript
async scanWithRetry() {
  try {
    await this.scan();
    this.retryCount = 0;
  } catch (error) {
    if (this.retryCount < 3) {
      this.retryCount++;
      const delay = 1000 * Math.pow(2, this.retryCount - 1);
      setTimeout(() => this.scanWithRetry(), delay);
    }
  }
}
```

### Timeout Handling

API interception has a 30-second timeout. If complete profile data isn't captured, partial data is saved.

---

## Debugging

### Enable Debug Mode

Enable verbose logging by setting in browser console:

```javascript
window.__MCGRAW_PLUS_DEBUG = true
```

### View Captured Data

All intercepted data is stored for inspection:

```javascript
// View all captured data
window.__mcgrawPlusCaptures

// Structure:
{
  endpoints: [],      // All intercepted URLs with timestamps
  profiles: [],       // User profile captures
  courses: [],        // Course data
  sections: [],       // Section data with instructors
  assignments: [],    // Assignment data
  instructors: [],    // Instructor data
  books: [],          // Book/textbook data
  rawResponses: [],   // Raw API responses (debug mode only)
}
```

### Console Logs

Filter for `[McGraw Plus]` in console:

```
[McGraw Plus] API interceptor v4.0 initialized
[McGraw Plus] Debug mode: OFF (set window.__MCGRAW_PLUS_DEBUG = true to enable)
[McGraw Plus] View captures: window.__mcgrawPlusCaptures
[McGraw Plus] Processed studentAssignments: {courses: 2, sections: 3, assignments: 15, instructors: 2}
[McGraw Plus] Captured user profile: Jane Doe
[McGraw Plus] Data capture complete: {hasProfile: true, courseCount: 2, ...}
```

### Debug Mode Logs

When debug mode is enabled:

```
[McGraw Plus DEBUG] Processing studentAssignments response: /openapi/paam/studentAssignments...
[McGraw Plus DEBUG] Added course: Introduction to Psychology
[McGraw Plus DEBUG] Added section: PSY 101 - Fall 2026
[McGraw Plus DEBUG] Added instructor: Dr. John Smith
[McGraw Plus DEBUG] Added assignment: sa123 status: IN_PROGRESS
```

---

## Performance

- API interception adds minimal overhead (< 1ms per request)
- DOM scraping debounced to 1 second
- MutationObserver only triggers on relevant DOM changes
- Visibility-based scraping reduces activity when tab is hidden
