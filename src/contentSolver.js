let botEnabled = null;
let responseMap = {};

window.botEnabled = false;

// Promise queue to serialize storage writes
let storageWriteQueue = Promise.resolve();

// Shorthand references to config (loaded from config.js)
const Log = () => window.SBS_Logger || console;
const Cfg = () => window.SBS_CONFIG || { DEV_MODE: false, TIMING: {}, SELECTORS: {} };

// Module references (loaded from other content scripts)
const Stats = () => window.SBS_Stats || null;
const Webhook = () => window.SBS_Webhook || null;
const LLM = () => window.SBS_LLM || null;
const Overlay = () => window.SBS_Overlay || null;

// Helper to refresh responseMap from storage (ensures we have latest data)
function refreshResponseMap() {
  return new Promise((resolve) => {
    chrome.storage.local.get("responseMap", (result) => {
      responseMap = result.responseMap || {};
      Log().debug("Refreshed responseMap from storage:", Object.keys(responseMap).length, "entries");
      resolve(responseMap);
    });
  });
}

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
  Log().debug("Setting input value:", { target: inputEl, value });
  const originalValue = inputEl.value;

  inputEl.focus();

  // Clear existing value first
  inputEl.select();

  // Try execCommand first
  let success = false;
  if (document.execCommand) {
    success = document.execCommand("insertText", false, value);
    Log().debug("execCommand result:", success, "| value now:", inputEl.value);
  }

  // Fallback: if execCommand failed or value doesn't match
  if (!success || inputEl.value !== value) {
    Log().debug("Using native setter fallback");
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    nativeSetter.call(inputEl, value);
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Verify the value was set correctly
  if (inputEl.value !== value) {
    Log().warn("Input value mismatch! Expected:", value, "| Got:", inputEl.value);
  } else {
    Log().debug("Input value set successfully:", inputEl.value);
  }

  return inputEl.value === value;
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

        Log().debug("Storage size:", (sizeBytes / 1024 / 1024).toFixed(2), "MB");

        if (sizeBytes > MAX_SIZE) {
          const keys = Object.keys(map);
          const pruneCount = Math.ceil(keys.length * 0.2);
          Log().warn("Storage limit exceeded! Pruning", pruneCount, "entries");
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

function normalizeQuestionKey(rawQuestion) {
  // Normalize question to prevent key mismatches
  return rawQuestion
    .replace(/\s+/g, ' ')     // Collapse multiple whitespace
    .replace(/\s*_+\s*/g, '_____')  // Normalize any sequence of underscores to standard blank marker
    .replace(/\s*\[blank\]\s*/gi, '_____')  // Handle [blank] markers
    .trim();
}

/**
 * Extract question text from prompt element, handling fill-in-blank variations
 * Supports: text nodes with gaps, input elements, span placeholders, literal underscores
 * Also handles list-based fill-in-blank (ol/li structure)
 */
function extractQuestionText(promptElement) {
  // Try to get the main question paragraph first
  const paragraphElement = promptElement.querySelector("p");

  // Check if this is a list-based fill-in-blank (ol/li with blanks)
  const orderedList = promptElement.querySelector("ol");
  const unorderedList = promptElement.querySelector("ul");

  let questionParts = [];

  // Extract text from paragraph if exists
  if (paragraphElement) {
    questionParts.push(extractNodeText(paragraphElement));
  }

  // Handle list-based blanks (the ol/li variation)
  if (orderedList || unorderedList) {
    const list = orderedList || unorderedList;
    const listItems = list.querySelectorAll("li");
    const blankCount = listItems.length;

    // Add blank markers for each list item that contains a blank
    for (let i = 0; i < listItems.length; i++) {
      const li = listItems[i];
      const hasBlank = li.querySelector('input, select, .input-container, .span-to-div');
      if (hasBlank) {
        questionParts.push(`[BLANK${i + 1}]`);
      } else {
        questionParts.push(li.textContent.trim());
      }
    }
  }

  // If no paragraph found, try getting text from the entire prompt
  if (!paragraphElement && !orderedList && !unorderedList) {
    return extractNodeText(promptElement);
  }

  return questionParts.join(' ');
}

/**
 * Extract text from a node, replacing blanks with markers
 */
function extractNodeText(node) {
  let parts = [];

  const processNode = (n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = n.textContent;
      if (text.trim()) {
        parts.push(text);
      }
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n;
      const tagName = el.tagName.toLowerCase();

      // Skip hidden elements
      if (el.classList.contains('_visuallyHidden') || el.getAttribute('aria-hidden') === 'true') {
        return;
      }

      // Check if this is a blank placeholder
      if (tagName === 'input' || tagName === 'select') {
        parts.push('_____');
      } else if (el.classList.contains('blank') ||
                 el.classList.contains('input-container') ||
                 el.classList.contains('span-to-div') ||
                 el.classList.contains('fitb-input')) {
        // Check if it contains an input/select
        if (el.querySelector('input, select')) {
          parts.push('_____');
        } else {
          // Recursively process children
          for (const child of el.childNodes) {
            processNode(child);
          }
        }
      } else if (tagName === 'ol' || tagName === 'ul') {
        // Skip lists - handled separately
        return;
      } else {
        // Process children
        for (const child of el.childNodes) {
          processNode(child);
        }
      }
    }
  };

  processNode(node);
  return parts.join('');
}

/**
 * Check page title to help detect question mode
 */
function getPageMode() {
  const title = document.title || '';
  if (title.includes('Fill in the Blank')) return 'fillInBlank';
  if (title.includes('Multiple Choice')) return 'multipleChoice';
  if (title.includes('Drag')) return 'dragAndDrop';
  if (title.includes('Order')) return 'ordering';
  if (title.includes('Answer Mode')) return 'answerMode';
  return null;
}

/**
 * Detect fill-in-blank question type and get blank elements
 * Returns: { isFillBlank: boolean, blankElements: Element[], blankType: string }
 */
function detectFillInBlank() {
  // Check page title first for hint
  const pageMode = getPageMode();

  // Type 1: FITB inputs with specific class (most common)
  let blanks = document.querySelectorAll('input.fitb-input');
  if (blanks.length > 0) {
    Log().debug("Detected fill-in-blank: fitb-input class,", blanks.length, "blanks");
    return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'fitb-input' };
  }

  // Type 2: Standard input containers with span-to-div
  blanks = document.querySelectorAll('.input-container.span-to-div input');
  if (blanks.length > 0) {
    Log().debug("Detected fill-in-blank: input-container span-to-div,", blanks.length, "blanks");
    return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'input-container' };
  }

  // Type 3: Inputs inside fieldset with fitb class
  blanks = document.querySelectorAll('.fitb-fieldset input, fieldset.fitb-fieldset input');
  if (blanks.length > 0) {
    Log().debug("Detected fill-in-blank: fitb-fieldset,", blanks.length, "blanks");
    return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'fitb-fieldset' };
  }

  // Type 4: Inputs in ordered/unordered list items (list-based blanks)
  blanks = document.querySelectorAll('.prompt ol input, .prompt ul input, .dlc_question ol input, .dlc_question ul input');
  if (blanks.length > 0) {
    Log().debug("Detected fill-in-blank: list-based,", blanks.length, "blanks");
    return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'list-based' };
  }

  // Type 5: Direct input fields in prompt area
  blanks = document.querySelectorAll('.prompt input[type="text"], .prompt input:not([type]), .dlc_question input');
  if (blanks.length > 0) {
    Log().debug("Detected fill-in-blank: prompt-input,", blanks.length, "blanks");
    return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'prompt-input' };
  }

  // Type 6: Sentence completion with select dropdowns
  blanks = document.querySelectorAll('.prompt select, .sentence-completion select, .dlc_question select');
  if (blanks.length > 0) {
    Log().debug("Detected fill-in-blank: select-dropdown,", blanks.length, "blanks");
    return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'select-dropdown' };
  }

  // Type 7: Inputs with fitbTesting ID pattern
  blanks = document.querySelectorAll('input[id^="fitbTesting_response"], input[id^="fitb_"]');
  if (blanks.length > 0) {
    Log().debug("Detected fill-in-blank: fitbTesting ID pattern,", blanks.length, "blanks");
    return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'fitbTesting-id' };
  }

  // Type 8: Any remaining input-container structures
  const inputContainers = document.querySelectorAll('.input-container, .span-to-div');
  if (inputContainers.length > 0) {
    const inputs = [];
    inputContainers.forEach(container => {
      const input = container.querySelector('input');
      if (input) inputs.push(input);
    });
    if (inputs.length > 0) {
      Log().debug("Detected fill-in-blank: generic-input-container,", inputs.length, "blanks");
      return { isFillBlank: true, blankElements: inputs, blankType: 'generic-input-container' };
    }
  }

  // Check if page mode suggests fill-in-blank but we couldn't find inputs
  if (pageMode === 'fillInBlank') {
    Log().warn("Page title indicates fill-in-blank but no inputs found!");
  }

  return { isFillBlank: false, blankElements: [], blankType: null };
}

