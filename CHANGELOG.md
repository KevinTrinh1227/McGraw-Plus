# Changelog

All notable changes to McGraw Plus will be documented in this file.

## [2.0.0] - 2026-02-05

### 🎉 Major Release: McGraw Plus

Complete rebrand and feature overhaul. The extension has been transformed from "SmartBook Solver" into "McGraw Plus" - a comprehensive study companion.

### Added

- **🌙 Dark Mode** - Comprehensive dark theme for all McGraw-Hill pages
- **⌨️ Keyboard Shortcuts** - Use 1-4 or A-D to select answers, Enter to submit
- **📅 Due Date Tracker** - Track assignments with browser notifications
- **📊 Progress Stats** - Session and lifetime statistics with streaks
- **🎯 Focus Mode** - Hide distractions and expand content
- **📊 Progress Bar** - Floating indicator of assignment completion
- **📑 Tab Title** - Show progress in browser tab title
- **🔔 Smart Notifications** - Chrome notifications for reminders
- **🚀 Onboarding** - First-run setup wizard
- **⚙️ Settings Page** - Dedicated settings view in popup

### Changed

- Complete UI redesign with cleaner, modern look
- Solver feature now hidden in "Advanced Features" with 3-step unlock
- Restructured codebase into organized directories
- Improved dark mode coverage across all page elements
- Better keyboard shortcut handling (skips input fields)

### Improved

- Performance: MutationObserver instead of polling
- Storage: Batched writes reduce I/O operations
- Code: Modular architecture with shared utilities

### Deprecated

- Star verification for premium features (removed)
- Premium gold theme (removed)

### Migration

- Existing data (Q&A pairs, stats) automatically migrated
- Settings preserved where applicable

---

## [4.1.0] - Previous Version

Last version as "SmartBook Solver" - see git history for earlier changes.
