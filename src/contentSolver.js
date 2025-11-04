let botEnabled = null; // Internal state for the while loop
let responseMap = {};

// The window variable is still needed for the popup to read the current state
window.botEnabled = false;

// Activation is now triggered exclusively by the background.js controller
// sending an "activate" message.

function updateMapData(question, answers, storeAPI) {
  // NOTE: The 'storeAPI' flag is now obsolete but kept as a parameter for compatibility.
  return new Promise((resolve) => {
    // Ensure answers is always an array for consistency
    const answerArray = Array.isArray(answers) ? answers : [answers];

    // Check if the question is new or if the stored answer is different
    if (
      !(question in responseMap) ||
      JSON.stringify(responseMap[question]) !== JSON.stringify(answerArray)
    ) {
      // ❌ REMOVED: storeQuestionToAPI(question, answerArray); call

      chrome.storage.local.get("responseMap", (result) => {
        const tempResponseMap = result.responseMap || {};
        tempResponseMap[question] = answerArray;
        chrome.storage.local.set({ responseMap: tempResponseMap }, () => {
          responseMap = tempResponseMap; // Update the responseMap in the content script
          resolve();
        });
      });
    } else {
      resolve();
    }
  });
}

// 🔑 NEW LOCAL FUNCTION: Replaces getAnswerFromAPI
async function getAnswerFromLocalMap(question) {
  if (responseMap[question]) {
    return responseMap[question];
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// drag and drop section
async function simulateDragAndDrop(source, target) {
  const rect1 = source.getBoundingClientRect();
  const rect2 = target.getBoundingClientRect();

  const mousedown = new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: rect1.left + rect1.width / 2,
    clientY: rect1.top + rect1.height / 2,
  });

  const mouseup = new MouseEvent("mouseup", {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: rect2.left + rect2.width / 2,
    clientY: rect2.top + rect2.height / 2,
  });

  source.dispatchEvent(mousedown);
  await sleep(800);

  for (let i = 1; i <= 50; i++) {
    const intermediateX =
      rect1.left + (rect2.left - rect1.left) * (i / 50) + rect1.width / 2;
    const intermediateY =
      rect1.top + (rect2.top - rect1.top) * (i / 50) + rect1.height / 2;

    const mousemove = new MouseEvent("mousemove", {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: intermediateX,
      clientY: intermediateY,
    });

    source.dispatchEvent(mousemove);
    await sleep(10);
  }
  const finalMouseMove = new MouseEvent("mousemove", {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: rect2.left + rect2.width / 2,
    clientY: rect2.top + rect2.height / 2,
  });
  source.dispatchEvent(finalMouseMove);
  await sleep(500);
  target.dispatchEvent(mouseup);
  await sleep(200);
}

// begin solver.js

function readQuestionAndResponses() {
  let question = "";
  let responses = [];

  // Find the question
  let questionElement = document.getElementsByClassName("prompt");
  if (questionElement.length > 0) {
    const paragraphElement = questionElement[0].querySelector("p");
    // Filter out the nested <span> elements and retrieve only text nodes
    const textNodes = [...paragraphElement.childNodes].filter(
      (node) => node.nodeType === Node.TEXT_NODE
    );
    // Join text nodes with a placeholder for the blank (if any)
    question = textNodes.map((node) => node.textContent).join("_____");
  }

  // Find the potential responses
  let responseElements = [];
  const container = document.getElementsByClassName("air-item-container")[0];
  if (container) {
    responseElements = container.getElementsByClassName(
      "choiceText rs_preserve"
    );
  }

  if (responseElements.length) {
    for (let i = 0; i < responseElements.length; i++) {
      responses.push(responseElements[i].textContent);
    }
  }

  return { question, responses, responseElements };
}

