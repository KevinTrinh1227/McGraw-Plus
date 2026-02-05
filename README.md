<p align="center">
  <img src="assets/banner.jpg" alt="McGraw Plus Banner" width="100%">
</p>

<p align="center">
  <a href="https://github.com/KevinTrinh1227/McGraw-Plus/releases/latest">
    <img src="https://img.shields.io/github/v/release/KevinTrinh1227/McGraw-Plus?label=Version&style=flat-square" alt="Version">
  </a>
  <img src="https://img.shields.io/github/downloads/KevinTrinh1227/McGraw-Plus/total?label=Downloads&style=flat-square" alt="Downloads">
  <img src="https://img.shields.io/github/stars/KevinTrinh1227/McGraw-Plus?label=Stars&style=flat-square" alt="Stars">
  <img src="https://img.shields.io/badge/Chrome-Supported-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome">
  <img src="https://img.shields.io/badge/Edge-Supported-0078D7?style=flat-square&logo=microsoftedge&logoColor=white" alt="Edge">
</p>

---

## Features

### Study Enhancement
- **Dark Mode** — Eye-friendly theme for late-night studying
- **Keyboard Shortcuts** — Use 1-4 or A-D to quickly select answers, Enter to submit
- **Progress Bar** — Floating visual indicator of assignment completion
- **Tab Title Progress** — See progress percentage in browser tab
- **Focus Mode** — Hide distractions and expand content area
- **Text Selection** — Enable copy/paste on restricted pages

### Productivity
- **Due Date Tracker** — Automatically detects and tracks assignment deadlines
- **Study Statistics** — Track questions answered, accuracy rate, and study streaks
- **Flashcard Generation** — Create flashcards from Q&A pairs
- **Dashboard** — Full-featured dashboard with calendar, to-do list, and analytics
- **Smart Notifications** — Reminders for upcoming deadlines

### Integrations
- **Discord Webhooks** — Get session notifications in Discord
- **AI Assistant** — Optional AI hints using Groq (free), OpenAI, or Anthropic
- **Export Options** — Export to Google Calendar (.ics), Anki, Quizlet, Notion, JSON, CSV

---

## Browser Support

| Browser | Supported |
|---------|-----------|
| Google Chrome | ✅ Yes |
| Microsoft Edge | ✅ Yes |
| Brave | ✅ Yes |
| Opera | ✅ Yes |
| Vivaldi | ✅ Yes |
| Arc | ✅ Yes |
| Firefox | ❌ Not yet |
| Safari | ❌ Not yet |

---

## Installation

