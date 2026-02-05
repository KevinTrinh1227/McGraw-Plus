# Features Guide

## Data Capture

McGraw Plus automatically captures your account data when you visit McGraw-Hill Connect:

| Data | Storage Key | Description |
|------|-------------|-------------|
| User Profile | `mp_user_profile` | Name, email, student ID, institution |
| Courses | `mp_courses` | Course names, disciplines, timezones |
| Sections | `mp_sections` | Section info with instructor details |
| Assignments | `mp_due_dates` | All assignments with status and scores |
| Instructors | `mp_instructors` | Instructor names and emails |
| Textbooks | `mp_books` | Book titles, ISBNs, authors |

**How it works:**
- API interceptor captures responses from McGraw-Hill's own API calls
- No extra network requests are made
- All data stored locally in your browser

See [Data Capture Guide](SCRAPING.md) for technical details.

---

## Appearance

### Dark Mode
Applies a comfortable dark theme to SmartBook and Connect pages.

**Toggle:** Settings > General > Dark Mode
**Shortcut:** `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac)

The dark theme:
- Reduces eye strain for late-night studying
- Uses carefully chosen contrast ratios
- Preserves readability of content

### Readability Mode
Improves text formatting for easier reading.

**Toggle:** Settings > General (Advanced)

Features:
- Increased line height
- Optimized font sizing
- Better paragraph spacing

---

## Productivity

### Keyboard Shortcuts
Navigate SmartBook faster with keyboard controls.

**Toggle:** Settings > General > Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `1-4` or `A-D` | Select answer option |
| `Enter` or `Space` | Submit answer |
| `→` | Next question |
| `←` | Previous question |
| `Ctrl+Shift+D` | Toggle dark mode |
| `Ctrl+Shift+F` | Toggle focus mode |
| `Ctrl+Shift+M` | Open Dashboard |

### Focus Mode
Hides distractions and expands the content area.

**Toggle:** Settings > Advanced
**Shortcut:** `Ctrl+Shift+F`

Hides:
- Navigation elements
- Sidebars
- Non-essential UI

### Quick Copy
Copy questions with one click for external research.

**Toggle:** Settings > Advanced

Adds a copy button to each question that copies:
- Question text
- Answer options (for multiple choice)
- Context if available

### Tab Title Progress
Shows assignment progress in the browser tab.

**Toggle:** Settings > General > Tab Title Progress

Format: `[45%] Assignment Name`

### Auto Resume
Automatically continues where you left off.

**Toggle:** Settings > Advanced

Saves your position and restores it when you return.

### Study Timer
Pomodoro-style timer for productive study sessions.

**Toggle:** Settings > Advanced

Default intervals:
- Focus: 25 minutes
- Short break: 5 minutes
- Long break: 15 minutes

---

## Organization

### Due Date Tracker
Automatically tracks assignment deadlines.

**Toggle:** Settings > General > Due Date Tracker

Features:
- Auto-detection from Connect pages
- Dashboard calendar view
- Upcoming deadlines widget

### Notifications
Browser notifications for reminders.

**Toggle:** Settings > General > Notifications

Notification types:
- Assignment due in 24 hours
- Assignment due in 1 hour
- Study streak reminders

---

## Study Tools

### Flashcard Generator
Creates flashcards from questions for review.

**Toggle:** Settings > Advanced

Access via Dashboard > Flashcards tab.

Features:
- Auto-generation from Q&A pairs
- Manual flashcard creation
- Spaced repetition scheduling
- Export to Anki/Quizlet

### PDF Export
Export questions and answers to PDF.

**Toggle:** Settings > Advanced

Export options:
- All Q&A pairs
- Filtered by course
- Include/exclude answers

### Confidence Marker
Track your confidence level on each question.

**Toggle:** Settings > Advanced

Confidence levels:
- Low (will review)
- Medium (somewhat confident)
- High (got it)

---

## Analytics

### Stats Tracker
Tracks your study progress over time.

**Toggle:** Settings > General

Tracked metrics:
- Total questions answered
- Correct on first try
- Study streak (consecutive days)
- Time spent studying
- Questions by type

### Progress Bar
Floating visual indicator of assignment completion.

**Toggle:** Settings > General > Progress Bar

Shows:
- Current progress percentage
- Questions remaining
- Time estimate (if available)

---

## Accessibility

### Text Selection
Enables copy/paste on pages where it's normally restricted.

**Toggle:** Settings > General > Enable Text Selection

Removes CSS restrictions that prevent:
- Text selection
- Right-click menu
- Copy/paste operations

---

## Integrations

### Discord Webhooks
Receive notifications in Discord.

**Setup:** Settings > Advanced > Discord Webhook

Notifications for:
- Study sessions start/end
- Assignment completions
- Achievement unlocks

### AI Assistant
Get hints using AI providers.

**Setup:** Settings > Advanced > AI Assistant

Supported providers:
- **Groq** (Free) - Llama 3.3 70B
- **OpenAI** - GPT-4o-mini
- **Anthropic** - Claude 3 Haiku

Usage:
1. Enable AI Assistant
2. Select provider
3. Enter API key
4. Click "Test" to verify

---

## Dashboard

Access the full-featured dashboard:
- Click "Open Dashboard" in popup
- Press `Ctrl+Shift+M`
- Right-click extension icon > "Open Dashboard"

### Dashboard Tabs

**Overview**
- Quick stats summary
- Upcoming assignments
- Recent activity

**Calendar**
- Monthly view
- Assignment deadlines
- Color-coded by course

**To-Do**
- Full assignment list
- Filter by status/course
- Sort by due date/name

**Stats**
- Activity heatmap
- Question type breakdown
- Streak tracking
- Progress trends

**Flashcards**
- Review mode
- Create new cards
- Manage decks

**Export**
- Google Calendar (.ics)
- Anki deck
- Quizlet import
- JSON/CSV data