/**
 * Extract correct answers from feedback, handling various DOM structures
 * Handles multiple acceptable answers per blank, takes first one
 */
function extractFillInBlankAnswers() {
  let answers = [];

  // Method 1: List-based correct answers (responses-container with li.correct-answers)
  const responsesContainer = document.querySelector('.responses-container');
  if (responsesContainer) {
    const answerItems = responsesContainer.querySelectorAll('li.correct-answers');
    Log().debug("Found responses-container with", answerItems.length, "answer items");

    answerItems.forEach((item, idx) => {
      // Get all acceptable answers for this blank
      const answerEls = item.querySelectorAll('.correct-answer');
      if (answerEls.length > 0) {
        // Take the first acceptable answer
        let text = answerEls[0].textContent;

        // Remove separator content if present (e.g., " or ")
        const sep = answerEls[0].querySelector('.separator');
        if (sep) {
          text = text.replace(sep.textContent, '');
        }

        // Clean up: remove trailing comma, whitespace
        text = text.replace(/[,\s]+$/, '').trim();

        if (text) {
          Log().debug("Field", idx + 1, "- First acceptable answer:", text,
            "(out of", answerEls.length, "options)");
          answers.push(text);
        }
      }
    });

    if (answers.length > 0) {
      Log().debug("Extracted from responses-container:", answers);
      return answers;
    }
  }

  // Method 2: Standard .correct-answers containers (non-list)
  const correctContainers = document.querySelectorAll('.correct-answers');
  if (correctContainers.length > 0) {
    Log().debug("Found", correctContainers.length, "correct-answers containers");

    correctContainers.forEach((container, idx) => {
      // Skip if this is inside a list (already handled above)
      if (container.tagName.toLowerCase() === 'li') {
        return;
      }

      // Look for .correct-answer spans
      const answerEls = container.querySelectorAll('.correct-answer');
      if (answerEls.length > 0) {
        // Take first acceptable answer, clean it
        let text = answerEls[0].textContent;
        // Remove separator content if present
        const sep = answerEls[0].querySelector('.separator');
        if (sep) text = text.replace(sep.textContent, '');
        text = text.replace(/[,\s]+$/, '').trim();
        if (text) {
          Log().debug("Container", idx, "- answer:", text);
          answers.push(text);
        }
      } else {
        // Try getting text directly from container, remove label
        let text = container.textContent;
        // Remove "Field X:" label
        text = text.replace(/field\s*\d+\s*:?\s*/gi, '');
        // Remove "correct answer(s):" label
        text = text.replace(/correct\s*answers?\s*:?\s*/gi, '');
        text = text.replace(/[,\s]+$/, '').trim();
        if (text) {
          Log().debug("Container", idx, "- text content:", text);
          answers.push(text);
        }
      }
    });

    if (answers.length > 0) {
      Log().debug("Extracted from correct-answers containers:", answers);
      return answers;
    }
  }

  // Method 3: FITB answer component structure
  const fitbAnswer = document.querySelector('.fitb-component.-answer');
  if (fitbAnswer) {
    const answerEls = fitbAnswer.querySelectorAll('.correct-answer');
    Log().debug("Found fitb-component.-answer with", answerEls.length, "answer elements");

    // Group answers by their parent li if in a list, otherwise take all
    const seenParents = new Set();
    answerEls.forEach(el => {
      const parentLi = el.closest('li');
      const parentKey = parentLi ? parentLi : el;

      if (!seenParents.has(parentKey)) {
        seenParents.add(parentKey);

        let text = el.textContent;
        const sep = el.querySelector('.separator');
        if (sep) text = text.replace(sep.textContent, '');
        text = text.replace(/[,\s]+$/, '').trim();
        if (text) answers.push(text);
      }
    });

    if (answers.length > 0) {
      Log().debug("Extracted from fitb-component.-answer:", answers);
      return answers;
    }
  }

  // Method 4: Feedback with highlighted correct text
  const feedbackCorrect = document.querySelectorAll('.feedback .correct, .feedback-correct, [data-correct="true"]');
  if (feedbackCorrect.length > 0) {
    feedbackCorrect.forEach(el => {
      const text = el.textContent.trim();
      if (text) answers.push(text);
    });

    if (answers.length > 0) {
      Log().debug("Extracted from feedback elements:", answers);
      return answers;
    }
  }

  // Method 5: Answer revealed in input fields themselves
  const revealedInputs = document.querySelectorAll('.input-container.correct input, .input-container .correct-value, input.correct');
  if (revealedInputs.length > 0) {
    revealedInputs.forEach(el => {
      const text = el.value || el.textContent;
      if (text && text.trim() && text.trim().toLowerCase() !== 'answer') {
        answers.push(text.trim());
      }
    });

    if (answers.length > 0) {
      Log().debug("Extracted from revealed inputs:", answers);
      return answers;
    }
  }

  // Method 6: Check for answer spans near blanks
  const answerSpans = document.querySelectorAll('.blank-answer, .answer-text, .correct-text');
  if (answerSpans.length > 0) {
    answerSpans.forEach(el => {
      const text = el.textContent.trim();
      if (text) answers.push(text);
    });

    if (answers.length > 0) {
      Log().debug("Extracted from answer spans:", answers);
      return answers;
    }
  }

  Log().warn("No fill-in-blank answers found with any method");
  return answers;
}

