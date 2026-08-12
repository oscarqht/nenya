const STORAGE_KEY = 'new_tab_destination';
const DEFAULT_DESTINATION = 'https://app.raindrop.io/my/0/%E2%9D%A4%EF%B8%8F';

/**
 * Return a normalized absolute HTTP(S) URL, or null when the input is unsafe.
 *
 * @param {string} value
 * @returns {string | null}
 */
function normalizeDestination(value) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.href;
  } catch (error) {
    return null;
  }
}

/**
 * Load the saved destination, falling back to Nenya's current default.
 *
 * @returns {Promise<string>}
 */
async function loadDestination() {
  try {
    const stored = await chrome.storage.sync.get(STORAGE_KEY);
    return normalizeDestination(stored?.[STORAGE_KEY] || '') || DEFAULT_DESTINATION;
  } catch (error) {
    console.warn('[options:newTabDestination] Failed to load destination:', error);
    return DEFAULT_DESTINATION;
  }
}

/**
 * Set a status message and its semantic state.
 *
 * @param {HTMLElement} statusElement
 * @param {string} message
 * @param {'success' | 'error' | 'idle'} state
 * @returns {void}
 */
function setStatus(statusElement, message, state) {
  statusElement.textContent = message;
  statusElement.classList.remove('text-success', 'text-error', 'text-base-content/60');
  statusElement.classList.add(
    state === 'success'
      ? 'text-success'
      : state === 'error'
        ? 'text-error'
        : 'text-base-content/60',
  );
}

/**
 * Initialize the New Tab destination setting.
 *
 * @returns {Promise<void>}
 */
async function init() {
  const form = document.getElementById('newTabDestinationForm');
  const input = document.getElementById('newTabDestinationInput');
  const status = document.getElementById('newTabDestinationStatus');

  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !(status instanceof HTMLElement)) {
    return;
  }

  input.value = await loadDestination();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const destination = normalizeDestination(input.value);
    if (!destination) {
      setStatus(status, 'Enter a valid HTTP or HTTPS URL.', 'error');
      input.focus();
      return;
    }

    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: destination });
      input.value = destination;
      setStatus(status, 'New Tab destination saved.', 'success');
    } catch (error) {
      console.error('[options:newTabDestination] Failed to save destination:', error);
      setStatus(status, 'Unable to save the New Tab destination.', 'error');
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[STORAGE_KEY]) {
      return;
    }

    const destination = normalizeDestination(changes[STORAGE_KEY].newValue || '');
    if (destination) {
      input.value = destination;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  });
} else {
  void init();
}
