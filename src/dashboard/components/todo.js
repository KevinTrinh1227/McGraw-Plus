/**
 * McGraw Plus - To-Do Component
 * Assignment list with filters, sort, and completion toggle
 */

class TodoComponent {
  constructor(options) {
    this.container = options.container;
    this.assignments = options.assignments || [];
    this.onToggle = options.onToggle;

    this.filter = 'all';
    this.sort = 'dueDate';
  }

  setAssignments(assignments) {
    this.assignments = assignments || [];
    this.render();
  }

  setFilter(filter) {
    this.filter = filter;
    this.render();
  }

  setSort(sort) {
    this.sort = sort;
    this.render();
  }

  render() {
    if (!this.container) return;

    const now = Date.now();
    let filtered = this.assignments;

    // Apply filter
    switch (this.filter) {
      case 'upcoming':
        filtered = filtered.filter((a) => {
          if (a.completed) return false;
          const dueTime = new Date(a.dueDate).getTime();
          return dueTime >= now;
        });
        break;
      case 'overdue':
        filtered = filtered.filter((a) => {
          if (a.completed) return false;
          const dueTime = new Date(a.dueDate).getTime();
          return dueTime < now;
        });
        break;
      case 'completed':
        filtered = filtered.filter((a) => a.completed);
        break;
      // 'all' - no filtering
    }

    // Apply sort
    filtered = [...filtered].sort((a, b) => {
      switch (this.sort) {
        case 'dueDate':
          return new Date(a.dueDate) - new Date(b.dueDate);
        case 'course':
          return (a.courseName || '').localeCompare(b.courseName || '');
        case 'type':
          return (a.type || '').localeCompare(b.type || '');
        default:
          return 0;
      }
    });

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <p>${this.getEmptyMessage()}</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = filtered
      .map((a) => this.renderAssignment(a, now))
      .join('');

    // Add click handlers for checkboxes
    this.container.querySelectorAll('.assignment-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('click', () => {
        const id = checkbox.dataset.id;
        const isCompleted = checkbox.classList.contains('checked');
        this.toggleAssignment(id, !isCompleted);
      });
    });
  }

  renderAssignment(assignment, now) {
    const dueTime = new Date(assignment.dueDate).getTime();
    const isOverdue = !assignment.completed && dueTime < now;
    const isSoon = !assignment.completed && !isOverdue && (dueTime - now) < 86400000;

    let statusClass = '';
    if (assignment.completed) statusClass = '';
    else if (isOverdue) statusClass = 'overdue';
    else if (isSoon) statusClass = 'soon';

    return `
      <div class="assignment-item ${assignment.completed ? 'completed' : ''}">
        <div class="assignment-checkbox ${assignment.completed ? 'checked' : ''}"
             data-id="${this.escapeHtml(assignment.id || '')}"
             title="${assignment.completed ? 'Mark incomplete' : 'Mark complete'}">
        </div>
        <div class="assignment-info">
          <div class="assignment-name" style="${assignment.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
            ${this.escapeHtml(assignment.name || 'Untitled')}
          </div>
          <div class="assignment-meta">
            ${assignment.courseName ? `<span class="assignment-course">${this.escapeHtml(assignment.courseName)}</span>` : ''}
            ${assignment.type ? `<span class="assignment-course">${this.escapeHtml(assignment.type)}</span>` : ''}
            <span class="assignment-due ${statusClass}">${this.formatDueDate(assignment.dueDate, now)}</span>
          </div>
        </div>
        ${assignment.link ? `
          <a href="${this.escapeHtml(assignment.link)}" target="_blank" class="assignment-link" title="Open in Connect">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        ` : ''}
      </div>
    `;
  }

  toggleAssignment(id, completed) {
    // Update local state
    const index = this.assignments.findIndex((a) => a.id === id);
    if (index !== -1) {
      this.assignments[index].completed = completed;
    }

    // Call callback
    if (this.onToggle) {
      this.onToggle(id, completed);
    }

    // Re-render
    this.render();
  }

  getEmptyMessage() {
    switch (this.filter) {
      case 'upcoming':
        return 'No upcoming assignments';
      case 'overdue':
        return 'No overdue assignments';
      case 'completed':
        return 'No completed assignments';
      default:
        return 'No assignments found';
    }
  }

  formatDueDate(date, now) {
    const d = new Date(date);
    const diff = d.getTime() - now;

    // Past due
    if (diff < 0) {
      const absDiff = Math.abs(diff);
      if (absDiff < 3600000) {
        const minutes = Math.floor(absDiff / 60000);
        return `${minutes}m ago`;
      }
      if (absDiff < 86400000) {
        const hours = Math.floor(absDiff / 3600000);
        return `${hours}h ago`;
      }
      const days = Math.floor(absDiff / 86400000);
      return `${days}d ago`;
    }

    // Future
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `in ${minutes}m`;
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `in ${hours}h`;
    }
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `in ${days}d`;
    }

    // Otherwise show date
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  window.TodoComponent = TodoComponent;
}