async function selectCorrectResponse(question, responses, responseElements) {
  await sleep(100);
  // --- Check for Next/Review Concept button ---
  let nextButtonContainer = document.getElementsByClassName(
    "next-button-container"
  )[0];
  if (nextButtonContainer) {
    let nextButton = nextButtonContainer.getElementsByTagName("button")[0];
    let reviewConceptButton = document.getElementsByClassName(
      "btn btn-tertiary lr-tray-button"
    )[0];

    // If the 'Next' button is disabled, it means we need to review the concept first
    if (nextButton && nextButton.hasAttribute("disabled")) {
      if (reviewConceptButton) {
        reviewConceptButton.click();
        await sleep(4000);
        let continueButton = document.querySelector(
          ".button-bar-wrapper button"
        );
        if (continueButton) {
          continueButton.click();
          await sleep(500); // Give time for content to reload
        }
      }
    }

    // Attempt to click Next button if it exists and is now enabled
    if (nextButton && !nextButton.hasAttribute("disabled")) {
      nextButton.click();
      return;
    }
  }

  let answerButton = document.querySelector(
    ".confidence-buttons-container button"
  );
  if (!answerButton) {
    console.log("No answer button found, likely not on a question page.");
    return;
  }

  // --- Attempt to retrieve answer ---
  // Replaced getAnswerFromAPI with local map check
  if (!responseMap[question]) {
    await getAnswerFromLocalMap(question);
  } else {
    console.log("Answer already stored locally.");
  }

  // --- Use Stored Answer (If found) ---
  if (responseMap[question]) {
    const correctResponses = responseMap[question];
    console.log("Answer found:", correctResponses);

    const isFillInBlank =
      responseElements.length === 0 &&
      document.getElementsByClassName("input-container span-to-div").length > 0;
    const isMultipleChoice = responseElements.length > 0;

    if (isFillInBlank) {
      let blanks = document.getElementsByClassName(
        "input-container span-to-div"
      );
      for (let x = 0; x < blanks.length; x++) {
        if (x < correctResponses.length) {
          let inputTag = blanks[x].getElementsByTagName("input")[0];
          inputTag.focus();
          document.execCommand("insertText", false, correctResponses[x]);
        }
      }
    } else if (isMultipleChoice) {
      let clicked = false;
      for (let i = 0; i < responses.length; i++) {
        if (correctResponses.includes(responses[i])) {
          responseElements[i].click();
          clicked = true;
        }
      }
      // Fail-safe: if answer was somehow wrong or not found in current options, click the first one
      if (!clicked) {
        responseElements[0]?.click();
      }
    }

    // Submit the known answer
    await sleep(Math.random() * 200 + 500);
    answerButton.click();

    // --- Answer Not Stored (Guessing and Learning) ---
  } else {
    let isFillInBlankQuestion = false;
    let isDragAndDrop = false;

    // Check for Fill-in-the-Blank or Drag-and-Drop
    if (responseElements.length === 0) {
      if (document.querySelector(".match-single-response-wrapper")) {
        isDragAndDrop = true;
        // Drag and drop solving logic (currently incomplete, attempts a few drops)
        await sleep(500);
        let choices = document.querySelectorAll(
          ".choices-container .choice-item-wrapper .content p"
        );
        let drop = document.querySelectorAll(
          ".-placeholder.choice-item-wrapper"
        );
        let numDrops = 0;

        while (drop.length > 0 && numDrops < 6) {
          console.log("Executing drag and drop: ", numDrops);
          if (choices[0] && drop[0]) {
            await simulateDragAndDrop(choices[0], drop[0]);
          }
          await sleep(500);
          choices = document.querySelectorAll(
            ".choices-container .choice-item-wrapper .content p"
          );
          drop = document.querySelectorAll(".-placeholder.choice-item-wrapper");
          await sleep(500);
          numDrops += 1;
        }
        if (numDrops >= 6 && drop.length > 0) {
          console.log("Giving up drag and drop after 6 attempts.");
        }
      } else if (
        document.getElementsByClassName("input-container span-to-div").length >
        0
      ) {
        isFillInBlankQuestion = true;
        let blanks = document.getElementsByClassName(
          "input-container span-to-div"
        );
        for (let x = 0; x < blanks.length; x++) {
          let inputTag = blanks[x].getElementsByTagName("input")[0];
          inputTag.focus();
          document.execCommand("insertText", false, "Guess Answer");
        }
      }
    } else {
      // Guess: Click the first multiple-choice option
      responseElements[0].click();
    }

    // Submit the guess
    await sleep(Math.random() * 200 + 300);
    // Ensure button is enabled before clicking (for systems that disable it until a choice is made)
    if (answerButton) {
      answerButton.removeAttribute("disabled");
      answerButton.click();
    }

    // --- Learn the Correct Answer ---
    await sleep(Math.random() * 100 + 400);
    let answers = [];

    if (isFillInBlankQuestion) {
      // Extract correct answers from fill-in-the-blank feedback
      let answerElements = document.getElementsByClassName("correct-answers");
      for (let x = 0; x < answerElements.length; x++) {
        // This is highly specific to the format: "correct-answer" inner text, removing commas and taking the first word/value
        const text =
          answerElements[x].querySelector(".correct-answer")?.textContent;
        if (text) {
          answers.push(text.replace(/,/g, "").split(" ")[0]);
        }
      }
    } else if (isDragAndDrop) {
      // TODO: Implement reliable answer extraction for drag and drop
      console.log("Skipping answer storage for complex drag and drop.");
      // MUST return here to prevent immediate navigation attempt
      return;
    } else {
      // Multiple Choice / True-False
      // Extract correct answers from the highlighted/revealed answer container
      const answerContainer =
        document.getElementsByClassName("answer-container")[0];
      if (answerContainer) {
        let answerElements = answerContainer.getElementsByClassName(
          "choiceText rs_preserve"
        );
        // Fallback for simple True/False or similar format where there's no choiceText
        if (answerElements.length === 0) {
          answerElements = answerContainer.getElementsByClassName("choice-row"); // Assuming choice-row contains the answer text
        }

        for (let i = 0; i < answerElements.length; i++) {
          answers.push(answerElements[i].textContent.trim());
        }
      }
    }

    // Store the newly learned answer locally (storeAPI is implicitly false/ignored)
    if (answers.length > 0) {
      // 🔑 AWAIT IS CRITICAL HERE to prevent "Context Invalidated"
      await updateMapData(question, answers, false); //
    }
  }

  // --- Move to Next Question ---
  await sleep(Math.random() * 200 + 300);
  let nextButton = document.querySelector(".next-button-container button");
  let reviewConceptButton = document.querySelector(
    ".btn.btn-tertiary.lr-tray-button"
  );

  if (nextButton) {
    // Re-check for disabled status (in case the answer was right/wrong and changed state)
    if (nextButton.hasAttribute("disabled")) {
      if (reviewConceptButton) {
        reviewConceptButton.click();
        await sleep(500);
        let continueButton = document.querySelector(
          ".button-bar-wrapper button"
        );
        if (continueButton) {
          continueButton.click();
          await sleep(500);
        }
      }
    }

    // Click Next
    await sleep(500);
    nextButton.click();
  }
}

