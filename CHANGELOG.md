# Changelog

All notable changes to McGraw Plus will be documented in this file.

## [2.5.0] - 2026-02-05

### Added
- School/institution name display in onboarding profile card
- Cleaner, more minimal design across all onboarding pages

### Changed
- Complete onboarding UI redesign with darker theme (#0f0f10 background)
- Simplified popup pre-onboarding view (no detection spinner/status)
- Progress dots now animate with active indicator bar
- Profile card header with gradient and avatar icon
- Last slide simplified - just "You're All Set!" with close hint
- Removed back button from final onboarding slide
- Features page redesigned with horizontal card layout
- Stats grid redesigned with cleaner stat cards
- Better responsive breakpoints for mobile

### Fixed
- Popup CSS for setup view (`.setup-content`, `.setup-links`, etc.)
- Removed unused CSS and HTML elements from onboarding

---

## [2.4.1] - 2026-02-05

### Added
- Debug mode for API capture: `window.__MCGRAW_PLUS_DEBUG = true`
- Debug storage inspection: `window.__mcgrawPlusCaptures`
- Sections data type storage (`mp_sections`)
- Proper handling of McGraw-Hill `studentAssignments` endpoint

### Changed
- API Interceptor rewritten to v4.0 to match ACTUAL McGraw-Hill API schemas
- Status detection now uses uppercase: `COMPLETE`, `IN_PROGRESS` (matching API)
- Sections extracted separately from courses (matching API structure)
- Instructors extracted from sections data
- Service worker now checks sections in addition to courses/assignments

### Fixed
- Onboarding now waits for ACTUAL data (courses/sections/assignments) before opening
- Completion status detection using proper field names from API
- Bridge now handles sections data type properly

---

## [2.4.0] - 2026-02-05

### Added
- API interception for reliable data capture (MAIN world script)
- Instructor capture and display in onboarding
- Textbook/book capture and display in onboarding
- New domain support: `connect.edu.mheducation.com`
- Greedy endpoint pattern matching for maximum data capture
- Onboarding lock mechanism to prevent duplicate tabs
- Emojis throughout onboarding UI for better visual appeal
- Connection badge with pulse animation

### Changed
- Split content scripts: api-interceptor at document_start, others at document_end
- Onboarding reduced from 7 slides to 4 (streamlined flow)
- Profile card redesigned without avatar icon
- Connection status badge moved to bottom of data overview
- Improved assignment completion detection (checks multiple fields)
- Updated documentation with API interception details

### Fixed
- Multiple courses now captured (not just first one)
- Assignments completed/pending count accuracy
- Removed auto-dashboard opening after onboarding (was annoying)
- Fixed `/me` pattern being too greedy (matching homepage, etc.)

---

## [2.3.0] - 2026-01-28

### Added
- Dashboard calendar improvements
- Activity heatmap visualization
- Export to PDF functionality

### Fixed
- Dark mode coverage improvements
- Stats persistence across sessions

---

## [2.2.0] - 2026-01-20

### Added
- Onboarding redesign with profile detection
- Popup UI improvements
- Version verification system

### Changed
- Settings categories reorganized
- Improved keyboard shortcut handling

---

## [2.1.0] - 2026-01-15

### Added
- Full-featured dashboard with tabs
- Star verification for premium features
- Due date calendar view
- Flashcard system

### Changed
- Complete popup redesign
- Storage key migration to `mp_` prefix

---

## [2.0.0] - 2026-01-10

### Major Release: McGraw Plus

Complete rebrand from "SmartBook Solver" to "McGraw Plus" - a comprehensive study companion.

### Added
- Dark Mode - Comprehensive dark theme
- Keyboard Shortcuts - 1-4 or A-D to select, Enter to submit
- Due Date Tracker - Track assignments with notifications
- Progress Stats - Session and lifetime statistics
- Focus Mode - Hide distractions
- Progress Bar - Floating completion indicator
- Tab Title - Show progress in browser tab
- Smart Notifications - Chrome notifications for reminders
- Onboarding - First-run setup wizard
- Settings Page - Dedicated settings view

### Changed
- Complete UI redesign
- Solver feature hidden in "Advanced Features"
- Restructured codebase into organized directories
- Improved dark mode coverage

### Improved
- Performance: MutationObserver instead of polling
- Storage: Batched writes reduce I/O
- Code: Modular architecture with shared utilities

---

## [4.1.0] - Previous Version

Last version as "SmartBook Solver" - see git history for earlier changes.
