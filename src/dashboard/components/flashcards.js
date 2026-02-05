/**
 * McGraw Plus - Flashcards Component
 * Flashcard generation, grid view, and review mode
 */

class FlashcardsComponent {
  constructor(options) {
    this.grid = options.grid;
    this.countEl = options.countEl;
    this.generateBtn = options.generateBtn;
    this.startReviewBtn = options.startReviewBtn;
    this.reviewMode = options.reviewMode;
    this.currentCard = options.currentCard;
    this.cardFrontText = options.cardFrontText;
    this.cardBackText = options.cardBackText;
    this.reviewProgress = options.reviewProgress;
    this.prevCardBtn = options.prevCardBtn;
    this.flipCardBtn = options.flipCardBtn;
    this.nextCardBtn = options.nextCardBtn;
    this.exitReviewBtn = options.exitReviewBtn;
    this.flashcards = options.flashcards || [];
    this.responseMap = options.responseMap || {};
    this.onSave = options.onSave;

    this.currentView = 'grid';
    this.reviewIndex = 0;
    this.isFlipped = false;

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.generateBtn?.addEventListener('click', () => this.generateFlashcards());
    this.startReviewBtn?.addEventListener('click', () => this.startReview());
    this.exitReviewBtn?.addEventListener('click', () => this.exitReview());
    this.flipCardBtn?.addEventListener('click', () => this.flipCard());
    this.prevCardBtn?.addEventListener('click', () => this.prevCard());
    this.nextCardBtn?.addEventListener('click', () => this.nextCard());
    this.currentCard?.addEventListener('click', () => this.flipCard());
  }

  setFlashcards(flashcards) {
    this.flashcards = flashcards || [];
    this.render();
  }

  setResponseMap(responseMap) {
    this.responseMap = responseMap || {};
  }

  setView(view) {
    this.currentView = view;
    if (this.grid) {
      this.grid.classList.toggle('list-view', view === 'list');
    }
  }

  render() {
    this.updateCount();
    this.renderGrid();
    this.updateReviewButton();
  }

  updateCount() {
    if (this.countEl) {
      this.countEl.textContent = `${this.flashcards.length} flashcard${this.flashcards.length !== 1 ? 's' : ''}`;
    }
  }

  updateReviewButton() {
    if (this.startReviewBtn) {
      this.startReviewBtn.disabled = this.flashcards.length === 0;
    }
  }

  renderGrid() {
    if (!this.grid) return;

    if (this.flashcards.length === 0) {
      this.grid.innerHTML = `
        <div class="empty-state">
          <p>No flashcards yet. Generate some from your Q&A data!</p>
        </div>
      `;
      return;
    }

    this.grid.innerHTML = this.flashcards
      .map((card, index) => `
        <div class="flashcard-item" data-index="${index}">
          <div class="flashcard-question">${this.escapeHtml(card.front)}</div>
          <div class="flashcard-answer">${this.escapeHtml(card.back)}</div>
        </div>
      `)
      .join('');

    // Add click handlers
    this.grid.querySelectorAll('.flashcard-item').forEach((item) => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index, 10);
        this.startReviewAt(index);
      });
    });
  }

  generateFlashcards() {
    const entries = Object.entries(this.responseMap);

    if (entries.length === 0) {
      alert('No Q&A data available to generate flashcards from.');
      return;
    }

    // Convert responseMap to flashcards
    const newFlashcards = entries.map(([question, answer]) => ({
      id: this.generateId(),
      front: this.cleanQuestion(question),
      back: this.cleanAnswer(answer),
      created: Date.now(),
    }));

    // Merge with existing, avoiding duplicates
    const existingFronts = new Set(this.flashcards.map((c) => c.front.toLowerCase()));
    const unique = newFlashcards.filter(
      (c) => !existingFronts.has(c.front.toLowerCase())
    );

    this.flashcards = [...this.flashcards, ...unique];

    // Save
    if (this.onSave) {
      this.onSave(this.flashcards);
    }

    this.render();

    if (unique.length > 0) {
      alert(`Generated ${unique.length} new flashcard${unique.length !== 1 ? 's' : ''}!`);
    } else {
      alert('No new flashcards to generate (all Q&A already exists).');
    }
  }

  cleanQuestion(text) {
    if (!text) return '';
    // Remove HTML tags and trim
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  cleanAnswer(text) {
    if (!text) return '';
    // Handle arrays (multiple correct answers)
    if (Array.isArray(text)) {
      return text.map((t) => this.cleanAnswer(t)).join(', ');
    }
    // Remove HTML tags and trim
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  generateId() {
    return `fc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  startReview() {
    this.startReviewAt(0);
  }

  startReviewAt(index) {
    if (this.flashcards.length === 0) return;

    this.reviewIndex = index;
    this.isFlipped = false;

    if (this.reviewMode) {
      this.reviewMode.classList.remove('hidden');
    }
    if (this.grid) {
      this.grid.classList.add('hidden');
    }

    this.renderReviewCard();
  }

  exitReview() {
    if (this.reviewMode) {
      this.reviewMode.classList.add('hidden');
    }
    if (this.grid) {
      this.grid.classList.remove('hidden');
    }
  }

  renderReviewCard() {
    const card = this.flashcards[this.reviewIndex];
    if (!card) return;

    if (this.cardFrontText) {
      this.cardFrontText.textContent = card.front;
    }
    if (this.cardBackText) {
      this.cardBackText.textContent = card.back;
    }
    if (this.reviewProgress) {
      this.reviewProgress.textContent = `${this.reviewIndex + 1} / ${this.flashcards.length}`;
    }

    // Reset flip state
    this.isFlipped = false;
    if (this.currentCard) {
      this.currentCard.classList.remove('flipped');
    }

    // Update button states
    if (this.prevCardBtn) {
      this.prevCardBtn.disabled = this.reviewIndex === 0;
    }
    if (this.nextCardBtn) {
      this.nextCardBtn.disabled = this.reviewIndex === this.flashcards.length - 1;
    }
  }

  flipCard() {
    this.isFlipped = !this.isFlipped;
    if (this.currentCard) {
      this.currentCard.classList.toggle('flipped', this.isFlipped);
    }
  }

  prevCard() {
    if (this.reviewIndex > 0) {
      this.reviewIndex--;
      this.renderReviewCard();
    }
  }

  nextCard() {
    if (this.reviewIndex < this.flashcards.length - 1) {
      this.reviewIndex++;
      this.renderReviewCard();
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Export for use in dashboard
if (typeof window !== 'undefined') {
  window.FlashcardsComponent = FlashcardsComponent;
}
