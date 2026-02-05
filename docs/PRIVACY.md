# Privacy Policy

**Last Updated:** February 2026

## Summary

McGraw Plus is designed with privacy as a core principle. All your data stays on your device, and we do not collect, store, or transmit any personal information to external servers.

## Data Collection

### What We Collect

**Stored Locally Only:**
- Your name (entered during onboarding)
- Study statistics (questions answered, streak, etc.)
- Assignment data scraped from McGraw-Hill pages
- Feature preferences and settings
- Flashcards you create

### What We DON'T Collect

- We do NOT have servers
- We do NOT collect analytics
- We do NOT track your browsing
- We do NOT store your McGraw-Hill credentials
- We do NOT access your McGraw-Hill account

## Data Storage

All data is stored locally in your browser using Chrome's storage API (`chrome.storage.local`). This data:

- Stays on your device
- Is not synced to the cloud
- Can be exported or deleted at any time
- Is cleared when you uninstall the extension

### Storage Keys

| Key | Data Type | Purpose |
|-----|-----------|---------|
| `mp_settings` | Preferences | Feature toggles |
| `mp_stats` | Statistics | Study progress |
| `mp_due_dates` | Assignments | Due date tracking |
| `mp_courses` | Courses | Course information |
| `mp_user_name` | Text | Personalization |

## External Connections

The extension only makes external requests when you explicitly configure them:

### Optional Connections

1. **GitHub API** (for star verification)
   - Only checks if your username has starred the repo
   - Public API, no authentication required
   - Only used when you click "Verify"

2. **Discord Webhooks** (if configured)
   - Sends session notifications to YOUR webhook URL
   - You control what channel receives messages
   - Only active when you configure a webhook

3. **AI Providers** (if configured)
   - Groq, OpenAI, or Anthropic
   - Only sends question text for hints
   - Uses YOUR API key
   - Never sends personal information

4. **Version Check**
   - Fetches `version.json` from GitHub
   - Only contains version numbers
   - No user data is sent

### What External Connections See

| Service | Data Sent | Data NOT Sent |
|---------|-----------|---------------|
| GitHub | Username (for star check) | Email, location, browsing data |
| Discord | Webhook messages you configure | Personal data, credentials |
| AI Providers | Question text (when you ask) | Name, grades, personal data |
| Version Check | Nothing | Any user data |

## Permissions Explained

### Required Permissions

| Permission | Why Needed |
|------------|------------|
| `activeTab` | Inject features on SmartBook pages |
| `storage` | Save your settings locally |
| `scripting` | Apply dark mode and other features |

### Optional Permissions

| Permission | Why Needed |
|------------|------------|
| `alarms` | Schedule notification reminders |
| `notifications` | Show due date reminders |
| `clipboardWrite` | Quick copy feature |
| `contextMenus` | Right-click menu options |

### Host Permissions

| Domain | Why Needed |
|--------|------------|
| `*.mheducation.com` | Apply features to McGraw-Hill pages |
| `api.github.com` | Star verification (optional) |
| `discord.com` | Webhook notifications (optional) |
| AI provider APIs | AI hints (optional) |

## Your Rights

### Access Your Data

Export all your data:
**Settings > Data > Export**

### Delete Your Data

Delete specific data:
**Settings > Data > Clear**

Delete everything:
**Settings > Data > Reset Everything**

Or simply uninstall the extension.

### Modify Your Data

- Edit your name in Settings
- Change any feature toggles
- Delete individual flashcards
- Clear study statistics

## Third-Party Services

McGraw Plus interacts with McGraw-Hill pages but:
- Is NOT affiliated with McGraw-Hill Education
- Does NOT have access to their systems
- Does NOT store your McGraw-Hill credentials
- Only reads publicly visible page content

## Data Security

- All data stored using Chrome's secure storage API
- No encryption needed (data never leaves your device)
- API keys stored locally (recommend using environment-specific keys)

## Updates to This Policy

We may update this privacy policy. Changes will be noted in the changelog and version number.

## Contact

Questions about privacy?

- GitHub Issues: [Report a concern](https://github.com/KevinTrinh1227/McGraw-Plus/issues)
- Website: [mcgrawplus.pages.dev](https://mcgrawplus.pages.dev)

## TLDR

- Everything stays on your device
- We don't run servers
- We don't collect data
- Optional features (Discord, AI) use YOUR accounts
- You can delete everything anytime
