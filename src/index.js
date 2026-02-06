document.addEventListener("DOMContentLoaded", () => {
  // --- Screen Elements ---
  const readmeScreen = document.getElementById("readme-screen");
  const mainScreen = document.getElementById("main-screen");
  const mainHeaderTitle = document.getElementById("main-header-title");

  // --- ReadMe Elements ---
  const agreeCheckbox = document.getElementById("agree-checkbox");
  const continueButton = document.getElementById("continue-button");

  // --- Main Screen Elements ---
  const statusMessage = document.getElementById("status-message");
  const toggleButton = document.getElementById("toggle-bot");

  // --- Update Banner Elements ---
  const updateBanner = document.getElementById("update-banner");
  const updateText = document.getElementById("update-text");
  const updateLink = document.getElementById("update-link");
  const updateDismiss = document.getElementById("update-dismiss");

  // --- Version Display ---
  const versionDisplay = document.getElementById("version-display");

  const AGREEMENT_KEY = "hasAgreedToDisclaimer";
  const MAIN_HEADER_HTML =
    '<img src="logo.png" alt="Extension Icon" class="header-logo"> McGraw-Hill SmartBook Solver';

  const TARGET_URL_PATTERN = "mheducation.com";

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // --- Version Display ---
  function showVersion() {
    if (versionDisplay) {
      const version = chrome.runtime.getManifest().version;
      versionDisplay.textContent = `v${version} · `;
    }
  }

  // --- Update Banner Logic ---
  function checkForUpdateUI() {
    chrome.storage.local.get(
      ["updateAvailable", "updateVersion", "updateUrl", "dismissedUpdateVersion"],
      (result) => {
        if (
          result.updateAvailable &&
          result.updateVersion &&
          result.dismissedUpdateVersion !== result.updateVersion
        ) {
          updateText.textContent = `Update available: v${result.updateVersion}`;
          updateLink.href = result.updateUrl || "#";
          updateBanner.style.display = "flex";
        } else {
          updateBanner.style.display = "none";
        }
      }
    );
  }

  if (updateDismiss) {
    updateDismiss.addEventListener("click", () => {
      chrome.storage.local.get("updateVersion", (result) => {
        if (result.updateVersion) {
          chrome.storage.local.set({
            dismissedUpdateVersion: result.updateVersion,
          });
        }
        updateBanner.style.display = "none";
      });
    });
  }

  // --- Screen Switching Logic ---

  function showMainScreen() {
    chrome.storage.local.set({ [AGREEMENT_KEY]: true });
    document.title = "McGraw-Hill SmartBook Solver";
    mainHeaderTitle.innerHTML = MAIN_HEADER_HTML;
    readmeScreen.style.display = "none";
    mainScreen.style.display = "block";

    showVersion();
    checkForUpdateUI();
    checkBotStatusAndInitUI();
  }

  function showReadMeScreen() {
    document.title = "Important Info (Read Me)";
    mainScreen.style.display = "none";
    readmeScreen.style.display = "block";
  }

  // --- ReadMe Event Handlers ---

  agreeCheckbox.addEventListener("change", () => {
    continueButton.disabled = !agreeCheckbox.checked;
  });

  continueButton.addEventListener("click", () => {
    if (agreeCheckbox.checked) {
      showMainScreen();
    }
  });

  // --- Bot Logic Functions ---

  function updateUI(isEnabled) {
    toggleButton.disabled = false;

    if (isEnabled) {
      statusMessage.innerHTML = "Bot Status: <strong>ACTIVE</strong>";
      toggleButton.textContent = "Deactivate Bot";
      toggleButton.className = "inactive";
    } else {
      statusMessage.innerHTML = "Bot Status: <strong>INACTIVE</strong>";
      toggleButton.textContent = "Activate Bot";
      toggleButton.className = "active";
    }
  }

  function handleNotOnTargetPage(isBotEnabled) {
    toggleButton.disabled = true;
    toggleButton.textContent = "Must be on McGraw-Hill site to Toggle on/off";
    toggleButton.className = "";

    if (isBotEnabled) {
      statusMessage.innerHTML =
        "Bot Status: <strong>ACTIVE (Running in Background)</strong>";
    } else {
      statusMessage.innerHTML = "Bot Status: <strong>INACTIVE</strong>";
    }
  }

  async function sendBotCommand(action) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];

      if (
        !activeTab ||
        !activeTab.url ||
        !activeTab.url.includes(TARGET_URL_PATTERN)
      ) {
        console.log("Not on the target McGraw-Hill site.");
        return;
      }

      let scriptInjected = false;
      const MAX_RETRIES = 5;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(activeTab.id, action, (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            });
          });
          return;
        } catch (error) {
          const errorMsg = error.message;

          if (
            errorMsg.includes("Could not establish connection") &&
            !scriptInjected
          ) {
            console.log(
              `Attempt ${attempt}: Content script not running. Injecting contentSolver.js.`
            );

            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ["contentSolver.js"],
            });

            scriptInjected = true;
          } else if (
            errorMsg.includes("Could not establish connection") &&
            scriptInjected
          ) {
            console.log(
              `Attempt ${attempt}: Script injected but listener not ready. Retrying...`
            );
          } else {
            console.warn(
              "Warning: Message failed to send with unexpected error:",
              errorMsg
            );
            return;
          }

          await sleep(200);
        }
      }

      console.error("Failed to send bot command after all retries.");
    });
  }

  const toggleBotHandler = () => {
    if (toggleButton.disabled) {
      return;
    }

    const isCurrentlyActive = toggleButton.className === "inactive";
    const newAction = isCurrentlyActive ? "deactivate" : "activate";
    const newState = !isCurrentlyActive;

    updateUI(newState);
    sendBotCommand(newAction);
  };

  function checkBotStatusAndInitUI() {
    toggleButton.removeEventListener("click", toggleBotHandler);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0]?.url || "";

      chrome.storage.local.get("isBotEnabled", (storageResult) => {
        const isBotEnabled = storageResult.isBotEnabled === true;

        if (currentUrl.includes(TARGET_URL_PATTERN)) {
          updateUI(isBotEnabled);
          toggleButton.addEventListener("click", toggleBotHandler);
        } else {
          handleNotOnTargetPage(isBotEnabled);
        }
      });
    });
  }

  // --- Initialization ---

  chrome.storage.local.get(AGREEMENT_KEY, (result) => {
    if (result[AGREEMENT_KEY]) {
      showMainScreen();
    } else {
      showReadMeScreen();
    }
  });
});