function readQuestionAndResponses() {
  Log().group("Reading Question");
  let question = "";
  let responses = [];

  // Get question text
  const questionElement = document.getElementsByClassName("prompt")[0];
  if (questionElement) {
    const rawQuestion = extractQuestionText(questionElement);
    question = normalizeQuestionKey(rawQuestion);
    Log().debug("Raw question:", rawQuestion);
    Log().debug("Normalized question:", question);
  }

  // Get response elements for multiple choice
  let responseElements = [];
  const container = document.getElementsByClassName("air-item-container")[0];
  if (container) {
    responseElements = container.getElementsByClassName("choiceText rs_preserve");
  }

  if (responseElements.length) {
    for (let i = 0; i < responseElements.length; i++) {
      responses.push(responseElements[i].textContent);
    }
    Log().debug("Found", responseElements.length, "response options");
  }

  // Detect question type
  const fillBlankInfo = detectFillInBlank();
  const isDragDrop = document.querySelector(".match-single-response-wrapper") !== null;

  if (fillBlankInfo.isFillBlank) {
    Log().info("Question type: FILL-IN-BLANK (" + fillBlankInfo.blankType + "), " + fillBlankInfo.blankElements.length + " blank(s)");
  } else if (isDragDrop) {
    Log().info("Question type: DRAG-AND-DROP");
  } else if (responseElements.length > 0) {
    Log().info("Question type: MULTIPLE-CHOICE");
  } else {
    Log().info("Question type: UNKNOWN");
  }

  Log().groupEnd();
  return { question, responses, responseElements, fillBlankInfo };
}

