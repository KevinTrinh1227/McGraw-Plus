document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const screens = {
    update: document.getElementById("update-screen"),
    disclaimer: document.getElementById("disclaimer-screen"),
    main: document.getElementById("main-screen"),
  };

  const elements = {
    agreeCheckbox: document.getElementById("agree-checkbox"),
    agreeBtn: document.getElementById("agree-btn"),
    powerBtn: document.getElementById("power-btn"),
    statusText: document.getElementById("status-text"),
    hintText: document.getElementById("hint-text"),
    version: document.getElementById("version"),
    shareBtn: document.getElementById("share-btn"),
    updateBtn: document.getElementById("update-btn"),
    currentVersion: document.querySelector(".version-info .current"),
    latestVersion: document.querySelector(".version-info .latest"),
  };

  const STORAGE_KEYS = {
    agreed: "hasAgreedToDisclaimer",
    botEnabled: "isBotEnabled",
  };

  const GITHUB_REPO = "https://github.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver";
  const GITHUB_API = `https://api.github.com/repos/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/releases/latest`;
  const TARGET_URL = "mheducation.com";

  // Helpers
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const showScreen = (name) => {
    Object.values(screens).forEach((s) => (s.style.display = "none"));
    screens[name].style.display = "flex";
  };

  const compareSemver = (a, b) => {
    const pa = a.replace(/^v/, "").split(".").map(Number);
    const pb = b.replace(/^v/, "").split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return 1;
      if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    }
    return 0;
  };

  // Check for updates
  const checkForUpdate = async () => {
    try {
      const res = await fetch(GITHUB_API, {
        headers: { Accept: "application/vnd.github.v3+json" },
      });
      if (!res.ok) return { needsUpdate: false };

      const release = await res.json();
      const latest = release.tag_name;
      const current = chrome.runtime.getManifest().version;

      // Find the zip asset
      let downloadUrl = release.html_url;
      const zipAsset = release.assets?.find((a) => a.name.endsWith(".zip"));
      if (zipAsset) {
        downloadUrl = zipAsset.browser_download_url;
      }

      return {
        needsUpdate: compareSemver(latest, current) > 0,
        latestVersion: latest.replace(/^v/, ""),
        currentVersion: current,
        downloadUrl: downloadUrl,
      };
    } catch {
      return { needsUpdate: false };
    }
  };

  // Send message to content script
  const sendCommand = async (action) => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab?.url?.includes(TARGET_URL)) return false;

    let injected = false;

    for (let i = 0; i < 3; i++) {
      try {
        await chrome.tabs.sendMessage(tab.id, action);
        return true;
      } catch (err) {
        if (
          err.message?.includes("Could not establish connection") ||
          err.message?.includes("Receiving end does not exist")
        ) {
          if (!injected) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["contentSolver.js"],
            });
            injected = true;
          }
          await sleep(200);
        } else {
          return true;
        }
      }
    }
    return false;
  };

  // Update UI
  const updateUI = (isActive, isOnSite) => {
    elements.powerBtn.disabled = !isOnSite;

    if (isOnSite) {
      elements.powerBtn.className = `power-btn ${isActive ? "active" : ""}`;
      elements.statusText.textContent = isActive ? "Active" : "Inactive";
      elements.statusText.className = `status-text ${isActive ? "active" : ""}`;
      elements.hintText.textContent = "";
    } else {
      elements.powerBtn.className = "power-btn";
      elements.statusText.textContent = "Not on McGraw-Hill";
      elements.statusText.className = "status-text";
      elements.hintText.textContent = "Open a SmartBook page to use";
    }
  };

  // Share functionality
  const shareExtension = async () => {
    const shareData = {
      title: "McGraw Plus",
      text: "Check out McGraw Plus - a SmartBook study tool!",
      url: GITHUB_REPO,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(GITHUB_REPO);
        elements.shareBtn.innerHTML = "<span>✓</span> Copied!";
        setTimeout(() => {
          elements.shareBtn.innerHTML = "<span>🔗</span> Share";
        }, 2000);
      }
    } catch {
      await navigator.clipboard.writeText(GITHUB_REPO);
      elements.shareBtn.innerHTML = "<span>✓</span> Copied!";
      setTimeout(() => {
        elements.shareBtn.innerHTML = "<span>🔗</span> Share";
      }, 2000);
    }
  };

  // Initialize
  const init = async () => {
    const version = chrome.runtime.getManifest().version;
    elements.version.textContent = `v${version}`;

    // Check for required update
    const update = await checkForUpdate();
    if (update.needsUpdate) {
      elements.currentVersion.textContent = `v${update.currentVersion}`;
      elements.latestVersion.textContent = `v${update.latestVersion}`;
      elements.updateBtn.href = update.downloadUrl;
      showScreen("update");
      return;
    }

    // Check agreement
    const storage = await chrome.storage.local.get([
      STORAGE_KEYS.agreed,
      STORAGE_KEYS.botEnabled,
    ]);

    if (!storage[STORAGE_KEYS.agreed]) {
      showScreen("disclaimer");
      return;
    }

    // Show main screen
    showScreen("main");

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const isOnSite = tabs[0]?.url?.includes(TARGET_URL) || false;
    const isActive = storage[STORAGE_KEYS.botEnabled] === true;

    updateUI(isActive, isOnSite);
  };

  // Events
  elements.agreeCheckbox.addEventListener("change", () => {
    elements.agreeBtn.disabled = !elements.agreeCheckbox.checked;
  });

  elements.agreeBtn.addEventListener("click", async () => {
    await chrome.storage.local.set({ [STORAGE_KEYS.agreed]: true });
    showScreen("main");

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const isOnSite = tabs[0]?.url?.includes(TARGET_URL) || false;
    const storage = await chrome.storage.local.get(STORAGE_KEYS.botEnabled);

    updateUI(storage[STORAGE_KEYS.botEnabled] === true, isOnSite);
  });

  elements.powerBtn.addEventListener("click", async () => {
    if (elements.powerBtn.disabled) return;

    const storage = await chrome.storage.local.get(STORAGE_KEYS.botEnabled);
    const isCurrentlyActive = storage[STORAGE_KEYS.botEnabled] === true;
    const newState = !isCurrentlyActive;
    const action = newState ? "activate" : "deactivate";

    await chrome.storage.local.set({ [STORAGE_KEYS.botEnabled]: newState });
    updateUI(newState, true);
    await sendCommand(action);
  });

  elements.shareBtn.addEventListener("click", shareExtension);

  // Start
  init();
});
