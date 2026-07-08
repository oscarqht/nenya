/* global chrome, URLPattern */

import { loadRules as loadAutoGoogleLoginRules } from './autoGoogleLogin.js';

/**
 * @typedef {Object} AutoReloadRuleSettings
 * @property {string} id
 * @property {string} pattern
 * @property {number} intervalSeconds
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

/**
 * @typedef {Object} NotificationBookmarkSettings
 * @property {boolean} enabled
 * @property {boolean} pullFinished
 * @property {boolean} unsortedSaved
 */

/**
 * @typedef {Object} NotificationProjectSettings
 * @property {boolean} enabled
 * @property {boolean} saveProject
 * @property {boolean} addTabs
 * @property {boolean} replaceItems
 * @property {boolean} deleteProject
 */

/**
 * @typedef {Object} NotificationClipboardSettings
 * @property {boolean} enabled
 * @property {boolean} copySuccess
 */

/**
 * @typedef {Object} NotificationPreferences
 * @property {boolean} enabled
 * @property {NotificationBookmarkSettings} bookmark
 * @property {NotificationProjectSettings} project
 * @property {NotificationClipboardSettings} clipboard
 */




/**
 * @typedef {Object} CustomCodeRuleSettings
 * @property {string} id
 * @property {string} pattern
 * @property {string} css
 * @property {string} js
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

/**
 * @typedef {Object} RunCodeInPageRuleSettings
 * @property {string} id
 * @property {string} title
 * @property {string[]} patterns
 * @property {string} code
 * @property {boolean | undefined} disabled
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */


/**
 * @typedef {'add' | 'replace' | 'remove'} ProcessorType
 */

/**
 * @typedef {'copy-to-clipboard' | 'save-to-raindrop'} ApplyWhenOption
 */

/**
 * @typedef {Object} UrlProcessor
 * @property {string} id
 * @property {ProcessorType} type
 * @property {string} name - Parameter name (string or regex pattern)
 * @property {string} [value] - Value for add/replace processors
 */

/**
 * @typedef {Object} UrlProcessRuleSettings
 * @property {string} id
 * @property {string} name
 * @property {string[]} urlPatterns
 * @property {UrlProcessor[]} processors
 * @property {ApplyWhenOption[]} applyWhen - When to apply this rule
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

/**
 * @typedef {Object} AutoGoogleLoginRuleSettings
 * @property {string} id
 * @property {string} pattern
 * @property {string} [email]
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

/**
 * @typedef {'remove' | 'replace' | 'prefix' | 'suffix'} TitleTransformOperationType
 */

/**
 * @typedef {Object} TitleTransformOperationSettings
 * @property {string} id
 * @property {TitleTransformOperationType} type
 * @property {string} [pattern] - Regex pattern for remove/replace operations
 * @property {string} [value] - Replacement value for replace, or text for prefix/suffix
 */

/**
 * @typedef {Object} TitleTransformRuleSettings
 * @property {string} id
 * @property {string} name
 * @property {string[]} urlPatterns
 * @property {TitleTransformOperationSettings[]} operations
 * @property {boolean | undefined} disabled
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

/**
 * @typedef {Object} ScreenshotSettings
 * @property {boolean} autoSave
 */

/**
 * @typedef {Object} ExportPayload
 * @property {string} provider
 * @property {AutoReloadRuleSettings[]} autoReloadRules
 * @property {CustomCodeRuleSettings[]} customCodeRules
 * @property {RunCodeInPageRuleSettings[]} runCodeInPageRules
 * @property {AutoGoogleLoginRuleSettings[]} autoGoogleLoginRules
 * @property {string[]} pinnedShortcuts
 * @property {any[]} pinnedSearchResults
 */

/**
 * @typedef {Object} ExportFile
 * @property {number} version
 * @property {ExportPayload} data
 */

const PROVIDER_ID = 'raindrop';
const EXPORT_VERSION = 14;
const AUTO_RELOAD_RULES_KEY = 'autoReloadRules';
const CUSTOM_CODE_RULES_KEY = 'customCodeRules';
const RUN_CODE_IN_PAGE_RULES_KEY = 'runCodeInPageRules';
const AUTO_GOOGLE_LOGIN_RULES_KEY = 'autoGoogleLoginRules';
const PINNED_SHORTCUTS_KEY = 'pinnedShortcuts';
const PINNED_SEARCH_RESULTS_KEY = 'pinnedSearchResults';
const CUSTOM_SEARCH_ENGINES_KEY = 'customSearchEngines';
const MIN_RULE_INTERVAL_SECONDS = 5;
const DEFAULT_PARENT_PATH = '/Bookmarks Bar';

