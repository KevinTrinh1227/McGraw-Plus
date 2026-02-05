# Data Scraping Guide

## Overview

McGraw Plus automatically scrapes assignment and course data from McGraw-Hill Connect pages. This happens transparently in the background, requiring no user interaction.

## Supported Pages

### Legacy Connect
- `connect.mheducation.com/connect/home` - Dashboard
- `connect.mheducation.com/connect/section/*` - Course sections
- `connect.mheducation.com/connect/course/*` - Course pages

### New Connect
- `newconnect.mheducation.com/student/todo` - To-do list
- `newconnect.mheducation.com/student/calendar/month` - Calendar view
- `newconnect.mheducation.com/student/class/section/*` - Class details
- `newconnect.mheducation.com/student/results/*` - Results/grades

### Router Integration
- `connect.router.integration.prod.mheducation.com/app/#/connect/coversheet`

## How It Works

### 1. Page Detection

The scraper first determines the page type:

```javascript
getPageType() {
  const url = window.location.href.toLowerCase();

  if (url.includes('newconnect.mheducation.com')) {
    if (path.includes('/student/todo')) return 'newconnect-todo';
    if (path.includes('/student/calendar')) return 'newconnect-calendar';
    // ...
  }
  // ...
}
```

### 2. Multi-Tab Coordination

Only one tab per domain scrapes at a time to prevent duplicate data:

```javascript
async acquireScraperLock() {
  const domain = window.location.hostname;
  const lockKey = `mp_active_scraper_tab_${domain}`;

  // Check if lock is stale (older than 30 seconds)
  const existingLock = result[lockKey];
  if (existingLock && Date.now() - existingLock.timestamp < 30000) {
    return false; // Another tab has the lock
  }

  // Acquire lock with heartbeat
  // ...
}
```

### 3. User Profile Extraction

The scraper extracts user information from multiple selectors:

```javascript
SELECTORS: {
  userProfile: [
    '.cui-user-menu .user-name',
    '.nav-sidebar .user-name',
    '.sidebar-profile .name',
    '[data-testid="user-profile-name"]',
    // ... more selectors
  ]
}
```

### 4. Assignment Scanning

Assignments are found using multiple methods:

1. **Table-based layouts** - Traditional HTML tables
2. **Card/list layouts** - Modern card-based UI
3. **Generic due date elements** - Any element with due date

### 5. Data Persistence

Data is merged with existing data, preserving:
- Existing completion status
- Historical assignments (up to 90 days)

## Selectors Reference

### Course Selectors
```javascript
courseCard: '.course-card, .course-tile, [data-course-id], .cui-card'
courseName: '.course-card-title, .course-title, .cui-card-title, h3, h4'
courseLink: 'a[href*="section"], a[href*="course"]'
```

### Assignment Selectors
```javascript
assignmentRow: '.assignment-row, .assignment-item, [data-assignment-id]'
assignmentName: '.assignment-name, .activity-name, .assignment-title'
assignmentDueDate: '.due-date, .due-column, td.due, [data-due]'
assignmentStatus: '.status, .status-column, .completion-status'
```

### To-Do List Selectors
```javascript
todoItem: '.todo-item, .task-item, [class*="todo"]'
todoName: '.task-name, .todo-title, .item-title'
todoDue: '.task-due-date, .todo-due, .item-due'
```

### Calendar Selectors
```javascript
calendarEvent: '.calendar-event, [class*="event"], .fc-event'
eventTitle: '.event-title, .event-name, .fc-title'
eventDate: '.event-date, [data-date], .fc-day'
```

## Date Parsing

The scraper handles multiple date formats:

| Pattern | Example |
|---------|---------|
| `MMM DD, YYYY` | "Jan 15, 2026" |
| `MMMM DD, YYYY` | "January 15, 2026" |
| `MM/DD/YYYY` | "01/15/2026" |
| `YYYY-MM-DD` | "2026-01-15" |
| `DD MMM YYYY` | "15 Jan 2026" |
| `Due: MMM DD` | "Due: Jan 15" |

Time extraction (if present):
```javascript
const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
```

## Error Handling

### Retry Logic

Failed scans are retried with exponential backoff:

```javascript
async scanWithRetry() {
  try {
    await this.scan();
    this.retryCount = 0;
  } catch (error) {
    if (this.retryCount < this.MAX_RETRY_COUNT) {
      this.retryCount++;
      const delay = this.RETRY_DELAY_MS * Math.pow(2, this.retryCount - 1);
      setTimeout(() => this.scanWithRetry(), delay);
    }
  }
}
```

### Storage Recovery

If storage is cleared, the scraper gracefully recovers:

```javascript
async checkStorageHealth() {
  const marker = await this.get('mp_storage_marker');
  if (!marker) {
    // Storage was cleared, reinitialize
    await this.set('mp_storage_marker', { createdAt: Date.now() });
    return false;
  }
  return true;
}
```

## Performance

- Scans are debounced (1 second)
- Minimum interval between scans (5 seconds)
- MutationObserver only triggers on relevant changes
- Visibility-based scanning (reduce activity when tab hidden)

## Debugging

Enable console logging by checking for `[McGraw Plus]` prefix:

```
[McGraw Plus] Assignment scraper initializing... newconnect-todo
[McGraw Plus] Loaded 3 courses, 12 assignments from cache
[McGraw Plus] Found 5 assignments
[McGraw Plus] Saved 3 courses, 12 assignments
```
