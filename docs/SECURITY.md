# Security

## Overview

McGraw Plus is designed with security best practices in mind. This document outlines our security measures and recommendations.

## Code Security

### Open Source

The entire codebase is open source on GitHub, allowing:
- Public code review
- Community security audits
- Transparent development

### No Obfuscation

The code is not minified or obfuscated, making it:
- Easy to audit
- Easy to understand
- Trustworthy

## Data Security

### Local Storage

All user data is stored locally using Chrome's storage API:

```javascript
chrome.storage.local.set({ key: value });
```

This means:
- Data never leaves your browser
- No network transmission of personal data
- Data is sandboxed to the extension

### No Remote Servers

We do not operate servers. The extension:
- Has no backend
- Makes no analytics calls
- Doesn't phone home

### Sensitive Data Handling

**API Keys:**
- Stored locally in `chrome.storage.local`
- Never transmitted except to the provider you configured
- Recommendation: Use API keys with limited permissions

**Personal Information:**
- Name is stored locally only
- McGraw-Hill credentials are NEVER stored
- The extension cannot access your Connect password

## Network Security

### Minimal External Requests

The extension only makes network requests for:

1. **Version Check** (automatic)
   - Target: `raw.githubusercontent.com`
   - Data sent: None
   - Purpose: Check for updates

2. **Star Verification** (user-initiated)
   - Target: `api.github.com`
   - Data sent: GitHub username
   - Purpose: Verify repository star

3. **Discord Webhooks** (user-configured)
   - Target: User's webhook URL
   - Data sent: Session messages
   - Purpose: Notifications

4. **AI Providers** (user-configured)
   - Target: Provider API
   - Data sent: Question text, API key
   - Purpose: Get hints

### Request Timeouts

All requests have timeouts to prevent hanging:

```javascript
fetch(url, {
  signal: AbortSignal.timeout(5000),
  cache: 'no-store',
});
```

## Permission Model

### Principle of Least Privilege

We only request permissions we actually need:

| Permission | Necessity |
|------------|-----------|
| `activeTab` | Required - Apply features |
| `storage` | Required - Save settings |
| `scripting` | Required - Inject scripts |
| `alarms` | Optional - Notifications |
| `notifications` | Optional - Reminders |

### Host Permissions

Limited to McGraw-Hill domains and optional services:

```json
"host_permissions": [
  "*://learning.mheducation.com/*",
  "*://connect.mheducation.com/*",
  "*://newconnect.mheducation.com/*"
]
```

## Content Script Security

### Isolated World

Content scripts run in an isolated world:
- Cannot access page JavaScript
- Cannot be manipulated by page scripts
- Protected from XSS attacks

### Input Validation

All scraped data is validated:

```javascript
// Name validation
if (name.length >= 2 && name.length <= 100 && !isCommonUIText(name)) {
  // Valid
}

// Date validation
if (!isNaN(date.getTime())) {
  // Valid date
}
```

## Kill Switch

The extension includes a remote kill switch for emergencies:

```json
{
  "killSwitch": true,
  "message": "Security issue detected. Please update."
}
```

This allows us to:
- Disable the extension if a vulnerability is found
- Force users to update to a patched version
- Communicate important security information

## Vulnerability Reporting

Found a security issue? Please report it responsibly:

1. **DO NOT** create a public issue
2. Contact via [GitHub Security Advisories](https://github.com/KevinTrinh1227/McGraw-Plus/security/advisories)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact

We will:
- Acknowledge within 48 hours
- Work on a fix
- Credit you in the release notes (if desired)

## Best Practices for Users

### API Key Security

If using AI features:
- Use API keys with limited permissions
- Rotate keys periodically
- Don't share your extension data export (contains API keys)

### Webhook Security

If using Discord webhooks:
- Don't share your webhook URL publicly
- Regenerate if compromised
- Use a dedicated channel for notifications

### Data Export

When exporting data:
- The JSON file may contain API keys
- Store exports securely
- Delete exports after use

### Updates

- Keep the extension updated
- Check for update notifications
- Review changelog for security fixes

## Compliance

### No Tracking

We comply with privacy regulations by:
- Not collecting personal data
- Not using cookies
- Not tracking users

### Data Portability

Users can export all their data in JSON format at any time.

### Right to Deletion

Users can delete all data:
- Through the extension settings
- By uninstalling the extension

## Audit Trail

The extension maintains an audit trail of significant events:

```javascript
// Stored timestamps
mp_onboarding_completed_at: 1707166800000
mp_terms_accepted_at: 1707166800000
mp_solver_enabled_at: 1707166800000
```

This helps with:
- Debugging issues
- Understanding feature usage
- No personal data is tracked
