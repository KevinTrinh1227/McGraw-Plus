/**
 * McGraw Plus - Export Component
 * ICS, Anki, Quizlet, Notion, JSON, and CSV exports
 */

class ExportComponent {
  constructor(options) {
    this.icsBtn = options.icsBtn;
    this.ankiBtn = options.ankiBtn;
    this.quizletBtn = options.quizletBtn;
    this.notionBtn = options.notionBtn;
    this.notionSettingsBtn = options.notionSettingsBtn;
    this.jsonBtn = options.jsonBtn;
    this.csvBtn = options.csvBtn;
    this.notionModal = options.notionModal;
    this.closeNotionModalBtn = options.closeNotionModalBtn;
    this.notionApiKey = options.notionApiKey;
    this.notionDatabaseId = options.notionDatabaseId;
    this.saveNotionSettingsBtn = options.saveNotionSettingsBtn;
    this.assignments = options.assignments || [];
    this.flashcards = options.flashcards || [];
    this.stats = options.stats || {};
    this.responseMap = options.responseMap || {};
    this.onToast = options.onToast;

    this.setupEventListeners();
    this.loadNotionSettings();
  }

  setupEventListeners() {
    this.icsBtn?.addEventListener('click', () => this.exportICS());
    this.ankiBtn?.addEventListener('click', () => this.exportAnki());
    this.quizletBtn?.addEventListener('click', () => this.exportQuizlet());
    this.notionBtn?.addEventListener('click', () => this.exportNotion());
    this.notionSettingsBtn?.addEventListener('click', () => this.openNotionModal());
    this.jsonBtn?.addEventListener('click', () => this.exportJSON());
    this.csvBtn?.addEventListener('click', () => this.exportCSV());
    this.closeNotionModalBtn?.addEventListener('click', () => this.closeNotionModal());
    this.saveNotionSettingsBtn?.addEventListener('click', () => this.saveNotionSettings());

    // Close modal on backdrop click
    this.notionModal?.addEventListener('click', (e) => {
      if (e.target === this.notionModal) {
        this.closeNotionModal();
      }
    });
  }

  setAssignments(assignments) {
    this.assignments = assignments || [];
  }

  setFlashcards(flashcards) {
    this.flashcards = flashcards || [];
  }

  setStats(stats) {
    this.stats = stats || {};
  }

  setResponseMap(responseMap) {
    this.responseMap = responseMap || {};
  }

  /**
   * Export assignments as ICS (iCalendar) file
   */
  exportICS() {
    if (this.assignments.length === 0) {
      this.showToast('No assignments to export');
      return;
    }

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//McGraw Plus//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (const assignment of this.assignments) {
      if (!assignment.dueDate) continue;

      const uid = `${assignment.id || Date.now()}@mcgraw-plus`;
      const dtstamp = this.formatICSDate(new Date());
      const dtstart = this.formatICSDate(new Date(assignment.dueDate));
      const summary = this.escapeICS(assignment.name || 'Assignment');
      const description = this.escapeICS(
        `Course: ${assignment.courseName || 'Unknown'}\n` +
        `Type: ${assignment.type || 'Assignment'}\n` +
        (assignment.link ? `Link: ${assignment.link}` : '')
      );

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        // Add alarm for 24 hours before
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        'DESCRIPTION:Assignment due in 24 hours',
        'END:VALARM',
        // Add alarm for 1 hour before
        'BEGIN:VALARM',
        'TRIGGER:-PT1H',
        'ACTION:DISPLAY',
        'DESCRIPTION:Assignment due in 1 hour',
        'END:VALARM',
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');

    const content = lines.join('\r\n');
    this.downloadFile(content, 'mcgraw-plus-assignments.ics', 'text/calendar');
    this.showToast('ICS file downloaded');
  }

  formatICSDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return (
      date.getUTCFullYear() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      'T' +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      'Z'
    );
  }

  escapeICS(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  /**
   * Export flashcards for Anki (tab-separated)
   */
  exportAnki() {
    const cards = this.getFlashcardsData();

    if (cards.length === 0) {
      this.showToast('No flashcards to export');
      return;
    }

    // Anki format: front<tab>back
    const content = cards
      .map((card) => `${this.escapeTab(card.front)}\t${this.escapeTab(card.back)}`)
      .join('\n');

    this.downloadFile(content, 'mcgraw-plus-anki.txt', 'text/plain');
    this.showToast('Anki file downloaded');
  }

  /**
   * Export flashcards for Quizlet
   */
  exportQuizlet() {
    const cards = this.getFlashcardsData();

    if (cards.length === 0) {
      this.showToast('No flashcards to export');
      return;
    }

    // Quizlet format: term<tab>definition (one per line)
    const content = cards
      .map((card) => `${this.escapeTab(card.front)}\t${this.escapeTab(card.back)}`)
      .join('\n');

    this.downloadFile(content, 'mcgraw-plus-quizlet.txt', 'text/plain');
    this.showToast('Quizlet file downloaded');
  }

  getFlashcardsData() {
    // Use explicit flashcards first, fall back to responseMap
    if (this.flashcards.length > 0) {
      return this.flashcards.map((c) => ({
        front: c.front,
        back: c.back,
      }));
    }

    // Generate from responseMap
    return Object.entries(this.responseMap).map(([question, answer]) => ({
      front: this.cleanText(question),
      back: this.cleanText(Array.isArray(answer) ? answer.join(', ') : answer),
    }));
  }

  cleanText(str) {
    if (!str) return '';
    return str
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  escapeTab(str) {
    if (!str) return '';
    return str
      .replace(/\t/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '');
  }

  /**
   * Export assignments to Notion
   */
  async exportNotion() {
    const apiKey = await this.getNotionApiKey();
    const databaseId = await this.getNotionDatabaseId();

    if (!apiKey || !databaseId) {
      this.showToast('Please configure Notion settings first');
      this.openNotionModal();
      return;
    }

    if (this.assignments.length === 0) {
      this.showToast('No assignments to export');
      return;
    }

    this.showToast('Syncing to Notion...');

    let success = 0;
    let failed = 0;

    for (const assignment of this.assignments) {
      try {
        const response = await fetch(`https://api.notion.com/v1/pages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
          },
          body: JSON.stringify({
            parent: { database_id: databaseId },
            properties: {
              Name: {
                title: [{ text: { content: assignment.name || 'Untitled' } }],
              },
              Course: {
                rich_text: [{ text: { content: assignment.courseName || '' } }],
              },
              'Due Date': assignment.dueDate ? {
                date: { start: new Date(assignment.dueDate).toISOString() },
              } : undefined,
              Status: {
                select: { name: assignment.completed ? 'Completed' : 'Not Started' },
              },
              Type: {
                select: { name: assignment.type || 'Assignment' },
              },
              Link: assignment.link ? {
                url: assignment.link,
              } : undefined,
            },
          }),
        });

        if (response.ok) {
          success++;
        } else {
          failed++;
          console.error('Notion error:', await response.text());
        }
      } catch (err) {
        failed++;
        console.error('Notion export error:', err);
      }
    }

    if (failed === 0) {
      this.showToast(`Synced ${success} assignments to Notion`);
    } else {
      this.showToast(`Synced ${success}, failed ${failed}`);
    }
  }

  /**
   * Export all data as JSON
   */
  exportJSON() {
    const data = {
      exportedAt: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      assignments: this.assignments,
      flashcards: this.flashcards,
      stats: this.stats,
      responseMap: this.responseMap,
    };

    const content = JSON.stringify(data, null, 2);
    this.downloadFile(content, `mcgraw-plus-backup-${Date.now()}.json`, 'application/json');
    this.showToast('JSON backup downloaded');
  }

  /**
   * Export assignments as CSV
   */
  exportCSV() {
    if (this.assignments.length === 0) {
      this.showToast('No assignments to export');
      return;
    }

    const headers = ['Name', 'Course', 'Due Date', 'Type', 'Completed', 'Link'];
    const rows = this.assignments.map((a) => [
      this.escapeCSV(a.name || ''),
      this.escapeCSV(a.courseName || ''),
      a.dueDate ? new Date(a.dueDate).toISOString() : '',
      this.escapeCSV(a.type || ''),
      a.completed ? 'Yes' : 'No',
      this.escapeCSV(a.link || ''),
    ]);

    const content = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');

    this.downloadFile(content, 'mcgraw-plus-assignments.csv', 'text/csv');
    this.showToast('CSV file downloaded');
  }

  escapeCSV(str) {
    if (!str) return '';
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * Notion settings
   */
  async loadNotionSettings() {
    const result = await chrome.storage.local.get(['mp_notion_api_key', 'mp_notion_database_id']);

    if (this.notionApiKey && result.mp_notion_api_key) {
      this.notionApiKey.value = result.mp_notion_api_key;
    }
    if (this.notionDatabaseId && result.mp_notion_database_id) {
      this.notionDatabaseId.value = result.mp_notion_database_id;
    }

    // Enable Notion export button if configured
    if (this.notionBtn) {
      this.notionBtn.disabled = !result.mp_notion_api_key || !result.mp_notion_database_id;
    }
  }

  async getNotionApiKey() {
    const result = await chrome.storage.local.get('mp_notion_api_key');
    return result.mp_notion_api_key;
  }

  async getNotionDatabaseId() {
    const result = await chrome.storage.local.get('mp_notion_database_id');
    return result.mp_notion_database_id;
  }

  openNotionModal() {
    if (this.notionModal) {
      this.notionModal.classList.remove('hidden');
    }
  }

  closeNotionModal() {
    if (this.notionModal) {
      this.notionModal.classList.add('hidden');
    }
  }

  async saveNotionSettings() {
    const apiKey = this.notionApiKey?.value.trim();
    const databaseId = this.notionDatabaseId?.value.trim();

    await chrome.storage.local.set({
      mp_notion_api_key: apiKey || null,
      mp_notion_database_id: databaseId || null,
    });

    // Update button state
    if (this.notionBtn) {
      this.notionBtn.disabled = !apiKey || !databaseId;
    }

    this.closeNotionModal();
    this.showToast('Notion settings saved');
  }

  /**
   * Download file helper
   */
  downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Toast helper
   */
  showToast(message) {
    if (this.onToast) {
      this.onToast(message);
    }
  }
}

// Export for use in dashboard
if (typeof window !== 'undefined') {
  window.ExportComponent = ExportComponent;
}