async function selectCorrectResponse(question, responses, responseElements, fillBlankInfo) {
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
    Log().debug("No answer button found, likely not on a question page");
    return;
  }

  // --- Use Stored Answer (If found) ---
  // Refresh from storage to ensure we have the latest data
  await refreshResponseMap();

  Log().debug("Looking up question key:", question);
  Log().debug("Available keys in responseMap:", Object.keys(responseMap).length);

  // Record activity for inactivity tracking
  if (Webhook()) {
    Webhook().recordActivity();
  }

  // Re-detect fill-in-blank in case it changed (use passed info or detect fresh)
  const currentFillBlank = fillBlankInfo || detectFillInBlank();
  const isDragDrop = document.querySelector(".match-single-response-wrapper") !== null;
  const questionType = currentFillBlank.isFillBlank ? "fillInBlank" : isDragDrop ? "dragAndDrop" : "multipleChoice";

  if (responseMap[question]) {
    const correctResponses = responseMap[question];
    Log().group("Using Stored Answer");
    Log().info("Stored answers:", correctResponses);

    // Update debug overlay
    if (Overlay()) {
      Overlay().updateDebugInfo({
        type: questionType === "fillInBlank" ? "Fill-in-Blank" : questionType === "dragAndDrop" ? "Drag & Drop" : "Multiple Choice",
        source: "Stored",
        confidence: "100%",
        action: "Answering from memory",
      });
    }

    // Record stats for correct first try
    if (Stats()) {
      try {
        await Stats().recordQuestion(questionType, true, false);
        // Force immediate save to ensure popup sees updated stats
        await Stats().save();

        // Update overlay stats
        if (Overlay()) {
          const session = await Stats().getSessionStats();
          Overlay().updateSessionStats(session);
        }
      } catch (e) {
        Log().warn("Failed to record stats:", e);
      }
    }

    if (currentFillBlank.isFillBlank) {
      // Use detected blank elements
      const blanks = currentFillBlank.blankElements;
      Log().info("Fill-in-blank (" + currentFillBlank.blankType + "): Found", blanks.length, "blanks,", correctResponses.length, "stored answers");

      if (blanks.length !== correctResponses.length) {
        Log().warn("Blank count mismatch! Blanks:", blanks.length, "Answers:", correctResponses.length);
      }

      for (let x = 0; x < blanks.length; x++) {
        const blankEl = blanks[x];
        const answer = x < correctResponses.length ? correctResponses[x] : correctResponses[0];

        if (blankEl.tagName.toLowerCase() === 'select') {
          // Handle dropdown
          const options = blankEl.querySelectorAll('option');
          for (const opt of options) {
            if (opt.textContent.trim().toLowerCase() === answer.toLowerCase() ||
                opt.value.toLowerCase() === answer.toLowerCase()) {
              blankEl.value = opt.value;
              blankEl.dispatchEvent(new Event('change', { bubbles: true }));
              Log().debug("Set dropdown", x, "to:", answer);
              break;
            }
          }
        } else {
          // Handle input
          Log().debug("Setting blank", x, "to:", answer);
          const success = setInputValue(blankEl, answer);
          if (!success) {
            Log().error("Failed to set blank", x);
          }
        }
        await sleep(50);
      }
    } else if (responseElements.length > 0) {
      // Multiple choice
      let clicked = false;
      for (let i = 0; i < responses.length; i++) {
        if (correctResponses.includes(responses[i])) {
          Log().debug("Clicking correct option:", responses[i]);
          responseElements[i].click();
          clicked = true;
        }
      }
      if (!clicked) {
        Log().warn("No matching response found, clicking first option");
        responseElements[0]?.click();
      }
    }

    Log().groupEnd();
    await sleep(Math.random() * 200 + 500);
    answerButton.click();
  } else {
    let isFillInBlankQuestion = currentFillBlank.isFillBlank;
    let isDragAndDrop = false;
    let usedLLM = false;

    // Try LLM for answer if enabled
    if (LLM()) {
      try {
        const llmReady = await LLM().isReady();
        if (llmReady) {
          Log().info("Trying LLM for answer...");

          // Update debug overlay
          if (Overlay()) {
            Overlay().updateDebugInfo({
              type: isFillInBlankQuestion ? "Fill-in-Blank" : "Multiple Choice",
              source: "LLM",
              confidence: "~70%",
              action: "Querying AI...",
            });
          }

          const llmAnswer = await LLM().askQuestion(question, responses);
          if (llmAnswer) {
            Log().info("LLM provided answer:", llmAnswer);
            usedLLM = true;

            if (Overlay()) {
              Overlay().showToast("AI Assist", "Using AI-generated answer", "info", 2000);
              Overlay().updateDebugInfo({
                type: isFillInBlankQuestion ? "Fill-in-Blank" : "Multiple Choice",
                source: "LLM",
                confidence: "~70%",
                action: "AI answered",
              });
            }

            // Use LLM answer
            if (responseElements.length > 0) {
              // Multiple choice - find matching option
              let clicked = false;
              for (let i = 0; i < responses.length; i++) {
                if (responses[i].toLowerCase().includes(llmAnswer.toLowerCase()) ||
                    llmAnswer.toLowerCase().includes(responses[i].toLowerCase())) {
                  Log().debug("LLM: Clicking option:", responses[i]);
                  responseElements[i].click();
                  clicked = true;
                  break;
                }
              }
              if (!clicked) {
                Log().warn("LLM answer didn't match any option, clicking first");
                responseElements[0].click();
              }
            } else if (isFillInBlankQuestion) {
              // Fill-in-blank - use LLM answer directly
              const llmAnswers = llmAnswer.split(/[,;]/).map(a => a.trim());
              const blanks = currentFillBlank.blankElements;
              for (let x = 0; x < blanks.length; x++) {
                const blankEl = blanks[x];
                const answer = llmAnswers[x] || llmAnswers[0] || "unknown";

                if (blankEl.tagName.toLowerCase() === 'select') {
                  // Try to match dropdown option
                  const options = blankEl.querySelectorAll('option');
                  let matched = false;
                  for (const opt of options) {
                    if (opt.textContent.toLowerCase().includes(answer.toLowerCase())) {
                      blankEl.value = opt.value;
                      blankEl.dispatchEvent(new Event('change', { bubbles: true }));
                      matched = true;
                      break;
                    }
                  }
                  if (!matched && options.length > 1) {
                    blankEl.value = options[1].value; // Select first non-empty option
                    blankEl.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                } else {
                  setInputValue(blankEl, answer);
                }
              }
            }
          }
        }
      } catch (e) {
        Log().warn("LLM fallback failed:", e);
      }
    }

    // Fall back to guessing if LLM didn't help
    if (!usedLLM) {
      // Update debug overlay for guessing
      if (Overlay()) {
        Overlay().updateDebugInfo({
          type: isFillInBlankQuestion ? "Fill-in-Blank" : document.querySelector(".match-single-response-wrapper") ? "Drag & Drop" : "Multiple Choice",
          source: "Guessing",
          confidence: "~25%",
          action: "No stored answer, guessing...",
        });
      }

      if (responseElements.length === 0) {
        if (document.querySelector(".match-single-response-wrapper")) {
          isDragAndDrop = true;
          isFillInBlankQuestion = false;
          await sleep(500);
          let choices = document.querySelectorAll(
            ".choices-container .choice-item-wrapper .content p",
          );
          let drop = document.querySelectorAll(
            ".-placeholder.choice-item-wrapper",
          );
          let numDrops = 0;

          while (drop.length > 0 && numDrops < 6) {
            Log().debug("Executing drag and drop:", numDrops);
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
            Log().warn("Giving up drag and drop after 6 attempts");
          }
        } else if (isFillInBlankQuestion) {
          // Use detected blanks
          const blanks = currentFillBlank.blankElements;
          Log().info("No stored answer - filling", blanks.length, "blank(s) with placeholder");
          for (let x = 0; x < blanks.length; x++) {
            const blankEl = blanks[x];
            if (blankEl.tagName.toLowerCase() === 'select') {
              const options = blankEl.querySelectorAll('option');
              if (options.length > 1) {
                blankEl.value = options[1].value;
                blankEl.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } else {
              setInputValue(blankEl, "answer");
            }
          }
        }
      } else {
        responseElements[0].click();
      }
    }

    // Submit the guess — only click if not disabled
    await sleep(Math.random() * 200 + 300);
    if (answerButton && !answerButton.hasAttribute("disabled")) {
      answerButton.click();
    }

    // --- Learn the Correct Answer ---
    Log().group("Learning Correct Answer");
    Log().time("answer-extraction");

    // Wait for feedback to render with retry logic
    const maxRetries = Cfg().TIMING?.FEEDBACK_MAX_RETRIES || 5;
    const retryWait = Cfg().TIMING?.FEEDBACK_RETRY_WAIT || 600;
    let answers = [];

    if (isFillInBlankQuestion) {
      Log().info("Extracting fill-in-blank answers...");

      // Retry loop for feedback extraction
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        await sleep(attempt === 1 ? 1000 : retryWait);

        // Use comprehensive extraction function
        answers = extractFillInBlankAnswers();

        if (answers.length > 0) {
          Log().info("Attempt", attempt, "- Successfully extracted", answers.length, "answers:", answers);
          break;
        }

        Log().debug("Attempt", attempt + "/" + maxRetries, "- No answers found yet");
      }

      if (answers.length === 0) {
        Log().error("Failed to extract fill-in-blank answers after", maxRetries, "attempts");
      }

    } else if (isDragAndDrop) {
      Log().info("Skipping answer storage for drag-and-drop question");
      Log().groupEnd();
      return;
    } else {
      // Multiple choice
      const answerContainer = document.getElementsByClassName("answer-container")[0];
      if (answerContainer) {
        let answerElements = answerContainer.getElementsByClassName("choiceText rs_preserve");
        if (answerElements.length === 0) {
          answerElements = answerContainer.getElementsByClassName("choice-row");
        }

        Log().debug("Found", answerElements.length, "answer elements in answer-container");

        for (let i = 0; i < answerElements.length; i++) {
          const ansText = answerElements[i].textContent.trim();
          Log().debug("Answer", i + ":", ansText);
          answers.push(ansText);
        }
      } else {
        Log().warn("No answer-container found for multiple choice");
      }
    }

    Log().timeEnd("answer-extraction");

    if (answers.length > 0) {
      Log().info("Storing", answers.length, "answer(s) for question");
      Log().debug("Storage key:", question);
      Log().debug("Storage value:", answers);
      await updateMapData(question, answers);
      // Verify storage worked
      await refreshResponseMap();
      if (responseMap[question]) {
        Log().info("Verified answer stored successfully");

        // Update debug overlay
        if (Overlay()) {
          Overlay().updateDebugInfo({
            type: isFillInBlankQuestion ? "Fill-in-Blank" : isDragAndDrop ? "Drag & Drop" : "Multiple Choice",
            source: "Learned",
            confidence: "100%",
            action: "Answer stored for next time",
          });
        }
      } else {
        Log().error("Answer storage verification failed!");
      }

      // Record stats for learned from feedback
      if (Stats()) {
        try {
          await Stats().recordQuestion(questionType, false, true);
          // Force immediate save to ensure popup sees updated stats
          await Stats().save();

          // Update overlay stats
          if (Overlay()) {
            const session = await Stats().getSessionStats();
            Overlay().updateSessionStats(session);
          }
        } catch (e) {
          Log().warn("Failed to record stats:", e);
        }
      }
    } else {
      Log().error("No answers extracted - nothing to store");
    }

    Log().groupEnd();
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
    Log().warn("Extension context invalidated during question check");
    botEnabled = false;
    return;
  }

  Log().group("Processing Question");
  let { question, responses, responseElements, fillBlankInfo } = readQuestionAndResponses();
  if (question && question.trim() !== "") {
    await selectCorrectResponse(question, responses, responseElements, fillBlankInfo);
  } else {
    const toQuestionsButton = document.querySelector(
      'button[data-automation-id="reading-questions-button"]',
    );
    const continueButton = document.querySelector(".button-bar-wrapper button");

    if (toQuestionsButton) {
      Log().info("Detected reading page—clicking button to go to questions");
      toQuestionsButton.click();
    } else if (
      continueButton &&
      continueButton.textContent.includes("Continue")
    ) {
      Log().info("Detected review page—clicking Continue");
      continueButton.click();
    } else {
      Log().debug("Could not find a valid question or navigation element");
    }
  }
  Log().groupEnd();
}

