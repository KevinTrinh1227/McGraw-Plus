let botEnabled = null;
let responseMap = {};

window.botEnabled = false;

// Promise queue to serialize storage writes
let storageWriteQueue = Promise.resolve();

function isContextValid() {
  try {
    chrome.runtime.getManifest();
    return true;
  } catch (e) {
    return false;
  }
}

function updateMapData(question, answers) {
  return new Promise((resolve) => {
    const answerArray = Array.isArray(answers) ? answers : [answers];

    if (
      !(question in responseMap) ||
      JSON.stringify(responseMap[question]) !== JSON.stringify(answerArray)
    ) {
      // Serialize storage writes through queue
      storageWriteQueue = storageWriteQueue.then(() => {
        return new Promise((innerResolve) => {
          chrome.storage.local.get("responseMap", (result) => {
            const tempResponseMap = result.responseMap || {};
            tempResponseMap[question] = answerArray;
            chrome.storage.local.set({ responseMap: tempResponseMap }, () => {
              responseMap = tempResponseMap;
              innerResolve();
              resolve();
            });
          });
        });
      });
    } else {
      resolve();
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setInputValue(inputEl, value) {
  inputEl.focus();

  // Clear existing value first
  inputEl.select();

  // Try execCommand first
  let success = false;
  if (document.execCommand) {
    success = document.execCommand("insertText", false, value);
  }

  // Fallback: if execCommand failed or value doesn't match
  if (!success || inputEl.value !== value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    nativeSetter.call(inputEl, value);
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

// Storage pruning — if responseMap exceeds 5MB, prune oldest 20%
function pruneResponseMapIfNeeded() {
  // Serialize through the write queue to avoid race conditions
  storageWriteQueue = storageWriteQueue.then(() => {
    return new Promise((resolve) => {
      chrome.storage.local.get("responseMap", (result) => {
        const map = result.responseMap || {};
        const json = JSON.stringify(map);
        const sizeBytes = new Blob([json]).size;
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB

        if (sizeBytes > MAX_SIZE) {
          const keys = Object.keys(map);
          const pruneCount = Math.ceil(keys.length * 0.2);
          console.log(
            `S: Pruning ${pruneCount} entries from responseMap (${(sizeBytes / 1024 / 1024).toFixed(1)}MB)`,
          );
          for (let i = 0; i < pruneCount; i++) {
            delete map[keys[i]];
          }
          chrome.storage.local.set({ responseMap: map }, () => {
            responseMap = map;
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  });
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

function readQuestionAndResponses() {
  let question = "";
  let responses = [];

  let questionElement = document.getElementsByClassName("prompt");
  if (questionElement.length > 0) {
    const paragraphElement = questionElement[0].querySelector("p");
    if (paragraphElement) {
      const textNodes = [...paragraphElement.childNodes].filter(
        (node) => node.nodeType === Node.TEXT_NODE,
      );
      question = textNodes.map((node) => node.textContent).join("_____");
    }
  }

  let responseElements = [];
  const container = document.getElementsByClassName("air-item-container")[0];
  if (container) {
    responseElements = container.getElementsByClassName(
      "choiceText rs_preserve",
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
  let nextButtonContainer = document.getElementsByClassName(
    "next-button-container",
  )[0];
  if (nextButtonContainer) {
    let nextButton = nextButtonContainer.getElementsByTagName("button")[0];
    let reviewConceptButton = document.getElementsByClassName(
      "btn btn-tertiary lr-tray-button",
    )[0];

    if (nextButton && nextButton.hasAttribute("disabled")) {
      if (reviewConceptButton) {
        reviewConceptButton.click();
        await sleep(4000);
        let continueButton = document.querySelector(
          ".button-bar-wrapper button",
        );
        if (continueButton) {
          continueButton.click();
          await sleep(500);
        }
      }
    }

    if (nextButton && !nextButton.hasAttribute("disabled")) {
      nextButton.click();
      return;
    }
  }

  let answerButton = document.querySelector(
    ".confidence-buttons-container button",
  );
  if (!answerButton) {
    console.log("No answer button found, likely not on a question page.");
    return;
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
        "input-container span-to-div",
      );
      console.log("S: Filling", blanks.length, "blanks with stored answers:", correctResponses);
      for (let x = 0; x < blanks.length; x++) {
        if (x < correctResponses.length) {
          let inputTag = blanks[x].getElementsByTagName("input")[0];
          if (inputTag) {
            console.log("S: Setting blank", x, "to:", correctResponses[x]);
            setInputValue(inputTag, correctResponses[x]);
          }
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
      if (!clicked) {
        responseElements[0]?.click();
      }
    }

    await sleep(Math.random() * 200 + 500);
    answerButton.click();
  } else {
    let isFillInBlankQuestion = false;
    let isDragAndDrop = false;

    if (responseElements.length === 0) {
      if (document.querySelector(".match-single-response-wrapper")) {
        isDragAndDrop = true;
        await sleep(500);
        let choices = document.querySelectorAll(
          ".choices-container .choice-item-wrapper .content p",
        );
        let drop = document.querySelectorAll(
          ".-placeholder.choice-item-wrapper",
        );
        let numDrops = 0;

        while (drop.length > 0 && numDrops < 6) {
          console.log("Executing drag and drop: ", numDrops);
          if (choices[0] && drop[0]) {
            await simulateDragAndDrop(choices[0], drop[0]);
          }
          await sleep(500);
          choices = document.querySelectorAll(
            ".choices-container .choice-item-wrapper .content p",
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
          "input-container span-to-div",
        );
        for (let x = 0; x < blanks.length; x++) {
          let inputTag = blanks[x].getElementsByTagName("input")[0];
          if (inputTag) setInputValue(inputTag, "ANSWER");
        }
      }
    } else {
      responseElements[0].click();
    }

    // Submit the guess — only click if not disabled
    await sleep(Math.random() * 200 + 300);
    if (answerButton && !answerButton.hasAttribute("disabled")) {
      answerButton.click();
    }

    // --- Learn the Correct Answer ---
    // Wait longer for feedback to render
    await sleep(800);
    let answers = [];

    if (isFillInBlankQuestion) {
      let answerElements = document.getElementsByClassName("correct-answers");
      console.log("S: Found", answerElements.length, "correct-answers elements");
      for (let x = 0; x < answerElements.length; x++) {
        const correctAnswerEl = answerElements[x].querySelector(".correct-answer");
        if (correctAnswerEl) {
          // Get the text content and trim, but preserve the full answer
          const text = correctAnswerEl.textContent.trim();
          console.log("S: Fill-in-blank answer", x, ":", text);
          if (text) {
            answers.push(text);
          }
        }
      }
    } else if (isDragAndDrop) {
      console.log("Skipping answer storage for complex drag and drop.");
      return;
    } else {
      const answerContainer =
        document.getElementsByClassName("answer-container")[0];
      if (answerContainer) {
        let answerElements = answerContainer.getElementsByClassName(
          "choiceText rs_preserve",
        );
        if (answerElements.length === 0) {
          answerElements = answerContainer.getElementsByClassName("choice-row");
        }

        for (let i = 0; i < answerElements.length; i++) {
          answers.push(answerElements[i].textContent.trim());
        }
      }
    }

    if (answers.length > 0) {
      await updateMapData(question, answers);
    }
  }

  // --- Move to Next Question ---
  await sleep(Math.random() * 200 + 300);
  let nextButton = document.querySelector(".next-button-container button");
  let reviewConceptButton = document.querySelector(
    ".btn.btn-tertiary.lr-tray-button",
  );

  if (nextButton) {
    if (nextButton.hasAttribute("disabled")) {
      if (reviewConceptButton) {
        reviewConceptButton.click();
        await sleep(500);
        let continueButton = document.querySelector(
          ".button-bar-wrapper button",
        );
        if (continueButton) {
          continueButton.click();
          await sleep(500);
        }
      }
    }

    await sleep(500);
    nextButton.click();
  }
}

async function answerQuestion() {
  if (!isContextValid()) {
    console.warn("S: Extension context invalidated during question check.");
    botEnabled = false;
    return;
  }

  let { question, responses, responseElements } = readQuestionAndResponses();
  if (question && question.trim() !== "") {
    await selectCorrectResponse(question, responses, responseElements);
  } else {
    const toQuestionsButton = document.querySelector(
      'button[data-automation-id="reading-questions-button"]',
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

async function _runBotLoop() {
  while (botEnabled) {
    if (!isContextValid()) {
      console.warn("S: Extension context invalidated. Stopping bot loop.");
      botEnabled = false;
      break;
    }

    if (!answerQuestionRunning) {
      answerQuestionRunning = true;
      try {
        await answerQuestion();
      } catch (error) {
        console.error("Error while answering question in loop:", error);
      }
      answerQuestionRunning = false;
    }
    await sleep(Math.random() * 200 + 300);
  }
}

async function activateBot() {
  console.log("S: Activating Bot");

  if (botEnabled === null || botEnabled === false) {
    botEnabled = true;
    window.botEnabled = true;
    chrome.storage.local.set({ isBotEnabled: true });

    while (botEnabled) {
      try {
        await _runBotLoop();
      } catch (e) {
        console.error(
          "S: Fatal error caught in main bot loop wrapper. Restarting in 500ms.",
          e,
        );
      }

      if (botEnabled) {
        await sleep(500);
        console.log("S: Attempting to restart bot loop...");
      }
    }
  }
}

function deactivateBot() {
  console.log("S: Deactivating Bot");
  botEnabled = false;
  window.botEnabled = false;
  chrome.storage.local.set({ isBotEnabled: false });

  // Clean up injected overlay and highlight styles
  const overlay = document.getElementById("smartbooksolver-note");
  if (overlay) overlay.remove();

  const highlighted = document.querySelectorAll('[data-sb-highlighted="true"]');
  highlighted.forEach((el) => {
    el.style.backgroundColor = "";
    el.style.border = "";
    el.style.borderRadius = "";
    el.removeAttribute("data-sb-highlighted");
  });
}

// Single consolidated message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (typeof request === "string") {
    if (request === "activate") {
      activateBot();
    } else if (request === "deactivate") {
      deactivateBot();
    }
  } else if (request.action === "updateMapData" && request.data) {
    const { question, answers } = request.data;
    if (question && answers) {
      updateMapData(question, answers);
      console.log("S: Received data from H and updated map (local only).");
    }
  }
  return true;
});

// Initialization
chrome.storage.local.get("isBotEnabled", (result) => {
  const isEnabled = result.isBotEnabled === true;

  botEnabled = isEnabled;
  window.botEnabled = isEnabled;

  if (isEnabled) {
    console.log(
      "S: Content script re-initialized. Bot was active, restarting loop.",
    );
    activateBot();
  } else {
    console.log(
      "S: Content script re-initialized. Bot is currently deactivated.",
    );
  }

  chrome.storage.local.get("responseMap", (mapResult) => {
    responseMap = mapResult.responseMap || {};
    console.log("S: Loaded responseMap on initialization.");
  });

  // Prune storage if needed
  pruneResponseMapIfNeeded();
});
