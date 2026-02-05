// background.js / serviceCore.js

// --- Tab Activation ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const isMHEducation = tab.url && tab.url.includes("learning.mheducation.com");

  if (isMHEducation && changeInfo.status === "complete") {
    chrome.storage.local.get("isBotEnabled", (result) => {
      const isEnabled = result.isBotEnabled === true;

      if (isEnabled) {
        console.log(
          `[Background] Bot is enabled. Activating solver on tab ${tabId}.`
        );

        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, "activate", (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "[Background] Initial activation message failed, likely due to timing."
              );
            }
          });
        }, 500);
      }
    });
  }
});

// --- Message Listener ---
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // Only handle messages explicitly intended for the background script
  if (request && request.action === "updateMapData") {
    // Forward to content script — no response needed from background
    return false;
  }
  return false;
});

// --- Auto-Update Checker ---

function compareSemver(a, b) {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

async function checkForUpdate() {
  try {
    const response = await fetch(
      "https://api.github.com/repos/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/releases/latest",
      { headers: { Accept: "application/vnd.github.v3+json" } }
    );

    if (!response.ok) {
      console.warn("[Update] GitHub API returned", response.status);
      return;
    }

    const release = await response.json();
    const latestVersion = release.tag_name; // e.g. "v3.1.0" or "3.1.0"
    const currentVersion = chrome.runtime.getManifest().version;

    // Find the ZIP asset URL for direct download (increments download count)
    let downloadUrl = release.html_url; // fallback to release page
    if (release.assets && release.assets.length > 0) {
      // Look for a .zip file in the assets
      const zipAsset = release.assets.find(
        (asset) => asset.name.endsWith(".zip") && asset.browser_download_url
      );
      if (zipAsset) {
        downloadUrl = zipAsset.browser_download_url;
        console.log("[Update] Found ZIP asset:", zipAsset.name);
      }
    }

    if (compareSemver(latestVersion, currentVersion) > 0) {
      console.log(
        `[Update] New version available: ${latestVersion} (current: ${currentVersion})`
      );
      chrome.storage.local.set({
        updateAvailable: true,
        updateVersion: latestVersion.replace(/^v/, ""),
        updateUrl: downloadUrl,
      });
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#4caf50" });
    } else {
      console.log("[Update] Already on latest version:", currentVersion);
      chrome.storage.local.set({ updateAvailable: false });
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (err) {
    console.warn("[Update] Failed to check for updates:", err.message);
  }
}

// Check on install/update
chrome.runtime.onInstalled.addListener(() => {
  checkForUpdate();
});

// Check on startup
chrome.runtime.onStartup.addListener(() => {
  checkForUpdate();
});

// Periodic check every 6 hours
chrome.alarms.create("checkForUpdate", { periodInMinutes: 360 });

// Also check 1 minute after load
chrome.alarms.create("initialUpdateCheck", { delayInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkForUpdate" || alarm.name === "initialUpdateCheck") {
    checkForUpdate();
  }
});
