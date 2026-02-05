# McGraw Plus - Architecture Overview

## Introduction

McGraw Plus is a Chrome extension that enhances the McGraw-Hill Connect and SmartBook study experience. It provides features like dark mode, keyboard shortcuts, due date tracking, and study statistics.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Chrome Extension                        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Popup UI   │  Dashboard   │  Background  │ Content Scripts │
│  popup.html  │ dashboard.js │ service-     │    main.js      │
│  popup.js    │              │ worker.js    │    scraper.js   │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       └──────────────┴──────────────┴────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Chrome Storage   │
                    │     (local)       │
                    └───────────────────┘
```

## Components

### 1. Popup UI (`src/popup/`)

The main user interface accessed via the extension icon.

**Features:**
- Power toggle for enabling/disabling
- Quick stats (questions, correct, streak)
- Settings management
- Star verification for premium features

### 2. Dashboard (`src/dashboard/`)

Full-featured dashboard with multiple tabs.

**Components:**
- Calendar with assignment deadlines
- To-do list with filtering
- Statistics and activity heatmap
- Flashcard review system
- Export functionality

### 3. Background Service Worker (`src/background/`)

Handles extension lifecycle and background tasks.

**Responsibilities:**
- Extension installation/update handling
- Alarm-based notifications
- Context menu management
- Command handling (keyboard shortcuts)

### 4. Content Scripts (`src/content/`)

Injected into McGraw-Hill pages to enhance functionality.

**Scripts:**
- `main.js` - Core functionality, feature toggles
- `assignment-scraper.js` - Auto-scrapes assignment data
- CSS files for dark mode, focus mode, etc.

### 5. Onboarding (`src/onboarding/`)

First-time setup experience.

**Slides:**
0. Version check
1. Terms of service
2. Personalized welcome
3. Connect login verification
4. Feature selection
5. Pin extension guide
6. Completion with confetti

### 6. Shared Modules (`src/shared/`)

Common utilities used across components.

- `storage.js` - Chrome storage abstraction
- `utils.js` - Common utilities
- `messaging.js` - Message passing

## Data Flow

### Assignment Scraping

```
McGraw-Hill Page
       │
       ▼
Content Script (assignment-scraper.js)
       │
       ▼ Detects courses, assignments, due dates
       │
Chrome Storage (mp_due_dates, mp_courses)
       │
       ▼
Popup / Dashboard (displays data)
```

### Settings Flow

```
User changes setting in Popup
       │
       ▼
Storage update (mp_settings)
       │
       ▼
Content script listens for changes
       │
       ▼
Feature enabled/disabled on page
```

## Storage Keys

| Key | Description |
|-----|-------------|
| `mp_settings` | User preferences |
| `mp_stats` | Study statistics |
| `mp_due_dates` | Assignment deadlines |
| `mp_courses` | Course information |
| `mp_flashcards` | Generated flashcards |
| `mp_user_name` | User's name |
| `mp_onboarding_complete` | Onboarding status |
| `mp_terms_accepted` | Terms acceptance |

## External Services

All external connections are optional:

1. **GitHub API** - Star verification
2. **Discord Webhooks** - Session notifications
3. **AI Providers** - Optional hints (Groq, OpenAI, Anthropic)

## Supported URLs

| Pattern | Purpose |
|---------|---------|
| `learning.mheducation.com/*` | SmartBook assignments |
| `connect.mheducation.com/*` | Connect dashboard |
| `newconnect.mheducation.com/*` | New Connect interface |
| `connect.router.integration.prod.mheducation.com/*` | Router integration |

## Version Control

The extension uses `version.json` for remote configuration:

```json
{
  "version": "2.2.0",
  "minVersion": "2.0.0",
  "killSwitch": false,
  "forceUpdate": false
}
```

This allows for:
- Force updates when critical bugs are found
- Kill switch for emergency situations
- Version comparison for update notifications
