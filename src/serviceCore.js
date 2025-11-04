// background.js

// 1. Listen for Tab Updates (User navigates, reloads, or creates a tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the URL is the McGraw-Hill domain AND the page has finished loading
  const isMHEducation = tab.url && tab.url.includes("learning.mheducation.com");

  if (isMHEducation && changeInfo.status === "complete") {
    // 2. Read the global bot state from local storage
    chrome.storage.local.get("isBotEnabled", (result) => {
      const isEnabled = result.isBotEnabled === true;

      // 3. If the bot is enabled, send the 'activate' message
      if (isEnabled) {
        console.log(
          `[Background] Bot is enabled. Activating solver on tab ${tabId}.`
        );

        // Use a small delay to ensure the content script (solver.js)
        // has been injected and its listener is ready to receive the message.
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, "activate", (response) => {
            if (chrome.runtime.lastError) {
              // This warning is normal; it means the content script
              // was still initializing, but the command was sent.
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

// 4. (Optional) Basic message listener for compatibility, though not used by the new persistence logic
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.data) {
    sendResponse({ success: true, data: request.data });
  }
  return true;
});
