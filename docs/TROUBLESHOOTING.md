# Troubleshooting Guide

## Common Issues

### Extension Not Working

**Symptoms:**
- Features don't appear on SmartBook pages
- Dark mode doesn't apply
- No keyboard shortcuts

**Solutions:**

1. **Check the URL**
   - Extension only works on `*.mheducation.com` pages
   - Verify you're on a supported page

2. **Check Extension Status**
   - Click the extension icon
   - Ensure the power toggle is ON
   - Status should show "Active on SmartBook"

3. **Refresh the Page**
   - Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R`)
   - This reloads the content scripts

4. **Check for Errors**
   - Open `chrome://extensions`
   - Click "Errors" on McGraw Plus
   - Report any errors on GitHub

5. **Reinstall Extension**
   - Remove the extension
   - Re-download from releases
   - Load unpacked again

---

### Dark Mode Not Applying

**Solutions:**

1. **Enable in Settings**
   - Settings > General > Dark Mode

2. **Page Compatibility**
   - Some pages may not support dark mode
   - Try other Connect pages

3. **CSS Conflicts**
   - Other extensions may interfere
   - Try disabling other extensions temporarily

4. **Use Keyboard Shortcut**
   - `Ctrl+Shift+D` to toggle directly

---

### Keyboard Shortcuts Not Working

**Solutions:**

1. **Enable in Settings**
   - Settings > General > Keyboard Shortcuts

2. **Check Focus**
   - Click on the page first
   - Shortcuts only work when page is focused

3. **Check for Conflicts**
   - Other extensions may use same shortcuts
   - Browser shortcuts take precedence

4. **Input Fields**
   - Shortcuts are disabled in input fields
   - Click outside the input to use shortcuts

---

### Profile Not Being Captured

**Symptoms:**
- Onboarding never opens
- "Connect to Continue" message persists
- No user name shown

**Solutions:**

1. **Visit Connect Dashboard**
   - Go to `connect.mheducation.com` or `newconnect.mheducation.com`
   - Navigate to your courses or assignments
   - The API interceptor needs to capture API responses

2. **Enable Debug Mode**
   - Open console: `F12` > Console tab
   - Run: `window.__MCGRAW_PLUS_DEBUG = true`
   - Refresh the page
   - Check for `[McGraw Plus]` messages

3. **Check Captured Data**
   - In console: `window.__mcgrawPlusCaptures`
   - Look for `profiles` and `courses` arrays
   - Should have data if API calls succeeded

4. **Wait for API Calls**
   - The extension intercepts API responses
   - Navigate around Connect to trigger API calls
   - Check ToDo, Calendar, or Results pages

5. **Check for Errors**
   - Look for red errors in console
   - Report on GitHub if persistent

---

### Due Dates Not Showing

**Solutions:**

1. **Visit Connect Dashboard**
   - Go to `connect.mheducation.com` or `newconnect.mheducation.com`
   - The API interceptor needs to capture `/studentAssignments` endpoint

2. **Check Login**
   - Ensure you're logged in to Connect
   - Extension can't access data without login

3. **Wait for Sync**
   - Data syncs automatically in background
   - May take a few seconds after page load

4. **Navigate to Assignments**
   - Go to ToDo or Calendar page
   - This triggers the studentAssignments API call

5. **Check Debug Data**
   - Run: `window.__mcgrawPlusCaptures.assignments`
   - Should show captured assignment data

---

### Onboarding Won't Complete

**Solutions:**

1. **Version Check Failing**
   - Check internet connection
   - Wait for retry (3 attempts)
   - Click "Try Again"

2. **Terms Not Accepting**
   - Enter a name (minimum 2 characters)
   - Button enables after name is entered

3. **Stuck on Login Check**
   - Click "Check Again"
   - Open Connect in another tab
   - Can skip with warning

4. **Reset Onboarding**
   - If completed but buggy
   - Settings > Data > Redo Onboarding

---

### Star Verification Failing

**Solutions:**

1. **Check Username**
   - GitHub username is case-insensitive
   - No spaces or special characters