let answerQuestionRunning = false;

async function _runBotLoop() {
  while (botEnabled) {
    if (!isContextValid()) {
      Log().warn("Extension context invalidated. Stopping bot loop.");
      botEnabled = false;
      break;
    }

    if (!answerQuestionRunning) {
      answerQuestionRunning = true;
      try {
        await answerQuestion();
      } catch (error) {
        Log().error("Error while answering question:", error);
      }
      answerQuestionRunning = false;
    }
    await sleep(Math.random() * 200 + 300);
  }
}

async function activateBot() {
  Log().info("=== Bot Activating ===");
  Log().info("DEV_MODE:", Cfg().DEV_MODE ? "ENABLED" : "DISABLED");

  if (botEnabled === null || botEnabled === false) {
    botEnabled = true;
    window.botEnabled = true;
    chrome.storage.local.set({ isBotEnabled: true });

    // Start session tracking
    if (Stats()) {
      try {
        await Stats().startSession();
        Log().info("Session started");
      } catch (e) {
        Log().warn("Failed to start session:", e);
      }
    }

    // Send webhook notification
    if (Webhook()) {
      try {
        await Webhook().sendSessionStart();
      } catch (e) {
        Log().warn("Failed to send session start webhook:", e);
      }
    }

    while (botEnabled) {
      try {
        await _runBotLoop();
      } catch (e) {
        Log().error("Fatal error in bot loop. Restarting in 500ms.", e);
      }

      if (botEnabled) {
        await sleep(500);
        Log().info("Attempting to restart bot loop...");
      }
    }
  }
}

