/**
 * LLM API Integration for McGraw-Hill SmartBook Solver
 * Supports Groq, OpenAI, and Anthropic APIs
 */

const LLM = {
  // Storage keys
  STORAGE_KEYS: {
    PROVIDER: "sbs_llm_provider",
    API_KEY: "sbs_llm_api_key",
    ENABLED: "sbs_llm_enabled",
  },

  // Provider configurations
  PROVIDERS: {
    groq: {
      name: "Groq",
      model: "llama-3.3-70b-versatile",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      maxTokens: 150,
    },
    openai: {
      name: "OpenAI",
      model: "gpt-4o-mini",
      endpoint: "https://api.openai.com/v1/chat/completions",
      maxTokens: 150,
    },
    anthropic: {
      name: "Anthropic",
      model: "claude-3-haiku-20240307",
      endpoint: "https://api.anthropic.com/v1/messages",
      maxTokens: 150,
    },
  },

  // System prompt for answering questions
  SYSTEM_PROMPT: `You are answering a SmartBook educational question. Your response must be ONLY the correct answer, with no explanation, no reasoning, and no extra text.

For multiple choice: respond with the exact text of the correct option.
For fill-in-the-blank: respond with just the word(s) that go in the blank(s), separated by commas if multiple blanks.

Examples:
Question: What is the capital of France?
Options: A) London, B) Paris, C) Berlin, D) Madrid
Answer: Paris

Question: The process of _____ converts glucose into energy.
Answer: cellular respiration

Be precise and match the expected format exactly.`,

  /**
   * Get LLM settings from storage
   */
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [this.STORAGE_KEYS.PROVIDER, this.STORAGE_KEYS.API_KEY, this.STORAGE_KEYS.ENABLED],
        (result) => {
          resolve({
            provider: result[this.STORAGE_KEYS.PROVIDER] || "groq",
            apiKey: result[this.STORAGE_KEYS.API_KEY] || null,
            enabled: result[this.STORAGE_KEYS.ENABLED] === true,
          });
        }
      );
    });
  },

  /**
   * Save LLM settings
   */
  async saveSettings(provider, apiKey, enabled) {
    return new Promise((resolve) => {
      const data = {
        [this.STORAGE_KEYS.PROVIDER]: provider,
        [this.STORAGE_KEYS.API_KEY]: apiKey,
        [this.STORAGE_KEYS.ENABLED]: enabled,
      };
      chrome.storage.local.set(data, resolve);
    });
  },

  /**
   * Clear API key from storage
   */
  async clearApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(this.STORAGE_KEYS.API_KEY, resolve);
    });
  },

  /**
   * Check if LLM is configured and ready
   */
  async isReady() {
    const settings = await this.getSettings();
    return settings.enabled && settings.apiKey;
  },

  /**
   * Ask the LLM for an answer
   * @param {string} question - The question text
   * @param {string[]} options - Available options (for multiple choice)
   * @returns {Promise<string|null>} The answer or null if failed
   */
  async askQuestion(question, options = []) {
    const settings = await this.getSettings();

    if (!settings.enabled || !settings.apiKey) {
      console.log("[McGraw Plus LLM] Not configured or disabled");
      return null;
    }

    const provider = this.PROVIDERS[settings.provider];
    if (!provider) {
      console.error("[McGraw Plus LLM] Unknown provider:", settings.provider);
      return null;
    }

    // Build the user prompt
    let userPrompt = `Question: ${question}`;
    if (options.length > 0) {
      userPrompt += `\nOptions: ${options.join(", ")}`;
    }
    userPrompt += "\nAnswer:";

    try {
      let response;

      if (settings.provider === "anthropic") {
        response = await this.callAnthropic(provider, settings.apiKey, userPrompt);
      } else {
        // OpenAI-compatible API (Groq, OpenAI)
        response = await this.callOpenAICompatible(provider, settings.apiKey, userPrompt);
      }

      if (response) {
        console.log("[McGraw Plus LLM] Got answer:", response);
        return response.trim();
      }

      return null;
    } catch (error) {
      console.error("[McGraw Plus LLM] Error:", error);
      return null;
    }
  },

  /**
   * Call OpenAI-compatible API (Groq, OpenAI)
   */
  async callOpenAICompatible(provider, apiKey, userPrompt) {
    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: this.SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: provider.maxTokens,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[McGraw Plus LLM] API error:", response.status, error);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  },

  /**
   * Call Anthropic API
   */
  async callAnthropic(provider, apiKey, userPrompt) {
    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: provider.maxTokens,
        system: this.SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[McGraw Plus LLM] Anthropic API error:", response.status, error);
      return null;
    }

    const data = await response.json();
    return data.content?.[0]?.text || null;
  },

  /**
   * Test the API connection
   */
  async testConnection() {
    const settings = await this.getSettings();

    if (!settings.apiKey) {
      return { success: false, error: "No API key configured" };
    }

    try {
      const answer = await this.askQuestion(
        "What is 2 + 2?",
        ["3", "4", "5", "6"]
      );

      if (answer && answer.includes("4")) {
        return { success: true, answer };
      } else if (answer) {
        return { success: true, answer, warning: "Unexpected answer format" };
      } else {
        return { success: false, error: "No response from API" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get list of available providers
   */
  getProviderList() {
    return Object.entries(this.PROVIDERS).map(([key, config]) => ({
      id: key,
      name: config.name,
      model: config.model,
    }));
  },
};

// Make available globally
if (typeof window !== "undefined") {
  window.SBS_LLM = LLM;
  window.MP_LLM = LLM; // McGraw Plus alias
}
