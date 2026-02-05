/**
 * McGraw Plus - Solver Module
 * Hidden advanced feature with 3-step unlock mechanism
 * Refactored from SmartBook Solver contentSolver.js
 */

const MP_Solver = {
  // State
  isActive: false,
  responseMap: {},
  storageWriteQueue: Promise.resolve(),

  // Module references
  get Stats() { return window.MP_Stats || null; },
  get Webhook() { return window.MP_Webhook || null; },
  get LLM() { return window.MP_LLM || null; },
  get Overlay() { return window.MP_Overlay || null; },
  get Logger() { return window.MP_Logger || console; },

  /**
   * Check if extension context is valid
   */
  isContextValid() {
    try {
      chrome.runtime.getManifest();
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Refresh responseMap from storage
   */
  async refreshResponseMap() {
    return new Promise((resolve) => {
      chrome.storage.local.get('responseMap', (result) => {
        this.responseMap = result.responseMap || {};
        this.Logger.debug('Refreshed responseMap:', Object.keys(this.responseMap).length, 'entries');
        resolve(this.responseMap);
      });
    });
  },

  /**
   * Update stored answer data
   */
  async updateMapData(question, answers) {
    const answerArray = Array.isArray(answers) ? answers : [answers];

    if (
      !(question in this.responseMap) ||
      JSON.stringify(this.responseMap[question]) !== JSON.stringify(answerArray)
    ) {
      this.storageWriteQueue = this.storageWriteQueue.then(() => {
        return new Promise((resolve) => {
          chrome.storage.local.get('responseMap', (result) => {
            const tempMap = result.responseMap || {};
            tempMap[question] = answerArray;
            chrome.storage.local.set({ responseMap: tempMap }, () => {
              this.responseMap = tempMap;
              resolve();
            });
          });
        });
      });
    }
  },

  /**
   * Set input value using native setter
   */
  setInputValue(inputEl, value) {
    this.Logger.debug('Setting input value:', value);
    const originalValue = inputEl.value;

    inputEl.focus();
    inputEl.select();

    let success = false;
    if (document.execCommand) {
      success = document.execCommand('insertText', false, value);
    }

    if (!success || inputEl.value !== value) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeSetter.call(inputEl, value);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return inputEl.value === value;
  },

  /**
   * Simulate drag and drop
   */
  async simulateDragAndDrop(source, target) {
    const rect1 = source.getBoundingClientRect();
    const rect2 = target.getBoundingClientRect();

    const mousedown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect1.left + rect1.width / 2,
      clientY: rect1.top + rect1.height / 2,
    });

    const mouseup = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect2.left + rect2.width / 2,
      clientY: rect2.top + rect2.height / 2,
    });

    source.dispatchEvent(mousedown);
    await this.sleep(800);

    for (let i = 1; i <= 50; i++) {
      const intermediateX = rect1.left + (rect2.left - rect1.left) * (i / 50) + rect1.width / 2;
      const intermediateY = rect1.top + (rect2.top - rect1.top) * (i / 50) + rect1.height / 2;

      const mousemove = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: intermediateX,
        clientY: intermediateY,
      });

      source.dispatchEvent(mousemove);
      await this.sleep(10);
    }

    target.dispatchEvent(mouseup);
    await this.sleep(200);
  },

  /**
   * Normalize question key
   */
  normalizeQuestionKey(rawQuestion) {
    return rawQuestion
      .replace(/\s+/g, ' ')
      .replace(/\s*_+\s*/g, '_____')
      .replace(/\s*\[blank\]\s*/gi, '_____')
      .trim();
  },

  /**
   * Extract question text from prompt element
   */
  extractQuestionText(promptElement) {
    const paragraphElement = promptElement.querySelector('p');
    const orderedList = promptElement.querySelector('ol');
    const unorderedList = promptElement.querySelector('ul');

    let questionParts = [];

    if (paragraphElement) {
      questionParts.push(this.extractNodeText(paragraphElement));
    }

    if (orderedList || unorderedList) {
      const list = orderedList || unorderedList;
      const listItems = list.querySelectorAll('li');

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

    if (!paragraphElement && !orderedList && !unorderedList) {
      return this.extractNodeText(promptElement);
    }

    return questionParts.join(' ');
  },

  /**
   * Extract text from a node, replacing blanks with markers
   */
  extractNodeText(node) {
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

        if (el.classList.contains('_visuallyHidden') || el.getAttribute('aria-hidden') === 'true') {
          return;
        }

        if (tagName === 'input' || tagName === 'select') {
          parts.push('_____');
        } else if (
          el.classList.contains('blank') ||
          el.classList.contains('input-container') ||
          el.classList.contains('span-to-div') ||
          el.classList.contains('fitb-input')
        ) {
          if (el.querySelector('input, select')) {
            parts.push('_____');
          } else {
            for (const child of el.childNodes) {
              processNode(child);
            }
          }
        } else if (tagName === 'ol' || tagName === 'ul') {
          return;
        } else {
          for (const child of el.childNodes) {
            processNode(child);
          }
        }
      }
    };

    processNode(node);
    return parts.join('');
  },

  /**
   * Detect fill-in-blank question type
   */
  detectFillInBlank() {
    // Type 1: FITB inputs with specific class
    let blanks = document.querySelectorAll('input.fitb-input');
    if (blanks.length > 0) {
      return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'fitb-input' };
    }

    // Type 2: Input containers with span-to-div
    blanks = document.querySelectorAll('.input-container.span-to-div input');
    if (blanks.length > 0) {
      return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'input-container' };
    }

    // Type 3: FITB fieldset
    blanks = document.querySelectorAll('.fitb-fieldset input, fieldset.fitb-fieldset input');
    if (blanks.length > 0) {
      return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'fitb-fieldset' };
    }

    // Type 4: List-based blanks
    blanks = document.querySelectorAll('.prompt ol input, .prompt ul input');
    if (blanks.length > 0) {
      return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'list-based' };
    }

    // Type 5: Direct inputs in prompt
    blanks = document.querySelectorAll('.prompt input[type="text"], .prompt input:not([type])');
    if (blanks.length > 0) {
      return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'prompt-input' };
    }

    // Type 6: Select dropdowns
    blanks = document.querySelectorAll('.prompt select, .sentence-completion select');
    if (blanks.length > 0) {
      return { isFillBlank: true, blankElements: Array.from(blanks), blankType: 'select-dropdown' };
    }

    return { isFillBlank: false, blankElements: [], blankType: null };
  },

  /**
   * Extract fill-in-blank answers from feedback
   */
  extractFillInBlankAnswers() {
    let answers = [];

    // Method 1: responses-container with li.correct-answers
    const responsesContainer = document.querySelector('.responses-container');
    if (responsesContainer) {
      const answerItems = responsesContainer.querySelectorAll('li.correct-answers');
      answerItems.forEach((item) => {
        const answerEls = item.querySelectorAll('.correct-answer');
        if (answerEls.length > 0) {
          let text = answerEls[0].textContent;
          const sep = answerEls[0].querySelector('.separator');
          if (sep) text = text.replace(sep.textContent, '');
          text = text.replace(/[,\s]+$/, '').trim();
          if (text) answers.push(text);
        }
      });

      if (answers.length > 0) return answers;
    }

    // Method 2: .correct-answers containers
    const correctContainers = document.querySelectorAll('.correct-answers');
    if (correctContainers.length > 0) {
      correctContainers.forEach((container) => {
        if (container.tagName.toLowerCase() === 'li') return;

        const answerEls = container.querySelectorAll('.correct-answer');
        if (answerEls.length > 0) {
          let text = answerEls[0].textContent;
          const sep = answerEls[0].querySelector('.separator');
          if (sep) text = text.replace(sep.textContent, '');
          text = text.replace(/[,\s]+$/, '').trim();
          if (text) answers.push(text);
        }
      });

      if (answers.length > 0) return answers;
    }

    // Method 3: FITB answer component
    const fitbAnswer = document.querySelector('.fitb-component.-answer');
    if (fitbAnswer) {
      const answerEls = fitbAnswer.querySelectorAll('.correct-answer');
      const seenParents = new Set();

      answerEls.forEach((el) => {
        const parentLi = el.closest('li');
        const parentKey = parentLi || el;

        if (!seenParents.has(parentKey)) {
          seenParents.add(parentKey);
          let text = el.textContent;
          const sep = el.querySelector('.separator');
          if (sep) text = text.replace(sep.textContent, '');
          text = text.replace(/[,\s]+$/, '').trim();
          if (text) answers.push(text);
        }
      });

      if (answers.length > 0) return answers;
    }

    return answers;
  },

  /**
   * Read question and responses from the page
   */
  readQuestionAndResponses() {
    this.Logger.group('Reading Question');
    let question = '';
    let responses = [];

    const questionElement = document.getElementsByClassName('prompt')[0];
    if (questionElement) {
      const rawQuestion = this.extractQuestionText(questionElement);
      question = this.normalizeQuestionKey(rawQuestion);
      this.Logger.debug('Question:', question);
    }

    let responseElements = [];
    const container = document.getElementsByClassName('air-item-container')[0];
    if (container) {
      responseElements = container.getElementsByClassName('choiceText rs_preserve');
    }

    if (responseElements.length) {
      for (let i = 0; i < responseElements.length; i++) {
        responses.push(responseElements[i].textContent);
      }
    }

    const fillBlankInfo = this.detectFillInBlank();
    const isDragDrop = document.querySelector('.match-single-response-wrapper') !== null;

    if (fillBlankInfo.isFillBlank) {
      this.Logger.info('Question type: FILL-IN-BLANK');
    } else if (isDragDrop) {
      this.Logger.info('Question type: DRAG-AND-DROP');
    } else if (responseElements.length > 0) {
      this.Logger.info('Question type: MULTIPLE-CHOICE');
    }

    this.Logger.groupEnd();
    return { question, responses, responseElements, fillBlankInfo };
  },

  /**
   * Select and submit the correct response
   */
  async selectCorrectResponse(question, responses, responseElements, fillBlankInfo) {
    await this.sleep(100);

    // Check for next button
    const nextButtonContainer = document.getElementsByClassName('next-button-container')[0];
    if (nextButtonContainer) {
      const nextButton = nextButtonContainer.getElementsByTagName('button')[0];
      const reviewConceptButton = document.querySelector('.btn.btn-tertiary.lr-tray-button');

      if (nextButton && nextButton.hasAttribute('disabled') && reviewConceptButton) {
        reviewConceptButton.click();
        await this.sleep(4000);
        const continueButton = document.querySelector('.button-bar-wrapper button');
        if (continueButton) {
          continueButton.click();
          await this.sleep(500);
        }
      }

      if (nextButton && !nextButton.hasAttribute('disabled')) {
        nextButton.click();
        return;
      }
    }

    const answerButton = document.querySelector('.confidence-buttons-container button');
    if (!answerButton) {
      this.Logger.debug('No answer button found');
      return;
    }

    // Refresh from storage
    await this.refreshResponseMap();

    const currentFillBlank = fillBlankInfo || this.detectFillInBlank();
    const isDragDrop = document.querySelector('.match-single-response-wrapper') !== null;
    const questionType = currentFillBlank.isFillBlank ? 'fillInBlank' : isDragDrop ? 'dragAndDrop' : 'multipleChoice';

    // Use stored answer if available
    if (this.responseMap[question]) {
      const correctResponses = this.responseMap[question];
      this.Logger.info('Using stored answer:', correctResponses);

      if (this.Overlay) {
        this.Overlay.updateDebugInfo({
          type: questionType === 'fillInBlank' ? 'Fill-in-Blank' : questionType === 'dragAndDrop' ? 'Drag & Drop' : 'Multiple Choice',
          source: 'Stored',
          confidence: '100%',
          action: 'Answering from memory',
        });
      }

      if (currentFillBlank.isFillBlank) {
        const blanks = currentFillBlank.blankElements;
        for (let x = 0; x < blanks.length; x++) {
          const blankEl = blanks[x];
          const answer = x < correctResponses.length ? correctResponses[x] : correctResponses[0];

          if (blankEl.tagName.toLowerCase() === 'select') {
            const options = blankEl.querySelectorAll('option');
            for (const opt of options) {
              if (opt.textContent.trim().toLowerCase() === answer.toLowerCase()) {
                blankEl.value = opt.value;
                blankEl.dispatchEvent(new Event('change', { bubbles: true }));
                break;
              }
            }
          } else {
            this.setInputValue(blankEl, answer);
          }
          await this.sleep(50);
        }
      } else if (responseElements.length > 0) {
        for (let i = 0; i < responses.length; i++) {
          if (correctResponses.includes(responses[i])) {
            responseElements[i].click();
            break;
          }
        }
      }

      await this.sleep(Math.random() * 200 + 500);
      answerButton.click();
    } else {
      // Guess and learn
      let isFillInBlankQuestion = currentFillBlank.isFillBlank;
      let isDragAndDrop = false;

      if (this.Overlay) {
        this.Overlay.updateDebugInfo({
          type: isFillInBlankQuestion ? 'Fill-in-Blank' : 'Multiple Choice',
          source: 'Guessing',
          confidence: '~25%',
          action: 'No stored answer, guessing...',
        });
      }

      if (responseElements.length === 0) {
        if (document.querySelector('.match-single-response-wrapper')) {
          isDragAndDrop = true;
          isFillInBlankQuestion = false;

          await this.sleep(500);
          let choices = document.querySelectorAll('.choices-container .choice-item-wrapper .content p');
          let drop = document.querySelectorAll('.-placeholder.choice-item-wrapper');
          let numDrops = 0;

          while (drop.length > 0 && numDrops < 6) {
            if (choices[0] && drop[0]) {
              await this.simulateDragAndDrop(choices[0], drop[0]);
            }
            await this.sleep(500);
            choices = document.querySelectorAll('.choices-container .choice-item-wrapper .content p');
            drop = document.querySelectorAll('.-placeholder.choice-item-wrapper');
            await this.sleep(500);
            numDrops++;
          }
        } else if (isFillInBlankQuestion) {
          const blanks = currentFillBlank.blankElements;
          for (const blankEl of blanks) {
            if (blankEl.tagName.toLowerCase() === 'select') {
              const options = blankEl.querySelectorAll('option');
              if (options.length > 1) {
                blankEl.value = options[1].value;
                blankEl.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } else {
              this.setInputValue(blankEl, 'answer');
            }
          }
        }
      } else {
        responseElements[0].click();
      }

      // Submit
      await this.sleep(Math.random() * 200 + 300);
      if (answerButton && !answerButton.hasAttribute('disabled')) {
        answerButton.click();
      }

      // Learn from feedback
      this.Logger.group('Learning Correct Answer');

      const maxRetries = 5;
      let answers = [];

      if (isFillInBlankQuestion) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          await this.sleep(attempt === 1 ? 1000 : 500);
          answers = this.extractFillInBlankAnswers();
          if (answers.length > 0) break;
        }
      } else if (!isDragAndDrop) {
        await this.sleep(1000);
        const answerContainer = document.getElementsByClassName('answer-container')[0];
        if (answerContainer) {
          let answerElements = answerContainer.getElementsByClassName('choiceText rs_preserve');
          if (answerElements.length === 0) {
            answerElements = answerContainer.getElementsByClassName('choice-row');
          }

          for (let i = 0; i < answerElements.length; i++) {
            answers.push(answerElements[i].textContent.trim());
          }
        }
      }

      if (answers.length > 0) {
        await this.updateMapData(question, answers);
        await this.refreshResponseMap();

        if (this.Overlay) {
          this.Overlay.updateDebugInfo({
            type: isFillInBlankQuestion ? 'Fill-in-Blank' : 'Multiple Choice',
            source: 'Learned',
            confidence: '100%',
            action: 'Answer stored for next time',
          });
        }
      }

      this.Logger.groupEnd();
    }

    // Move to next question
    await this.sleep(Math.random() * 200 + 300);
    const nextButton = document.querySelector('.next-button-container button');
    const reviewButton = document.querySelector('.btn.btn-tertiary.lr-tray-button');

    if (nextButton) {
      if (nextButton.hasAttribute('disabled') && reviewButton) {
        reviewButton.click();
        await this.sleep(500);
        const continueButton = document.querySelector('.button-bar-wrapper button');
        if (continueButton) {
          continueButton.click();
          await this.sleep(500);
        }
      }

      await this.sleep(500);
      nextButton.click();
    }
  },

  /**
   * Answer a single question
   */
  async answerQuestion() {
    if (!this.isContextValid()) {
      this.Logger.warn('Extension context invalidated');
      this.isActive = false;
      return;
    }

    this.Logger.group('Processing Question');
    const { question, responses, responseElements, fillBlankInfo } = this.readQuestionAndResponses();

    if (question && question.trim() !== '') {
      await this.selectCorrectResponse(question, responses, responseElements, fillBlankInfo);
    } else {
      const toQuestionsButton = document.querySelector('button[data-automation-id="reading-questions-button"]');
      const continueButton = document.querySelector('.button-bar-wrapper button');

      if (toQuestionsButton) {
        this.Logger.info('Detected reading page—clicking to go to questions');
        toQuestionsButton.click();
      } else if (continueButton && continueButton.textContent.includes('Continue')) {
        this.Logger.info('Detected review page—clicking Continue');
        continueButton.click();
      }
    }
    this.Logger.groupEnd();
  },

  /**
   * Main bot loop
   */
  async runLoop() {
    while (this.isActive) {
      if (!this.isContextValid()) {
        this.Logger.warn('Extension context invalidated. Stopping.');
        this.isActive = false;
        break;
      }

      try {
        await this.answerQuestion();
      } catch (error) {
        this.Logger.error('Error answering question:', error);
      }

      await this.sleep(Math.random() * 200 + 300);
    }
  },

  /**
   * Activate the solver
   */
  async activate() {
    if (this.isActive) return;

    this.Logger.info('=== Solver Activating ===');
    this.isActive = true;
    chrome.storage.local.set({ isBotEnabled: true });

    // Load response map
    await this.refreshResponseMap();

    // Start loop
    while (this.isActive) {
      try {
        await this.runLoop();
      } catch (e) {
        this.Logger.error('Fatal error in solver loop:', e);
      }

      if (this.isActive) {
        await this.sleep(500);
      }
    }
  },

  /**
   * Deactivate the solver
   */
  async deactivate() {
    this.Logger.info('=== Solver Deactivating ===');
    this.isActive = false;
    chrome.storage.local.set({ isBotEnabled: false });

    // Cleanup
    const overlay = document.getElementById('smartbooksolver-note');
    if (overlay) overlay.remove();

    const highlighted = document.querySelectorAll('[data-sb-highlighted="true"]');
    highlighted.forEach((el) => {
      el.style.backgroundColor = '';
      el.style.border = '';
      el.removeAttribute('data-sb-highlighted');
    });
  },
};

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const message = typeof request === 'string' ? { type: request } : request;

  switch (message.type) {
    case 'activate':
    case 'SOLVER_ACTIVATE':
      MP_Solver.activate();
      sendResponse({ success: true });
      break;

    case 'deactivate':
    case 'SOLVER_DEACTIVATE':
      MP_Solver.deactivate();
      sendResponse({ success: true });
      break;
  }

  return true;
});

// Auto-activate if was enabled
chrome.storage.local.get('isBotEnabled', (result) => {
  if (result.isBotEnabled === true) {
    MP_Solver.activate();
  }
});

// Export
if (typeof window !== 'undefined') {
  window.MP_Solver = MP_Solver;
}
