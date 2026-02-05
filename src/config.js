/**
 * Configuration for McGraw-Hill SmartBook Solver
 *
 * DEV_MODE: Set to true during development for detailed logging
 * - Shows verbose logs in console
 * - Displays timing information
 * - Helps debug fill-in-blank and other question types
 *
 * For releases: Set DEV_MODE = false
 */

const CONFIG = {
  // Toggle this for development vs production
  DEV_MODE: true,

  // Version from manifest (for reference)
  VERSION: "4.1.0",

  // Timing configurations (ms)
  TIMING: {
    FEEDBACK_WAIT: 800,        // Wait for feedback to render after submit
    FEEDBACK_RETRY_WAIT: 500,  // Wait between retries if feedback not found
    FEEDBACK_MAX_RETRIES: 3,   // Max retries for feedback extraction
    INPUT_SETTLE: 100,         // Wait after setting input value
    DRAG_STEP_DELAY: 10,       // Delay between drag steps
    DRAG_INITIAL: 800,         // Initial delay before drag
    DRAG_FINAL: 500,           // Final delay after drag
  },

  // DOM Selectors (centralized for easy updates)
  SELECTORS: {
    QUESTION_PROMPT: ".prompt",
    QUESTION_PARAGRAPH: "p",
    RESPONSE_CONTAINER: ".air-item-container",
    CHOICE_TEXT: ".choiceText.rs_preserve",
    FILL_BLANK_CONTAINER: ".input-container.span-to-div",
    FILL_BLANK_INPUT: "input",
    CORRECT_ANSWERS_CONTAINER: ".correct-answers",
    CORRECT_ANSWER: ".correct-answer",
    ANSWER_CONTAINER: ".answer-container",
    CHOICE_ROW: ".choice-row",
    NEXT_BUTTON: ".next-button-container button",
    SUBMIT_BUTTON: ".confidence-buttons-container button",
    DRAG_DROP_WRAPPER: ".match-single-response-wrapper",
    DRAG_CHOICES: ".choices-container .choice-item-wrapper .content p",
    DRAG_PLACEHOLDERS: ".-placeholder.choice-item-wrapper",
  }
};

// Logger utility with dev mode check
const Logger = {
  _prefix: "[SBS]",

  // Always log (errors, critical info)
  error: function(...args) {
    console.error(this._prefix, "[ERROR]", ...args);
  },

  warn: function(...args) {
    console.warn(this._prefix, "[WARN]", ...args);
  },

  // Only log in dev mode
  info: function(...args) {
    if (CONFIG.DEV_MODE) {
      console.log(this._prefix, "[INFO]", ...args);
    }
  },

  debug: function(...args) {
    if (CONFIG.DEV_MODE) {
      console.log(this._prefix, "[DEBUG]", ...args);
    }
  },

  // Group logging for complex operations
  group: function(label) {
    if (CONFIG.DEV_MODE) {
      console.group(this._prefix + " " + label);
    }
  },

  groupEnd: function() {
    if (CONFIG.DEV_MODE) {
      console.groupEnd();
    }
  },

  // Table for displaying structured data
  table: function(data) {
    if (CONFIG.DEV_MODE) {
      console.table(data);
    }
  },

  // Timing helper
  time: function(label) {
    if (CONFIG.DEV_MODE) {
      console.time(this._prefix + " " + label);
    }
  },

  timeEnd: function(label) {
    if (CONFIG.DEV_MODE) {
      console.timeEnd(this._prefix + " " + label);
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.SBS_CONFIG = CONFIG;
  window.SBS_Logger = Logger;

  // Sync DEV_MODE to storage so popup can read it
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ sbs_dev_mode: CONFIG.DEV_MODE });
  }
}
