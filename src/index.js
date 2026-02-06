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
    toggleBtn: document.getElementById("toggle-btn"),
    toggleText: document.getElementById("toggle-text"),
    statusIndicator: document.getElementById("status-indicator"),
    statusValue: document.getElementById("status-value"),
    hintText: document.getElementById("hint-text"),
    version: document.getElementById("version"),
    updateBtn: document.getElementById("update-btn"),
    currentVersion: document.querySelector(".version-info .current"),
    latestVersion: document.querySelector(".version-info .latest"),
  };

  const STORAGE_KEYS = {
    agreed: "hasAgreedToDisclaimer",
    botEnabled: "isBotEnabled",
  };

  const GITHUB_API = "https://api.github.com/repos/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/releases/latest";
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

  // Check for updates - returns { needsUpdate, latestVersion, downloadUrl }
  const checkForUpdate = async () => {
    try {
      const res = await fetch(GITHUB_API, {
        headers: { Accept: "application/vnd.github.v3+json" },
      });
      if (!res.ok) return { needsUpdate: false };

      const release = await res.json();
      const latest = release.tag_name;
      const current = chrome.runtime.getManifest().version;

      return {
        needsUpdate: compareSemver(latest, current) > 0,
        latestVersion: latest.replace(/^v/, ""),
        currentVersion: current,
        downloadUrl: release.html_url,
      };
    } catch {
      return { needsUpdate: false };
    }
  };

  // Send message to content script with retry
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
        if (err.message?.includes("Could not establish connection") ||
            err.message?.includes("Receiving end does not exist")) {
          if (!injected) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["contentSolver.js"],
            });
            injected = true;
          }
          await sleep(200);
        } else {
          // Ignore other errors (like async response channel closing)
          return true;
        }
      }
    }
    return false;
  };

  // Update UI based on bot state
  const updateUI = (isActive, isOnSite) => {
    elements.toggleBtn.disabled = !isOnSite;

    if (isOnSite) {
      elements.statusIndicator.className = `status-indicator ${isActive ? "active" : "inactive"}`;
      elements.statusValue.textContent = isActive ? "Active" : "Inactive";
      elements.toggleText.textContent = isActive ? "Stop Solver" : "Start Solver";
      elements.toggleBtn.className = `btn btn-toggle ${isActive ? "active" : ""}`;
      elements.hintText.textContent = "";
    } else {
      elements.statusIndicator.className = "status-indicator inactive";
      elements.statusValue.textContent = "Not on McGraw-Hill";
      elements.toggleText.textContent = "Start Solver";
      elements.toggleBtn.className = "btn btn-toggle";
      elements.hintText.textContent = "Open a McGraw-Hill SmartBook page to use";
    }
  };

  // Initialize
  const init = async () => {
    // Show version
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
    const storage = await chrome.storage.local.get([STORAGE_KEYS.agreed, STORAGE_KEYS.botEnabled]);

    if (!storage[STORAGE_KEYS.agreed]) {
      showScreen("disclaimer");
      return;
    }

    // Show main screen
    showScreen("main");

    // Check current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const isOnSite = tabs[0]?.url?.includes(TARGET_URL) || false;
    const isActive = storage[STORAGE_KEYS.botEnabled] === true;

    updateUI(isActive, isOnSite);
  };

  // Event: Agree checkbox
  elements.agreeCheckbox.addEventListener("change", () => {
    elements.agreeBtn.disabled = !elements.agreeCheckbox.checked;
  });

  // Event: Agree button
  elements.agreeBtn.addEventListener("click", async () => {
    await chrome.storage.local.set({ [STORAGE_KEYS.agreed]: true });
    showScreen("main");

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const isOnSite = tabs[0]?.url?.includes(TARGET_URL) || false;
    const storage = await chrome.storage.local.get(STORAGE_KEYS.botEnabled);

    updateUI(storage[STORAGE_KEYS.botEnabled] === true, isOnSite);
  });

  // Event: Toggle button
  elements.toggleBtn.addEventListener("click", async () => {
    if (elements.toggleBtn.disabled) return;

    const storage = await chrome.storage.local.get(STORAGE_KEYS.botEnabled);
    const isCurrentlyActive = storage[STORAGE_KEYS.botEnabled] === true;
    const newState = !isCurrentlyActive;
    const action = newState ? "activate" : "deactivate";

    // Update storage first
    await chrome.storage.local.set({ [STORAGE_KEYS.botEnabled]: newState });

    // Update UI optimistically
    updateUI(newState, true);

    // Send command to content script
    await sendCommand(action);
  });

  // Start
  init();
});
