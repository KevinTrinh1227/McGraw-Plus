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

  const AGREEMENT_KEY = "hasAgreedToDisclaimer";
  const MAIN_HEADER_HTML =
    '<img src="logo.png" alt="Extension Icon" class="header-logo"> McGraw-Hill SmartBook Solver';

  // Define the target URL pattern for enabling the toggle button
  const TARGET_URL_PATTERN = "mheducation.com";

  // Helper function for delays
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // --- Screen Switching Logic ---

  function showMainScreen() {
    // Correctly saves the agreement status to storage
    chrome.storage.local.set({ [AGREEMENT_KEY]: true });
    document.title = "McGraw-Hill SmartBook Solver";
    mainHeaderTitle.innerHTML = MAIN_HEADER_HTML;
    readmeScreen.style.display = "none";
    mainScreen.style.display = "block";

    // Resume original solver initialization/status check
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
    // This function now only handles the visual state based on the global setting
    // It is called when we ARE on the target page.
    toggleButton.disabled = false;

    if (isEnabled) {
      statusMessage.innerHTML = "Bot Status: <strong>ACTIVE 🟢</strong>";
      toggleButton.textContent = "❌ Deactivate Bot";
      toggleButton.className = "inactive";
    } else {
      statusMessage.innerHTML = "Bot Status: <strong>INACTIVE 🔴</strong>";
      toggleButton.textContent = "🚀 Activate Bot";
      toggleButton.className = "active";
    }
  }

  // 🔑 UPDATED: Takes the current bot state as an argument
  function handleNotOnTargetPage(isBotEnabled) {
    // Disable the button and show a helpful message
    toggleButton.disabled = true;
    toggleButton.textContent = "Must be on McGraw-Hill site to Toggle on/off";
    toggleButton.className = ""; // Remove active/inactive classes for neutral look

    // 🔑 NEW LOGIC: Display the actual global status, but indicate the button is locked
    if (isBotEnabled) {
      statusMessage.innerHTML =
        "Bot Status: <strong>ACTIVE 🟢 (Running in Background)</strong>";
    } else {
      statusMessage.innerHTML = "Bot Status: <strong>INACTIVE 🔴</strong>";
    }
  }

  // 🔑 MODIFIED: Targets only the active tab that is relevant, and injects script if needed.
  // Now uses retry logic for reliable activation.
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
          // 1. Try to send the message
          await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(activeTab.id, action, (response) => {
              if (chrome.runtime.lastError) {
                // Reject the promise if there is an error
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            });
          });
          // If successful, break the retry loop
          return;
        } catch (error) {
          const errorMsg = error.message;

          // 2. Check if the error means the content script is not running
          if (
            errorMsg.includes("Could not establish connection") &&
            !scriptInjected
          ) {
            console.log(
              `Attempt ${attempt}: Content script not running. Injecting contentSolver.js.`
            );

            // NOTE: Using contentSolver.js as per the manifest fix.
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ["contentSolver.js"],
            });

            scriptInjected = true;
          } else if (
            errorMsg.includes("Could not establish connection") &&
            scriptInjected
          ) {
            // Script is injected but still not ready; continue retry loop
            console.log(
              `Attempt ${attempt}: Script injected but listener not ready. Retrying...`
            );
          } else {
            // Log other unexpected errors and stop retrying
            console.warn(
              "Warning: Message failed to send with unexpected error:",
              errorMsg
            );
            return;
          }

          // Wait before the next attempt
          await sleep(200);
        }
      }

      console.error("Failed to send bot command after all retries.");
    });
  }

  // Separate handler function for cleaner removal/re-adding of listener
  const toggleBotHandler = () => {
    // Check if the button is currently disabled by our logic before proceeding
    if (toggleButton.disabled) {
      return;
    }

    const isCurrentlyActive = toggleButton.className === "inactive";
    const newAction = isCurrentlyActive ? "deactivate" : "activate";
    const newState = !isCurrentlyActive;

    // 1. Update the local UI state first
    updateUI(newState);

    // 2. Send the command to the active tab (which will also update the global storage state)
    sendBotCommand(newAction);
  };

  function checkBotStatusAndInitUI() {
    // 1. Ensure any old listener is removed before proceeding
    toggleButton.removeEventListener("click", toggleBotHandler);

    // 2. Check the current active tab's URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0]?.url || "";

      // 3. Load initial status from storage (global state)
      chrome.storage.local.get("isBotEnabled", (storageResult) => {
        const isBotEnabled = storageResult.isBotEnabled === true;

        if (currentUrl.includes(TARGET_URL_PATTERN)) {
          // On target page: Update UI to show global status and make button clickable
          updateUI(isBotEnabled);
          // 4. Add the click listener (runs after status check due to event loop)
          toggleButton.addEventListener("click", toggleBotHandler);
        } else {
          // Not on target page: Inform user, show the state, and disable the button
          // 🔑 PASSING isBotEnabled HERE
          handleNotOnTargetPage(isBotEnabled);
        }
      });
    });
  }

  // --- Initialization ---

  // Check if the user has previously agreed
  chrome.storage.local.get(AGREEMENT_KEY, (result) => {
    if (result[AGREEMENT_KEY]) {
      showMainScreen();
    } else {
      showReadMeScreen();
    }
  });
});