// Main function that reads the question and responses and selects the correct response
async function answerQuestion() {
  // Ensure we are in a valid extension context before proceeding
  if (!chrome.runtime.getManifest()) {
    console.warn("S: Extension context invalidated during question check.");
    botEnabled = false;
    return;
  }

  let { question, responses, responseElements } = readQuestionAndResponses();
  // Ensure we have a question before attempting to answer/store
  if (question && question.trim() !== "") {
    await selectCorrectResponse(question, responses, responseElements);
  } else {
    // If not on a question page, check if we need to click "Continue" or "Start Questions"
    const toQuestionsButton = document.querySelector(
      'button[data-automation-id="reading-questions-button"]'
    );
    const continueButton = document.querySelector(".button-bar-wrapper button");

    if (toQuestionsButton) {
      console.log("Detected reading page—clicking button to go to questions.");
      toQuestionsButton.click();
    } else if (
      continueButton &&
      continueButton.textContent.includes("Continue")
    ) {
      console.log("Detected review page—clicking Continue.");
      continueButton.click();
    } else {
      console.log("Could not find a valid question or navigation element.");
    }
  }
}

let answerQuestionRunning = false;

// 🔑 NEW FUNCTION: Contains the core while loop logic with self-healing checks.
async function _runBotLoop() {
  while (botEnabled) {
    // 🔑 Critical Check: If the context is invalidated, stop the loop immediately.
    if (!chrome.runtime.getManifest()) {
      console.warn("S: Extension context invalidated. Stopping bot loop.");
      botEnabled = false;
      // Do not use 'return' here, let the loop naturally exit and be restarted by activateBot if needed.
      break;
    }

    if (!answerQuestionRunning) {
      answerQuestionRunning = true;
      try {
        await answerQuestion();
      } catch (error) {
        // If an error occurs, log it, but the loop continues unless context is invalidated.
        console.error("Error while answering question in loop:", error);
      }
      answerQuestionRunning = false;
    }
    await sleep(Math.random() * 200 + 300);
  }
}

