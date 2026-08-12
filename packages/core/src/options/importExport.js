/* global chrome, URLPattern */

import { loadRules as loadAutoGoogleLoginRules } from './autoGoogleLogin.js';


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
const CUSTOM_CODE_RULES_KEY = 'customCodeRules';
const RUN_CODE_IN_PAGE_RULES_KEY = 'runCodeInPageRules';
const AUTO_GOOGLE_LOGIN_RULES_KEY = 'autoGoogleLoginRules';
const PINNED_SHORTCUTS_KEY = 'pinnedShortcuts';
const PINNED_SEARCH_RESULTS_KEY = 'pinnedSearchResults';
const CUSTOM_SEARCH_ENGINES_KEY = 'customSearchEngines';
const MIN_RULE_INTERVAL_SECONDS = 5;
const DEFAULT_PARENT_PATH = '/Bookmarks Bar';

const importButton = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('optionsFloatingFileImportButton')
);
const exportButton = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('optionsFloatingFileExportButton')
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

const MAX_PINNED_SHORTCUTS = 7;
const DEFAULT_PINNED_SHORTCUTS = [
  'getMarkdown',
  'saveUnsorted',
  'encryptSave',
  'saveClipboardToUnsorted',
  'emojiPicker',
];
const AVAILABLE_PINNED_SHORTCUT_IDS = new Set([
  'getMarkdown',
  'saveUnsorted',
  'encryptSave',
  'saveClipboardToUnsorted',
  'importCustomCode',
  'customCode',
  'takeScreenshot',
  'screenRecording',
  'emojiPicker',
]);

/**
 * Generate a unique identifier for imported/exported rules when missing.
 * @returns {string}
 */
function generateRuleId() {
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2);
  return 'rule-' + Date.now().toString(36) + '-' + random;
}

/**
 * Deep clone plain JSON-like values.
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clonePreferences(value) {
  return JSON.parse(JSON.stringify(value));
}

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
 * @param {{ linkUrl?: string, linkText?: string }} [options] - Optional link
 *   appended to the toast (e.g. a Google Drive folder link).
 * @returns {void}
 */
