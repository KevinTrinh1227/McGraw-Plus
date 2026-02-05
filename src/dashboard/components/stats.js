/**
 * McGraw Plus - Stats Component
 * Activity heatmap, pie chart, streak, and time statistics
 */

class StatsComponent {
  constructor(options) {
    this.heatmapGrid = options.heatmapGrid;
    this.heatmapMonths = options.heatmapMonths;
    this.pieChart = options.pieChart;
    this.chartLegend = options.chartLegend;
    this.streakNumber = options.streakNumber;
    this.bestStreak = options.bestStreak;
    this.totalTime = options.totalTime;
    this.avgSession = options.avgSession;
    this.accuracyRing = options.accuracyRing;
    this.statsAccuracy = options.statsAccuracy;
    this.correctCount = options.correctCount;
    this.totalCount = options.totalCount;
    this.stats = options.stats || {};
  }

  setStats(stats) {
    this.stats = stats || {};
    this.render();
  }

  render() {
    this.renderHeatmap();
    this.renderPieChart();
    this.renderStreak();
    this.renderTimeStats();
    this.renderAccuracy();
  }

  renderHeatmap() {
    if (!this.heatmapGrid) return;

    const dailyLog = this.stats.dailyLog || {};
    const today = new Date();
    const cells = [];

    // Generate 52 weeks * 7 days = 364 cells
    // Start from 52 weeks ago, end at today
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364 + (6 - startDate.getDay()));

    // Find max questions for scaling
    const values = Object.values(dailyLog).map((v) =>
      typeof v === 'number' ? v : (v.questions || 0)
    );
    const maxQuestions = Math.max(...values, 1);

    // Generate cells (column by column, 7 rows per column)
    for (let week = 0; week < 52; week++) {
      for (let day = 0; day < 7; day++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(cellDate.getDate() + week * 7 + day);

        const dateStr = cellDate.toISOString().split('T')[0];
        const entry = dailyLog[dateStr];
        const questions = entry ? (typeof entry === 'number' ? entry : (entry.questions || 0)) : 0;

        // Calculate level (0-4)
        let level = 0;
        if (questions > 0) {
          const ratio = questions / maxQuestions;
          if (ratio >= 0.75) level = 4;
          else if (ratio >= 0.5) level = 3;
          else if (ratio >= 0.25) level = 2;
          else level = 1;
        }

        const isToday = dateStr === today.toISOString().split('T')[0];
        const isFuture = cellDate > today;

        cells.push({
          date: dateStr,
          level: isFuture ? 0 : level,
          questions: isFuture ? 0 : questions,
          isToday,
        });
      }
    }

    // Render grid
    this.heatmapGrid.innerHTML = cells
      .map((cell) => `
        <div class="heatmap-cell level-${cell.level}"
             title="${cell.date}: ${cell.questions} question${cell.questions !== 1 ? 's' : ''}"
             style="${cell.isToday ? 'outline: 2px solid var(--accent);' : ''}">
        </div>
      `)
      .join('');

    // Render month labels
    if (this.heatmapMonths) {
      const months = [];
      let lastMonth = -1;

      for (let week = 0; week < 52; week++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(cellDate.getDate() + week * 7);
        const month = cellDate.getMonth();

        if (month !== lastMonth) {
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          months.push({ name: monthNames[month], week });
          lastMonth = month;
        }
      }

      // Simple month labels (showing first of each month)
      this.heatmapMonths.innerHTML = months
        .map((m, i) => {
          const left = m.week * 12; // 10px cell + 2px gap
          return `<span style="position: absolute; left: ${left}px;">${m.name}</span>`;
        })
        .join('');
      this.heatmapMonths.style.position = 'relative';
      this.heatmapMonths.style.height = '16px';
    }
  }

  renderPieChart() {
    if (!this.pieChart || !this.chartLegend) return;

    const byType = this.stats.byType || {
      multipleChoice: 0,
      fillInBlank: 0,
      dragAndDrop: 0,
    };

    const total = byType.multipleChoice + byType.fillInBlank + byType.dragAndDrop;

    if (total === 0) {
      this.pieChart.style.background = 'var(--bg-tertiary)';
      this.chartLegend.innerHTML = `
        <div class="legend-item">
          <div class="legend-color" style="background: var(--text-muted);"></div>
          <span>No data yet</span>
        </div>
      `;
      return;
    }

    // Calculate percentages
    const mcPercent = (byType.multipleChoice / total) * 100;
    const fibPercent = (byType.fillInBlank / total) * 100;
    const dadPercent = (byType.dragAndDrop / total) * 100;

    // Calculate degrees for conic gradient
    const mcDeg = (mcPercent / 100) * 360;
    const fibDeg = (fibPercent / 100) * 360;

    this.pieChart.style.background = `conic-gradient(
      var(--accent) 0deg ${mcDeg}deg,
      var(--success) ${mcDeg}deg ${mcDeg + fibDeg}deg,
      var(--warning) ${mcDeg + fibDeg}deg 360deg
    )`;

    this.chartLegend.innerHTML = `
      <div class="legend-item">
        <div class="legend-color" style="background: var(--accent);"></div>
        <span>Multiple Choice (${Math.round(mcPercent)}%)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: var(--success);"></div>
        <span>Fill in Blank (${Math.round(fibPercent)}%)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: var(--warning);"></div>
        <span>Drag & Drop (${Math.round(dadPercent)}%)</span>
      </div>
    `;
  }

  renderStreak() {
    if (!this.streakNumber) return;

    const streak = this.stats.streakDays || 0;
    this.streakNumber.textContent = streak;

    // Calculate best streak from dailyLog
    if (this.bestStreak) {
      const bestStreak = this.calculateBestStreak();
      this.bestStreak.textContent = Math.max(bestStreak, streak);
    }
  }

  calculateBestStreak() {
    const dailyLog = this.stats.dailyLog || {};
    const dates = Object.keys(dailyLog).sort();

    if (dates.length === 0) return 0;

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diff = (currDate - prevDate) / 86400000; // days

      if (diff === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return maxStreak;
  }

  renderTimeStats() {
    if (!this.totalTime) return;

    const totalMs = this.stats.totalTimeMs || 0;
    const totalSessions = this.stats.totalSessions || 1;

    // Total time
    const totalHours = Math.floor(totalMs / 3600000);
    const totalMinutes = Math.floor((totalMs % 3600000) / 60000);
    this.totalTime.textContent = totalHours > 0
      ? `${totalHours}h ${totalMinutes}m`
      : `${totalMinutes}m`;

    // Average session
    if (this.avgSession) {
      const avgMs = totalMs / totalSessions;
      const avgMinutes = Math.floor(avgMs / 60000);
      this.avgSession.textContent = `${avgMinutes}m`;
    }
  }

  renderAccuracy() {
    if (!this.statsAccuracy) return;

    const total = this.stats.totalQuestions || 0;
    const correct = this.stats.correctFirstTry || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    this.statsAccuracy.textContent = `${accuracy}%`;

    if (this.correctCount) {
      this.correctCount.textContent = correct;
    }

    if (this.totalCount) {
      this.totalCount.textContent = total;
    }

    // Update accuracy ring gradient
    if (this.accuracyRing) {
      const degrees = (accuracy / 100) * 360;
      this.accuracyRing.style.background = `conic-gradient(
        var(--success) 0deg ${degrees}deg,
        var(--bg-tertiary) ${degrees}deg 360deg
      )`;
    }
  }
}

// Export for use in dashboard
if (typeof window !== 'undefined') {
  window.StatsComponent = StatsComponent;
}
