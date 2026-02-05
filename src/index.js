/**
 * SmartBook Solver v4.1.0 - Popup Script (Minimal UI)
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- Storage Keys ---
  const STORAGE = {
    AGREEMENT: "hasAgreedToDisclaimer",
    BOT_ENABLED: "isBotEnabled",
    WEBHOOK_URL: "sbs_webhook_url",
    LLM_PROVIDER: "sbs_llm_provider",
    LLM_API_KEY: "sbs_llm_api_key",
    LLM_ENABLED: "sbs_llm_enabled",
    ANTI_COPY: "sbs_anti_copy_enabled",
    STATS: "sbs_stats",
    GITHUB_USERNAME: "sbs_github_username",
    STAR_VERIFIED: "sbs_star_verified",
  };

  // GitHub repo info for star verification
  const REPO_OWNER = "KevinTrinh1227";
  const REPO_NAME = "McGraw-Hill-SmartBook-Solver";

  const TARGET_URL = "mheducation.com";

  // --- DOM Elements ---
  const elements = {
    // Screens
    disclaimerScreen: document.getElementById("disclaimer-screen"),
    mainScreen: document.getElementById("main-screen"),

    // Disclaimer
    agreeCheckbox: document.getElementById("agree-checkbox"),
    continueBtn: document.getElementById("continue-btn"),

    // Status
    statusIndicator: document.getElementById("status-indicator"),
    statusLabel: document.querySelector(".status-label"),
    toggleBtn: document.getElementById("toggle-btn"),
    toggleBtnText: document.querySelector("#toggle-btn .btn-text"),
    hintText: document.getElementById("hint-text"),

    // Quick Stats
    statQuestions: document.getElementById("stat-questions"),
    statCorrect: document.getElementById("stat-correct"),
    statLearned: document.getElementById("stat-learned"),

    // Settings (accordion)
    webhookUrl: document.getElementById("webhook-url"),
    saveWebhookBtn: document.getElementById("save-webhook-btn"),
    testWebhookBtn: document.getElementById("test-webhook-btn"),
    llmEnabled: document.getElementById("llm-enabled"),
    llmProvider: document.getElementById("llm-provider"),
    llmApiKey: document.getElementById("llm-api-key"),
    saveLlmBtn: document.getElementById("save-llm-btn"),
    testLlmBtn: document.getElementById("test-llm-btn"),
    antiCopyEnabled: document.getElementById("anti-copy-enabled"),

    // Star Verification
    starBadge: document.getElementById("star-badge"),
    starStatus: document.getElementById("star-status"),
    githubUsername: document.getElementById("github-username"),
    verifyStarBtn: document.getElementById("verify-star-btn"),

    // Debug (accordion)
    debugSection: document.getElementById("debug-section"),
    debugQaCount: document.getElementById("debug-qa-count"),
    debugStorageSize: document.getElementById("debug-storage-size"),
    debugSearch: document.getElementById("debug-search"),
    debugQaList: document.getElementById("debug-qa-list"),
    debugExportBtn: document.getElementById("debug-export-btn"),
    debugClearBtn: document.getElementById("debug-clear-btn"),
    debugOverlayEnabled: document.getElementById("debug-overlay-enabled"),

    // Update Banner
    updateBanner: document.getElementById("update-banner"),
    updateText: document.getElementById("update-text"),
    updateLink: document.getElementById("update-link"),
    updateDismiss: document.getElementById("update-dismiss"),

    // Footer
    versionDisplay: document.getElementById("version-display"),

    // Hidden legacy elements
    lifetimeQuestions: document.getElementById("lifetime-questions"),
    lifetimeCorrect: document.getElementById("lifetime-correct"),
    lifetimeLearned: document.getElementById("lifetime-learned"),
    lifetimeAccuracy: document.getElementById("lifetime-accuracy"),
    lifetimeSessions: document.getElementById("lifetime-sessions"),
    lifetimeTime: document.getElementById("lifetime-time"),
    typeMc: document.getElementById("type-mc"),
    typeFib: document.getElementById("type-fib"),
    typeDnd: document.getElementById("type-dnd"),
    resetStatsBtn: document.getElementById("reset-stats-btn"),
    settingsBtn: document.getElementById("settings-btn"),
    premiumFeatures: document.getElementById("premium-features"),
  };

  // --- Utility Functions ---
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function formatDuration(ms) {
    if (!ms || ms < 0) return "0m";
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  // --- Screen Management ---
  function showDisclaimer() {
    elements.disclaimerScreen.style.display = "block";
    elements.mainScreen.style.display = "none";
  }

  function showMain() {
    elements.disclaimerScreen.style.display = "none";
    elements.mainScreen.style.display = "block";
    initMainScreen();
  }

  // --- Disclaimer Handlers ---
  elements.agreeCheckbox.addEventListener("change", () => {
    elements.continueBtn.disabled = !elements.agreeCheckbox.checked;
  });

  elements.continueBtn.addEventListener("click", () => {
    if (elements.agreeCheckbox.checked) {
      chrome.storage.local.set({ [STORAGE.AGREEMENT]: true });
      showMain();
    }
  });

  // --- DEV_MODE Check ---
  let DEV_MODE = false;

  async function checkDevMode() {
    return new Promise((resolve) => {
      chrome.storage.local.get("sbs_dev_mode", (result) => {
        DEV_MODE = result.sbs_dev_mode === true;
        resolve(DEV_MODE);
      });
    });
  }

  // --- Main Screen Initialization ---
  async function initMainScreen() {
    showVersion();
    checkForUpdate();
    loadSettings();
    loadStats();
    loadStarStatus();
    checkBotStatus();
    setupAccordion();
    setupSettingsHandlers();

    // Check for DEV_MODE and show debug section if enabled
    await checkDevMode();
    if (DEV_MODE && elements.debugSection) {
      elements.debugSection.style.display = "block";
      initDebugSection();
    }
  }

  // --- Version Display ---
  function showVersion() {
    const version = chrome.runtime.getManifest().version;
    elements.versionDisplay.textContent = `v${version}`;
  }

  // --- Update Check ---
  function checkForUpdate() {
    chrome.storage.local.get(
      ["updateAvailable", "updateVersion", "updateUrl", "dismissedUpdateVersion"],
      (result) => {
        if (
          result.updateAvailable &&
          result.updateVersion &&
          result.dismissedUpdateVersion !== result.updateVersion
        ) {
          elements.updateText.textContent = `v${result.updateVersion} available`;
          elements.updateLink.href = result.updateUrl || "#";
          elements.updateBanner.style.display = "flex";
        } else {
          elements.updateBanner.style.display = "none";
        }
      }
    );
  }

  elements.updateDismiss.addEventListener("click", () => {
    chrome.storage.local.get("updateVersion", (result) => {
      if (result.updateVersion) {
        chrome.storage.local.set({ dismissedUpdateVersion: result.updateVersion });
      }
      elements.updateBanner.style.display = "none";
    });
  });

  // --- Bot Status Management ---
  function updateBotUI(isActive) {
    elements.toggleBtn.disabled = false;

    if (isActive) {
      elements.statusIndicator.className = "active";
      elements.statusLabel.textContent = "ACTIVE";
      elements.toggleBtnText.textContent = "Deactivate";
      elements.toggleBtn.classList.add("active");
    } else {
      elements.statusIndicator.className = "inactive";
      elements.statusLabel.textContent = "INACTIVE";
      elements.toggleBtnText.textContent = "Activate";
      elements.toggleBtn.classList.remove("active");
    }
  }

  function handleNotOnTargetPage(isActive) {
    elements.toggleBtn.disabled = true;
    elements.toggleBtnText.textContent = "Open MH";
    elements.toggleBtn.classList.remove("active");
    elements.hintText.textContent = "Navigate to SmartBook first";

    if (isActive) {
      elements.statusIndicator.className = "active";
      elements.statusLabel.textContent = "ACTIVE";
    } else {
      elements.statusIndicator.className = "inactive";
      elements.statusLabel.textContent = "INACTIVE";
    }
  }

  function checkBotStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0]?.url || "";

      chrome.storage.local.get(STORAGE.BOT_ENABLED, (result) => {
        const isActive = result[STORAGE.BOT_ENABLED] === true;

        if (currentUrl.includes(TARGET_URL)) {
          updateBotUI(isActive);
          elements.hintText.textContent = isActive
            ? "Bot is running"
            : "Click to start";
        } else {
          handleNotOnTargetPage(isActive);
        }
      });
    });
  }

  async function sendBotCommand(action) {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const activeTab = tabs[0];

        if (!activeTab?.url?.includes(TARGET_URL)) {
          resolve(false);
          return;
        }

        let scriptInjected = false;
        const MAX_RETRIES = 5;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            await chrome.tabs.sendMessage(activeTab.id, action);
            resolve(true);
            return;
          } catch (error) {
            if (error.message?.includes("Could not establish connection") && !scriptInjected) {
              await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: ["config.js", "contentSolver.js"],
              });
              scriptInjected = true;
            }
            await sleep(200);
          }
        }
        resolve(false);
      });
    });
  }

  elements.toggleBtn.addEventListener("click", async () => {
    if (elements.toggleBtn.disabled) return;

    const isCurrentlyActive = elements.toggleBtn.classList.contains("active");
    const newAction = isCurrentlyActive ? "deactivate" : "activate";
    const newState = !isCurrentlyActive;

    // Update UI optimistically
    updateBotUI(newState);
    elements.hintText.textContent = newState
      ? "Bot is running"
      : "Click to start";

    // Send command
    const success = await sendBotCommand(newAction);
    if (!success) {
      // Revert on failure
      updateBotUI(isCurrentlyActive);
      elements.hintText.textContent = "Failed. Refresh page.";
    }
  });

  // --- Accordion Handlers ---
  function setupAccordion() {
    const triggers = document.querySelectorAll(".accordion-trigger");
    triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const section = trigger.closest(".accordion-section");
        const isOpen = section.classList.contains("open");

        // Close all sections
        document.querySelectorAll(".accordion-section").forEach((s) => {
          s.classList.remove("open");
        });

        // Open clicked section if it wasn't open
        if (!isOpen) {
          section.classList.add("open");
        }
      });
    });
  }

  // --- Stats Management ---
  function loadStats() {
    chrome.storage.local.get(STORAGE.STATS, (result) => {
      const stats = result[STORAGE.STATS] || {
        totalQuestions: 0,
        correctFirstTry: 0,
        learnedFromFeedback: 0,
        totalSessions: 0,
        totalTimeMs: 0,
        byType: { multipleChoice: 0, fillInBlank: 0, dragAndDrop: 0 },
        currentSession: null,
      };

      // Quick stats - show session stats (learned = questions that were wrong but now learned)
      const session = stats.currentSession || {};
      elements.statQuestions.textContent = session.questions || 0;
      elements.statCorrect.textContent = session.correct || 0;
      // Learned = questions answered wrong (had to learn from feedback)
      const learned = (session.questions || 0) - (session.correct || 0);
      elements.statLearned.textContent = learned >= 0 ? learned : 0;

      // Lifetime stats (hidden but kept for compatibility)
      const accuracy =
        stats.totalQuestions > 0
          ? Math.round((stats.correctFirstTry / stats.totalQuestions) * 100)
          : 0;
      const timeSavedMs = stats.totalQuestions * 30 * 1000;

      if (elements.lifetimeQuestions) elements.lifetimeQuestions.textContent = stats.totalQuestions;
      if (elements.lifetimeCorrect) elements.lifetimeCorrect.textContent = stats.correctFirstTry;
      if (elements.lifetimeLearned) elements.lifetimeLearned.textContent = stats.learnedFromFeedback;
      if (elements.lifetimeAccuracy) elements.lifetimeAccuracy.textContent = `${accuracy}%`;
      if (elements.lifetimeSessions) elements.lifetimeSessions.textContent = stats.totalSessions;
      if (elements.lifetimeTime) elements.lifetimeTime.textContent = formatDuration(timeSavedMs);

      // By type
      if (elements.typeMc) elements.typeMc.textContent = stats.byType?.multipleChoice || 0;
      if (elements.typeFib) elements.typeFib.textContent = stats.byType?.fillInBlank || 0;
      if (elements.typeDnd) elements.typeDnd.textContent = stats.byType?.dragAndDrop || 0;
    });
  }

  if (elements.resetStatsBtn) {
    elements.resetStatsBtn.addEventListener("click", () => {
      if (confirm("Reset all stats? This cannot be undone.")) {
        chrome.storage.local.remove(STORAGE.STATS, () => {
          loadStats();
        });
      }
    });
  }

  // --- Settings Management ---
  function loadSettings() {
    chrome.storage.local.get(
      [STORAGE.WEBHOOK_URL, STORAGE.LLM_PROVIDER, STORAGE.LLM_API_KEY, STORAGE.LLM_ENABLED, STORAGE.ANTI_COPY],
      (result) => {
        // Webhook
        if (result[STORAGE.WEBHOOK_URL] && elements.webhookUrl) {
          elements.webhookUrl.value = result[STORAGE.WEBHOOK_URL];
        }

        // LLM
        if (elements.llmEnabled) {
          elements.llmEnabled.checked = result[STORAGE.LLM_ENABLED] === true;
        }
        if (result[STORAGE.LLM_PROVIDER] && elements.llmProvider) {
          elements.llmProvider.value = result[STORAGE.LLM_PROVIDER];
        }
        if (result[STORAGE.LLM_API_KEY] && elements.llmApiKey) {
          elements.llmApiKey.value = result[STORAGE.LLM_API_KEY];
        }

        // Anti-copy
        if (elements.antiCopyEnabled) {
          elements.antiCopyEnabled.checked = result[STORAGE.ANTI_COPY] === true;
        }
      }
    );
  }

  function setupSettingsHandlers() {
    // Webhook
    if (elements.saveWebhookBtn) {
      elements.saveWebhookBtn.addEventListener("click", () => {
        const url = elements.webhookUrl.value.trim();
        if (url && !url.includes("discord.com/api/webhooks/")) {
          alert("Invalid Discord webhook URL");
          return;
        }
        chrome.storage.local.set({ [STORAGE.WEBHOOK_URL]: url || null });
        alert("Saved!");
      });
    }

    if (elements.testWebhookBtn) {
      elements.testWebhookBtn.addEventListener("click", async () => {
        const url = elements.webhookUrl.value.trim();
        if (!url) {
          alert("Enter a webhook URL first");
          return;
        }

        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: "SmartBook Solver",
              embeds: [
                {
                  title: "Test",
                  description: "Connection successful!",
                  color: 0x6366f1,
                  timestamp: new Date().toISOString(),
                },
              ],
            }),
          });

          if (response.ok) {
            alert("Test sent! Check Discord.");
          } else {
            alert(`Failed: ${response.status}`);
          }
        } catch (error) {
          alert(`Error: ${error.message}`);
        }
      });
    }

    // LLM
    if (elements.saveLlmBtn) {
      elements.saveLlmBtn.addEventListener("click", () => {
        chrome.storage.local.set({
          [STORAGE.LLM_ENABLED]: elements.llmEnabled.checked,
          [STORAGE.LLM_PROVIDER]: elements.llmProvider.value,
          [STORAGE.LLM_API_KEY]: elements.llmApiKey.value.trim() || null,
        });
        alert("Saved!");
      });
    }

    if (elements.testLlmBtn) {
      elements.testLlmBtn.addEventListener("click", async () => {
        const apiKey = elements.llmApiKey.value.trim();
        const provider = elements.llmProvider.value;

        if (!apiKey) {
          alert("Enter an API key first");
          return;
        }

        const providers = {
          groq: {
            endpoint: "https://api.groq.com/openai/v1/chat/completions",
            model: "llama-3.3-70b-versatile",
          },
          openai: {
            endpoint: "https://api.openai.com/v1/chat/completions",
            model: "gpt-4o-mini",
          },
          anthropic: {
            endpoint: "https://api.anthropic.com/v1/messages",
            model: "claude-3-haiku-20240307",
          },
        };

        const config = providers[provider];

        try {
          let response;
          if (provider === "anthropic") {
            response = await fetch(config.endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: config.model,
                max_tokens: 50,
                messages: [{ role: "user", content: "Say 'test successful'" }],
              }),
            });
          } else {
            response = await fetch(config.endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: config.model,
                max_tokens: 50,
                messages: [{ role: "user", content: "Say 'test successful'" }],
              }),
            });
          }

          if (response.ok) {
            alert("API connection successful!");
          } else {
            const error = await response.text();
            alert(`API error: ${response.status}\n${error.slice(0, 100)}`);
          }
        } catch (error) {
          alert(`Error: ${error.message}`);
        }
      });
    }

    // Anti-copy toggle
    if (elements.antiCopyEnabled) {
      elements.antiCopyEnabled.addEventListener("change", () => {
        chrome.storage.local.set({ [STORAGE.ANTI_COPY]: elements.antiCopyEnabled.checked });
      });
    }

    // Star verification
    if (elements.verifyStarBtn) {
      elements.verifyStarBtn.addEventListener("click", verifyStar);
    }
  }

  // --- Star Verification ---
  async function loadStarStatus() {
    chrome.storage.local.get([STORAGE.GITHUB_USERNAME, STORAGE.STAR_VERIFIED], (result) => {
      const username = result[STORAGE.GITHUB_USERNAME];
      const verified = result[STORAGE.STAR_VERIFIED] === true;

      if (username && elements.githubUsername) {
        elements.githubUsername.value = username;
      }

      if (verified) {
        showVerifiedStatus(username);
        applyPremiumTheme();
      }
    });
  }

  function showVerifiedStatus(username) {
    if (elements.starStatus) {
      elements.starStatus.classList.add("verified");
      elements.starStatus.innerHTML = `<span class="star-text">Verified: @${username}</span>`;
    }
    if (elements.starBadge) {
      elements.starBadge.style.display = "inline";
    }
  }

  function showUnverifiedStatus() {
    if (elements.starStatus) {
      elements.starStatus.classList.remove("verified");
      elements.starStatus.innerHTML = `<span class="star-text">Not verified</span>`;
    }
    if (elements.starBadge) {
      elements.starBadge.style.display = "none";
    }
    document.body.classList.remove("premium-theme");
  }

  function applyPremiumTheme() {
    document.body.classList.add("premium-theme");
  }

  async function checkStargazer(username) {
    const normalizedUsername = username.trim().toLowerCase();
    let page = 1;
    const perPage = 100;

    while (true) {
      try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/stargazers?per_page=${perPage}&page=${page}`;
        const response = await fetch(url, {
          headers: { Accept: "application/vnd.github.v3+json" },
        });

        if (!response.ok) {
          if (response.status === 403) {
            return { error: "Rate limited. Try again later." };
          }
          return { error: `GitHub API error: ${response.status}` };
        }

        const users = await response.json();

        if (users.length === 0) {
          return { found: false };
        }

        for (const user of users) {
          if (user.login.toLowerCase() === normalizedUsername) {
            return { found: true };
          }
        }

        if (users.length < perPage) {
          return { found: false };
        }

        page++;
        if (page > 50) {
          return { found: false };
        }
      } catch (error) {
        return { error: error.message };
      }
    }
  }

  async function verifyStar() {
    const username = elements.githubUsername.value.trim();

    if (!username) {
      alert("Enter your GitHub username");
      return;
    }

    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)) {
      alert("Invalid username format");
      return;
    }

    elements.verifyStarBtn.disabled = true;
    elements.verifyStarBtn.textContent = "...";

    try {
      const userResponse = await fetch(`https://api.github.com/users/${username}`, {
        headers: { Accept: "application/vnd.github.v3+json" },
      });

      if (!userResponse.ok) {
        if (userResponse.status === 404) {
          alert("User not found");
        } else {
          alert(`Error: ${userResponse.status}`);
        }
        return;
      }

      const result = await checkStargazer(username);

      if (result.error) {
        alert(result.error);
        return;
      }

      if (result.found) {
        chrome.storage.local.set({
          [STORAGE.GITHUB_USERNAME]: username,
          [STORAGE.STAR_VERIFIED]: true,
        });
        showVerifiedStatus(username);
        applyPremiumTheme();
        alert("Verified! Premium unlocked.");
      } else {
        chrome.storage.local.set({
          [STORAGE.GITHUB_USERNAME]: username,
          [STORAGE.STAR_VERIFIED]: false,
        });
        showUnverifiedStatus();
        alert("Star not found. Click 'Star Repo' first!");
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      elements.verifyStarBtn.disabled = false;
      elements.verifyStarBtn.textContent = "Verify";
    }
  }

  // --- Debug Section Functions ---
  let responseMapCache = {};

  function initDebugSection() {
    loadDebugQAData();

    if (elements.debugSearch) {
      elements.debugSearch.addEventListener("input", () => {
        renderDebugQAList(elements.debugSearch.value);
      });
    }

    if (elements.debugExportBtn) {
      elements.debugExportBtn.addEventListener("click", () => {
        const dataStr = JSON.stringify(responseMapCache, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `smartbook-qa-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    if (elements.debugClearBtn) {
      elements.debugClearBtn.addEventListener("click", () => {
        if (confirm("Clear ALL stored Q&A data?")) {
          chrome.storage.local.remove("responseMap", () => {
            responseMapCache = {};
            loadDebugQAData();
            alert("Cleared.");
          });
        }
      });
    }

    if (elements.debugOverlayEnabled) {
      chrome.storage.local.get("sbs_debug_overlay", (result) => {
        elements.debugOverlayEnabled.checked = result.sbs_debug_overlay === true;
      });

      elements.debugOverlayEnabled.addEventListener("change", () => {
        chrome.storage.local.set({ sbs_debug_overlay: elements.debugOverlayEnabled.checked });
      });
    }
  }

  function loadDebugQAData() {
    chrome.storage.local.get("responseMap", (result) => {
      responseMapCache = result.responseMap || {};
      const count = Object.keys(responseMapCache).length;
      const sizeBytes = new Blob([JSON.stringify(responseMapCache)]).size;
      const sizeKB = (sizeBytes / 1024).toFixed(1);

      if (elements.debugQaCount) {
        elements.debugQaCount.textContent = count;
      }
      if (elements.debugStorageSize) {
        elements.debugStorageSize.textContent = sizeKB + " KB";
      }

      renderDebugQAList();
    });
  }

  function renderDebugQAList(filter = "") {
    if (!elements.debugQaList) return;

    const entries = Object.entries(responseMapCache);
    const filtered = filter
      ? entries.filter(([q]) => q.toLowerCase().includes(filter.toLowerCase()))
      : entries;

    if (filtered.length === 0) {
      elements.debugQaList.innerHTML = `<div class="debug-qa-empty">${filter ? "No matches" : "No Q&A data"}</div>`;
      return;
    }

    const html = filtered
      .slice(-30)
      .reverse()
      .map(([question, answers]) => {
        const answerText = Array.isArray(answers) ? answers.join(", ") : answers;
        const shortQuestion = question.length > 50 ? question.slice(0, 50) + "..." : question;
        const shortAnswer = answerText.length > 30 ? answerText.slice(0, 30) + "..." : answerText;
        return `
          <div class="debug-qa-item" data-question="${encodeURIComponent(question)}">
            <div class="debug-qa-question">${escapeHtml(shortQuestion)}</div>
            <div class="debug-qa-answer">${escapeHtml(shortAnswer)}</div>
          </div>
        `;
      })
      .join("");

    elements.debugQaList.innerHTML = html;

    elements.debugQaList.querySelectorAll(".debug-qa-item").forEach((item) => {
      item.addEventListener("click", () => {
        const question = decodeURIComponent(item.dataset.question);
        const answers = responseMapCache[question];
        showQADetail(question, answers);
      });
    });
  }

  function showQADetail(question, answers) {
    const overlay = document.createElement("div");
    overlay.className = "debug-qa-detail-overlay";
    overlay.addEventListener("click", () => {
      overlay.remove();
      detail.remove();
    });

    const detail = document.createElement("div");
    detail.className = "debug-qa-detail";
    detail.innerHTML = `
      <button class="close-btn">&times;</button>
      <h4>Question:</h4>
      <pre>${escapeHtml(question)}</pre>
      <h4 style="margin-top: 10px;">Answer:</h4>
      <pre>${escapeHtml(JSON.stringify(answers, null, 2))}</pre>
    `;

    detail.querySelector(".close-btn").addEventListener("click", () => {
      overlay.remove();
      detail.remove();
    });

    document.body.appendChild(overlay);
    document.body.appendChild(detail);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Storage Change Listener for Real-time Stats Updates ---
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE.STATS]) {
      loadStats();
    }
    if (changes.responseMap && DEV_MODE) {
      loadDebugQAData();
    }
  });

  // --- Initialize ---
  chrome.storage.local.get(STORAGE.AGREEMENT, (result) => {
    if (result[STORAGE.AGREEMENT]) {
      showMain();
    } else {
      showDisclaimer();
    }
  });
});
