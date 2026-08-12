/* global chrome */

import {
  sendRuntimeMessage,
  setStatus,
  concludeStatus,
  queryTabs,
  normalizeUrlForSave,
  collectSavableTabs,
} from './shared.js';
import { TOKEN_VALIDATION_MESSAGE } from '../shared/tokenRefresh.js';

/**
 * @typedef {Object} TokenValidationResult
 * @property {boolean} isValid
 * @property {boolean} needsReauth
 * @property {string} [error]
 */

/**
 * Check if tokens exist in storage (quick local check).
 * @returns {Promise<boolean>}
 */
async function hasStoredTokens() {
  try {
    const result = await chrome.storage.sync.get('cloudAuthTokens');
    const tokens = result.cloudAuthTokens;
    if (!tokens || typeof tokens !== 'object') {
      return false;
    }

    for (const providerId in tokens) {
      const providerTokens = tokens[providerId];
      if (
        providerTokens &&
        typeof providerTokens === 'object' &&
        providerTokens.accessToken
      ) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Check if user is logged in to any cloud bookmark provider.
 * This asks the background to validate tokens (and attempt refresh if expired).
 * @returns {Promise<boolean>}
 */
export async function isUserLoggedIn() {
  try {
    // First, quick local check - if no tokens exist, user is not logged in
    const hasTokens = await hasStoredTokens();
    if (!hasTokens) {
      return false;
    }

    // Ask background to validate tokens (this will attempt refresh if expired)
    const response = await sendRuntimeMessage({
      type: TOKEN_VALIDATION_MESSAGE,
    });

    if (response && response.isValid) {
      return true;
    }

    // If needsReauth is true, tokens exist but are expired and couldn't be refreshed
    // We still return true so the popup shows the UI, but operations will fail
    // and guide user to reconnect
    if (response && response.needsReauth) {
      // Return true so user sees the UI but with appropriate error messages
      return true;
    }

    return false;
  } catch (error) {
    console.error('[popup] Error checking login status:', error);
    // Fall back to local check if background communication fails
    return hasStoredTokens();
  }
}

/**
 * Get detailed token validation status.
 * @returns {Promise<TokenValidationResult>}
 */
export async function getTokenValidationStatus() {
  try {
    const hasTokens = await hasStoredTokens();
    if (!hasTokens) {
      return {
        isValid: false,
        needsReauth: true,
        error: 'No tokens stored. Please connect to Raindrop.',
      };
    }

    const response = await sendRuntimeMessage({
      type: TOKEN_VALIDATION_MESSAGE,
    });

    return {
      isValid: response?.isValid ?? false,
      needsReauth: response?.needsReauth ?? true,
      error: response?.error,
    };
  } catch (error) {
    return {
      isValid: false,
      needsReauth: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Show or hide the Mirror Cloud Bookmarks section based on login status.
 * @param {boolean} isLoggedIn
 * @param {HTMLElement} mirrorSection
 * @returns {void}
 */
export function toggleMirrorSection(isLoggedIn, mirrorSection) {
  if (!mirrorSection) {
    return;
  }

  if (isLoggedIn) {
    mirrorSection.style.display = 'block';
  } else {
    mirrorSection.style.display = 'none';
  }
}

/**
 * Show a message directing users to login via options page.
 * @param {HTMLElement} statusMessage
 * @param {HTMLElement} openOptionsButton
 * @param {string} [errorMessage] - Optional custom error message for reauth scenarios
 * @returns {void}
 */
export function showLoginMessage(
  statusMessage,
  openOptionsButton,
  errorMessage,
) {
  if (!statusMessage) {
    return;
  }

  const isReauth = Boolean(errorMessage);
  const displayMessage =
    errorMessage ||
    'Connect to a cloud bookmark provider to sync your bookmarks, saved projects, and options.';
  const buttonText = isReauth
    ? 'Reconnect in Options'
    : 'Go to Options to Connect';

  const loginMessage = document.createElement('div');
  loginMessage.className = 'card w-full bg-base-100 shadow-xl';
  loginMessage.innerHTML = `
    <div class="card-body gap-4">
      <div class="text-center space-y-2">
        <p class="text-sm ${
          isReauth ? 'text-warning' : 'text-base-content/70'
        }">${displayMessage}</p>
        <button id="goToOptionsButton" class="btn ${
          isReauth ? 'btn-warning' : 'btn-primary'
        } w-full" type="button">
          ${buttonText}
        </button>
      </div>
    </div>
  `;

  // Replace the main content with login message
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = '';
    main.appendChild(loginMessage);

    // Add event listener for the options button
    const goToOptionsButton = document.getElementById('goToOptionsButton');
    if (goToOptionsButton && openOptionsButton) {
      goToOptionsButton.addEventListener('click', () => {
        openOptionsButton.click();
      });
    }
  }
}


/**
 * @typedef {Object} SaveUnsortedEntry
 * @property {string} url
 * @property {string} [title]
 * @property {string} [excerpt]
 * @property {boolean} [includeScreenshot]
 * @property {number} [tabId]
 * @property {number} [windowId]
 */

const UNSORTED_SCREENSHOT_DISABLED_HOSTNAMES_STORAGE_KEY =
  'unsortedScreenshotDisabledHostnames';

/**
 * Extract a normalized hostname for save-to-unsorted screenshot preferences.
 * @param {string | undefined} url
 * @returns {string}
 */
function getSaveToUnsortedHostname(url) {
  if (!url) {
    return '';
  }

  const normalizedUrl = normalizeUrlForSave(url) || url;

  try {
    return new URL(normalizedUrl).hostname.toLowerCase();
  } catch (error) {
    return '';
  }
}

/**
 * Load hostnames whose Save to Unsorted dialog should default to no screenshot.
 * @returns {Promise<Set<string>>}
 */
async function loadDisabledScreenshotHostnames() {
  try {
    const result = await chrome.storage.local.get(
      UNSORTED_SCREENSHOT_DISABLED_HOSTNAMES_STORAGE_KEY,
    );
    const stored =
      result[UNSORTED_SCREENSHOT_DISABLED_HOSTNAMES_STORAGE_KEY];

    if (!Array.isArray(stored)) {
      return new Set();
    }

    return new Set(
      stored
        .filter((value) => typeof value === 'string' && value.length > 0)
        .map((value) => value.toLowerCase()),
    );
  } catch (error) {
    console.error(
      '[popup] Failed to load Save to Unsorted screenshot preferences:',
      error,
    );
    return new Set();
  }
}

/**
 * Persist the Save to Unsorted screenshot preference for a hostname.
 * @param {string} hostname
 * @param {boolean} includeScreenshot
 * @returns {Promise<void>}
 */
async function saveScreenshotPreferenceForHostname(
  hostname,
  includeScreenshot,
) {
  if (!hostname) {
    return;
  }

  try {
    const disabledHostnames = await loadDisabledScreenshotHostnames();

    if (includeScreenshot) {
      disabledHostnames.delete(hostname);
    } else {
      disabledHostnames.add(hostname);
    }

    await chrome.storage.local.set({
      [UNSORTED_SCREENSHOT_DISABLED_HOSTNAMES_STORAGE_KEY]: Array.from(
        disabledHostnames,
      ).sort(),
    });
  } catch (error) {
    console.error(
      '[popup] Failed to save Save to Unsorted screenshot preference:',
      error,
    );
  }
}

/**
 * Close a browser tab by id when possible.
 * @param {number | undefined} tabId
 * @returns {Promise<void>}
 */
async function closeTabById(tabId) {
  if (typeof tabId !== 'number') {
    return;
  }

  try {
    await chrome.tabs.remove(tabId);
  } catch (error) {
    console.warn('[popup] Failed to close tab after save:', error);
  }
}

/**
 * Show the save to Unsorted dialog.
 * @param {any} tab
 * @returns {Promise<void>}
 */
export async function showSaveToUnsortedDialog(tab) {
  const modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('saveToUnsortedModal'));
  const titleInput = /** @type {HTMLInputElement | null} */ (document.getElementById('saveToUnsortedTitleInput'));
  const descriptionInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('saveToUnsortedDescriptionInput'));
  const screenshotCheckbox = /** @type {HTMLInputElement | null} */ (document.getElementById(
    'saveToUnsortedScreenshotCheckbox',
  ));
  const closeTabCheckbox = /** @type {HTMLInputElement | null} */ (document.getElementById(
    'saveToUnsortedCloseTabCheckbox',
  ));
  const cancelButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('saveToUnsortedCancelButton'));
  const confirmButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('saveToUnsortedConfirmButton'));
  const popupBody = document.body;

  if (
    !modal ||
    !titleInput ||
    !descriptionInput ||
    !screenshotCheckbox ||
    !closeTabCheckbox ||
    !cancelButton ||
    !confirmButton
  ) {
    console.error('Save to unsorted dialog elements not found');
    return;
  }

  titleInput.value = tab.title || '';
  descriptionInput.value = '';

  const hostname = getSaveToUnsortedHostname(tab?.url);
  const disabledHostnames = await loadDisabledScreenshotHostnames();
  screenshotCheckbox.checked = !disabledHostnames.has(hostname);

  // Store original button content for restoration
  const originalConfirmButtonContent = confirmButton.innerHTML;

  const handleConfirm = async () => {
    if (confirmButton.disabled) return;
    const title = titleInput.value;
    const description = descriptionInput.value;
    const includeScreenshot = screenshotCheckbox.checked;

    // Show loading state
    const originalButtonContent = confirmButton.innerHTML;
    confirmButton.innerHTML = '<span class="loading loading-spinner loading-xs"></span> Saving...';
    confirmButton.disabled = true;
    cancelButton.disabled = true;

    await saveScreenshotPreferenceForHostname(hostname, includeScreenshot);

    const entries = [
      {
        url: tab.url,
        title: title,
        excerpt: description,
        includeScreenshot: includeScreenshot,
        tabId: tab.id,
        windowId: tab.windowId,
      },
    ];

    try {
      const response = await sendRuntimeMessage({
        type: 'mirror:saveToUnsorted',
        entries,
      });
      handleSaveResponse(response, /** @type {HTMLElement} */ (document.getElementById('statusMessage')));
      if (response?.ok && closeTabCheckbox.checked) {
        await closeTabById(tab.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      concludeStatus(message, 'error', 3000, /** @type {HTMLElement} */ (document.getElementById('statusMessage')));
    } finally {
      // Restore button state
      confirmButton.innerHTML = originalButtonContent;
      confirmButton.disabled = false;
      cancelButton.disabled = false;
    }
    modal.close();
  };

  const handleCancel = () => {
    modal.close();
  };

  const handleWindowKeyDown = (/** @type {KeyboardEvent} */ e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      modal.close();
    } else if (e.key === 'Enter') {
      // If a button is focused, let the browser handle the Enter key to click it
      if (document.activeElement instanceof HTMLButtonElement) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      void handleConfirm();
    }
  };

  const handleCancelEvent = (/** @type {Event} */ e) => {
    e.preventDefault(); // Prevent default dialog close to handle it via our window listener
    e.stopPropagation();
  };

  confirmButton.addEventListener('click', handleConfirm, { once: true });
  cancelButton.addEventListener('click', handleCancel, { once: true });
  window.addEventListener('keydown', handleWindowKeyDown, true);
  modal.addEventListener('cancel', handleCancelEvent);

  modal.addEventListener(
    'close',
    () => {
      popupBody.classList.remove('save-to-unsorted-dialog-open');
      confirmButton.removeEventListener('click', handleConfirm);
      cancelButton.removeEventListener('click', handleCancel);
      window.removeEventListener('keydown', handleWindowKeyDown, true);
      modal.removeEventListener('cancel', handleCancelEvent);
      // Restore button state in case modal was closed while loading
      if (confirmButton.classList.contains('loading')) {
        confirmButton.innerHTML = originalConfirmButtonContent;
        confirmButton.disabled = false;
        cancelButton.disabled = false;
      }
    },
    { once: true },
  );

  popupBody.classList.add('save-to-unsorted-dialog-open');
  modal.showModal();
  // Focus input after modal is shown with a small delay to override browser default focus
  setTimeout(() => {
    titleInput.focus();
    titleInput.select(); // Select all text for easy editing
  }, 50);
}

/**
 * Handle the save to Unsorted action from the popup.
 * @param {HTMLElement} saveUnsortedButton
 * @param {HTMLElement} statusMessage
 * @returns {Promise<void>}
 */
export async function handleSaveToUnsorted(saveUnsortedButton, statusMessage) {
  try {
    const tabs = await collectSavableTabs();
    if (tabs.length === 0) {
      concludeStatus(
        'No highlighted or active tabs available to save.',
        'info',
        3000,
        statusMessage,
      );
      return;
    }

    // If there's only one tab, show the dialog
    if (tabs.length === 1 && tabs[0]) {
      showSaveToUnsortedDialog(tabs[0]);
    } else {
      // If there are multiple tabs, save them directly without a dialog
      if (saveUnsortedButton) {
        /** @type {HTMLButtonElement} */ (saveUnsortedButton).disabled = true;
      }
      setStatus('Saving tabs to Unsorted...', 'info', statusMessage);
      try {
        const entries = buildSaveEntriesFromTabs(tabs);
        if (entries.length === 0) {
          concludeStatus(
            'No valid tab URLs to save.',
            'info',
            3.0,
            statusMessage,
          );
          return;
        }
        const response = await sendRuntimeMessage({
          type: 'mirror:saveToUnsorted',
          entries,
        });
        handleSaveResponse(response, statusMessage);
      } finally {
        if (saveUnsortedButton) {
          /** @type {HTMLButtonElement} */ (saveUnsortedButton).disabled = false;
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    concludeStatus(message, 'error', 3000, statusMessage);
  }
}

/**
 * Handle encrypt-and-save for the active tab.
 * @param {HTMLElement} encryptButton
 * @param {HTMLElement} statusMessage
 * @returns {Promise<void>}
 */
export async function handleEncryptAndSaveActive(encryptButton, statusMessage) {
  if (!encryptButton) {
    return;
  }

  /** @type {HTMLButtonElement} */ (encryptButton).disabled = true;
  setStatus('Preparing encrypted save...', 'info', statusMessage);

  try {
    const tabs = await queryTabs({
      currentWindow: true,
      active: true,
    });
    
    const activeTab = tabs && tabs[0];
    const rawUrl = typeof activeTab?.url === 'string' ? activeTab.url : '';
    if (!rawUrl) {
      concludeStatus(
        'No active tab available to save.',
        'info',
        3000,
        statusMessage,
      );
      return;
    }

    const normalizedUrl = normalizeUrlForSave(rawUrl);
    if (!normalizedUrl) {
      concludeStatus(
        'Active tab URL is not supported for saving.',
        'error',
        3000,
        statusMessage,
      );
      return;
    }

    const title = typeof activeTab?.title === 'string' ? activeTab.title : '';
    const tabId = typeof activeTab?.id === 'number' ? activeTab.id : undefined;

    const response = await sendRuntimeMessage({
      type: 'mirror:encryptAndSave',
      url: normalizedUrl,
      title,
      tabId,
    });

    if (!response || typeof response !== 'object') {
      concludeStatus(
        'Encrypt and save failed. Please try again.',
        'error',
        3000,
        statusMessage,
      );
      return;
    }

    if (!response.ok) {
      concludeStatus(
        response.error || 'Encrypt and save failed. Please try again.',
        'error',
        3000,
        statusMessage,
      );
      return;
    }

    if (response.saveResult && typeof response.saveResult === 'object') {
      const summary = summarizeSaveResult(response.saveResult);
      const modePrefix =
        response.mode === 'encrypted'
          ? 'Encrypted link saved.'
          : 'Saved without encryption.';
      const message = (modePrefix + ' ' + summary).trim();
      concludeStatus(
        message,
        response.saveResult.ok ? 'success' : 'error',
        3000,
        statusMessage,
      );
      return;
    }

    const fallbackMessage =
      response.mode === 'encrypted'
        ? 'Encrypted link saved to Unsorted.'
        : 'Saved to Unsorted.';
    concludeStatus(fallbackMessage, 'success', 3000, statusMessage);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    concludeStatus(message, 'error', 3000, statusMessage);
  } finally {
    /** @type {HTMLButtonElement} */ (encryptButton).disabled = false;
  }
}

/**
 * Build save entries from tab descriptors.
 * @param {chrome.tabs.Tab[]} tabs
 * @returns {SaveUnsortedEntry[]}
 */
function buildSaveEntriesFromTabs(tabs) {
  /** @type {SaveUnsortedEntry[]} */
  const entries = [];
  const seen = new Set();

  tabs.forEach((tab) => {
    if (!tab.url) {
      return;
    }
    const normalizedUrl = normalizeUrlForSave(tab.url);
    if (!normalizedUrl || seen.has(normalizedUrl)) {
      return;
    }
    seen.add(normalizedUrl);
    entries.push({
      url: normalizedUrl,
      title: typeof tab.title === 'string' ? tab.title : '',
    });
  });

  return entries;
}

/**
 * Update popup status based on a save response.
 * @param {any} response
 * @returns {string}
 */
function summarizeSaveResult(response) {
  const created = Number(response.created) || 0;
  const updated = Number(response.updated) || 0;
  const skipped = Number(response.skipped) || 0;
  const failed = Number(response.failed) || 0;
  const savedCount = created + updated;
  const fragments = [];

  fragments.push(savedCount + ' tab(s) saved');
  if (skipped > 0) {
    fragments.push(skipped + ' skipped');
  }
  if (failed > 0) {
    fragments.push(failed + ' failed');
  }

  return fragments.join('. ') + '.';
}

/**
 * @param {any} response
 * @param {HTMLElement} statusMessage
 * @returns {void}
 */
function handleSaveResponse(response, statusMessage) {
  if (!response || typeof response !== 'object') {
    concludeStatus(
      'Save failed. Please try again.',
      'error',
      3000,
      statusMessage,
    );
    return;
  }

  const message = summarizeSaveResult(response);

  if (response.ok) {
    concludeStatus(message, 'success', 3000, statusMessage);
    return;
  }

  const errorText =
    typeof response.error === 'string' ? response.error : message;
  concludeStatus(errorText, 'error', 3000, statusMessage);
}