const importButton = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('optionsFloatingImportButton')
);
const exportButton = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('optionsFloatingExportButton')
);
const fileInput = /** @type {HTMLInputElement | null} */ (
  document.getElementById('optionsFloatingImportFileInput')
);

/** @typedef {'success' | 'error' | 'info'} ToastVariant */

const TOAST_BACKGROUND_BY_VARIANT = {
  success: 'linear-gradient(135deg, #22c55e, #16a34a)',
  error: 'linear-gradient(135deg, #f97316, #ea580c)',
  info: 'linear-gradient(135deg, #3b82f6, #2563eb)',
};

/**
 * Validate a URLPattern-compatible pattern.
 * @param {string} pattern
 * @returns {boolean}
 */
function isValidUrlPattern(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return false;
  }
  try {
    // eslint-disable-next-line no-new
    new URLPattern(pattern.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Show a toast via Toastify when available.
 * @param {string} message
 * @param {ToastVariant} [variant='info']
 * @returns {void}
 */
function showToast(message, variant = 'info') {
  /** @type {{ Toastify?: (options: any) => { showToast: () => void } }} */
  const windowWithToastify = /** @type {any} */ (window);
  const background =
    TOAST_BACKGROUND_BY_VARIANT[variant] || TOAST_BACKGROUND_BY_VARIANT.info;
  if (typeof windowWithToastify.Toastify === 'function') {
    windowWithToastify
      .Toastify({
        text: message,
        duration: 4000,
        gravity: 'top',
        position: 'right',
        close: true,
        style: { background },
      })
      .showToast();
    return;
  }
  // Fallback
  try {
    // eslint-disable-next-line no-alert
    alert(message);
  } catch (_) {
    // ignore
  }
}

/**
 * Normalize possibly partial preferences.
 * @param {unknown} value
 * @returns {NotificationPreferences}
 */
function normalizePreferences(value) {
  const fallback = clonePreferences({
    enabled: true,
    bookmark: { enabled: true, pullFinished: true, unsortedSaved: true },
    project: {
      enabled: true,
      saveProject: true,
      addTabs: true,
      replaceItems: true,
      deleteProject: true,
    },
    clipboard: {
      enabled: true,
      copySuccess: true,
    },
  });
  if (!value || typeof value !== 'object') {
    return fallback;
  }
  const raw =
    /** @type {{ enabled?: unknown, bookmark?: Partial<NotificationBookmarkSettings>, project?: Partial<NotificationProjectSettings>, clipboard?: Partial<NotificationClipboardSettings> }} */ (
      value
    );
  const bookmark = raw.bookmark ?? {};
  const project = raw.project ?? {};
  const clipboard = raw.clipboard ?? {};
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled,
    bookmark: {
      enabled:
        typeof bookmark.enabled === 'boolean'
          ? bookmark.enabled
          : fallback.bookmark.enabled,
      pullFinished:
        typeof bookmark.pullFinished === 'boolean'
          ? bookmark.pullFinished
          : fallback.bookmark.pullFinished,
      unsortedSaved:
        typeof bookmark.unsortedSaved === 'boolean'
          ? bookmark.unsortedSaved
          : fallback.bookmark.unsortedSaved,
    },
    project: {
      enabled:
        typeof project.enabled === 'boolean'
          ? project.enabled
          : fallback.project.enabled,
      saveProject:
        typeof project.saveProject === 'boolean'
          ? project.saveProject
          : fallback.project.saveProject,
      addTabs:
        typeof project.addTabs === 'boolean'
          ? project.addTabs
          : fallback.project.addTabs,
      replaceItems:
        typeof project.replaceItems === 'boolean'
          ? project.replaceItems
          : fallback.project.replaceItems,
      deleteProject:
        typeof project.deleteProject === 'boolean'
          ? project.deleteProject
          : fallback.project.deleteProject,
    },
    clipboard: {
      enabled:
        typeof clipboard.enabled === 'boolean'
          ? clipboard.enabled
          : fallback.clipboard.enabled,
      copySuccess:
        typeof clipboard.copySuccess === 'boolean'
          ? clipboard.copySuccess
          : fallback.clipboard.copySuccess,
    },
  };
}

/**
 * Read current settings used by Options backup.
 * @returns {Promise<{ autoReloadRules: AutoReloadRuleSettings[], customCodeRules: CustomCodeRuleSettings[], runCodeInPageRules: RunCodeInPageRuleSettings[], autoGoogleLoginRules: AutoGoogleLoginRuleSettings[], pinnedShortcuts: string[], pinnedSearchResults: any[], customSearchEngines: Array<{id: string, name: string, shortcut: string, searchUrl: string}> }>}
 */
async function readCurrentOptions() {
  const [
    reloadResp,
    customCodeResp,
    runCodeInPageResp,
    autoGoogleLoginRulesResp,
    pinnedShortcutsResp,
    pinnedSearchResultsResp,
    customSearchEnginesResp,
  ] = await Promise.all([
    chrome.storage.local.get(AUTO_RELOAD_RULES_KEY),
    chrome.storage.local.get(CUSTOM_CODE_RULES_KEY),
    chrome.storage.local.get(RUN_CODE_IN_PAGE_RULES_KEY),
    loadAutoGoogleLoginRules(),
    chrome.storage.local.get(PINNED_SHORTCUTS_KEY),
    chrome.storage.local.get(PINNED_SEARCH_RESULTS_KEY),
    chrome.storage.local.get(CUSTOM_SEARCH_ENGINES_KEY),
  ]);

  return {
    autoReloadRules: normalizeAutoReloadRules(
      reloadResp?.[AUTO_RELOAD_RULES_KEY],
    ),
    customCodeRules: normalizeCustomCodeRules(
      customCodeResp?.[CUSTOM_CODE_RULES_KEY],
    ),
    runCodeInPageRules: normalizeRunCodeInPageRules(
      runCodeInPageResp?.[RUN_CODE_IN_PAGE_RULES_KEY],
    ),
    autoGoogleLoginRules: normalizeAutoGoogleLoginRules(
      autoGoogleLoginRulesResp,
    ),
    pinnedShortcuts: normalizePinnedShortcuts(
      pinnedShortcutsResp?.[PINNED_SHORTCUTS_KEY],
    ),
    pinnedSearchResults: normalizePinnedSearchResults(
      pinnedSearchResultsResp?.[PINNED_SEARCH_RESULTS_KEY],
    ),
    customSearchEngines: normalizeCustomSearchEngines(
      customSearchEnginesResp?.[CUSTOM_SEARCH_ENGINES_KEY],
    ),
  };
}

/**
 * Trigger a download of the given data as a JSON file.
 * @param {any} data
 * @param {string} filename
 */
function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Export current options to a JSON file.
 * @returns {Promise<void>}
 */
async function handleExportClick() {
  try {
    const {
      autoReloadRules,
      customCodeRules,
      runCodeInPageRules,
      autoGoogleLoginRules,
      pinnedShortcuts,
      pinnedSearchResults,
      customSearchEngines,
    } = await readCurrentOptions();
    /** @type {ExportFile} */
    const payload = {
      version: EXPORT_VERSION,
      data: {
        provider: PROVIDER_ID,
        autoReloadRules,
        customCodeRules,
        runCodeInPageRules,
        autoGoogleLoginRules,
        pinnedShortcuts,
        pinnedSearchResults,
        customSearchEngines,
      },
    };
    const now = new Date();
    const YYYY = String(now.getFullYear());
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const filename =
      'nenya-options-' + YYYY + MM + DD + '-' + HH + mm + '.json';
    downloadJson(payload, filename);
    showToast('Exported options to ' + filename, 'success');
  } catch (error) {
    console.warn('[importExport] Export failed:', error);
    showToast('Failed to export options.', 'error');
  }
}

/**
 * Apply imported settings to storage.
 * @param {AutoReloadRuleSettings[]} autoReloadRules
 * @param {CustomCodeRuleSettings[]} customCodeRules
 * @param {RunCodeInPageRuleSettings[]} runCodeInPageRules
 * @param {AutoGoogleLoginRuleSettings[]} autoGoogleLoginRules
 * @param {string[]} pinnedShortcuts
 * @param {any[]} pinnedSearchResults
 * @param {Array<{id: string, name: string, shortcut: string, searchUrl: string}>} customSearchEngines
 * @returns {Promise<void>}
 */
async function applyImportedOptions(
  autoReloadRules,
  customCodeRules,
  runCodeInPageRules,
  autoGoogleLoginRules,
  pinnedShortcuts,
  pinnedSearchResults,
  customSearchEngines,
) {
  const sanitizedRules = normalizeAutoReloadRules(autoReloadRules);
  const sanitizedCustomCodeRules = normalizeCustomCodeRules(
    customCodeRules || [],
  );
  const sanitizedRunCodeInPageRules = normalizeRunCodeInPageRules(
    runCodeInPageRules || [],
  );
  const sanitizedAutoGoogleLoginRules = normalizeAutoGoogleLoginRules(
    autoGoogleLoginRules || [],
  );
  const sanitizedPinnedShortcuts = normalizePinnedShortcuts(
    pinnedShortcuts || [],
  );
  const sanitizedPinnedSearchResults = normalizePinnedSearchResults(
    pinnedSearchResults || [],
  );
  const sanitizedCustomSearchEngines = normalizeCustomSearchEngines(
    customSearchEngines || [],
  );

  await chrome.storage.local.set({
    [AUTO_RELOAD_RULES_KEY]: sanitizedRules,
    [AUTO_GOOGLE_LOGIN_RULES_KEY]: sanitizedAutoGoogleLoginRules,
    [PINNED_SHORTCUTS_KEY]: sanitizedPinnedShortcuts,
    [PINNED_SEARCH_RESULTS_KEY]: sanitizedPinnedSearchResults,
    [CUSTOM_SEARCH_ENGINES_KEY]: sanitizedCustomSearchEngines,
    [CUSTOM_CODE_RULES_KEY]: sanitizedCustomCodeRules,
    [RUN_CODE_IN_PAGE_RULES_KEY]: sanitizedRunCodeInPageRules,
  });
}

/**
 * Handle selected import file.
 * @returns {Promise<void>}
 */
async function handleFileChosen() {
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    return;
  }
  const file = fileInput.files[0];
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid file.');
    }

    /** @type {any} */
    const data = parsed.data ?? parsed;
    const provider =
      typeof data?.provider === 'string' ? data.provider : PROVIDER_ID;
    if (provider !== PROVIDER_ID) {
      throw new Error('Unsupported provider in file.');
    }

    const autoReloadRules = /** @type {AutoReloadRuleSettings[]} */ (
      data.autoReloadRules
    );
    const customCodeRules = /** @type {CustomCodeRuleSettings[]} */ (
      data.customCodeRules || []
    );
    const runCodeInPageRules = /** @type {RunCodeInPageRuleSettings[]} */ (
      data.runCodeInPageRules || []
    );
    const autoGoogleLoginRules = /** @type {AutoGoogleLoginRuleSettings[]} */ (
      data.autoGoogleLoginRules || []
    );
    const pinnedShortcuts = /** @type {string[]} */ (
      data.pinnedShortcuts || []
    );
    const pinnedSearchResults = /** @type {any[]} */ (
      data.pinnedSearchResults || []
    );
    const customSearchEngines =
      /** @type {Array<{id: string, name: string, shortcut: string, searchUrl: string}>} */ (
        data.customSearchEngines || []
      );

    await applyImportedOptions(
      autoReloadRules,
      customCodeRules,
      runCodeInPageRules,
      autoGoogleLoginRules,
      pinnedShortcuts,
      pinnedSearchResults,
      customSearchEngines,
    );
    showToast('Options imported successfully.', 'success');
  } catch (error) {
    console.warn('[importExport] Import failed:', error);
    showToast(
      'Failed to import options. Please select a valid export file.',
      'error',
    );
  } finally {
    // Reset input to allow re-selecting the same file
    fileInput.value = '';
  }
}

/**
 * Initialize listeners for import/export controls.
 * @returns {void}
 */
function initImportExport() {
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      void handleExportClick();
    });
  }
  if (importButton && fileInput) {
    importButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      void handleFileChosen();
    });
  }
}

initImportExport();
