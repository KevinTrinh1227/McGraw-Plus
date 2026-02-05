# McGraw Plus - Architecture Overview

## Introduction

McGraw Plus is a Chrome extension that enhances the McGraw-Hill Connect and SmartBook study experience. It provides features like dark mode, keyboard shortcuts, due date tracking, and study statistics.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Chrome Extension                              │
├──────────────┬──────────────┬──────────────┬────────────────────────────┤
│   Popup UI   │  Dashboard   │  Background  │      Content Scripts       │
│  popup.html  │ dashboard.js │ service-     │  api-interceptor.js (MAIN) │
│  popup.js    │              │ worker.js    │  api-bridge.js (isolated)  │
│              │              │              │  main.js, scraper.js       │
└──────┬───────┴──────┬───────┴──────┬───────┴──────────────┬─────────────┘
       │              │              │                      │
       └──────────────┴──────────────┴──────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │       Chrome Storage (local)    │
                    │  mp_user_profile, mp_courses,   │
                    │  mp_sections, mp_due_dates,     │
                    │  mp_instructors, mp_books,      │
                    │  mp_capture_state, mp_settings  │
                    └─────────────────────────────────┘
```

## Components

### 1. Popup UI (`src/popup/`)

The main user interface accessed via the extension icon.

**Features:**
- Power toggle for solver enable/disable
- Quick stats (questions answered, correct, streak)
- Settings management with categorized toggles
- Navigation to dashboard

### 2. Dashboard (`src/dashboard/`)

Full-featured dashboard with multiple tabs.

**Components:**
- Calendar with assignment deadlines
- To-do list with filtering and sorting
- Statistics and activity heatmap
- Flashcard review system
- Export functionality (PDF, JSON)

### 3. Background Service Worker (`src/background/`)

Handles extension lifecycle and background tasks.

**Responsibilities:**
- Extension installation/update handling
- Alarm-based due date reminders
- Context menu management
- Keyboard shortcut commands
- Onboarding tab management with lock mechanism
- Legacy data migration

### 4. Content Scripts (`src/content/`)

Injected into McGraw-Hill pages.

**Scripts:**

| Script | World | Run At | Purpose |
|--------|-------|--------|---------|
| `api-interceptor.js` | MAIN | document_start | Intercepts fetch/XHR to capture API data (v4.0) |
| `api-bridge.js` | Isolated | document_end | Bridges MAIN world events to chrome.storage |
| `assignment-scraper.js` | Isolated | document_end | DOM scraping fallback |
| `main.js` | Isolated | document_end | Core functionality, feature toggles |

**API Interceptor (v4.0) Features:**
- Intercepts `/openapi/paam/studentAssignments` for courses, sections, assignments
- Captures instructor info from sections automatically
- Debug mode: `window.__MCGRAW_PLUS_DEBUG = true`
- View captures: `window.__mcgrawPlusCaptures`
- 30-second timeout with partial data fallback
- Context invalidation handling for extension reloads

**CSS Files:**
- `dark-mode.css` - Dark theme styles
- `focus-mode.css` - Distraction-free mode
- `progress-bar.css` - Floating progress indicator
- `overlay.css` - UI overlays

### 5. Onboarding (`src/onboarding/`)

First-time setup experience (4 slides).

**Flow:**
1. Welcome + Profile display
2. Data overview (courses, assignments, instructors, books)
3. Features introduction
4. Completion with confetti

### 6. Shared Modules (`src/shared/`)

Common utilities used across components.

- `storage.js` - Chrome storage abstraction
- `utils.js` - Common utilities
- `messaging.js` - Message passing helpers

---

## Data Flow

### API Interception (Primary)

```
McGraw-Hill Page loads
       │
       ▼
API Interceptor (MAIN world)
       │ hooks fetch() and XMLHttpRequest
       ▼
Intercepts API responses
       │ matches user/course/assignment patterns
       ▼
Dispatches CustomEvent
       │
       ▼
API Bridge (isolated world)
       │ receives event
       ▼
Chrome Storage
       │
       ▼
Popup / Dashboard / Onboarding
```

### DOM Scraping (Fallback)

```
McGraw-Hill Page
       │
       ▼
Content Script (assignment-scraper.js)
       │ detects page type
       ▼
Scrapes courses, assignments, due dates
       │
       ▼
