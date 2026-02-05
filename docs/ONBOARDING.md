# Onboarding Flow

## Overview

The onboarding flow guides new users through setup, requiring version verification and terms acceptance before allowing use of the extension.

## Slides

### Slide 0: Version Check

**Purpose:** Ensure users have a supported version.

**Logic:**
1. Fetch `version.json` from GitHub
2. Compare current version with `minVersion`
3. Block if outdated, allow if current

**States:**
- `checking` - Spinner while fetching
- `ok` - Version is up to date
- `outdated` - Must update to continue
- `error` - Network error (retry 3x, then allow with warning)

### Slide 1: Terms of Service

**Purpose:** Legal acknowledgment and name collection.

**Requirements:**
- User must enter their full name (min 2 characters)
- Checkbox disabled until name entered

**Stored Data:**
```javascript
{
  mp_terms_accepted: true,
  mp_terms_accepted_at: 1707166800000,
  mp_user_name: "John Smith"
}
```

### Slide 2: Welcome

**Purpose:** Personalized greeting and feature overview.

**Dynamic Content:**
- Displays user's name from Slide 1
- Shows key feature highlights

### Slide 3: Login to Connect

**Purpose:** Verify McGraw-Hill Connect login for data sync.

**Detection Methods:**
1. Check for cached course/assignment data
2. Query open Connect tabs
3. Send message to content scripts

**States:**
- `checking` - Verifying login
- `logged-in` - Connected successfully
- `logged-out` - Needs to log in

**Note:** Users can skip without logging in (with warning).

### Slide 4: Feature Selection

**Purpose:** Let users choose which features to enable.

**UI Components:**
- Category tabs (All, Appearance, Productivity, etc.)
- Responsive grid of feature cards
- Enable All / Disable All buttons

**Features (16 total):**

| Feature | Category | Default |
|---------|----------|---------|
| Dark Mode | Appearance | On |
| Keyboard Shortcuts | Productivity | On |
| Due Date Tracker | Organization | On |
| Stats Tracker | Analytics | On |
| Notifications | Organization | On |
| Quick Copy | Productivity | Off |
| Flashcards | Study | Off |
| Focus Mode | Productivity | Off |
| PDF Export | Study | Off |
| Study Timer | Productivity | Off |
| Progress Bar | Analytics | On |
| Readability | Appearance | Off |
| Tab Title | Productivity | On |
| Auto Resume | Productivity | Off |
| Confidence Marker | Study | Off |
| Text Selection | Accessibility | Off |

### Slide 5: Pin Extension

**Purpose:** Guide users to pin the extension for easy access.

**Browser Detection:**
```javascript
function detectBrowser() {
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('arc')) return 'arc';
  if (ua.includes('vivaldi')) return 'vivaldi';
  if (ua.includes('opera') || ua.includes('opr')) return 'opera';
  if (ua.includes('brave')) return 'brave';
  if (ua.includes('edg')) return 'edge';
  if (ua.includes('chrome')) return 'chrome';
  // ...
}
```

**Arrow Positions:**

| Browser | Position |
|---------|----------|
| Chrome/Edge/Brave | Top-right, 120px from edge |
| Opera | Top-right, 200px from edge |
| Vivaldi | Top-right, 180px from edge |
| Arc | Left sidebar, 60px from left |

### Slide 6: Complete

**Purpose:** Confirmation with personalized details.

**Displayed Information:**
- User's full name
- Completion timestamp
- "You now have access" message
- Link to website

**Actions:**
- Confetti celebration animation
- "Get Started" navigates to Connect

## Navigation

**Buttons:**
- `Skip` - Complete with defaults (closes tab)
- `Back` - Go to previous slide
- `Next` - Proceed to next slide

**Keyboard:**
- `Arrow Right` / `Enter` - Next
- `Arrow Left` - Back
- `Escape` - Skip

## Confetti Animation

Custom canvas-based confetti on completion:

```javascript
function triggerConfetti() {
  const particles = [];
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];

  for (let i = 0; i < 150; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20 - 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      // ...
    });
  }
  // Animation loop...
}
```

## Redo Onboarding

Users can redo onboarding from:
**Settings > Data > Redo Onboarding**

This removes:
- `mp_onboarding_complete`
- `mp_terms_accepted`

And opens the onboarding page again.
