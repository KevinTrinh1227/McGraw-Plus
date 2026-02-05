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

### Due Dates Not Showing

**Solutions:**

1. **Visit Connect Dashboard**
   - Go to `connect.mheducation.com`
   - The scraper needs to run on Connect pages

2. **Check Login**
   - Ensure you're logged in to Connect
   - Scraper can't access data without login

3. **Wait for Sync**
   - Data syncs automatically in background
   - May take a few seconds

4. **Manual Resync**
   - Settings > Data > Re-sync Data

5. **Check Storage**
   - Settings > Data tab
   - Verify Q&A pairs count isn't 0

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

## Debugging

### Enable Developer Console

1. Right-click on SmartBook page
2. Click "Inspect"
3. Go to Console tab
4. Filter by `[McGraw Plus]`

### Common Console Messages

```
[McGraw Plus] Assignment scraper initializing...
```
Normal - scraper is starting

```
[McGraw Plus] Loaded 3 courses, 12 assignments from cache
```
Normal - data loaded

```
[McGraw Plus] Another tab is scraping, skipping initialization
```
Normal - multi-tab coordination working

```
[McGraw Plus] Lock acquisition error: ...
```
Warning - storage issue, but will proceed

### Storage Debugging

1. Go to `chrome://extensions`
2. Click "Details" on McGraw Plus
3. Click "Inspect" on any view
4. Go to Application > Storage > Local Storage

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