Chrome Storage (mp_due_dates, mp_courses)
       │
       ▼
Popup / Dashboard displays data
```

### Settings Flow

```
User changes setting in Popup/Dashboard
       │
       ▼
Chrome Storage update (mp_settings)
       │
       ▼
Content script storage listener
       │
       ▼
Feature enabled/disabled on page
```

---

## Storage Keys

### Core Data

| Key | Description |
|-----|-------------|
| `mp_user_profile` | User info (name, email, userId, institution) |
| `mp_courses` | Course information (id, name, discipline, timezone) |
| `mp_sections` | Section information (id, name, courseId, instructor) |
| `mp_due_dates` | Assignment data with status and attempt info |
| `mp_instructors` | Instructor information per section |
| `mp_books` | Textbook/material information |
| `mp_capture_state` | API capture progress and summary |

### User Preferences

| Key | Description |
|-----|-------------|
| `mp_settings` | Feature toggle preferences |
| `mp_user_name` | Display name for UI |

### State Management

| Key | Description |
|-----|-------------|
| `mp_onboarding_complete` | Whether onboarding finished |
| `mp_onboarding_completed_at` | Completion timestamp |
| `mp_terms_accepted` | Terms acceptance status |
| `mp_onboarding_lock` | Lock to prevent duplicate tabs |
| `mp_onboarding_tab_id` | Active onboarding tab ID |
| `mp_dashboard_tab_id` | Active dashboard tab ID |
| `mp_capture_state` | API capture progress |

### Statistics

| Key | Description |
|-----|-------------|
| `mp_stats` | Study statistics and streaks |
| `mp_flashcards` | Generated flashcards |

### Legacy

| Key | Description |
|-----|-------------|
| `isBotEnabled` | Solver enabled state (legacy compatibility) |
| `responseMap` | Cached Q&A pairs |

---

## Supported Domains

| Domain | Purpose |
|--------|---------|
| `learning.mheducation.com` | SmartBook assignments |
| `connect.mheducation.com` | Connect dashboard (legacy) |
| `newconnect.mheducation.com` | New Connect interface |
| `connect.edu.mheducation.com` | Education Connect |
| `connect.router.integration.prod.mheducation.com` | Router integration |

---

## External Services

All external connections are optional and user-initiated:

| Service | Purpose | When Used |
|---------|---------|-----------|
| Discord Webhooks | Session notifications | User configures webhook URL |
| Groq API | AI hints | User provides API key |
| OpenAI API | AI hints | User provides API key |
| Anthropic API | AI hints | User provides API key |

**No data is sent to external servers without explicit user configuration.**

---

## Content Script Injection

The extension uses split content script configuration in `manifest.json`:

```json
"content_scripts": [
  {
    "matches": ["*://learning.mheducation.com/*", ...],
    "js": ["content/api-interceptor.js"],
    "run_at": "document_start",
    "world": "MAIN"
  },
  {
    "matches": ["*://learning.mheducation.com/*", ...],
    "js": ["content/api-bridge.js", "content/main.js", ...],
    "css": ["content/dark-mode.css", ...],
    "run_at": "document_end"
  }
]
```

**Why MAIN world for api-interceptor.js:**
- Must intercept fetch/XHR before page JavaScript executes
- Requires access to window.fetch and XMLHttpRequest.prototype
- Uses CustomEvents to communicate with isolated world bridge

---

## Lock Mechanisms

### Onboarding Lock

Prevents duplicate onboarding tabs:

```javascript
// 30-second expiration
if (lock && Date.now() - lock.timestamp < 30000) {
  return false; // Lock held by another process
}
```

### Scraper Lock

Prevents duplicate scraping across tabs:

```javascript
// Per-domain lock with heartbeat
const lockKey = `mp_active_scraper_tab_${domain}`;
```

---

## Error Handling

- **API Interception:** Silent failure, logs to console
- **DOM Scraping:** Retry with exponential backoff (3 attempts)
- **Storage:** Graceful recovery from cleared storage
- **Network:** Timeout after 30 seconds, partial data saved

---

## Performance Considerations

- API interception adds < 1ms overhead per request
- DOM scraping debounced to 1 second intervals
- MutationObserver for efficient DOM change detection
- Visibility-based scraping (reduced activity when tab hidden)
- Storage writes batched to reduce I/O
