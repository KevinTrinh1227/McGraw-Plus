/**
 * GitHub Star Verification System
 * Verifies users have starred the repo to unlock premium features
 * Optimized: Checks user's starred repos instead of paginating stargazers
 */

const StarVerify = {
  // Config
  REPO_OWNER: "KevinTrinh1227",
  REPO_NAME: "McGraw-Hill-SmartBook-Solver",

  // Storage keys
  STORAGE_KEYS: {
    USERNAME: "sbs_github_username",
    VERIFIED: "sbs_star_verified",
    VERIFIED_AT: "sbs_star_verified_at",
    LAST_CHECK: "sbs_star_last_check",
  },

  // Re-verification interval (24 hours)
  REVERIFY_INTERVAL: 24 * 60 * 60 * 1000,

  // Cache for current session
  _cache: {
    verified: null,
    username: null,
    timestamp: null,
  },
  _cacheExpiry: 5 * 60 * 1000, // 5 minutes session cache

  /**
   * Get stored verification status
   */
  async getStatus() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [
          this.STORAGE_KEYS.USERNAME,
          this.STORAGE_KEYS.VERIFIED,
          this.STORAGE_KEYS.VERIFIED_AT,
          this.STORAGE_KEYS.LAST_CHECK,
        ],
        (result) => {
          resolve({
            username: result[this.STORAGE_KEYS.USERNAME] || null,
            verified: result[this.STORAGE_KEYS.VERIFIED] === true,
            verifiedAt: result[this.STORAGE_KEYS.VERIFIED_AT] || null,
            lastCheck: result[this.STORAGE_KEYS.LAST_CHECK] || null,
          });
        }
      );
    });
  },

  /**
   * Save verification status
   */
  async saveStatus(username, verified) {
    const now = Date.now();

    // Update session cache
    this._cache = {
      verified,
      username,
      timestamp: now,
    };

    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          [this.STORAGE_KEYS.USERNAME]: username,
          [this.STORAGE_KEYS.VERIFIED]: verified,
          [this.STORAGE_KEYS.VERIFIED_AT]: verified ? now : null,
          [this.STORAGE_KEYS.LAST_CHECK]: now,
        },
        resolve
      );
    });
  },

  /**
   * Clear verification (for logout/unlink)
   */
  async clearStatus() {
    this._cache = { verified: null, username: null, timestamp: null };

    return new Promise((resolve) => {
      chrome.storage.local.remove(
        [
          this.STORAGE_KEYS.USERNAME,
          this.STORAGE_KEYS.VERIFIED,
          this.STORAGE_KEYS.VERIFIED_AT,
          this.STORAGE_KEYS.LAST_CHECK,
        ],
        resolve
      );
    });
  },

  /**
   * Check if a username has starred the repo
   * OPTIMIZED: Checks user's starred repos (most users have <500 stars)
   * Much faster than paginating through repo's stargazers
   * @param {string} username - GitHub username to check
   * @returns {Promise<{found: boolean, error?: string}>}
   */
  async checkStar(username) {
    if (!username || typeof username !== "string") {
      return { found: false, error: "Invalid username" };
    }

    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      return { found: false, error: "Empty username" };
    }

    // Check session cache first
    if (
      this._cache.username &&
      this._cache.username.toLowerCase() === normalizedUsername.toLowerCase() &&
      this._cache.timestamp &&
      Date.now() - this._cache.timestamp < this._cacheExpiry
    ) {
      console.log("[StarVerify] Using cached result");
      return { found: this._cache.verified === true };
    }

    try {
      // Method: Check user's starred repos
      // This is faster because most users have fewer stars than repos have stargazers
      let page = 1;
      const perPage = 100;
      const repoFullName = `${this.REPO_OWNER}/${this.REPO_NAME}`.toLowerCase();

      while (page <= 50) {
        // Safety limit: 5000 starred repos max
        const url = `https://api.github.com/users/${normalizedUsername}/starred?per_page=${perPage}&page=${page}`;

        const response = await fetch(url, {
          headers: { Accept: "application/vnd.github.v3+json" },
        });

        if (!response.ok) {
          if (response.status === 403) {
            // Rate limited
            const resetHeader = response.headers.get("X-RateLimit-Reset");
            const resetTime = resetHeader
              ? new Date(parseInt(resetHeader) * 1000).toLocaleTimeString()
              : "a few minutes";
            return {
              found: false,
              error: `Rate limited. Try again after ${resetTime}.`,
            };
          }
          if (response.status === 404) {
            return { found: false, error: "User not found" };
          }
          return { found: false, error: `GitHub API error: ${response.status}` };
        }

        const starredRepos = await response.json();

        if (starredRepos.length === 0) {
          // No more starred repos, user hasn't starred our repo
          return { found: false };
        }

        // Check if our repo is in this page
        for (const repo of starredRepos) {
          if (repo.full_name.toLowerCase() === repoFullName) {
            console.log("[StarVerify] Found star on page", page);
            return { found: true };
          }
        }

        // Check if there might be more pages
        if (starredRepos.length < perPage) {
          // Last page, user hasn't starred our repo
          return { found: false };
        }

        page++;
      }

      // Hit safety limit
      console.warn("[StarVerify] Hit page limit, user has many starred repos");
      return { found: false };
    } catch (error) {
      console.error("[StarVerify] Error checking star status:", error);
      return { found: false, error: error.message };
    }
  },

  /**
   * Verify a GitHub username exists
   * @param {string} username - GitHub username
   * @returns {Promise<{exists: boolean, error?: string}>}
   */
  async verifyUserExists(username) {
    try {
      const response = await fetch(`https://api.github.com/users/${username}`, {
        headers: { Accept: "application/vnd.github.v3+json" },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { exists: false, error: "GitHub user not found" };
        }
        if (response.status === 403) {
          return { exists: false, error: "Rate limited. Try again later." };
        }
        return { exists: false, error: `GitHub API error: ${response.status}` };
      }

      return { exists: true };
    } catch (error) {
      return { exists: false, error: error.message };
    }
  },

  /**
   * Verify a GitHub username and save status
   * @param {string} username - GitHub username
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async verify(username) {
    if (!username || !username.trim()) {
      return { success: false, message: "Please enter your GitHub username" };
    }

    const cleanUsername = username.trim();

    // Validate username format (alphanumeric and hyphens, 1-39 chars)
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(cleanUsername)) {
      return { success: false, message: "Invalid GitHub username format" };
    }

    // First verify the user exists
    const userCheck = await this.verifyUserExists(cleanUsername);
    if (!userCheck.exists) {
      return { success: false, message: userCheck.error };
    }

    // Now check if they starred the repo
    const starCheck = await this.checkStar(cleanUsername);

    if (starCheck.error) {
      return { success: false, message: starCheck.error };
    }

    if (starCheck.found) {
      await this.saveStatus(cleanUsername, true);
      return {
        success: true,
        message: "Verified! Thank you for starring the repo!",
      };
    } else {
      await this.saveStatus(cleanUsername, false);
      return {
        success: false,
        message: "You haven't starred the repo yet. Please star it first!",
        repoUrl: `https://github.com/${this.REPO_OWNER}/${this.REPO_NAME}`,
      };
    }
  },

  /**
   * Re-verify stored username (for periodic checks)
   * @returns {Promise<boolean>} - True if still verified
   */
  async reverify() {
    const status = await this.getStatus();

    if (!status.username) {
      return false;
    }

    // Check if we need to reverify based on time
    if (status.lastCheck && Date.now() - status.lastCheck < this.REVERIFY_INTERVAL) {
      return status.verified;
    }

    // Perform fresh check
    const starCheck = await this.checkStar(status.username);
    const hasStarred = starCheck.found === true;
    await this.saveStatus(status.username, hasStarred);

    return hasStarred;
  },

  /**
   * Check if user is verified (with auto-reverify)
   */
  async isVerified() {
    const status = await this.getStatus();

    if (!status.verified) {
      return false;
    }

    // Auto-reverify if needed
    if (!status.lastCheck || Date.now() - status.lastCheck > this.REVERIFY_INTERVAL) {
      return await this.reverify();
    }

    return true;
  },

  /**
   * Get repo URL for starring
   */
  getRepoUrl() {
    return `https://github.com/${this.REPO_OWNER}/${this.REPO_NAME}`;
  },

  /**
   * Get star count (for display)
   */
  async getStarCount() {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}`,
        { headers: { Accept: "application/vnd.github.v3+json" } }
      );

      if (!response.ok) return null;

      const data = await response.json();
      return data.stargazers_count;
    } catch {
      return null;
    }
  },
};

// Make available globally
if (typeof window !== "undefined") {
  window.SBS_StarVerify = StarVerify;
}
