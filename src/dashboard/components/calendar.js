/**
 * McGraw Plus - Calendar Component
 * Pure CSS/JS month grid with assignment indicators
 */

class CalendarComponent {
  constructor(options) {
    this.container = options.container;
    this.detailsContainer = options.detailsContainer;
    this.detailsDate = options.detailsDate;
    this.monthYear = options.monthYear;
    this.prevBtn = options.prevBtn;
    this.nextBtn = options.nextBtn;
    this.todayBtn = options.todayBtn;
    this.assignments = options.assignments || [];

    this.currentDate = new Date();
    this.selectedDate = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.prevBtn?.addEventListener('click', () => this.changeMonth(-1));
    this.nextBtn?.addEventListener('click', () => this.changeMonth(1));
    this.todayBtn?.addEventListener('click', () => this.goToToday());
  }

  setAssignments(assignments) {
    this.assignments = assignments || [];
    this.render();
  }

  changeMonth(delta) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    this.render();
  }

  goToToday() {
    this.currentDate = new Date();
    this.selectedDate = new Date().toISOString().split('T')[0];
    this.render();
    this.renderDetails();
  }

  render() {
    if (!this.container) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // Update header
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    if (this.monthYear) {
      this.monthYear.textContent = `${monthNames[month]} ${year}`;
    }

    // Calculate calendar grid
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();

    // Build grid
    let html = '';
    let dayCount = 1;
    let nextMonthDay = 1;

    // 6 rows max
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        const cellIndex = row * 7 + col;

        if (cellIndex < firstDay) {
          // Previous month
          const day = daysInPrevMonth - firstDay + cellIndex + 1;
          const prevMonth = month === 0 ? 11 : month - 1;
          const prevYear = month === 0 ? year - 1 : year;
          const dateStr = this.formatDateStr(prevYear, prevMonth, day);

          html += this.renderDay(day, dateStr, true);
        } else if (dayCount <= daysInMonth) {
          // Current month
          const dateStr = this.formatDateStr(year, month, dayCount);
          const isToday = dateStr === today;
          const isSelected = dateStr === this.selectedDate;
          const dots = this.getDotsForDate(dateStr, now);

          html += this.renderDay(dayCount, dateStr, false, isToday, isSelected, dots);
          dayCount++;
        } else {
          // Next month
          const nextMonth = month === 11 ? 0 : month + 1;
          const nextYear = month === 11 ? year + 1 : year;
          const dateStr = this.formatDateStr(nextYear, nextMonth, nextMonthDay);

          html += this.renderDay(nextMonthDay, dateStr, true);
          nextMonthDay++;
        }
      }

      // Stop if we've rendered all days and started next month
      if (dayCount > daysInMonth && row >= 4) break;
    }

    this.container.innerHTML = html;

    // Add click handlers
    this.container.querySelectorAll('.calendar-day').forEach((dayEl) => {
      dayEl.addEventListener('click', () => {
        const dateStr = dayEl.dataset.date;
        this.selectDate(dateStr);
      });
    });
  }

  renderDay(day, dateStr, isOtherMonth, isToday = false, isSelected = false, dots = []) {
    const classes = ['calendar-day'];
    if (isOtherMonth) classes.push('other-month');
    if (isToday) classes.push('today');
    if (isSelected) classes.push('selected');

    let dotsHtml = '';
    if (dots.length > 0) {
      dotsHtml = '<div class="day-dots">' +
        dots.slice(0, 3).map((type) => `<div class="dot ${type}"></div>`).join('') +
        '</div>';
    }

    return `
      <div class="${classes.join(' ')}" data-date="${dateStr}">
        <span class="day-number">${day}</span>
        ${dotsHtml}
      </div>
    `;
  }

  formatDateStr(year, month, day) {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  getDotsForDate(dateStr, now) {
    const dayStart = new Date(dateStr).setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr).setHours(23, 59, 59, 999);

    const dots = [];
    const seen = new Set();

    for (const assignment of this.assignments) {
      if (!assignment.dueDate) continue;

      const dueTime = new Date(assignment.dueDate).getTime();
      const dueDate = new Date(assignment.dueDate).toISOString().split('T')[0];

      if (dueDate !== dateStr) continue;

      let type;
      if (assignment.completed) {
        type = 'completed';
      } else if (dueTime < now) {
        type = 'overdue';
      } else if (dueTime - now < 86400000) {
        type = 'soon';
      } else {
        type = 'upcoming';
      }

      if (!seen.has(type)) {
        seen.add(type);
        dots.push(type);
      }
    }

    // Sort by priority: overdue > soon > upcoming > completed
    const priority = { overdue: 0, soon: 1, upcoming: 2, completed: 3 };
    dots.sort((a, b) => priority[a] - priority[b]);

    return dots;
  }

  selectDate(dateStr) {
    this.selectedDate = dateStr;

    // Update selected state
    this.container.querySelectorAll('.calendar-day').forEach((dayEl) => {
      dayEl.classList.toggle('selected', dayEl.dataset.date === dateStr);
    });

    this.renderDetails();
  }

  renderDetails() {
    if (!this.detailsContainer || !this.selectedDate) return;

    const d = new Date(this.selectedDate);
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    this.detailsDate.textContent = d.toLocaleDateString(undefined, options);

    const now = Date.now();
    const assignments = this.assignments.filter((a) => {
      if (!a.dueDate) return false;
      const dueDate = new Date(a.dueDate).toISOString().split('T')[0];
      return dueDate === this.selectedDate;
    });

    if (assignments.length === 0) {
      this.detailsContainer.innerHTML = '<div class="empty-state"><p>No assignments due this day</p></div>';
      return;
    }

    this.detailsContainer.innerHTML = assignments
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .map((a) => {
        const dueTime = new Date(a.dueDate).getTime();
        const isOverdue = !a.completed && dueTime < now;
        const isSoon = !a.completed && !isOverdue && (dueTime - now) < 86400000;

        const time = new Date(a.dueDate).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        });

        let statusClass = '';
        if (a.completed) statusClass = 'completed';
        else if (isOverdue) statusClass = 'overdue';
        else if (isSoon) statusClass = 'soon';

        return `
          <div class="assignment-item">
            <div class="assignment-checkbox ${a.completed ? 'checked' : ''}"
                 data-id="${this.escapeHtml(a.id || '')}"
                 title="${a.completed ? 'Mark incomplete' : 'Mark complete'}">
            </div>
            <div class="assignment-info">
              <div class="assignment-name">${this.escapeHtml(a.name || 'Untitled')}</div>
              <div class="assignment-meta">
                ${a.courseName ? `<span class="assignment-course">${this.escapeHtml(a.courseName)}</span>` : ''}
                <span class="assignment-due ${statusClass}">${time}</span>
              </div>
            </div>
            ${a.link ? `
              <a href="${this.escapeHtml(a.link)}" target="_blank" class="assignment-link" title="Open in Connect">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ` : ''}
          </div>
        `;
      })
      .join('');
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
  window.CalendarComponent = CalendarComponent;
}