// 🔑 MODIFIED FUNCTION: Manages state and uses a wrapper to restart the loop if it fails.
async function activateBot() {
  console.log("S: Activating Bot");

  // Only proceed if the bot is currently inactive
  if (botEnabled === null || botEnabled === false) {
    botEnabled = true; // Set local flag
    window.botEnabled = true; // Update global flag for popup
    chrome.storage.local.set({ isBotEnabled: true });

    // Loop until botEnabled is manually set to false by deactivateBot()
    while (botEnabled) {
      try {
        await _runBotLoop();
      } catch (e) {
        console.error(
          "S: Fatal error caught in main bot loop wrapper. Restarting in 500ms.",
          e
        );
      }

      // If the bot is still meant to be running, wait briefly and try to restart the loop
      if (botEnabled) {
        await sleep(500);
        console.log("S: Attempting to restart bot loop...");
      }
    }
  }
}

function deactivateBot() {
  console.log("S: Deactivating Bot");
  // 🔑 IMMEDIATE STOP: Setting this to false stops the while loop in _runBotLoop
  botEnabled = false;
  window.botEnabled = false; // Update global flag for popup

  // 🔑 PERSISTENCE: Save state to Chrome Storage
  chrome.storage.local.set({ isBotEnabled: false });
}

// listen for messages from the popup AND background script to enable/disable the bot
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request);
  if (request == "activate") {
    activateBot();
  }
  if (request == "deactivate") {
    deactivateBot();
  }

  // 🔑 MESSAGE PORT FIX: RETURN TRUE is essential for async messaging
  return true; //
});

//listen for messages from highlighter.js to update responseMap
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateMapData" && message.data) {
    const { question, answers } = message.data;
    if (question && answers) {
      // Update local map only
      updateMapData(question, answers, false);
      console.log("S: Received data from H and updated map (local only).");
    }
  }
});

// 🚀 NEW INITIALIZATION BLOCK: Check storage on script load to set the initial state correctly
chrome.storage.local.get("isBotEnabled", (result) => {
  const isEnabled = result.isBotEnabled === true;

  // Set the local flags to match the persistent state
  botEnabled = isEnabled;
  window.botEnabled = isEnabled;

  if (isEnabled) {
    console.log(
      "S: Content script re-initialized. Bot was active, restarting loop."
    );
    // If the bot was active when the page loaded/reloaded, start the loop
    // The inner logic of activateBot prevents multiple loop starts.
    activateBot();
  } else {
    console.log(
      "S: Content script re-initialized. Bot is currently deactivated."
    );
  }

  // Load response map for immediate use
  chrome.storage.local.get("responseMap", (mapResult) => {
    responseMap = mapResult.responseMap || {};
    console.log("S: Loaded responseMap on initialization.");
  });
});
