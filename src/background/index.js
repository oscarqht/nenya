import {
  saveUrlsToUnsorted,
  normalizeHttpUrl,
  pushNotification,
  handleTokenValidationMessage,
  handleRaindropSearch,
  handleOpenAllItemsInCollection,
  handleUpdateRaindropUrl,
  ensureNenyaSessionsCollection,
  handleFetchSessions,
  handleFetchSessionDetails,
  handleRestoreSession,
  ensureDeviceCollectionAndExport,
  handleSessionExportAlarm,
  handleUpdateSessionName,
  handleDeleteSession,
  handleUploadCollectionCover,
  handleSetCurrentSessionIconPreference,
} from './mirror.js';

import {
  initializeOptionsBackupService,
  handleOptionsBackupMessage,
  runAutomaticRestore,
  runStartupSync,
} from './options-backup.js';
import {
  initializeAutoReloadFeature,
  handleAutoReloadAlarm,
  getActiveAutoReloadStatus,
  evaluateAllTabs,
} from './auto-reload.js';

import {
  setupClipboardContextMenus,
  handleClipboardContextMenuClick,
  handleClipboardCommand,
  handleMultiTabCopy,
  handleScreenshotCopy,
  setCopySuccessBadge,
  setCopyFailureBadge,
} from './clipboard.js';
import {
  setupContextMenus as setupCentralizedContextMenus,
  updateRunCodeSubmenu,
  updateScreenshotMenuVisibility,
  COPY_MENU_IDS,
  RAINDROP_MENU_IDS,
  NENYA_MENU_IDS,
  PARENT_MENU_IDS,
  isCopyMenuItem,
  isRaindropMenuItem,
  parseRunCodeMenuItem,
  getCopyFormatType,
} from '../shared/contextMenus.js';
import { initializeTabSnapshots } from './tab-snapshots.js';
import {
  handleScreenRecordingToggle,
  handleActionClickDuringRecording,
  isRecording,
  handleScreenRecorderMessage,
} from './screen-recorder.js';

const SAVE_UNSORTED_MESSAGE = 'mirror:saveToUnsorted';
const ENCRYPT_AND_SAVE_MESSAGE = 'mirror:encryptAndSave';
const CLIPBOARD_SAVE_TO_UNSORTED_MESSAGE = 'clipboard:saveToUnsorted';
const TAKE_SCREENSHOT_MESSAGE = 'clipboard:takeScreenshot';
const RENAMED_TAB_TITLES_STORAGE_KEY = 'renamedTabTitles';
const SHOW_SAVE_TO_UNSORTED_DIALOG_MESSAGE =
  'showSaveToUnsortedDialog';
const GET_CURRENT_TAB_ID_MESSAGE = 'getCurrentTabId';
const RAINDROP_SEARCH_MESSAGE = 'mirror:search';
const FETCH_SESSIONS_MESSAGE = 'mirror:fetchSessions';
const FETCH_SESSION_DETAILS_MESSAGE = 'mirror:fetchSessionDetails';
const RESTORE_SESSION_MESSAGE = 'mirror:restoreSession';
const RESTORE_WINDOW_MESSAGE = 'mirror:restoreWindow';
const RESTORE_GROUP_MESSAGE = 'mirror:restoreGroup';
const RESTORE_TAB_MESSAGE = 'mirror:restoreTab';
const OPEN_ALL_ITEMS_MESSAGE = 'mirror:openAllItems';
const SAVE_SESSION_MESSAGE = 'mirror:saveSession';
const UPDATE_SESSION_NAME_MESSAGE = 'mirror:updateSessionName';
const DELETE_SESSION_MESSAGE = 'mirror:deleteSession';
const SET_CURRENT_SESSION_ICON_PREFERENCE_MESSAGE =
  'mirror:setCurrentSessionIconPreference';
const UPDATE_RAINDROP_URL_MESSAGE = 'mirror:updateRaindropUrl';
const GET_AUTO_RELOAD_STATUS_MESSAGE = 'autoReload:getStatus';
const AUTO_RELOAD_RE_EVALUATE_MESSAGE = 'autoReload:reEvaluate';
const RUN_CODE_IN_PAGE_EXECUTE_MESSAGE = 'runCodeInPage:execute';
const COLLECT_PAGE_CONTENT_MESSAGE = 'collect-page-content-as-markdown';
const ENCRYPT_SERVICE_URL = 'https://oh-auth.vercel.app/secret/encrypt';
const ENCRYPT_COVER_URL = 'https://picsum.photos/640/360';
const SESSION_EXPORT_ALARM_NAME = 'nenya-session-export';

/**
 * @typedef {'page-content' | 'html-source'} TabContentMode
 */

/**
 * Build a user-authored JavaScript payload that catches runtime errors while
 * preserving support for await in snippets.
 * @param {string} code
 * @param {string} consoleLabel
 * @param {string} sourceName
 * @returns {string}
 */
function buildUserScriptCode(code, consoleLabel, sourceName) {
  return [
    '(async function() {',
    '  try {',
    code,
    '  } catch (error) {',
    `    console.error(${JSON.stringify(consoleLabel)}, error);`,
    '  }',
    '})();',
    `//# sourceURL=${sourceName}`,
  ].join('\n');
}

/**
 * Keep sourceURL names readable without allowing storage values to break the
 * generated comment.
 * @param {string} value
 * @returns {string}
 */
function sanitizeSourceName(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}

/**
 * Execute manually triggered user-authored JavaScript in a CSP-exempt user
 * script world.
 * @param {number} tabId
 * @param {string} code
 * @param {string} consoleLabel
 * @param {string} sourceName
 * @returns {Promise<void>}
 */