2. **Actually Star the Repo**
   - Visit [the repo](https://github.com/KevinTrinh1227/McGraw-Plus)
   - Click the Star button

3. **Wait and Retry**
   - GitHub API may be slow
   - Try again in a few minutes

4. **Check Stargazer Limit**
   - Verification checks up to 1000 stargazers
   - If repo has many stars, may take longer

---

### Discord Webhook Not Working

**Solutions:**

1. **Check URL Format**
   - Must be `https://discord.com/api/webhooks/...`
   - Copy the full URL from Discord

2. **Test the Webhook**
   - Settings > Advanced > Test
   - Check Discord for test message

3. **Check Discord Permissions**
   - Webhook needs permission in channel
   - Channel might be restricted

4. **Regenerate Webhook**
   - In Discord, delete and create new webhook
   - Update URL in settings

---

### AI Assistant Not Working

**Solutions:**

1. **Check API Key**
   - Ensure key is correct
   - No spaces before/after

2. **Test the Connection**
   - Settings > Advanced > Test
   - Should show "API working!"

3. **Check Provider**
   - Groq: Uses free tier, may have limits
   - OpenAI: Needs billing set up
   - Anthropic: Check account status

4. **Rate Limits**
   - Groq: 14,400 req/day
   - Wait if you've hit limits

---

### Extension Disabled/Blocked

**Symptoms:**
- "Extension Disabled" message
- "Update Required" overlay

**Solutions:**

1. **Update Required**
   - Click "Download Update"
   - Install the new version
   - This means your version is too old

2. **Kill Switch Active**
   - Rare, means a critical issue was found
   - Check GitHub for announcements
   - Update when fix is available

3. **Manual Update**
   - Download latest from releases
   - Replace your `src/` folder
   - Reload extension in `chrome://extensions`

---

### Extension Context Invalidated Error

**Symptoms:**
- Console shows "Extension context invalidated"
- Features stop working after extension update/reload
- Chrome storage errors

**This is normal behavior** when:
- You reload the extension in `chrome://extensions`
- The extension auto-updates
- Developer mode reloads

**Solutions:**

1. **Refresh the Page**
   - Simply refresh the McGraw-Hill page
   - Content scripts will reinitialize

2. **This is Expected**
   - The extension handles this gracefully
   - Old tabs will stop working until refreshed
   - No data is lost

3. **If Persistent**
   - Restart Chrome
   - Disable/enable the extension

---

## Debugging

### Enable Debug Mode

Run this in the browser console on any McGraw-Hill page:

```javascript
window.__MCGRAW_PLUS_DEBUG = true
```

This enables verbose logging for the API interceptor.

### View Captured Data

```javascript
window.__mcgrawPlusCaptures
```

Shows all data captured by the API interceptor:
- `endpoints` - All intercepted URLs
- `profiles` - User profile captures
- `courses` - Course data
- `sections` - Section data
- `assignments` - Assignment data
- `instructors` - Instructor data
- `books` - Book/textbook data
- `rawResponses` - Raw API responses (debug mode only)

### Enable Developer Console

1. Right-click on SmartBook page
2. Click "Inspect"
3. Go to Console tab
4. Filter by `[McGraw Plus]`

### Common Console Messages

```
[McGraw Plus] API interceptor v4.0 initialized
```
Normal - API interceptor is ready

```
[McGraw Plus] Processed studentAssignments: {courses: 2, sections: 3, ...}
```
Normal - data captured from main endpoint

```
[McGraw Plus] Data capture complete: {hasProfile: true, ...}
```
Normal - sufficient data captured for onboarding

```
[McGraw Plus] Another tab is scraping, skipping initialization
```
Normal - multi-tab coordination working

```
[McGraw Plus] Extension context invalidated, cleaning up...
```
Normal - extension was reloaded, refresh the page

### Storage Debugging

1. Go to `chrome://extensions`
2. Click "Details" on McGraw Plus
3. Click "Inspect" on any view
4. Go to Application > Storage > Local Storage

Key storage entries:
- `mp_user_profile` - User data
- `mp_courses` - Courses
- `mp_sections` - Sections with instructor info
- `mp_due_dates` - Assignments
- `mp_capture_state` - Capture status

### Reset Everything

If all else fails:

1. Go to Settings > Data
2. Click "Reset Everything"
3. Confirm twice
4. Extension resets to fresh state

---

## Getting Help

### Before Reporting

1. Check this troubleshooting guide
2. Search existing GitHub issues
3. Try latest version

### Reporting Issues

Include:
- Browser name and version
- Extension version
- Steps to reproduce
- Console errors (if any)
- Screenshots (if helpful)

[Report an Issue](https://github.com/KevinTrinh1227/McGraw-Plus/issues)

### FAQ

**Q: Does this work on Firefox/Safari?**
A: Not yet. Chrome, Edge, Brave, Opera, Vivaldi, and Arc are supported.

**Q: Does this store my Connect password?**
A: No. We never access or store your credentials.

**Q: Will this get me in trouble?**
A: Use responsibly. The extension is for study enhancement, not cheating.

**Q: Why does it need so many permissions?**
A: Each permission has a specific purpose. See the Privacy Policy for details.

**Q: My data disappeared after update.**
A: This shouldn't happen. Try Re-sync Data. If lost, report as a bug.
