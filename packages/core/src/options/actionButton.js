const STORAGE_KEY = 'action_button_behavior';
const DEFAULT_BEHAVIOR = 'popup';

/**
 * Save action button behavior to storage
 * @param {string} behavior
 * @returns {Promise<void>}
 */
async function saveBehavior(behavior) {
  if (!chrome?.storage?.local) {
    return;
  }
  try {
    await chrome.storage.local.set({
      [STORAGE_KEY]: behavior,
    });
  } catch (error) {
    console.error('[options:actionButton] Failed to save behavior:', error);
    throw error;
  }
}

/**
 * Load action button behavior from storage
 * @returns {Promise<string>}
 */
async function loadBehavior() {
  if (!chrome?.storage?.local) {
    return DEFAULT_BEHAVIOR;
  }

  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const storedValue = stored?.[STORAGE_KEY];

    if (storedValue === 'popup' || storedValue === 'sidepanel') {
      return storedValue;
    }

    return DEFAULT_BEHAVIOR;
  } catch (error) {
    console.warn('[options:actionButton] Failed to load behavior:', error);
    return DEFAULT_BEHAVIOR;
  }
}

// Initialize when DOM is ready
async function init() {
  const select = document.getElementById('action-behavior-select');
  if (!select) return;

  const currentBehavior = await loadBehavior();
  select.value = currentBehavior;

  select.addEventListener('change', async (e) => {
    const newBehavior = e.target.value;
    await saveBehavior(newBehavior);
  });

  // Listen for storage changes from other tabs/windows
  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes[STORAGE_KEY]) {
        const newValue = changes[STORAGE_KEY].newValue;
        if (newValue === 'popup' || newValue === 'sidepanel') {
          select.value = newValue;
        }
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  });
} else {
  void init();
}