async function executeManualUserCode(tabId, code, consoleLabel, sourceName) {
  const userScripts = chrome.userScripts;
  const setupMessage =
    'Nenya Run Code requires Chrome user scripts to be enabled. ' +
    `Open chrome://extensions/?id=${chrome.runtime.id}, enable ` +
    '"Allow User Scripts" on Chrome 138+, or enable Developer Mode on older Chrome. ' +
    'Immediate Run Code also requires Chrome 135 or newer.';

  if (!userScripts || typeof userScripts.execute !== 'function') {
    throw new Error(setupMessage);
  }

  try {
    await userScripts.execute({
      target: { tabId },
      world: 'USER_SCRIPT',
      injectImmediately: true,
      js: [
        {
          code: buildUserScriptCode(code, consoleLabel, sourceName),
        },
      ],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${setupMessage} Original error: ${detail}`);
  }
}

/**
 * Execute automatically matched custom JavaScript rules in the legacy page
 * context. This preserves existing behavior: page CSP can block these rules,
 * but a stored rule cannot suddenly start running during load on CSP-heavy apps.
 * @param {number} tabId
 * @param {string} code
 * @param {string} consoleLabel
 * @returns {Promise<void>}
 */
async function executeAutomaticCustomCode(tabId, code, consoleLabel) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: (jsCode, label) => {
      try {
        (0, eval)(jsCode);
        return { success: true };
      } catch (error) {
        console.error(label, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    args: [code, consoleLabel],
  });
  const failedResult = results.find((result) => {
    return result.result && result.result.success === false;
  });
  if (failedResult?.result?.error) {
    throw new Error(failedResult.result.error);
  }
}

/**
 * Create a tab immediately to the right of the active tab in the last focused window.
 * If the active tab is in a group, the new tab is moved into that same group.
 * @param {{url?: string, pinned?: boolean, active?: boolean}} tabCreateProperties
 * @returns {Promise<chrome.tabs.Tab>}
 */
async function createTabNextToActive(tabCreateProperties) {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  const activeTab = tabs[0] || null;

  const createProperties = { ...tabCreateProperties };
  let activeGroupId = -1;

  if (activeTab && typeof activeTab.windowId === 'number') {
    createProperties.windowId = activeTab.windowId;
  }
  if (activeTab && typeof activeTab.index === 'number') {
    createProperties.index = activeTab.index + 1;
  }
  if (
    activeTab &&
    typeof activeTab.groupId === 'number' &&
    activeTab.groupId >= 0
  ) {
    activeGroupId = activeTab.groupId;
  }

  const newTab = await chrome.tabs.create(createProperties);
  if (activeGroupId >= 0 && typeof newTab?.id === 'number') {
    try {
      await chrome.tabs.group({
        groupId: activeGroupId,
        tabIds: newTab.id,
      });
    } catch (error) {
      console.warn('[tabs] Failed to place tab in active group:', error);
    }
  }

  return newTab;
}

// ============================================================================
// KEYBOARD SHORTCUTS (COMMANDS)
// Set up command listeners as early as possible to ensure they're ready
// when the service worker wakes up from a keyboard shortcut
// ============================================================================

/**
 * Handle keyboard shortcuts (commands).
 * This listener is set up early to ensure it's ready when the service worker
 * wakes up from a keyboard shortcut press.
 * @param {string} command
 * @returns {void}
 */
chrome.commands.onCommand.addListener((command) => {
  if (
    command === 'tabs-activate-left-tab' ||
    command === 'tabs-activate-right-tab'
  ) {
    void (async () => {
      try {
        const window = await chrome.windows.getCurrent({ populate: true });
        if (!window.tabs) {
          return;
        }
        const activeTabIndex = window.tabs.findIndex((tab) => tab.active);
        if (activeTabIndex === -1) {
          return;
        }

        let newIndex;
        if (command === 'tabs-activate-left-tab') {
          newIndex =
            (activeTabIndex - 1 + window.tabs.length) % window.tabs.length;
        } else {
          // 'tabs-activate-right-tab'
          newIndex = (activeTabIndex + 1) % window.tabs.length;
        }

        const newTab = window.tabs[newIndex];
        if (newTab && newTab.id) {
          await chrome.tabs.update(newTab.id, { active: true });
        }
      } catch (error) {
        console.warn('[commands] Tab activation failed:', error);
      }
    })();
    return;
  }

  if (command === 'bookmarks-save-to-unsorted-encrypted') {
    void (async () => {
      try {
        const tabs = await chrome.tabs.query({
          currentWindow: true,
          active: true,
        });
        const activeTab = tabs && tabs[0];
        const url = typeof activeTab?.url === 'string' ? activeTab.url : '';
        if (!url) {
          return;
        }
        const title =
          typeof activeTab?.title === 'string' ? activeTab.title : '';
        const tabId = typeof activeTab?.id === 'number' ? activeTab.id : null;
        const result = await handleEncryptAndSave({
          rawUrl: url,
          title,
          tabId,
          notifyOnError: true,
        });
        if (!result.ok && result.error) {
          console.warn('[commands] Encrypt & Save failed:', result.error);
        }
      } catch (error) {
        console.warn('[commands] Encrypt & Save failed:', error);
      }
    })();
    return;
  }

  if (command === 'bookmarks-save-to-unsorted') {
    void handleSaveToUnsortedRequest();
    return;
  }

  if (command === 'bookmarks-save-clipboard-to-unsorted') {
    void (async () => {
      try {
        const clipboardResult = await readClipboardFromTab();
        if (clipboardResult.error) {
          console.warn(
            '[commands] Failed to read clipboard:',
            clipboardResult.error,
          );
          return;
        }
        const result = await handleSaveClipboardUrlToUnsorted(
          clipboardResult.text || '',
        );
        if (!result.ok && result.error) {
          console.warn(
            '[commands] Save clipboard to Unsorted failed:',
            result.error,
          );
        }
      } catch (error) {
        console.warn('[commands] Save clipboard to Unsorted failed:', error);
      }
    })();
    return;
  }

  // Handle clipboard commands
  if (
    command === 'copy-title' ||
    command === 'copy-title-url' ||
    command === 'copy-title-dash-url' ||
    command === 'copy-markdown-link' ||
    command === 'copy-screenshot'
  ) {
    void handleClipboardCommand(command).catch((error) => {
      console.warn('[commands] Clipboard command failed:', error);
    });
    return;
  }

  if (command === 'download-markdown') {
    void (async () => {
      try {
        await handleMarkdownDownload();
      } catch (error) {
        console.warn('[commands] Download markdown failed:', error);
      }
    })();
    return;
  }

  if (command === 'emoji-picker-show') {
    void (async () => {
      try {
        // Set a flag in storage to indicate we should navigate to emoji page
        await chrome.storage.local.set({ openEmojiPage: true });

        // Open the extension popup (this will trigger the popup to open)
        // The popup will check the flag and navigate to emoji.html
        await chrome.action.openPopup();
      } catch (error) {
        console.warn('[commands] Emoji picker failed:', error);
      }
    })();
    return;
  }
  if (command === 'screen-recording-start') {
    void (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        await handleScreenRecordingToggle(tabId);
      } catch (error) {
        console.warn('[commands] Screen recording failed:', error);
      }
    })();
    return;
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Prompt the user for a title in the provided tab.
 * @param {number | null} tabId
 * @param {string} prefillTitle
 * @returns {Promise<string>}
 */
async function promptForTitle(tabId, prefillTitle) {
  if (!chrome.scripting || typeof tabId !== 'number') {
    return prefillTitle;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (originalTitle) => {
        const userTitle = window.prompt(
          'Enter an optional title to save to unsorted collection',
          originalTitle,
        );
        return userTitle;
      },
      args: [prefillTitle],
      // Use isolated world so pages cannot override prompt behavior.
      world: 'ISOLATED',
    });

    const value =
      Array.isArray(results) && results[0] ? results[0].result : null;

    if (value === null) {
      return prefillTitle;
    }

    return value.trim() || prefillTitle;
  } catch (error) {
    console.warn('[promptForTitle] Unable to prompt for title:', error);
    return prefillTitle;
  }
}

/**
 * Get storage area for tab rename persistence.
 * Prefer session storage so entries do not survive browser restarts.
 * @returns {chrome.storage.StorageArea | null}
 */
function getRenameStorageArea() {
  if (chrome?.storage?.session) {
    return chrome.storage.session;
  }
  if (chrome?.storage?.local) {
    return chrome.storage.local;
  }
  return null;
}

/**
 * Load persisted renamed tab titles keyed by tab ID.
 * @returns {Promise<Record<string, string>>}
 */
async function loadPersistedRenamedTabTitles() {
  const storageArea = getRenameStorageArea();
  if (!storageArea) {
    return {};
  }

  try {
    const result = await storageArea.get(RENAMED_TAB_TITLES_STORAGE_KEY);
    const value = result?.[RENAMED_TAB_TITLES_STORAGE_KEY];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    /** @type {Record<string, string>} */
    const map = {};
    Object.entries(value).forEach(([key, title]) => {
      if (typeof title === 'string' && title.trim()) {
        map[key] = title;
      }
    });
    return map;
  } catch (error) {
    console.warn('[rename-tab] Failed to load persisted titles:', error);
    return {};
  }
}

/**
 * Save persisted renamed tab titles map.
 * @param {Record<string, string>} titlesByTabId
 * @returns {Promise<void>}
 */
async function savePersistedRenamedTabTitles(titlesByTabId) {
  const storageArea = getRenameStorageArea();
  if (!storageArea) {
    return;
  }
  await storageArea.set({
    [RENAMED_TAB_TITLES_STORAGE_KEY]: titlesByTabId,
  });
}

/**
 * Persist a renamed title for a tab.
 * @param {number} tabId
 * @param {string} title
 * @returns {Promise<void>}
 */
async function persistRenamedTabTitle(tabId, title) {
  if (typeof tabId !== 'number') {
    return;
  }
  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  if (!trimmedTitle) {
    return;
  }

  const titlesByTabId = await loadPersistedRenamedTabTitles();
  titlesByTabId[String(tabId)] = trimmedTitle;
  await savePersistedRenamedTabTitles(titlesByTabId);
}

/**
 * Remove a persisted renamed title for a tab.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function removePersistedRenamedTabTitle(tabId) {
  if (typeof tabId !== 'number') {
    return;
  }

  const titlesByTabId = await loadPersistedRenamedTabTitles();
  const key = String(tabId);
  if (!(key in titlesByTabId)) {
    return;
  }
  delete titlesByTabId[key];
  await savePersistedRenamedTabTitles(titlesByTabId);
}

/**
 * Get persisted renamed title for a tab.
 * @param {number} tabId
 * @returns {Promise<string>}
 */
async function getPersistedRenamedTabTitle(tabId) {
  if (typeof tabId !== 'number') {
    return '';
  }
  const titlesByTabId = await loadPersistedRenamedTabTitles();
  const title = titlesByTabId[String(tabId)];
  return typeof title === 'string' ? title : '';
}

/**
 * Re-apply persisted renamed title to a tab.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function reapplyPersistedRenamedTabTitle(tabId) {
  if (!chrome.scripting || typeof tabId !== 'number') {
    return;
  }

  const title = await getPersistedRenamedTabTitle(tabId);
  if (!title) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (nextTitle) => {
        document.title = nextTitle;
      },
      args: [title],
      world: 'ISOLATED',
    });
  } catch (error) {
    // Restricted pages may not support script injection.
    console.warn('[rename-tab] Failed to reapply title:', error);
  }
}

/**
 * Re-apply persisted title multiple times to survive pages that overwrite late.
 * @param {number} tabId
 * @returns {void}
 */
function schedulePersistedRenamedTabTitleReapply(tabId) {
  void reapplyPersistedRenamedTabTitle(tabId);
  setTimeout(() => {
    void reapplyPersistedRenamedTabTitle(tabId);
  }, 300);
  setTimeout(() => {
    void reapplyPersistedRenamedTabTitle(tabId);
  }, 1200);
}

/**
 * Remove persisted rename entries for tabs that are no longer open.
 * @returns {Promise<void>}
 */
async function pruneClosedPersistedRenamedTabs() {
  const titlesByTabId = await loadPersistedRenamedTabTitles();
  const keys = Object.keys(titlesByTabId);
  if (keys.length === 0) {
    return;
  }

  try {
    const tabs = await chrome.tabs.query({});
    const openTabIds = new Set(
      tabs
        .filter((tab) => typeof tab.id === 'number')
        .map((tab) => String(tab.id)),
    );

    /** @type {Record<string, string>} */
    const next = {};
    let changed = false;
    Object.entries(titlesByTabId).forEach(([tabId, title]) => {
      if (openTabIds.has(tabId)) {
        next[tabId] = title;
      } else {
        changed = true;
      }
    });

    if (changed) {
      await savePersistedRenamedTabTitles(next);
    }
  } catch (error) {
    console.warn('[rename-tab] Failed to prune persisted titles:', error);
  }
}

/**
 * Prompt for a new tab title in-page and apply it.
 * @param {number} tabId
 * @returns {Promise<{ success: boolean, cancelled?: boolean, title?: string, error?: string }>}
 */
async function promptAndRenameTab(tabId) {
  if (!chrome.scripting || typeof tabId !== 'number') {
    return { success: false, error: 'Active tab unavailable for renaming.' };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const currentTitle =
          typeof document.title === 'string' ? document.title : '';
        const input = window.prompt('Enter a new tab title', currentTitle);
        if (input === null) {
          return { success: false, cancelled: true };
        }

        const nextTitle = String(input).trim();
        if (!nextTitle) {
          return { success: false, cancelled: true };
        }

        document.title = nextTitle;
        return { success: true, title: nextTitle };
      },
      // Use isolated world so pages cannot hijack prompt and return bogus values.
      world: 'ISOLATED',
    });

    const value =
      Array.isArray(results) && results[0] ? results[0].result : null;
    if (!value || typeof value !== 'object') {
      return { success: false, error: 'Failed to rename tab.' };
    }

    return /** @type {{ success: boolean, cancelled?: boolean, title?: string, error?: string }} */ (value);
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : 'Unable to rename tab on this page.';
    return { success: false, error: messageText };
  }
}

/**
 * Resolve a target tab and trigger the rename prompt.
 * @param {number | null} [tabId]
 * @returns {Promise<{ success: boolean, cancelled?: boolean, title?: string, error?: string }>}
 */
async function handleRenameTabRequest(tabId = null) {
  let targetTabId = typeof tabId === 'number' ? tabId : null;

  if (targetTabId === null) {
    const tabs = await chrome.tabs.query({
      currentWindow: true,
      active: true,
    });
    if (tabs && tabs[0] && typeof tabs[0].id === 'number') {
      targetTabId = tabs[0].id;
    }
  }

  if (targetTabId === null) {
    return { success: false, error: 'No active tab found.' };
  }

  const result = await promptAndRenameTab(targetTabId);
  if (result.success && typeof result.title === 'string') {
    try {
      await persistRenamedTabTitle(targetTabId, result.title);
    } catch (error) {
      console.warn('[rename-tab] Failed to persist title:', error);
    }
  }

  return result;
}

const FRIENDLY_TITLE_WORDS = [
  'hidden',
  'quiet',
  'ember',
  'lantern',
  'meadow',
  'harbor',
  'compass',
  'willow',
  'prairie',
  'atlas',
  'haven',
  'spark',
  'cove',
  'trail',
  'pine',
  'aurora',
  'echo',
  'breeze',
  'fox',
  'otter',
  'lynx',
  'sparrow',
  'tiger',
  'panda',
  'dolphin',
  'river',
  'garden',
  'bridge',
  'market',
  'sunrise',
  'maple',
  'london',
  'kyoto',
  'oslo',
  'berlin',
  'lagos',
  'atlanta',
];

function buildFriendlyEncryptedTitle() {
  const count = Math.random() < 0.5 ? 2 : 3;
  const words = [];
  for (let i = 0; i < count; i += 1) {
    const word =
      FRIENDLY_TITLE_WORDS[
      Math.floor(Math.random() * FRIENDLY_TITLE_WORDS.length)
      ];
    if (word) {
      words.push(word.charAt(0).toUpperCase() + word.slice(1));
    }
  }
  if (words.length === 0) {
    return 'Encrypted Link';
  }
  return words.join(' ');
}

/**
 * Prompt the user for an encryption password in the provided tab.
 * @param {number | null} tabId
 * @returns {Promise<{ password: string, error?: string }>}
 */
async function promptForEncryptionPassword(tabId) {
  if (!chrome.scripting || typeof tabId !== 'number') {
    return {
      password: '',
      error: 'Active tab unavailable for password entry.',
    };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const input = window.prompt(
          'Enter a password to encrypt this link (leave blank to save without encryption).',
        );
        return input === null ? null : String(input);
      },
      // Use isolated world so pages cannot override prompt behavior.
      world: 'ISOLATED',
    });
    const value =
      Array.isArray(results) && results[0] ? results[0].result : null;
    const password =
      typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
    return { password };
  } catch (error) {
    console.warn('[encrypt-save] Unable to prompt for password:', error);
    return {
      password: '',
      error: 'Password prompt is not available on this page.',
    };
  }
}

/**
 * Encrypt a URL using the external service.
 * @param {string} url
 * @param {string} password
 * @returns {Promise<string>}
 */
async function encryptUrlWithPassword(url, password) {
  const response = await fetch(ENCRYPT_SERVICE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, password }),
  });

  if (!response.ok) {
    throw new Error(
      'Encryption failed: ' +
      response.status +
      (response.statusText ? ' ' + response.statusText : ''),
    );
  }

  const data = await response.json();
  const encryptedUrl = typeof data?.url === 'string' ? data.url.trim() : '';
  if (!encryptedUrl) {
    throw new Error('Encryption service did not return a URL.');
  }
  return encryptedUrl;
}

/**
 * Choose a title for plain saves using selection text or a fallback.
 * @param {string} selectionText
 * @param {string} fallbackTitle
 * @returns {string}
 */
function derivePlainTitle(selectionText, fallbackTitle) {
  const selection =
    typeof selectionText === 'string' ? selectionText.trim() : '';
  if (selection) {
    return selection;
  }
  if (typeof fallbackTitle === 'string') {
    return fallbackTitle;
  }
  return '';
}

/**
 * Read clipboard text from active tab using scripting API.
 * @returns {Promise<{ text?: string, error?: string }>}
 */
async function readClipboardFromTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      return { error: 'No active tab found' };
    }

    // Inject script to read clipboard
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        try {
          const text = await navigator.clipboard.readText();
          return { text };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    });

    const result = results?.[0]?.result;
    if (!result) {
      return { error: 'Failed to read clipboard' };
    }

    return result;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process clipboard text and save to Raindrop Unsorted if it contains a valid URL.
 * @param {string} clipboardText - The text from clipboard
 * @returns {Promise<{ ok: boolean, created?: number, updated?: number, skipped?: number, error?: string }>}
 */
async function handleSaveClipboardUrlToUnsorted(clipboardText) {
  try {
    if (!clipboardText || !clipboardText.trim()) {
      const error = 'Clipboard is empty';
      void pushNotification('clipboard-save', 'Clipboard save failed', error);
      return { ok: false, error };
    }

    const text = clipboardText.trim();

    // Validate URL
    const normalizedUrl = normalizeHttpUrl(text);
    if (!normalizedUrl) {
      const error = 'Clipboard does not contain a valid URL';
      void pushNotification('clipboard-save', 'Clipboard save failed', error);
      return { ok: false, error };
    }

    // Derive title from URL
    const title = new URL(normalizedUrl).hostname || normalizedUrl;

    // Save to Unsorted using existing pipeline
    const saveResult = await saveUrlsToUnsorted(
      [{ url: normalizedUrl, title }],
      { pleaseParse: true },
    );

    return {
      ok: saveResult.ok,
      created: saveResult.created,
      updated: saveResult.updated,
      skipped: saveResult.skipped,
      error: saveResult.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void pushNotification('clipboard-save', 'Clipboard save failed', message);
    return { ok: false, error: message };
  }
}

/**
 * Handle encrypt-and-save flow shared by commands, context menus, and popup.
 * @param {{ rawUrl: string, title?: string, selectionText?: string, tabId?: number | null, notifyOnError?: boolean }} options
 * @returns {Promise<{ ok: boolean, mode?: 'plain' | 'encrypted', error?: string, saveResult?: any }>}
 */
async function handleEncryptAndSave(options) {
  const rawUrl = typeof options.rawUrl === 'string' ? options.rawUrl : '';
  const tabId = typeof options.tabId === 'number' ? options.tabId : null;
  const notifyOnError = Boolean(options.notifyOnError);

  if (!rawUrl) {
    const error = 'No URL available to save.';
    if (notifyOnError) {
      void pushNotification('encrypt-unsorted', 'Encrypt & save failed', error);
    }
    return { ok: false, error };
  }

  const normalizedUrl = normalizeHttpUrl(rawUrl);
  if (!normalizedUrl) {
    const error = 'This URL cannot be saved.';
    if (notifyOnError) {
      void pushNotification('encrypt-unsorted', 'Encrypt & save failed', error);
    }
    return { ok: false, error };
  }

  const finalUrl = normalizedUrl;
  if (!finalUrl) {
    const error = 'This URL cannot be saved.';
    if (notifyOnError) {
      void pushNotification('encrypt-unsorted', 'Encrypt & save failed', error);
    }
    return { ok: false, error };
  }

  const passwordResult = await promptForEncryptionPassword(tabId);
  if (passwordResult.error) {
    if (notifyOnError) {
      void pushNotification(
        'encrypt-unsorted',
        'Encrypt & save failed',
        passwordResult.error,
      );
    }
    return { ok: false, error: passwordResult.error };
  }

  const password = passwordResult.password;
  if (!password) {
    const plainTitle = derivePlainTitle(
      options.selectionText || '',
      options.title || '',
    );
    const saveResult = await saveUrlsToUnsorted(
      [{ url: finalUrl, title: plainTitle }],
      { skipUrlProcessing: true },
    );
    return {
      ok: saveResult.ok,
      mode: 'plain',
      saveResult,
      error: saveResult.error,
    };
  }

  let encryptedUrl;
  try {
    encryptedUrl = await encryptUrlWithPassword(finalUrl, password);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Encryption failed.';
    if (notifyOnError) {
      void pushNotification(
        'encrypt-unsorted',
        'Encrypt & save failed',
        message,
      );
    }
    return { ok: false, mode: 'encrypted', error: message };
  }

  const generatedTitle = buildFriendlyEncryptedTitle();
  let coverUrl = ENCRYPT_COVER_URL;
  try {
    if (coverUrl.includes('picsum.photos')) {
      const response = await fetch(coverUrl);
      if (response.ok && response.url) {
        coverUrl = response.url;
      }
    }
  } catch (error) {
    console.warn('[encrypt-save] Failed to resolve cover URL redirect:', error);
  }
  const saveResult = await saveUrlsToUnsorted(
    [{ url: encryptedUrl, title: generatedTitle, cover: coverUrl }],
    { pleaseParse: false, skipUrlProcessing: true, keepEntryTitle: true },
  );
  return {
    ok: saveResult.ok,
    mode: 'encrypted',
    saveResult,
    error: saveResult.error,
  };
}
/**
 * Handle one-time initialization tasks.
 * @param {string} trigger
 * @returns {void}
 */
function handleLifecycleEvent(trigger) {
  setupCentralizedContextMenus();
  setupClipboardContextMenus();
  initializeTabSnapshots();
  void ensureNenyaSessionsCollection();
  void initializeOptionsBackupService();
  void runStartupSync();
  chrome.alarms.create('options-backup-check', {
    periodInMinutes: 1,
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  handleLifecycleEvent('install');

  // Perform one-time migrations on install or update
  if (details.reason === 'install' || details.reason === 'update') {
    // Migration: pinnedItems -> pinnedSearchResults
    try {
      const oldKey = 'pinnedItems';
      const newKey = 'pinnedSearchResults';
      const storage = await chrome.storage.local.get([oldKey, newKey]);
      if (storage[oldKey] && !storage[newKey]) {
        await chrome.storage.local.set({ [newKey]: storage[oldKey] });
        await chrome.storage.local.remove(oldKey);
        console.log('[migration] Migrated pinnedItems to pinnedSearchResults.');
      }
    } catch (error) {
      console.error('[migration] Pinned items migration failed:', error);
    }

  }

  if (details.reason === 'install' || details.reason === 'update') {
    // Inject content scripts into existing tabs instead of reloading them
    // This preserves user state (scroll position, form data, etc.)
    // ⚡ Bolt: Use Promise.all to inject scripts into all tabs concurrently for faster startup.
    const windows = await chrome.windows.getAll({ populate: true });
    const allTabs = windows.flatMap((window) => window.tabs || []);

    const contentScripts = [
      [
        'src/contentScript/custom-js-css.js',
      ],
    ];

    const injectionPromises = allTabs
      .filter(
        (tab) =>
          tab.id &&
          tab.url &&
          (tab.url.startsWith('http:') || tab.url.startsWith('https:')) &&
          !tab.discarded,
      )
      .map((tab) => {
        const tabId = tab.id;
        return (async () => {
          try {
            for (const scriptGroup of contentScripts) {
              await chrome.scripting
                .executeScript({ target: { tabId }, files: scriptGroup })
                .catch((e) =>
                  console.warn(
                    `JS injection failed for group in tab ${tabId}:`,
                    e,
                  ),
                );
            }
          } catch (error) {
            console.warn(
              `Content script injection failed for tab ${tabId}:`,
              error,
            );
            try {
              await chrome.tabs.reload(tabId, { bypassCache: true });
            } catch (reloadError) {
              console.warn(`Tab reload failed for tab ${tabId}:`, reloadError);
            }
          }
        })();
      });

    await Promise.all(injectionPromises);
  }
});

chrome.runtime.onStartup.addListener(() => {
  handleLifecycleEvent('startup');
  void pruneClosedPersistedRenamedTabs();
});

// Ensure backup and synced session services are initialized immediately when service worker starts
initializeOptionsBackupService();
void ensureNenyaSessionsCollection();

void initializeAutoReloadFeature().catch((error) => {
  console.error('[auto-reload] Initialization failed:', error);
});

chrome.tabs.onHighlighted.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({
      currentWindow: true,
      highlighted: true,
    });
    const hasMultipleTabs = tabs && tabs.length > 1;
    await updateScreenshotMenuVisibility(hasMultipleTabs);
  } catch (error) {
    console.warn(
      '[contextMenu] Failed to update screenshot visibility:',
      error,
    );
  }
});

// Handle action button click during recording
// When recording, the popup is disabled, so this listener fires
chrome.action.onClicked.addListener(async (tab) => {
  // Check if we're recording
  if (isRecording()) {
    // Stop recording and open preview
    const handled = await handleActionClickDuringRecording();
    if (handled) {
      return;
    }
  }
  // If not recording, this shouldn't happen since popup is enabled
  // But just in case, open the popup manually
  try {
    await chrome.action.openPopup();
  } catch (error) {
    // openPopup might fail in some contexts, ignore
    console.warn('[background] Failed to open popup:', error);
  }
});

// Update context menu visibility when tabs change
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab) {
      void updateContextMenuVisibility(tab);
    }
  } catch (error) {
    console.warn('Failed to get tab for context menu update:', error);
  }
});

// Clean up when tabs close
chrome.tabs.onRemoved.addListener(async (tabId) => {
  void removePersistedRenamedTabTitle(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    schedulePersistedRenamedTabTitleReapply(tabId);
    if (tab) {
      void updateContextMenuVisibility(tab);
    }
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void (async () => {
    if (alarm.name === 'options-backup-check') {
      await runAutomaticRestore();
    } else if (alarm.name === SESSION_EXPORT_ALARM_NAME) {
      await handleSessionExportAlarm();
    } else {
      await handleAutoReloadAlarm(alarm);
    }
  })();
});

// ============================================================================
// PAGE CONTENT COLLECTION
// ============================================================================

/**
 * Check if URL is a YouTube video page.
 * @param {string} url
 * @returns {boolean}
 */
function isYouTubeVideoPage(url) {
  return /^https?:\/\/(?:www\.)?youtube\.com\/watch/.test(url);
}

/**
 * Check if URL is a Notion page.
 * @param {string} url
 * @returns {boolean}
 */
function isNotionPage(url) {
  return /^https?:\/\/(?:www\.)?notion\.so\//.test(url);
}

/**
 * Inject content scripts to extract page content as markdown.
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
async function injectContentScripts(tabId) {
  try {
    // Get the tab to check its URL
    const tab = await chrome.tabs.get(tabId);
    const tabUrl = tab.url || '';

    let contentScriptFile = 'src/contentScript/getContent-general.js';

    // Determine which content extraction script to use
    if (isYouTubeVideoPage(tabUrl)) {
      contentScriptFile = 'src/contentScript/getContent-youtube.js';
    } else if (isNotionPage(tabUrl)) {
      contentScriptFile = 'src/contentScript/getContent-notion.js';
    }

    // For YouTube and Notion, we don't need Readability and Turndown
    if (isYouTubeVideoPage(tabUrl) || isNotionPage(tabUrl)) {
      // Just inject the specific content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [contentScriptFile],
      });
    } else {
      // For general pages, inject libraries first
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          'src/libs/readability.min.js',
          'src/libs/turndown.7.2.0.js',
          'src/libs/turndown-plugin-gfm.1.0.2.js',
        ],
      });

      // Then inject content extraction script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [contentScriptFile],
      });
    }

    // Finally inject collector script (for all page types)
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/contentScript/pageContentCollector.js'],
    });

    return true;
  } catch (error) {
    console.error('[background] Failed to inject content scripts:', error);
    return false;
  }
}

/**
 * Collect page content from a single tab.
 * @param {number} tabId
 * @param {number} timeout
 * @returns {Promise<{tabId: number, title: string, url: string, content: string} | null>}
 */
async function collectPageContent(tabId, timeout = 10000) {
  return new Promise((resolve) => {
    if (typeof tabId !== 'number') {
      resolve(null);
      return;
    }

    // Set up message listener for content
    const onMessage = (message, sender) => {
      if (sender?.tab?.id !== tabId) return;
      if (!message || message.type !== 'page-content-collected') return;

      clearTimeout(timeoutId);
      chrome.runtime.onMessage.removeListener(onMessage);

      resolve({
        tabId,
        title: message.title || '',
        url: message.url || '',
        content: message.content || '',
      });
    };

    chrome.runtime.onMessage.addListener(onMessage);

    // Fallback timeout
    const timeoutId = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(onMessage);
      resolve(null);
    }, timeout);

    // Start extraction chain
    void injectContentScripts(tabId);
  });
}

/**
 * Collect page content from multiple tabs concurrently.
 * @param {number[]} tabIds
 * @returns {Promise<Array<{tabId: number, title: string, url: string, content: string}>>}
 */
async function collectPageContentFromTabs(tabIds) {
  // ⚡ Bolt: Use Promise.all to fetch content from all tabs concurrently for a significant speed boost.
  const promises = tabIds.map(async (tabId) => {
    if (typeof tabId !== 'number') {
      return null;
    }
    try {
      const content = await collectPageContent(tabId);
      return (
        content || {
          tabId,
          title: '',
          url: '',
          content: '(failed to collect content)',
        }
      );
    } catch (error) {
      console.error(
        `[background] Error collecting content from tab ${tabId}:`,
        error,
      );
      return {
        tabId,
        title: '',
        url: '',
        content: `(error: ${error.message})`,
      };
    }
  });

  const results = await Promise.all(promises);
  return results.filter(Boolean);
}

/**
 * Get highlighted tabs in the current window, falling back to the active tab.
 * @returns {Promise<chrome.tabs.Tab[]>}
 */
async function getHighlightedOrActiveHttpTabs() {
  /** @type {chrome.tabs.Tab[]} */
  let tabs = await chrome.tabs.query({
    currentWindow: true,
    highlighted: true,
  });
  if (!tabs || tabs.length === 0) {
    tabs = await chrome.tabs.query({ currentWindow: true, active: true });
  }

  return (tabs || []).filter((tab) => {
    const url = tab.url || '';
    return url.startsWith('http://') || url.startsWith('https://');
  });
}

/**
 * Trigger a Markdown download for the highlighted tabs or the active tab.
 * @returns {Promise<void>}
 */
async function handleMarkdownDownload() {
  const filteredTabs = await getHighlightedOrActiveHttpTabs();
  if (filteredTabs.length === 0) {
    console.warn('[markdown] No valid tabs available for download');
    return;
  }

  const tabIds = filteredTabs
    .map((tab) => tab.id)
    .filter((tabId) => typeof tabId === 'number');
  const contents = await collectPageContentFromTabs(tabIds);

  if (contents.length === 0) {
    console.warn('[markdown] No content collected from tabs');
    return;
  }

  let markdownContent = '';
  contents.forEach((content, index) => {
    markdownContent += `## Page ${index + 1}: ${content.title}\n\n`;
    markdownContent += `**URL:** ${content.url}\n\n`;
    markdownContent += content.content;
    markdownContent += '\n\n---\n\n';
  });

  const activeTabs = await chrome.tabs.query({
    currentWindow: true,
    active: true,
  });
  const activeTab = activeTabs && activeTabs[0];

  if (!activeTab || typeof activeTab.id !== 'number') {
    console.warn('[markdown] No active tab found for download');
    return;
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `page-content-${timestamp}.md`;

  await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: (markdown, fileName) => {
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    args: [markdownContent, filename],
  });
}

/**
 * Restore a saved session window tree into a new browser window.
 * @param {any[]} tree
 * @returns {Promise<void>}
 */
async function restoreWindowFromTree(tree) {
  const tabs = [];
  (Array.isArray(tree) ? tree : []).forEach((node) => {
    if (node?.type === 'tab') {
      tabs.push({ ...node, groupId: -1 });
    } else if (node?.type === 'group' && Array.isArray(node.tabs)) {
      node.tabs.forEach((tab) => {
        tabs.push({ ...tab, groupId: node.id, group: node });
      });
    }
  });
  tabs.sort((a, b) => (a.index || 0) - (b.index || 0));
  if (tabs.length === 0) {
    return;
  }

  const first = tabs[0];
  const newWindow = await chrome.windows.create({
    url: first.url,
    focused: true,
  });
  const windowId = newWindow?.id;
  const firstTabId = newWindow?.tabs?.[0]?.id;
  if (typeof windowId !== 'number' || typeof firstTabId !== 'number') {
    return;
  }

  if (first.pinned) {
    await chrome.tabs.update(firstTabId, { pinned: true });
  }

  const createdTabs = [{ id: firstTabId, oldGroupId: first.groupId, group: first.group }];
  for (let i = 1; i < tabs.length; i += 1) {
    const tabInfo = tabs[i];
    const newTab = await chrome.tabs.create({
      windowId,
      url: tabInfo.url,
      pinned: Boolean(tabInfo.pinned),
      active: false,
    });
    if (typeof newTab?.id === 'number') {
      createdTabs.push({ id: newTab.id, oldGroupId: tabInfo.groupId, group: tabInfo.group });
    }
  }

  const groups = new Map();
  createdTabs.forEach((tab) => {
    if (tab.oldGroupId >= 0 && tab.group) {
      groups.set(tab.oldGroupId, tab.group);
    }
  });

  for (const [oldGroupId, group] of groups.entries()) {
    const tabIds = createdTabs
      .filter((tab) => tab.oldGroupId === oldGroupId)
      .map((tab) => tab.id);
    if (tabIds.length === 0) {
      continue;
    }
    const newGroupId = await chrome.tabs.group({
      tabIds: /** @type {any} */ (tabIds),
      createProperties: { windowId },
    });
    await chrome.tabGroups.update(newGroupId, {
      title: group.title || 'Group',
      color: group.color || 'grey',
      collapsed: Boolean(group.collapsed),
    });
  }
}

// ============================================================================
// MESSAGE LISTENER
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  if (handleOptionsBackupMessage(message, sendResponse)) {
    return true;
  }

  if (handleTokenValidationMessage(message, sendResponse)) {
    return true;
  }

  // Handle screen recorder messages
  const screenRecorderResult = handleScreenRecorderMessage(message, sender, sendResponse);
  if (screenRecorderResult !== undefined) {
    return screenRecorderResult;
  }

  // Screen recording toggle from popup
  if (message.type === 'screen-recorder:toggle') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        await handleScreenRecordingToggle(tabId);
        sendResponse({ success: true });
      } catch (error) {
        console.error('[background] Screen recording toggle failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Start new recording from preview page
  if (message.type === 'screen-recorder:start-new') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        await handleScreenRecordingToggle(tabId);
        sendResponse({ success: true });
      } catch (error) {
        console.error('[background] Screen recording start failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === GET_AUTO_RELOAD_STATUS_MESSAGE) {
    const status = getActiveAutoReloadStatus();
    sendResponse({ status });
    return true;
  }

  if (message.type === AUTO_RELOAD_RE_EVALUATE_MESSAGE) {
    void evaluateAllTabs()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.warn(
          '[background] Failed to re-evaluate auto reload rules:',
          error,
        );
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === RUN_CODE_IN_PAGE_EXECUTE_MESSAGE) {
    const ruleId = typeof message.ruleId === 'string' ? message.ruleId : '';
    const tabId = typeof message.tabId === 'number' ? message.tabId : null;
    void (async () => {
      try {
        let targetTabId = tabId;
        if (targetTabId === null) {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          targetTabId =
            tabs && typeof tabs[0]?.id === 'number' ? tabs[0].id : null;
        }
        if (targetTabId === null) {
          throw new Error('No active tab found.');
        }
        const result = await runCodeInPageRule(ruleId, targetTabId);
        sendResponse({ ok: true, ...result });
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : String(error);
        console.error('[background] Run code failed:', error);
        sendResponse({ ok: false, error: messageText });
      }
    })();
    return true;
  }

  if (message.type === OPEN_ALL_ITEMS_MESSAGE) {
    const collectionId = Number(message.collectionId);
    const collectionTitle = message.collectionTitle;
    if (!Number.isFinite(collectionId)) {
      sendResponse({ ok: false, error: 'Invalid collection ID' });
      return false;
    }
    handleOpenAllItemsInCollection(collectionId, collectionTitle)
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error) => {
        console.error('[background] Open all items failed:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }
  
  if (message.type === UPDATE_RAINDROP_URL_MESSAGE) {
    const { id, url } = message;
    handleUpdateRaindropUrl(id, url)
      .then((result) => {
        sendResponse({ ok: true, ...result });
      })
      .catch((error) => {
        console.error('[background] Update Raindrop URL failed:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === GET_CURRENT_TAB_ID_MESSAGE) {
    if (sender.tab) {
      sendResponse({ tabId: sender.tab.id });
    } else {
      sendResponse({ tabId: null });
    }
    return true;
  }

  if (message.type === ENCRYPT_AND_SAVE_MESSAGE) {
    const url = typeof message.url === 'string' ? message.url : '';
    const title = typeof message.title === 'string' ? message.title : '';
    const selectionText =
      typeof message.selectionText === 'string' ? message.selectionText : '';
    const tabId = typeof message.tabId === 'number' ? message.tabId : null;

    handleEncryptAndSave({
      rawUrl: url,
      title,
      selectionText,
      tabId,
      notifyOnError: false,
    })
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        const messageText =
          error instanceof Error ? error.message : String(error);
        sendResponse({ ok: false, error: messageText });
      });
    return true;
  }

  if (message.type === SAVE_UNSORTED_MESSAGE) {
    const entries = Array.isArray(message.entries) ? message.entries : [];
    saveUrlsToUnsorted(entries)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        const messageText =
          error instanceof Error ? error.message : String(error);
        sendResponse({ ok: false, error: messageText });
      });
    return true;
  }

  if (message.type === RAINDROP_SEARCH_MESSAGE) {
    const query = typeof message.query === 'string' ? message.query : '';
    handleRaindropSearch(query)
      .then((result) => {
        sendResponse({
          items: Array.isArray(result?.items) ? result.items : [],
          collections: Array.isArray(result?.collections) ? result.collections : [],
        });
      })
      .catch((error) => {
        console.error('[background] Raindrop search failed:', error);
        sendResponse({
          items: [],
          collections: [],
          error: error instanceof Error ? error.message : 'Raindrop search failed.',
        });
      });
    return true;
  }

  if (message.type === FETCH_SESSIONS_MESSAGE) {
    handleFetchSessions()
      .then((sessions) => {
        sendResponse({ ok: true, sessions });
      })
      .catch((error) => {
        console.error('[background] Fetch sessions failed:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === FETCH_SESSION_DETAILS_MESSAGE) {
    const collectionId = Number(message.collectionId);
    if (!Number.isFinite(collectionId)) {
      sendResponse({ ok: false, error: 'Invalid collection ID' });
      return false;
    }
    handleFetchSessionDetails(collectionId)
      .then((details) => {
        sendResponse({ ok: true, details });
      })
      .catch((error) => {
        console.error('[background] Fetch session details failed:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === RESTORE_SESSION_MESSAGE) {
    const collectionId = Number(message.collectionId);
    if (!Number.isFinite(collectionId)) {
      sendResponse({ ok: false, error: 'Invalid collection ID' });
      return false;
    }
    handleRestoreSession(collectionId)
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error) => {
        console.error('[background] Restore session failed:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === RESTORE_WINDOW_MESSAGE) {
    void (async () => {
      try {
        await restoreWindowFromTree(message.tree);
        sendResponse({ ok: true });
      } catch (error) {
        console.error('[background] Restore window failed:', error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === RESTORE_GROUP_MESSAGE) {
    void (async () => {
      try {
        const group = message.group;
        const tabs = Array.isArray(group?.tabs) ? group.tabs : [];
        const currentWindow = await chrome.windows.getCurrent();
        const windowId = currentWindow.id;
        if (typeof windowId !== 'number') {
          throw new Error('Could not get current window');
        }

        const tabIds = [];
        for (const tab of tabs) {
          const newTab = await chrome.tabs.create({
            windowId,
            url: tab.url,
            pinned: Boolean(tab.pinned),
            active: false,
          });
          if (typeof newTab?.id === 'number') {
            tabIds.push(newTab.id);
          }
        }

        if (tabIds.length > 0) {
          const newGroupId = await chrome.tabs.group({
            tabIds: /** @type {any} */ (tabIds),
            createProperties: { windowId },
          });
          await chrome.tabGroups.update(newGroupId, {
            title: group.title || 'Group',
            color: group.color || 'grey',
            collapsed: Boolean(group.collapsed),
          });
        }
        sendResponse({ ok: true });
      } catch (error) {
        console.error('[background] Restore group failed:', error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === RESTORE_TAB_MESSAGE) {
    void (async () => {
      try {
        const url = typeof message.url === 'string' ? message.url : '';
        if (!url) {
          throw new Error('Invalid tab URL');
        }
        await createTabNextToActive({
          url,
          pinned: Boolean(message.pinned),
          active: true,
        });
        sendResponse({ ok: true });
      } catch (error) {
        console.error('[background] Restore tab failed:', error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === SAVE_SESSION_MESSAGE) {
    const collectionId = Number(message.collectionId);
    if (!Number.isFinite(collectionId)) {
      sendResponse({ ok: false, error: 'Invalid collection ID' });
      return false;
    }
    void (async () => {
      try {
        await ensureDeviceCollectionAndExport(undefined, collectionId);
        sendResponse({ ok: true });
      } catch (error) {
        console.error('[background] Save session failed:', error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'mirror:ensureSessionsCollection') {
    ensureNenyaSessionsCollection()
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error) => {
        console.warn('[background] Ensure sessions collection failed:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === UPDATE_SESSION_NAME_MESSAGE) {
    const collectionId = Number(message.collectionId);
    const oldName = typeof message.oldName === 'string' ? message.oldName : '';
    const newName = typeof message.newName === 'string' ? message.newName : '';
    handleUpdateSessionName(collectionId, oldName, newName)
      .then((result) => {
        sendResponse({ ok: true, ...result });
      })
      .catch((error) => {
        console.error('[background] Update session name failed:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === DELETE_SESSION_MESSAGE) {
    const collectionId = Number(message.collectionId);
    handleDeleteSession(collectionId)
      .then((result) => {
        sendResponse({ ok: true, ...result });
      })
      .catch((error) => {
        console.error('[background] Delete session failed:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'mirror:uploadCollectionCover') {
    const collectionId = Number(message.collectionId);
    const iconPath = typeof message.iconPath === 'string' ? message.iconPath : '';
    handleUploadCollectionCover(collectionId, iconPath)
      .then((result) => {
        sendResponse({ ok: true, ...result });
      })
      .catch((error) => {
        console.error('[background] Upload collection cover failed:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === SET_CURRENT_SESSION_ICON_PREFERENCE_MESSAGE) {
    const iconPath = typeof message.iconPath === 'string' ? message.iconPath : '';
    handleSetCurrentSessionIconPreference(iconPath)
      .then((result) => {
        sendResponse({ ok: true, ...result });
      })
      .catch((error) => {
        console.error('[background] Persist session icon preference failed:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === CLIPBOARD_SAVE_TO_UNSORTED_MESSAGE) {
    const clipboardText =
      typeof message.clipboardText === 'string' ? message.clipboardText : '';
    handleSaveClipboardUrlToUnsorted(clipboardText)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        const messageText =
          error instanceof Error ? error.message : String(error);
        sendResponse({ ok: false, error: messageText });
      });
    return true;
  }

  if (message.type === TAKE_SCREENSHOT_MESSAGE) {
    const tabId = typeof message.tabId === 'number' ? message.tabId : null;
    void (async () => {
      try {
        let targetTabId = tabId;
        if (targetTabId === null) {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tabs && tabs[0] && typeof tabs[0].id === 'number') {
            targetTabId = tabs[0].id;
          }
        }

        if (targetTabId !== null) {
          const success = await handleScreenshotCopy(targetTabId);
          sendResponse({ success });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (error) {
        console.warn('[background] Failed to take screenshot:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === COLLECT_PAGE_CONTENT_MESSAGE) {
    void (async () => {
      try {
        // Get tabs to collect content from
        let tabIds = Array.isArray(message.tabIds) ? message.tabIds : [];
        if (tabIds.length === 0) {
          // Get highlighted tabs or active tab
          const highlightedTabs = await chrome.tabs.query({
            currentWindow: true,
            highlighted: true,
          });
          if (highlightedTabs && highlightedTabs.length > 0) {
            tabIds = highlightedTabs
              .map((t) => t.id)
              .filter((id) => typeof id === 'number');
          } else {
            const activeTabs = await chrome.tabs.query({
              currentWindow: true,
              active: true,
            });
            if (
              activeTabs &&
              activeTabs[0] &&
              typeof activeTabs[0].id === 'number'
            ) {
              tabIds = [activeTabs[0].id];
            }
          }
        }

        // Collect content from each tab
        const contents = await collectPageContentFromTabs(tabIds);

        sendResponse({ success: true, contents });
      } catch (error) {
        console.error('[background] Error collecting page content:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }



  if (message.type === 'INJECT_CUSTOM_JS') {
    const ruleId = message.ruleId;
    const code = typeof message.code === 'string' ? message.code : '';

    if (!code || !sender.tab || typeof sender.tab.id !== 'number') {
      sendResponse({ success: false, error: 'Invalid request' });
      return false;
    }

    const tabId = sender.tab.id;

    void (async () => {
      try {
        await executeAutomaticCustomCode(
          tabId,
          code,
          '[Nenya CustomCode] Script execution error:',
        );

        sendResponse({ success: true });
      } catch (error) {
        console.error('[background] Failed to inject custom JS:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'auto-google-login:checkTabActive') {
    void (async () => {
      try {
        if (!sender.tab || typeof sender.tab.id !== 'number') {
          sendResponse({ isActive: false });
          return;
        }

        const tabId = sender.tab.id;
        const windowId =
          typeof sender.tab.windowId === 'number' ? sender.tab.windowId : null;

        if (windowId === null) {
          sendResponse({ isActive: false });
          return;
        }

        // Get the window to check if it's focused
        const window = await chrome.windows.get(windowId);
        if (!window || !window.focused) {
          sendResponse({ isActive: false });
          return;
        }

        // Check if this tab is active in its window
        const tabs = await chrome.tabs.query({
          active: true,
          windowId: windowId,
        });

        const isActive =
          tabs.length > 0 &&
          typeof tabs[0]?.id === 'number' &&
          tabs[0].id === tabId;

        sendResponse({ isActive });
      } catch (error) {
        console.warn('[background] Failed to check tab active status:', error);
        sendResponse({ isActive: false });
      }
    })();
    return true;
  }

  return false;
});


async function handleSaveToUnsortedRequest() {
  try {
    const tabs = await chrome.tabs.query({
      currentWindow: true,
      active: true,
    });
    const activeTab = tabs && tabs[0];
    if (!activeTab) {
      pushNotification(
        'save-unsorted-request',
        'Save to Unsorted',
        'No active tab found.',
      );
      return;
    }

    await chrome.action.openPopup();
    await new Promise((resolve) => setTimeout(resolve, 150));
    await chrome.runtime.sendMessage({
      type: SHOW_SAVE_TO_UNSORTED_DIALOG_MESSAGE,
      tab: {
        id: activeTab.id,
        url: activeTab.url,
        title: activeTab.title,
        windowId: activeTab.windowId,
      },
    });
  } catch (error) {
    console.warn('[background] Save to Unsorted request failed:', error);
    pushNotification(
      'save-unsorted-request',
      'Save to Unsorted',
      'An unexpected error occurred.',
    );
  }
}

/**
 * Update context menu visibility based on current tab.
 * Uses the centralized context menu module for updates.
 * @param {chrome.tabs.Tab} tab - The current tab
 * @returns {Promise<void>}
 */
async function updateContextMenuVisibility(tab) {
  if (!chrome.contextMenus) return;

  try {
    // Update Run Code menu based on current URL
    if (tab && tab.url) {
      await updateRunCodeSubmenu(tab.url);
    }

    // Update screenshot visibility based on tab selection
    const highlightedTabs = await chrome.tabs.query({
      currentWindow: true,
      highlighted: true,
    });
    const hasMultipleTabs = highlightedTabs && highlightedTabs.length > 1;
    await updateScreenshotMenuVisibility(hasMultipleTabs);
  } catch (error) {
    console.warn('Failed to update context menu visibility:', error);
  }
}

/**
 * Ensure extension context menu entries exist.
 * Uses the centralized context menu module for hierarchical menus.
 * @returns {void}
 */
function setupContextMenus() {
  if (!chrome.contextMenus) {
    return;
  }

  // Use the centralized context menu setup
  void setupCentralizedContextMenus().catch((error) => {
    console.error('[contextMenu] Failed to setup context menus:', error);
  });
}

if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const menuItemId = String(info.menuItemId);

    // ========================================================================
    // COPY MENU HANDLERS
    // ========================================================================
    if (isCopyMenuItem(menuItemId)) {
      const formatType = getCopyFormatType(menuItemId);
      if (formatType && tab) {
        void handleCopyContextMenuClick(formatType, tab);
      }
      return;
    }

    // ========================================================================
    // RAINDROP MENU HANDLERS
    // ========================================================================

    // Save current page to unsorted
    if (menuItemId === RAINDROP_MENU_IDS.SAVE_PAGE) {
      void handleSaveToUnsortedRequest();
      return;
    }

    // Save link to unsorted
    if (menuItemId === RAINDROP_MENU_IDS.SAVE_LINK) {
      const url = typeof info.linkUrl === 'string' ? info.linkUrl : '';
      if (!url) {
        return;
      }
      const normalizedUrl = normalizeHttpUrl(url);
      if (!normalizedUrl) {
        return;
      }
      const selection =
        typeof info.selectionText === 'string' ? info.selectionText.trim() : '';
      const originalTitle =
        selection || (typeof tab?.title === 'string' ? tab.title : '');
      const title = await promptForTitle(tab?.id, originalTitle);
      void saveUrlsToUnsorted([{ url: normalizedUrl, title }]).catch((error) => {
        console.error('[contextMenu] Failed to save link:', error);
      });
      return;
    }

    // Save clipboard link to unsorted
    if (menuItemId === RAINDROP_MENU_IDS.SAVE_CLIPBOARD) {
      void (async () => {
        try {
          const clipboardResult = await readClipboardFromTab();
          if (clipboardResult.error) {
            console.error(
              '[contextMenu] Failed to read clipboard:',
              clipboardResult.error,
            );
            return;
          }
          await handleSaveClipboardUrlToUnsorted(clipboardResult.text || '');
        } catch (error) {
          console.error('[contextMenu] Failed to save clipboard link:', error);
        }
      })();
      return;
    }

    // Encrypt & save to unsorted
    if (menuItemId === RAINDROP_MENU_IDS.ENCRYPT_SAVE) {
      const targetUrl =
        typeof info.linkUrl === 'string' && info.linkUrl
          ? info.linkUrl
          : typeof info.pageUrl === 'string'
            ? info.pageUrl
            : '';
      if (!targetUrl) {
        return;
      }

      const selectionText =
        typeof info.selectionText === 'string' ? info.selectionText.trim() : '';
      const tabId = typeof tab?.id === 'number' ? tab.id : null;
      const title =
        selectionText || (typeof tab?.title === 'string' ? tab.title : '');

      void handleEncryptAndSave({
        rawUrl: targetUrl,
        title,
        selectionText,
        tabId,
        notifyOnError: true,
      }).catch((error) => {
        console.error('[contextMenu] Encrypt & save failed:', error);
      });
      return;
    }



    // ========================================================================
    // RUN CODE MENU HANDLERS
    // ========================================================================
    const runCodeMenuItem = parseRunCodeMenuItem(menuItemId);
    if (runCodeMenuItem) {
      void handleRunCodeFromContextMenu(runCodeMenuItem.ruleId, tab);
      return;
    }

    // ========================================================================
    // NENYA MENU HANDLERS
    // ========================================================================


    // Emoji Picker
    if (menuItemId === NENYA_MENU_IDS.EMOJI_PICKER) {
      void (async () => {
        try {
          await chrome.storage.local.set({ openEmojiPage: true });
          await chrome.action.openPopup();
        } catch (error) {
          console.warn('[contextMenu] Failed to open emoji picker:', error);
        }
      })();
      return;
    }

    // Take screenshot
    if (menuItemId === NENYA_MENU_IDS.TAKE_SCREENSHOT) {
      if (tab && typeof tab.id === 'number') {
        void handleScreenshotCopy(tab.id);
      }
      return;
    }

    // Screen recording
    if (menuItemId === NENYA_MENU_IDS.SCREEN_RECORDING) {
      if (tab && typeof tab.id === 'number') {
        void handleScreenRecordingToggle(tab.id);
      }
      return;
    }

    // Auto Reload
    if (menuItemId === NENYA_MENU_IDS.AUTO_RELOAD) {
      if (tab && tab.url) {
        await chrome.storage.local.set({ autoReloadPrefillUrl: tab.url });
        chrome.runtime.openOptionsPage();
      }
      return;
    }

    // Download as markdown
    if (menuItemId === NENYA_MENU_IDS.DOWNLOAD_MARKDOWN) {
      void handleMarkdownDownload().catch((error) => {
        console.error('[contextMenu] Download markdown failed:', error);
      });
      return;
    }

    // Inject JS/CSS (Custom Code Options)
    if (menuItemId === NENYA_MENU_IDS.CUSTOM_CODE_OPTIONS) {
      if (tab && tab.url) {
        await chrome.storage.local.set({ customCodePrefillUrl: tab.url });
        chrome.runtime.openOptionsPage();
      }
      return;
    }

    // Open Options
    if (menuItemId === NENYA_MENU_IDS.OPTIONS) {
      chrome.runtime.openOptionsPage();
      return;
    }

    // ========================================================================
    // BACKWARDS COMPATIBILITY - Handle old menu IDs
    // ========================================================================
    // Handle clipboard context menu clicks (legacy)
    if (tab) {
      void handleClipboardContextMenuClick(info, tab);
    }
  });
}

// ============================================================================
// CONTEXT MENU HELPER FUNCTIONS
// ============================================================================

/**
 * Handle copy context menu click.
 * @param {'title' | 'title-url' | 'title-dash-url' | 'markdown-link' | 'screenshot'} formatType
 * @param {chrome.tabs.Tab} tab
 * @returns {Promise<void>}
 */
async function handleCopyContextMenuClick(formatType, tab) {
  try {
    // Get highlighted tabs first, then fall back to active tab
    let tabs = await chrome.tabs.query({
      currentWindow: true,
      highlighted: true,
    });
    if (!tabs || tabs.length === 0) {
      tabs = await chrome.tabs.query({ currentWindow: true, active: true });
    }

    if (!tabs || tabs.length === 0) {
      setCopyFailureBadge();
      return;
    }

    let success = false;

    if (formatType === 'screenshot') {
      // Screenshot only works with single tab
      if (tabs.length === 1 && typeof tabs[0].id === 'number') {
        success = await handleScreenshotCopy(tabs[0].id);
      }
    } else {
      success = await handleMultiTabCopy(formatType, tabs);
    }

    // Set badge based on result
    if (success) {
      setCopySuccessBadge();
    } else {
      setCopyFailureBadge();
    }
  } catch (error) {
    console.error('[contextMenu] Copy operation failed:', error);
    setCopyFailureBadge();
  }
}

/**
 * Handle create new project from context menu.
 * @param {chrome.tabs.Tab} [tab]
 * @returns {Promise<void>}
 */
async function handleCreateProjectFromContextMenu(tab) {
  try {
    // Get highlighted tabs for project
    let tabs = await chrome.tabs.query({
      currentWindow: true,
      highlighted: true,
    });
    if (!tabs || tabs.length === 0) {
      tabs = await chrome.tabs.query({ currentWindow: true, active: true });
    }

    if (!tabs || tabs.length === 0) {
      return;
    }

    // Prompt for project name
    const projectName = await promptForProjectName(tab?.id);
    if (!projectName) {
      return;
    }

    // Convert tabs to project tab descriptors
    const tabDescriptors = tabs
      .filter((t) => t && typeof t.id === 'number' && t.url)
      .map((t) => ({
        id: t.id,
        windowId: t.windowId || -1,
        index: t.index || 0,
        groupId: t.groupId || -1,
        pinned: Boolean(t.pinned),
        url: t.url || '',
        title: t.title || '',
      }));

    await saveTabsAsProject(projectName, tabDescriptors);

    // Refresh project submenus after creating a new project
    void updateProjectSubmenus();
  } catch (error) {
    console.error('[contextMenu] Failed to create project:', error);
  }
}

/**
 * Handle add current page to project from context menu.
 * @param {number} projectId
 * @param {chrome.tabs.Tab} [tab]
 * @returns {Promise<void>}
 */
async function handleAddToProjectFromContextMenu(projectId, tab) {
  try {
    // Get highlighted tabs
    let tabs = await chrome.tabs.query({
      currentWindow: true,
      highlighted: true,
    });
    if (!tabs || tabs.length === 0) {
      tabs = await chrome.tabs.query({ currentWindow: true, active: true });
    }

    if (!tabs || tabs.length === 0) {
      return;
    }

    // Convert tabs to project tab descriptors
    const tabDescriptors = tabs
      .filter((t) => t && typeof t.id === 'number' && t.url)
      .map((t) => ({
        id: t.id,
        windowId: t.windowId || -1,
        index: t.index || 0,
        groupId: t.groupId || -1,
        pinned: Boolean(t.pinned),
        url: t.url || '',
        title: t.title || '',
      }));

    // Import addTabsToProject
    const { addTabsToProject } = await import('./projects.js');
    await addTabsToProject(projectId, tabDescriptors);
  } catch (error) {
    console.error('[contextMenu] Failed to add to project:', error);
  }
}

/**
 * Handle replace project items from context menu.
 * @param {number} projectId
 * @param {chrome.tabs.Tab} [tab]
 * @returns {Promise<void>}
 */
async function handleReplaceProjectFromContextMenu(projectId, tab) {
  try {
    // Get highlighted tabs
    let tabs = await chrome.tabs.query({
      currentWindow: true,
      highlighted: true,
    });
    if (!tabs || tabs.length === 0) {
      tabs = await chrome.tabs.query({ currentWindow: true, active: true });
    }

    if (!tabs || tabs.length === 0) {
      return;
    }

    // Convert tabs to project tab descriptors
    const tabDescriptors = tabs
      .filter((t) => t && typeof t.id === 'number' && t.url)
      .map((t) => ({
        id: t.id,
        windowId: t.windowId || -1,
        index: t.index || 0,
        groupId: t.groupId || -1,
        pinned: Boolean(t.pinned),
        url: t.url || '',
        title: t.title || '',
      }));

    // Import replaceProjectItems
    const { replaceProjectItems } = await import('./projects.js');
    await replaceProjectItems(projectId, tabDescriptors);
  } catch (error) {
    console.error('[contextMenu] Failed to replace project:', error);
  }
}

/**
 * Run a stored "Run code in page" snippet in a tab.
 * @param {string} ruleId
 * @param {number} tabId
 * @returns {Promise<{title: string}>}
 */
async function runCodeInPageRule(ruleId, tabId) {
  if (!ruleId) {
    throw new Error('Invalid code rule ID.');
  }
  if (typeof tabId !== 'number') {
    throw new Error('No active tab found.');
  }

  const result = await chrome.storage.local.get('runCodeInPageRules');
  const rules = Array.isArray(result.runCodeInPageRules)
    ? result.runCodeInPageRules
    : [];
  const rule = rules.find((candidate) => candidate.id === ruleId);

  if (!rule) {
    throw new Error('Code rule not found.');
  }

  if (!rule.code || !rule.code.trim()) {
    throw new Error('Code rule is empty.');
  }

  await executeManualUserCode(
    tabId,
    rule.code,
    '[Nenya RunCode] Script execution error:',
    sanitizeSourceName(`nenya-run-code-${ruleId}.js`),
  );

  return {
    title: typeof rule.title === 'string' ? rule.title : '',
  };
}

/**
 * Handle run code snippet from context menu.
 * @param {string} ruleId
 * @param {chrome.tabs.Tab} [tab]
 * @returns {Promise<void>}
 */
async function handleRunCodeFromContextMenu(ruleId, tab) {
  if (!tab || typeof tab.id !== 'number') {
    return;
  }

  try {
    await runCodeInPageRule(ruleId, tab.id);
  } catch (error) {
    console.error('[contextMenu] Failed to run code:', error);
  }
}

/**
 * Prompt user for project name.
 * @param {number} [tabId]
 * @returns {Promise<string | null>}
 */
async function promptForProjectName(tabId) {
  if (typeof tabId !== 'number') {
    return 'New Project';
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return window.prompt('Enter project name:', 'New Project');
      },
    });

    if (results && results[0] && results[0].result) {
      return String(results[0].result).trim() || null;
    }
    return null;
  } catch (error) {
    console.warn('[contextMenu] Failed to prompt for project name:', error);
    return 'New Project';
  }
}

// ============================================================================
// STORAGE CHANGE LISTENERS FOR CONTEXT MENU UPDATES
// ============================================================================

/**
 * Listen for storage changes to update context menus dynamically.
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  // Update project submenus when cached projects change
  if (changes.cachedProjects) {
    void updateProjectSubmenus().catch((error) => {
      console.warn('[contextMenu] Failed to update project submenus:', error);
    });
  }

  // Update code submenus when "run code in page" rules change
  if (changes.runCodeInPageRules) {
    // We need to update for the current tab's URL
    void (async () => {
      try {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tabs && tabs[0] && tabs[0].url) {
          await updateRunCodeSubmenu(tabs[0].url);
        }
      } catch (error) {
        console.warn('[contextMenu] Failed to update code submenus:', error);
      }
    })();
  }
});