async function deactivateBot() {
  Log().info("=== Bot Deactivating ===");
  botEnabled = false;
  window.botEnabled = false;
  chrome.storage.local.set({ isBotEnabled: false });

  // End session tracking and send webhook
  if (Stats()) {
    try {
      const session = await Stats().endSession();
      if (session) {
        // Show session summary toast
        if (Overlay()) {
          Overlay().showSessionSummary(session);
        }

        // Send webhook
        if (Webhook()) {
          await Webhook().sendSessionEnd(session, "manual");
        }
      }
      Log().info("Session ended:", session);
    } catch (e) {
      Log().warn("Failed to end session:", e);
    }
  }

  // Clear inactivity timer
  if (Webhook()) {
    Webhook().clearInactivityTimer();
  }

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

  Log().info("Cleanup complete");
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
      Log().debug("Received data from overlay and updated map");
    }
  }
  return true;
});

// Initialization
chrome.storage.local.get("isBotEnabled", (result) => {
  const isEnabled = result.isBotEnabled === true;

  botEnabled = isEnabled;
  window.botEnabled = isEnabled;

  Log().info("=== Content Script Initialized ===");
  Log().info("DEV_MODE:", Cfg().DEV_MODE ? "ENABLED" : "DISABLED");
  Log().info("Bot status:", isEnabled ? "ACTIVE" : "INACTIVE");

  if (isEnabled) {
    activateBot();
  }

  chrome.storage.local.get("responseMap", (mapResult) => {
    responseMap = mapResult.responseMap || {};
    Log().info("Loaded responseMap with", Object.keys(responseMap).length, "entries");
  });

  // Prune storage if needed
  pruneResponseMapIfNeeded();
});
