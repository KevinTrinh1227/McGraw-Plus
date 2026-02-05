/**
 * McGraw Plus - Anti-Copy Bypass
 * Enables text selection and copying on restricted pages
 */

const MP_AntiCopy = {
  isActive: false,
  styleElement: null,
  mutationObserver: null,

  /**
   * Enable the anti-copy bypass
   */
  enable() {
    if (this.isActive) return;

    console.log('[McGraw Plus] Enabling copy bypass');

    // Inject CSS
    this.injectStyles();

    // Remove event handlers
    this.removeEventHandlers();

    // Setup mutation observer
    this.setupMutationObserver();

    this.isActive = true;

    // Notify user
    if (window.MP_Overlay) {
      window.MP_Overlay.showToast(
        'Copy Enabled',
        'Text selection and copying are now allowed',
        'success',
        2000
      );
    }
  },

  /**
   * Disable the anti-copy bypass
   */
  disable() {
    if (!this.isActive) return;

    console.log('[McGraw Plus] Disabling copy bypass');

    // Remove styles
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }

    // Disconnect observer
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

    this.styleElement = document.createElement('style');
    this.styleElement.id = 'mp-anti-copy-styles';
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

      /* Override pointer-events restrictions */
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
    const events = ['copy', 'cut', 'paste', 'selectstart', 'contextmenu', 'dragstart'];

    // Remove document-level handlers
    events.forEach((event) => {
      document[`on${event}`] = null;
    });

    // Remove inline handlers
    const selectors = events.map((e) => `[on${e}]`).join(', ');
    const elements = document.querySelectorAll(selectors);

    elements.forEach((el) => {
      events.forEach((event) => {
        el.removeAttribute(`on${event}`);
      });
    });

    // Override addEventListener
    this.overrideEventListener();
  },

  /**
   * Override addEventListener to prevent new copy-blocking handlers
   */
  overrideEventListener() {
    const blockedEvents = ['copy', 'cut', 'paste', 'selectstart', 'contextmenu'];

    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const handlerMap = new WeakMap();

    EventTarget.prototype.addEventListener = function (type, handler, options) {
      if (blockedEvents.includes(type)) {
        // Replace with no-op
        const wrappedHandler = function () { return; };

        if (!handlerMap.has(this)) {
          handlerMap.set(this, new Map());
        }
        handlerMap.get(this).set(handler, wrappedHandler);

        return originalAddEventListener.call(this, type, wrappedHandler, options);
      }

      return originalAddEventListener.call(this, type, handler, options);
    };
  },

  /**
   * Setup mutation observer for dynamic elements
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
   * Clean an element of copy-blocking attributes
   */
  cleanElement(element) {
    const events = ['oncopy', 'oncut', 'onpaste', 'onselectstart', 'oncontextmenu', 'ondragstart'];

    events.forEach((event) => {
      if (element.hasAttribute(event)) {
        element.removeAttribute(event);
      }
    });

    // Also check children
    const children = element.querySelectorAll(
      '[oncopy], [oncut], [onpaste], [onselectstart], [oncontextmenu], [ondragstart]'
    );
    children.forEach((child) => {
      events.forEach((event) => {
        child.removeAttribute(event);
      });
    });
  },
};

// Auto-initialize based on settings
chrome.storage.local.get('mp_settings', (result) => {
  const settings = result.mp_settings || {};
  if (settings.antiCopy) {
    MP_AntiCopy.enable();
  }
});

// Listen for setting changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.mp_settings) {
    const newSettings = changes.mp_settings.newValue || {};
    if (newSettings.antiCopy) {
      MP_AntiCopy.enable();
    } else {
      MP_AntiCopy.disable();
    }
  }
});

// Export
if (typeof window !== 'undefined') {
  window.MP_AntiCopy = MP_AntiCopy;
}