### Step 1: Download
Download the latest release from [Releases](https://github.com/KevinTrinh1227/McGraw-Plus/releases/latest)

### Step 2: Extract
Extract the ZIP file to a permanent location on your computer (e.g., `Documents/McGraw-Plus`)

### Step 3: Load Extension
1. Open `chrome://extensions` in your browser
2. Enable **Developer Mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the extracted `src/` folder
5. Pin the extension to your toolbar for easy access

---

## How It Works

### Auto-Detection
McGraw Plus automatically detects when you're on McGraw-Hill pages:

| URL Pattern | Detection |
|-------------|-----------|
| `learning.mheducation.com/*` | SmartBook assignments |
| `connect.mheducation.com/*` | Connect dashboard |

### Content Scripts
When you visit a supported page, the extension automatically:
1. Injects the content scripts (`src/content/main.js`)
2. Applies your preferences (dark mode, shortcuts, etc.)
3. Scrapes assignment data for due date tracking
4. Enables study enhancement features

### Data Flow
```
McGraw-Hill Page
       ↓
Content Scripts (src/content/*.js)
       ↓
Chrome Storage (local)
       ↓
Popup UI / Dashboard
```

### File Structure
```
src/
├── manifest.json           # Extension configuration
├── background/
│   └── service-worker.js   # Background service worker
├── content/
│   ├── main.js             # Main content script
│   ├── assignment-scraper.js
│   ├── dark-mode.css
│   ├── focus-mode.css
│   ├── progress-bar.css
│   └── overlay.css
├── popup/
│   ├── popup.html          # Extension popup
│   ├── popup.css
│   └── popup.js
├── dashboard/
│   ├── dashboard.html      # Full dashboard page
│   ├── dashboard.css
│   ├── dashboard.js
│   └── components/
│       ├── calendar.js
│       ├── todo.js
│       ├── stats.js
│       ├── flashcards.js
│       └── export.js
├── shared/
│   ├── utils.js            # Shared utilities
│   ├── storage.js          # Storage abstraction
│   └── messaging.js        # Message passing
├── onboarding/
│   ├── onboarding.html
│   └── onboarding.js
└── assets/
    └── icons/
```

---

## First-Time Setup (Onboarding)

When you first install the extension:

1. **Terms of Use** — Accept the terms and enter your name
2. **Feature Selection** — Choose which features to enable
3. **Personalization** — Your name is displayed in greetings

You can redo onboarding anytime from Settings > Data > Redo Onboarding.

---

## Usage

### Quick Start
1. Navigate to any McGraw-Hill SmartBook page
2. Click the extension icon to see status
3. Use the power toggle to enable/disable features
4. Press `Ctrl+Shift+M` to open the Dashboard

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `1-4` or `A-D` | Select answer option |
| `Enter` or `Space` | Submit answer |
| `→` / `←` | Next / Previous question |
| `Ctrl+Shift+D` | Toggle dark mode |
| `Ctrl+Shift+F` | Toggle focus mode |
| `Ctrl+Shift+M` | Open Dashboard |

### Dashboard Features

Access the dashboard via:
- Click "Open Dashboard" button in popup
- Press `Ctrl+Shift+M`
- Right-click extension icon > "Open Dashboard"

**Dashboard Tabs:**
- **Overview** — Quick stats and upcoming assignments
- **Calendar** — Monthly view with assignment deadlines
- **To-Do** — Full assignment list with filters and sorting
- **Stats** — Activity heatmap, question types, streak tracking
- **Flashcards** — Review and generate flashcards
- **Export** — Export data to various formats

---

## Settings

### General
| Setting | Description |
|---------|-------------|
| Dark Mode | Apply dark theme to SmartBook pages |
| Keyboard Shortcuts | Enable keyboard navigation |
| Due Date Tracker | Track assignment deadlines |
| Notifications | Browser notifications for reminders |
| Progress Bar | Floating progress indicator |
| Tab Title | Show progress in browser tab |
| Text Selection | Enable copy on restricted pages |

### Discord Webhook
Receive notifications when:
- Study sessions start/end
- Assignments are completed
- Achievements unlocked

### AI Assistant (Optional)
Get hints using AI. Supported providers:
- **Groq** (Free, recommended) — Llama 3.3 70B
- **OpenAI** — GPT-4o-mini
- **Anthropic** — Claude 3 Haiku

---

## Data Storage

### Storage Keys
| Key | Description |
|-----|-------------|
| `mp_settings` | User preferences |
| `mp_stats` | Study statistics |
| `mp_due_dates` | Assignment deadlines |
| `mp_courses` | Course information |
| `mp_flashcards` | Generated flashcards |
| `responseMap` | Q&A pairs |
| `mp_user_name` | User's name |
| `mp_star_verified` | GitHub star status |

### Privacy
- All data stored locally in your browser
- No telemetry or tracking
- No external servers (except optional AI/Discord)
- Open source for transparency

---

## Star Verification

Support the project by starring the repo! This unlocks premium features.

1. Go to Settings > Share & Support
2. Enter your GitHub username
3. Click Verify
4. Verification is case-insensitive and checks up to 1000 stargazers

---

## Updates

The extension checks for updates automatically. When available:
1. A banner appears in the popup
2. Click "Download Update"
3. Extract and replace your local files
4. Click "Reload" on `chrome://extensions`

### Version Control
The extension uses `version.json` for remote configuration:
```json
{
  "version": "2.0.0",
  "minVersion": "1.0.0",
  "killSwitch": false,
  "forceUpdate": false,
  "downloadUrl": "https://github.com/KevinTrinh1227/McGraw-Plus/releases/latest"
}
```

---

## Troubleshooting

### Extension not working?
1. Make sure you're on a McGraw-Hill page (`mheducation.com`)
2. Check that the extension is enabled (power toggle is ON)
3. Try refreshing the page
4. Check `chrome://extensions` for errors

### Dark mode not applying?
1. Enable Dark Mode in settings
2. Refresh the SmartBook page
3. Some pages may not support dark mode

### Keyboard shortcuts not working?
1. Enable Keyboard Shortcuts in settings
2. Make sure focus is on the page (click on the page first)
3. Some input fields capture keyboard events

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## Disclaimer

This extension is for **educational purposes only** to enhance your study experience.

- Use responsibly and in accordance with your institution's policies
- The developer is not responsible for misuse
- Not affiliated with McGraw-Hill Education

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with care by <a href="https://github.com/KevinTrinh1227">Kevin Trinh</a>
</p>
