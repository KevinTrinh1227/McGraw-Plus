# Contributing to McGraw Plus

Thank you for your interest in contributing to McGraw Plus! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a feature branch from `main`
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## Development Setup

### Prerequisites

- Chrome, Edge, Brave, or another Chromium-based browser
- Basic knowledge of JavaScript and Chrome Extensions

### Loading the Extension

1. Open `chrome://extensions` in your browser
2. Enable **Developer Mode**
3. Click **Load unpacked** and select the `src/` folder
4. Make changes and click the refresh icon to reload

### Project Structure

```
src/
├── manifest.json           # Extension configuration
├── popup/                  # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── onboarding/             # First-run onboarding
│   ├── onboarding.html
│   ├── onboarding.css
│   └── onboarding.js
├── background/             # Service worker
│   └── service-worker.js
├── content/                # Content scripts
│   ├── main.js            # Feature loader
│   ├── dark-mode.css
│   ├── focus-mode.css
│   ├── overlay.js
│   ├── overlay.css
│   ├── anti-copy.js
│   └── solver.js
├── shared/                 # Shared modules
│   ├── storage.js
│   ├── messaging.js
│   └── utils.js
├── config/                 # Configuration
│   └── defaults.json
├── libs/                   # Third-party libraries
└── assets/                 # Icons and images
```

## Guidelines

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add JSDoc comments for functions
- Keep functions small and focused

### Commit Messages

Write clear commit messages that explain what changed and why:

```
Add keyboard shortcut for focus mode

Added Ctrl+Shift+F to toggle focus mode from any SmartBook page.
Also updated the popup to show the current focus mode state.
```

### Pull Requests

- Reference any related issues
- Describe what changes were made and why
- Include screenshots for UI changes
- Make sure all existing features still work

## Feature Requests

Open an issue with the `enhancement` label describing:

- What problem the feature solves
- How users would use it
- Any implementation ideas

## Bug Reports

Open an issue with the `bug` label including:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser and version
- Screenshots if applicable

## Questions

For questions, open a discussion or issue with the `question` label.

## Code of Conduct

Be respectful and constructive. We're all here to learn and build something useful.

---

Thanks for contributing! 🎉
