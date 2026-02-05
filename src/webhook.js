/**
 * Discord Webhook Integration for McGraw-Hill SmartBook Solver
 * Sends notifications on session start/end/complete
 */

const Webhook = {
  // Storage key for webhook URL
  STORAGE_KEY: "sbs_webhook_url",

  // Inactivity timeout (2 minutes)
  INACTIVITY_TIMEOUT: 2 * 60 * 1000,

  // Track last activity
  lastActivityTime: null,
  inactivityTimer: null,

  /**
   * Get the webhook URL from storage
   */
  async getWebhookUrl() {
    return new Promise((resolve) => {
      chrome.storage.local.get(this.STORAGE_KEY, (result) => {
        resolve(result[this.STORAGE_KEY] || null);
      });
    });
  },

  /**
   * Set the webhook URL
   */
  async setWebhookUrl(url) {
    if (!url) {
      return new Promise((resolve) => {
        chrome.storage.local.remove(this.STORAGE_KEY, resolve);
      });
    }

    // Validate URL format
    if (!this.isValidWebhookUrl(url)) {
      throw new Error("Invalid Discord webhook URL");
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: url }, resolve);
    });
  },

  /**
   * Validate Discord webhook URL
   */
  isValidWebhookUrl(url) {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname === "discord.com" &&
        parsed.pathname.startsWith("/api/webhooks/")
      );
    } catch {
      return false;
    }
  },

  /**
   * Send a webhook message
   * @param {object} embed - Discord embed object
   */
  async send(embed) {
    const webhookUrl = await this.getWebhookUrl();
    if (!webhookUrl) {
      console.log("[SBS Webhook] No webhook URL configured");
      return false;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "SmartBook Solver",
          embeds: [embed],
        }),
      });

      if (!response.ok) {
        console.error("[SBS Webhook] Failed to send:", response.status);
        return false;
      }

      console.log("[SBS Webhook] Message sent successfully");
      return true;
    } catch (error) {
      console.error("[SBS Webhook] Error sending:", error);
      return false;
    }
  },

  /**
   * Send session start notification
   */
  async sendSessionStart() {
    const embed = {
      title: "SmartBook Session Started",
      color: 0x4caf50, // Green
      description: "Bot has been activated and is now answering questions.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "SmartBook Solver",
      },
    };

    return this.send(embed);
  },

  /**
   * Send session end notification
   * @param {object} session - Session stats
   * @param {string} reason - 'manual' or 'inactivity'
   */
  async sendSessionEnd(session, reason = "manual") {
    if (!session) return false;

    const duration = session.endTime
      ? session.endTime - session.startTime
      : Date.now() - session.startTime;

    const accuracy =
      session.questions > 0
        ? Math.round((session.correct / session.questions) * 100)
        : 0;

    const embed = {
      title: "SmartBook Session Complete",
      color: 0x2196f3, // Blue
      fields: [
        {
          name: "Questions",
          value: String(session.questions || 0),
          inline: true,
        },
        {
          name: "Correct",
          value: `${session.correct || 0} (${accuracy}%)`,
          inline: true,
        },
        {
          name: "Duration",
          value: this.formatDuration(duration),
          inline: true,
        },
        {
          name: "End Reason",
          value: reason === "inactivity" ? "Inactivity timeout" : "Manual stop",
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "SmartBook Solver",
      },
    };

    return this.send(embed);
  },

  /**
   * Send assignment complete notification
   * @param {object} session - Session stats
   */
  async sendAssignmentComplete(session) {
    if (!session) return false;

    const duration = Date.now() - session.startTime;
    const accuracy =
      session.questions > 0
        ? Math.round((session.correct / session.questions) * 100)
        : 0;

    const embed = {
      title: "Assignment Complete!",
      color: 0xffc107, // Gold
      description: "All questions have been answered.",
      fields: [
        {
          name: "Total Questions",
          value: String(session.questions || 0),
          inline: true,
        },
        {
          name: "Accuracy",
          value: `${accuracy}%`,
          inline: true,
        },
        {
          name: "Time",
          value: this.formatDuration(duration),
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "SmartBook Solver",
      },
    };

    return this.send(embed);
  },

  /**
   * Record activity (resets inactivity timer)
   */
  recordActivity() {
    this.lastActivityTime = Date.now();

    // Reset inactivity timer
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      this.handleInactivity();
    }, this.INACTIVITY_TIMEOUT);
  },

  /**
   * Handle inactivity timeout
   */
  async handleInactivity() {
    console.log("[SBS Webhook] Inactivity timeout reached");

    // Check if bot is still active
    chrome.storage.local.get("isBotEnabled", async (result) => {
      if (result.isBotEnabled === true) {
        // Get session stats and send webhook
        if (window.SBS_Stats) {
          const session = await window.SBS_Stats.endSession();
          if (session) {
            await this.sendSessionEnd(session, "inactivity");
          }
        }

        // Deactivate bot
        chrome.storage.local.set({ isBotEnabled: false });

        // Notify overlay
        if (window.SBS_Overlay) {
          window.SBS_Overlay.showToast(
            "Session Ended",
            "Bot deactivated due to inactivity",
            "warning"
          );
        }
      }
    });
  },

  /**
   * Clear inactivity timer
   */
  clearInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  },

  /**
   * Format duration for display
   */
  formatDuration(ms) {
    if (!ms || ms < 0) return "0s";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  },

  /**
   * Test the webhook with a sample message
   */
  async test() {
    const embed = {
      title: "Webhook Test",
      color: 0x9c27b0, // Purple
      description: "This is a test message from SmartBook Solver.",
      timestamp: new Date().toISOString(),
      footer: {
        text: "SmartBook Solver - Test",
      },
    };

    return this.send(embed);
  },
};

// Make available globally
if (typeof window !== "undefined") {
  window.SBS_Webhook = Webhook;
}