export function showToast(message, variant = 'info', options = {}) {
  /** @type {{ Toastify?: (options: any) => { showToast: () => void } }} */
  const windowWithToastify = /** @type {any} */ (window);
  const background =
    TOAST_BACKGROUND_BY_VARIANT[variant] || TOAST_BACKGROUND_BY_VARIANT.info;
  if (typeof windowWithToastify.Toastify === 'function') {
    /** @type {Record<string, any>} */
    const toastOptions = {
      duration: options.linkUrl ? 8000 : 4000,
      gravity: 'top',
      position: 'right',
      close: true,
      style: { background },
    };
    if (options.linkUrl) {
      // Build a DOM node so the link is safe from HTML injection.
      const node = document.createElement('span');
      node.appendChild(document.createTextNode(message + ' '));
      const link = document.createElement('a');
      link.href = options.linkUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = options.linkText || 'Open';
      link.style.color = '#ffffff';
      link.style.textDecoration = 'underline';
      node.appendChild(link);
      toastOptions.node = node;
    } else {
      toastOptions.text = message;
    }
    windowWithToastify.Toastify(toastOptions).showToast();
    return;
  }
  // Fallback
  try {
    // eslint-disable-next-line no-alert
    alert(options.linkUrl ? message + ' ' + options.linkUrl : message);
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

/**
 * Normalize custom code rules for import/export.
 * @param {unknown} value
 * @returns {Array<CustomCodeRuleSettings & { disabled?: boolean }>}
 */
function normalizeCustomCodeRules(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce((rules, entry) => {
    if (!entry || typeof entry !== 'object') {
      return rules;
    }

    const raw =
      /** @type {{ id?: unknown, pattern?: unknown, css?: unknown, js?: unknown, disabled?: unknown, createdAt?: unknown, updatedAt?: unknown }} */ (
        entry
      );
    const pattern = typeof raw.pattern === 'string' ? raw.pattern.trim() : '';
    if (!isValidUrlPattern(pattern)) {
      return rules;
    }

    const id = typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : generateRuleId();

    const rule = {
      id,
      pattern,
      css: typeof raw.css === 'string' ? raw.css : '',
      js: typeof raw.js === 'string' ? raw.js : '',
      disabled: !!raw.disabled,
    };
    if (typeof raw.createdAt === 'string') {
      rule.createdAt = raw.createdAt;
    }
    if (typeof raw.updatedAt === 'string') {
      rule.updatedAt = raw.updatedAt;
    }

    rules.push(rule);
    return rules;
  }, /** @type {Array<CustomCodeRuleSettings & { disabled?: boolean }>} */ ([]));
}

/**
 * Normalize run code in page rules for import/export.
 * @param {unknown} value
 * @returns {RunCodeInPageRuleSettings[]}
 */
function normalizeRunCodeInPageRules(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce((rules, entry) => {
    if (!entry || typeof entry !== 'object') {
      return rules;
    }

    const raw =
      /** @type {{ id?: unknown, title?: unknown, patterns?: unknown, code?: unknown, disabled?: unknown, createdAt?: unknown, updatedAt?: unknown }} */ (
        entry
      );
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) {
      return rules;
    }

    const patterns = Array.isArray(raw.patterns)
      ? raw.patterns.filter(
          (pattern) =>
            typeof pattern === 'string' && isValidUrlPattern(pattern.trim()),
        )
      : [];

    const id = typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : generateRuleId();

    /** @type {RunCodeInPageRuleSettings} */
    const rule = {
      id,
      title,
      patterns,
      code: typeof raw.code === 'string' ? raw.code : '',
      disabled: !!raw.disabled,
    };
    if (typeof raw.createdAt === 'string') {
      rule.createdAt = raw.createdAt;
    }
    if (typeof raw.updatedAt === 'string') {
      rule.updatedAt = raw.updatedAt;
    }

    rules.push(rule);
    return rules;
  }, /** @type {RunCodeInPageRuleSettings[]} */ ([]));
}

/**
 * Normalize auto Google login rules for import/export.
 * @param {unknown} value
 * @returns {Array<AutoGoogleLoginRuleSettings & { disabled?: boolean }>}
 */
function normalizeAutoGoogleLoginRules(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce((rules, entry) => {
    if (!entry || typeof entry !== 'object') {
      return rules;
    }

    const raw =
      /** @type {{ id?: unknown, pattern?: unknown, email?: unknown, disabled?: unknown, createdAt?: unknown, updatedAt?: unknown }} */ (
        entry
      );
    const pattern = typeof raw.pattern === 'string' ? raw.pattern.trim() : '';
    if (!isValidUrlPattern(pattern)) {
      return rules;
    }

    const id = typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : generateRuleId();

    const rule = {
      id,
      pattern,
      disabled: !!raw.disabled,
    };
    if (typeof raw.email === 'string' && raw.email.trim()) {
      rule.email = raw.email.trim();
    }
    if (typeof raw.createdAt === 'string') {
      rule.createdAt = raw.createdAt;
    }
    if (typeof raw.updatedAt === 'string') {
      rule.updatedAt = raw.updatedAt;
    }

    rules.push(rule);
    return rules;
  }, /** @type {Array<AutoGoogleLoginRuleSettings & { disabled?: boolean }>} */ ([]));
}

/**
 * Normalize pinned shortcuts for import/export.
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizePinnedShortcuts(value) {
  if (!Array.isArray(value)) {
    return [...DEFAULT_PINNED_SHORTCUTS];
  }

  const deduped = [];
  for (const item of value) {
    if (
      typeof item !== 'string' ||
      item === 'openOptions' ||
      !AVAILABLE_PINNED_SHORTCUT_IDS.has(item) ||
      deduped.includes(item)
    ) {
      continue;
    }
    deduped.push(item);
    if (deduped.length >= MAX_PINNED_SHORTCUTS) {
      break;
    }
  }

  return deduped.length > 0 ? deduped : [...DEFAULT_PINNED_SHORTCUTS];
}

/**
 * Normalize pinned search results for import/export.
 * @param {unknown} value
 * @returns {Array<{title: string, url: string, type: string}>}
 */
function normalizePinnedSearchResults(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce((items, entry) => {
    if (!entry || typeof entry !== 'object') {
      return items;
    }

    const raw =
      /** @type {{ title?: unknown, url?: unknown, type?: unknown }} */ (entry);
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const url = typeof raw.url === 'string' ? raw.url.trim() : '';
    if (!title || !url) {
      return items;
    }

    items.push({
      title,
      url,
      type: typeof raw.type === 'string' ? raw.type : '',
    });
    return items;
  }, /** @type {Array<{title: string, url: string, type: string}>} */ ([]));
}

/**
 * Normalize custom search engines for import/export.
 * @param {unknown} value
 * @returns {Array<{id: string, name: string, shortcut: string, searchUrl: string}>}
 */
function normalizeCustomSearchEngines(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenShortcuts = new Set();
  return value.reduce((engines, entry) => {
    if (!entry || typeof entry !== 'object') {
      return engines;
    }

    const raw =
      /** @type {{ id?: unknown, name?: unknown, shortcut?: unknown, searchUrl?: unknown }} */ (
        entry
      );
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const shortcut =
      typeof raw.shortcut === 'string' ? raw.shortcut.trim() : '';
    const searchUrl =
      typeof raw.searchUrl === 'string' ? raw.searchUrl.trim() : '';
    if (!name || !shortcut || !searchUrl || !searchUrl.includes('%s')) {
      return engines;
    }

    const normalizedShortcut = shortcut.toLowerCase();
    if (seenShortcuts.has(normalizedShortcut)) {
      return engines;
    }
    seenShortcuts.add(normalizedShortcut);

    engines.push({
      id:
        typeof raw.id === 'string' && raw.id.trim()
          ? raw.id.trim()
          : 'se-' + Date.now().toString(36) + '-' + engines.length,
      name,
      shortcut,
      searchUrl,
    });
    return engines;
  }, /** @type {Array<{id: string, name: string, shortcut: string, searchUrl: string}>} */ ([]));
}

/**
 * Read current settings used by options import/export.
 * @returns {Promise<{ customCodeRules: CustomCodeRuleSettings[], runCodeInPageRules: RunCodeInPageRuleSettings[], autoGoogleLoginRules: AutoGoogleLoginRuleSettings[], pinnedShortcuts: string[], pinnedSearchResults: any[], customSearchEngines: Array<{id: string, name: string, shortcut: string, searchUrl: string}> }>}
 */
async function readCurrentOptions() {
  const [
    customCodeResp,
    runCodeInPageResp,
    autoGoogleLoginRulesResp,
    pinnedShortcutsResp,
    pinnedSearchResultsResp,
    customSearchEnginesResp,
  ] = await Promise.all([
    chrome.storage.local.get(CUSTOM_CODE_RULES_KEY),
    chrome.storage.local.get(RUN_CODE_IN_PAGE_RULES_KEY),
    loadAutoGoogleLoginRules(),
    chrome.storage.local.get(PINNED_SHORTCUTS_KEY),
    chrome.storage.local.get(PINNED_SEARCH_RESULTS_KEY),
    chrome.storage.local.get(CUSTOM_SEARCH_ENGINES_KEY),
  ]);

  return {
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
 * Build the export payload from current options. Transport-agnostic — used by
 * both the local-file export and the Google Drive backup.
 * @returns {Promise<ExportFile>}
 */
export async function buildExportPayload() {
  const {
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
      customCodeRules,
      runCodeInPageRules,
      autoGoogleLoginRules,
      pinnedShortcuts,
      pinnedSearchResults,
      customSearchEngines,
    },
  };
  return payload;
}

/**
 * Validate and apply a parsed export payload to storage. Transport-agnostic —
 * used by both the local-file import and the Google Drive restore. Dispatches
 * the `nenya-options-imported` event on success. Throws on invalid input.
 * @param {unknown} parsed - Parsed JSON (either the full ExportFile or its data)
 * @returns {Promise<void>}
 */
export async function applyExportPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid file.');
  }

  /** @type {any} */
  const data = /** @type {any} */ (parsed).data ?? parsed;
  const provider =
    typeof data?.provider === 'string' ? data.provider : PROVIDER_ID;
  if (provider !== PROVIDER_ID) {
    throw new Error('Unsupported provider in file.');
  }

  const customCodeRules = /** @type {CustomCodeRuleSettings[]} */ (
    data.customCodeRules || []
  );
  const runCodeInPageRules = /** @type {RunCodeInPageRuleSettings[]} */ (
    data.runCodeInPageRules || []
  );
  const autoGoogleLoginRules = /** @type {AutoGoogleLoginRuleSettings[]} */ (
    data.autoGoogleLoginRules || []
  );
  const pinnedShortcuts = /** @type {string[]} */ (data.pinnedShortcuts || []);
  const pinnedSearchResults = /** @type {any[]} */ (
    data.pinnedSearchResults || []
  );
  const customSearchEngines =
    /** @type {Array<{id: string, name: string, shortcut: string, searchUrl: string}>} */ (
      data.customSearchEngines || []
    );

  await applyImportedOptions(
    customCodeRules,
    runCodeInPageRules,
    autoGoogleLoginRules,
    pinnedShortcuts,
    pinnedSearchResults,
    customSearchEngines,
  );
  document.dispatchEvent(new CustomEvent('nenya-options-imported'));
}

/**
 * Export current options to a JSON file.
 * @returns {Promise<void>}
 */
async function handleExportClick() {
  try {
    const payload = await buildExportPayload();
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
 * @param {CustomCodeRuleSettings[]} customCodeRules
 * @param {RunCodeInPageRuleSettings[]} runCodeInPageRules
 * @param {AutoGoogleLoginRuleSettings[]} autoGoogleLoginRules
 * @param {string[]} pinnedShortcuts
 * @param {any[]} pinnedSearchResults
 * @param {Array<{id: string, name: string, shortcut: string, searchUrl: string}>} customSearchEngines
 * @returns {Promise<void>}
 */
async function applyImportedOptions(
  customCodeRules,
  runCodeInPageRules,
  autoGoogleLoginRules,
  pinnedShortcuts,
  pinnedSearchResults,
  customSearchEngines,
) {
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
    await applyExportPayload(parsed);
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
