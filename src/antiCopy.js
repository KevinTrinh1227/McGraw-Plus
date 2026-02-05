/**
 * Anti-Copy Bypass for McGraw-Hill SmartBook
 * Enables text selection and copying on restricted pages
 */

const AntiCopy = {
  // Storage key for setting
  STORAGE_KEY: "sbs_anti_copy_enabled",

  // Track if bypass is active
  isActive: false,

  // Injected style element
  styleElement: null,

  /**
   * Initialize anti-copy bypass
   */
  async init() {
    const enabled = await this.isEnabled();
    if (enabled) {
      this.enable();
    }

    // Listen for setting changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes[this.STORAGE_KEY]) {
        if (changes[this.STORAGE_KEY].newValue === true) {
          this.enable();
        } else {
          this.disable();
        }
      }
    });
  },

  /**
   * Check if anti-copy is enabled in settings
   */
  async isEnabled() {
    return new Promise((resolve) => {
      chrome.storage.local.get(this.STORAGE_KEY, (result) => {
        resolve(result[this.STORAGE_KEY] === true);
      });
    });
  },

  /**
   * Set anti-copy enabled/disabled
   */
  async setEnabled(enabled) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: enabled }, resolve);
    });
  },

  /**
   * Enable the anti-copy bypass
   */
  enable() {
    if (this.isActive) return;

    console.log("[SBS AntiCopy] Enabling copy bypass");

    // 1. Inject CSS to override user-select
    this.injectStyles();

    // 2. Remove event handlers
    this.removeEventHandlers();

    // 3. Set up mutation observer to handle dynamically added elements
    this.setupMutationObserver();

    this.isActive = true;

    // Notify user
    if (window.SBS_Overlay) {
      window.SBS_Overlay.showToast(
        "Copy Enabled",
        "Text selection and copying are now allowed",
        "success",
        2000
      );
    }
  },

  /**
   * Disable the anti-copy bypass
   */
  disable() {
    if (!this.isActive) return;

    console.log("[SBS AntiCopy] Disabling copy bypass");

    // Remove injected styles
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }

    // Disconnect mutation observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    this.isActive = false;
  },

  /**
   * Inject CSS to enable text selection
   */
  injectStyles() {
    if (this.styleElement) return;

    this.styleElement = document.createElement("style");
    this.styleElement.id = "sbs-anti-copy-styles";
    this.styleElement.textContent = `
      /* Override user-select restrictions */
      *, *::before, *::after {
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
      }

      /* Allow context menu */
      body {
        -webkit-touch-callout: default !important;
      }

      /* Override any pointer-events restrictions */
      [style*="pointer-events: none"] {
        pointer-events: auto !important;
      }
    `;

    document.head.appendChild(this.styleElement);
  },

  /**
   * Remove copy/select blocking event handlers
   */
  removeEventHandlers() {
    // Remove document-level handlers
    const events = ["copy", "cut", "paste", "selectstart", "contextmenu", "dragstart"];

    events.forEach((event) => {
      document[`on${event}`] = null;
    });

    // Remove inline handlers from elements
    const selectors = events.map((e) => `[on${e}]`).join(", ");
    const elements = document.querySelectorAll(selectors);

    elements.forEach((el) => {
      events.forEach((event) => {
        el.removeAttribute(`on${event}`);
      });
    });

    // Override addEventListener for these events
    this.overrideEventListener();
  },

  /**
   * Override addEventListener to prevent new copy-blocking handlers
   */
  overrideEventListener() {
    const blockedEvents = ["copy", "cut", "paste", "selectstart", "contextmenu"];

    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

    // Store handlers to allow removal
    const handlerMap = new WeakMap();

    EventTarget.prototype.addEventListener = function (type, handler, options) {
      if (blockedEvents.includes(type)) {
        // Wrap handler to prevent default only if it would block the action
        const wrappedHandler = function (e) {
          // Allow the event to proceed
          return;
        };

        // Store mapping for removal
        if (!handlerMap.has(this)) {
          handlerMap.set(this, new Map());
        }
        handlerMap.get(this).set(handler, wrappedHandler);

        return originalAddEventListener.call(this, type, wrappedHandler, options);
      }

      return originalAddEventListener.call(this, type, handler, options);
    };

    EventTarget.prototype.removeEventListener = function (type, handler, options) {
      if (blockedEvents.includes(type) && handlerMap.has(this)) {
        const wrappedHandler = handlerMap.get(this).get(handler);
        if (wrappedHandler) {
          handlerMap.get(this).delete(handler);
          return originalRemoveEventListener.call(this, type, wrappedHandler, options);
        }
      }

      return originalRemoveEventListener.call(this, type, handler, options);
    };

    // Store originals for potential restoration
    this._originalAddEventListener = originalAddEventListener;
    this._originalRemoveEventListener = originalRemoveEventListener;
  },

  /**
   * Set up mutation observer to handle dynamically added elements
   */
  setupMutationObserver() {
    if (this.mutationObserver) return;

    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.cleanElement(node);
          }
        });
      });
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },

  /**
   * Clean a single element of copy-blocking attributes
   */
  cleanElement(element) {
    const events = ["oncopy", "oncut", "onpaste", "onselectstart", "oncontextmenu", "ondragstart"];

    events.forEach((event) => {
      if (element.hasAttribute(event)) {
        element.removeAttribute(event);
      }
    });

    // Also check children
    const children = element.querySelectorAll(
      "[oncopy], [oncut], [onpaste], [onselectstart], [oncontextmenu], [ondragstart]"
    );
    children.forEach((child) => {
      events.forEach((event) => {
        child.removeAttribute(event);
      });
    });
  },

  /**
   * Toggle anti-copy on/off
   */
  async toggle() {
    const currentlyEnabled = await this.isEnabled();
    await this.setEnabled(!currentlyEnabled);
  },
};

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => AntiCopy.init());
} else {
  AntiCopy.init();
}

// Make available globally
if (typeof window !== "undefined") {
  window.SBS_AntiCopy = AntiCopy;
}
