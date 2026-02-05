# Onboarding Flow

## Overview

The onboarding flow introduces new users to McGraw Plus, displaying their captured account data and explaining features. It automatically opens when a user profile is detected from McGraw-Hill Connect.

## Automatic Trigger

Onboarding opens automatically when:
1. User visits any McGraw-Hill Connect page
2. API interceptor captures their profile (name + email/userId)
3. Onboarding has not been completed yet

**Lock Mechanism:** Prevents duplicate onboarding tabs via 30-second lock.

---

## Slides (4 Total)

### Slide 0: Welcome + Profile

**Purpose:** Greet user by name and show captured profile.

**Displayed Data:**
- User's full name (from API)
- Email address
- Account ID (truncated if long)
- Institution/School name (if available)

**Profile Card Design:**
- Gradient header with avatar icon
- Dark theme (#0f0f10 background)
- Clean, minimal layout

**Stored Data:**
```json
{
  "mp_user_profile": {
    "firstName": "Jane",
    "lastName": "Doe",
    "name": "Jane Doe",
    "email": "jane.doe@example.edu",
    "userId": "12345678",
    "institutionId": "u123",
    "institutionName": "Example University"
  }
}
```

**Terms Notice:**
By clicking "Get Started", users implicitly agree to Terms of Service.
A link allows viewing the full terms in a modal.

---

### Slide 1: Data Overview

**Purpose:** Show all captured data from their McGraw-Hill account.

**Displayed Sections:**

1. **User Info Card** - Name and email with small icon
2. **Stats Grid (4 cards):**
   - Courses count (sections)
   - Total assignments
   - Completed assignments (green highlight)
   - Pending assignments (amber highlight if overdue)

3. **Overdue Warning** (if any assignments past due)
4. **Instructors Section** - List of instructors with email
5. **Textbooks Section** - List of books by title
6. **Connection Status Badge** - Pulse animation

**Stats Card Design:**
- Dark background (#1a1a1a)
- Large numbers with colored indicators
- Success (green) for completed
- Warning (amber) for pending/overdue

**Completion Calculation:**
```javascript
const isCompleted =
  item.completed === true ||
  item.status === 'completed' ||
  item.status === 'COMPLETE' ||
  item.progress === 100 ||
  item.percentComplete === 100;
```

---

### Slide 2: Features Overview

**Purpose:** Introduce key features of McGraw Plus.

**Layout:** Horizontal feature cards with icons

**Featured Items:**
| Feature | Icon | Description |
|---------|------|-------------|
| Due Date Tracking | Calendar | Never miss a deadline with automatic tracking |
| Dark Mode | Moon | Easy on the eyes for late-night studying |
| Statistics | Chart | Track your study progress and streaks |
| Notifications | Bell | Get reminded before assignments are due |

**Design:**
- Horizontal card layout (responsive grid)
- Dark cards with subtle hover effects
- Feature icons with accent colors

**Links:**
- Website: https://mcgrawplus.pages.dev
- Docs: https://mcgrawplus.pages.dev/docs

---

### Slide 3: Complete

**Purpose:** Simple completion message with close hint.

**Displayed Information:**
- "You're All Set!" heading
- Brief confirmation message
- Hint to close the page

**Actions on Reaching This Slide:**
1. Save settings to storage
2. Mark onboarding complete
3. Mark terms accepted
4. Trigger confetti celebration

**Note:** No back button on this slide - user should simply close the tab.

**Stored Data:**
```json
{
  "mp_onboarding_complete": true,
  "mp_onboarding_completed_at": 1707166800000,
  "mp_terms_accepted": true,
  "mp_terms_accepted_at": 1707166800000,
  "mp_user_name": "Jane Doe"
}
```

---

## Navigation

**Buttons:**
- `Back` (←) - Go to previous slide (not shown on final slide)
- `Next` / `Continue` (→) - Proceed to next slide
- `Get Started` - Begin onboarding (Slide 0)
- `Finish Setup` - Complete onboarding (Slide 2)

**Keyboard:**
- `Escape` - Close terms modal

---

## Terms Modal

Accessed via "Terms of Service" link on Slide 0.

**Sections:**
1. Acceptance of Terms
2. Use of the Extension
3. Data Privacy
4. Disclaimer
5. Academic Integrity
6. Updates

**Confirm Button:**
- Disabled until user scrolls to bottom
- Enables after scrolling to end marker

---

## Confetti Animation

Custom canvas-based confetti on completion:

```javascript
function triggerConfetti() {
  const particles = [];
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

  for (let i = 0; i < 150; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20 - 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
    });
  }
  // Animation loop with gravity...
}
```

---

## Connection Toast

Success toast appears briefly at top of page when onboarding opens:
- Green background
- Checkmark icon
- "Successfully connected!" text
- Auto-fades after 2.5 seconds

---

## Progress Indicator

4 animated dots at top showing current position:
- Active: Accent color (purple) with animated bar indicator
- Completed: Muted accent color
- Upcoming: Gray

**Animation:** Active dot expands with a bar indicator that animates width

---

## Storage Keys

| Key | Purpose |
|-----|---------|
| `mp_onboarding_complete` | Whether onboarding finished |
| `mp_onboarding_completed_at` | Timestamp of completion |
| `mp_terms_accepted` | Whether terms accepted |
| `mp_terms_accepted_at` | Timestamp of acceptance |
| `mp_user_name` | User's display name |
| `mp_onboarding_tab_id` | ID of onboarding tab (prevents duplicates) |
| `mp_onboarding_lock` | Lock to prevent race conditions |

---

## Redo Onboarding

Users can redo onboarding from Dashboard settings.

**Clears:**
- `mp_onboarding_complete`
- `mp_terms_accepted`

**Preserves:**
- User profile data
- Course/assignment data
- Statistics

---

## Debugging

Console logs for tracking:
```
[McGraw Plus] Opened onboarding for: Jane Doe
[McGraw Plus] Onboarding lock already held
[McGraw Plus] Could not acquire onboarding lock, skipping
```
