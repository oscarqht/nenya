const STORAGE_KEY = 'new_tab_destination';
const DEFAULT_DESTINATION = 'https://app.raindrop.io/my/0/%E2%9D%A4%EF%B8%8F';

/**
 * Return a normalized absolute HTTP(S) URL, or null when the input is unsafe.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeDestination(value) {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.href;
  } catch (error) {
    return null;
  }
}

/**
 * Load the configured destination and navigate the current New Tab page.
 *
 * @returns {Promise<void>}
 */
async function redirectToDestination() {
  let destination = DEFAULT_DESTINATION;

  try {
    const stored = await chrome.storage.sync.get(STORAGE_KEY);
    destination = normalizeDestination(stored?.[STORAGE_KEY]) || DEFAULT_DESTINATION;
  } catch (error) {
    console.warn('[newtab] Failed to load destination:', error);
  }

  window.location.replace(destination);
}

void redirectToDestination();
