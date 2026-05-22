/* global chrome, URLPattern */

/**
 * @fileoverview Centralized context menu management for Nenya extension.
 * Handles creation, updates, and dynamic submenus for all context menu items.
 */

import { LLM_PROVIDER_META } from './llmProviders.js';

// ============================================================================
// CONTEXT MENU ID CONSTANTS
// ============================================================================

/**
 * Parent menu IDs
 */
export const PARENT_MENU_IDS = {
  COPY: 'nenya-copy-parent',
  RAINDROP: 'nenya-raindrop-parent',
  SEND_TO_LLM: 'nenya-send-to-llm-parent',
  RUN_CODE: 'nenya-run-code-parent',
  // NENYA parent removed as requested
};

/**
 * Copy submenu IDs
 */
export const COPY_MENU_IDS = {
  TITLE: 'nenya-copy-title',
  TITLE_URL: 'nenya-copy-title-url',
  TITLE_DASH_URL: 'nenya-copy-title-dash-url',
  MARKDOWN_LINK: 'nenya-copy-markdown-link',
  SCREENSHOT: 'nenya-copy-screenshot',
};

/**
 * Raindrop submenu IDs
 */
export const RAINDROP_MENU_IDS = {
  SAVE_PAGE: 'nenya-save-unsorted-page',
  SAVE_LINK: 'nenya-save-unsorted-link',
  SAVE_CLIPBOARD: 'nenya-save-clipboard-link',
  ENCRYPT_SAVE: 'nenya-encrypt-unsorted',
};

/**
 * Nenya submenu IDs (replacing OTHER_MENU_IDS)
 */
export const NENYA_MENU_IDS = {
  // CHAT removed as requested
  OPTIONS: 'nenya-options',

  // Submenu Parents
  TOOLS_PARENT: 'nenya-tools-parent',
  APPEARANCE_PARENT: 'nenya-appearance-parent',
  DEVELOPER_PARENT: 'nenya-developer-parent',

  // Tools
  EMOJI_PICKER: 'nenya-emoji-picker',
  TAKE_SCREENSHOT: 'nenya-take-screenshot',
  SCREEN_RECORDING: 'nenya-screen-recording',
  CUSTOM_FILTER: 'nenya-custom-filter',
  AUTO_RELOAD: 'nenya-auto-reload',
  DOWNLOAD_MARKDOWN: 'nenya-download-markdown',

  // Appearance
  BRIGHT_MODE: 'nenya-bright-mode',
  DARK_MODE: 'nenya-dark-mode',

  // Developer
  CUSTOM_CODE_OPTIONS: 'nenya-custom-code-options',
  IMPORT_RULE: 'nenya-import-rule',
};

// Deprecated export for backward compatibility during migration
export const OTHER_MENU_IDS = {
  TAKE_SCREENSHOT: NENYA_MENU_IDS.TAKE_SCREENSHOT,
};

/**
 * Dynamic menu ID prefixes
 */
export const DYNAMIC_PREFIXES = {
  LLM_PROVIDER: 'send-to-llm-',
  RUN_CODE: 'run-code-',
};

/**
 * Storage key for custom JS/CSS injection rules
 */
const CUSTOM_CODE_STORAGE_KEY = 'customCodeRules';

/**
 * Storage key for "Run code in page" rules (manually triggered)
 */
const RUN_CODE_IN_PAGE_STORAGE_KEY = 'runCodeInPageRules';



// ============================================================================
// CONTEXT MENU CREATION
// ============================================================================

/**
 * Create a context menu item with error handling.
 * @param {chrome.contextMenus.CreateProperties} props
 * @returns {Promise<void>}
 */
function createMenuItem(props) {
  return new Promise((resolve) => {
    chrome.contextMenus.create(props, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn(
          `[contextMenu] Failed to create "${props.id}":`,
          error.message,
        );
      }
      resolve();
    });
  });
}

/**
 * Remove all dynamic menu items matching a prefix.
 * @param {string} prefix - The ID prefix to match
 * @returns {Promise<void>}
 */
async function removeDynamicMenuItems(prefix) {
  // Chrome doesn't provide a way to list existing menu items,
  // so we track them separately or just recreate all menus
}

/**
 * Create the Copy submenu with all copy format options.
 * @returns {Promise<void>}
 */
async function createCopyMenu() {
  const contexts = /** @type {any} */ (['page', 'frame', 'selection', 'editable', 'link', 'image']);

  await createMenuItem({
    id: PARENT_MENU_IDS.COPY,
    title: '📋 Copy',
    contexts,
  });

  await createMenuItem({
    id: COPY_MENU_IDS.TITLE,
    parentId: PARENT_MENU_IDS.COPY,
    title: '🔤 Title',
    contexts,
  });

  await createMenuItem({
    id: COPY_MENU_IDS.TITLE_URL,
    parentId: PARENT_MENU_IDS.COPY,
    title: '🔤 Title\\nURL',
    contexts,
  });

  await createMenuItem({
    id: COPY_MENU_IDS.TITLE_DASH_URL,
    parentId: PARENT_MENU_IDS.COPY,
    title: '🔤 Title - URL',
    contexts,
  });

  await createMenuItem({
    id: COPY_MENU_IDS.MARKDOWN_LINK,
    parentId: PARENT_MENU_IDS.COPY,
    title: 'Ⓜ️ [Title](URL)',
    contexts,
  });

  await createMenuItem({
    id: COPY_MENU_IDS.SCREENSHOT,
    parentId: PARENT_MENU_IDS.COPY,
    title: '📸 Screenshot',
    contexts,
  });
}

/**
 * Create the Raindrop submenu with all save/project options.
 * @returns {Promise<void>}
 */
async function createRaindropMenu() {
  const pageContexts = /** @type {any} */ (['page', 'frame', 'selection', 'editable', 'image']);
  const allContexts = /** @type {any} */ ([
    'page',
    'frame',
    'selection',
    'editable',
    'image',
    'link',
  ]);

  await createMenuItem({
    id: PARENT_MENU_IDS.RAINDROP,
    title: '💧 Raindrop',
    contexts: allContexts,
  });

  await createMenuItem({
    id: RAINDROP_MENU_IDS.SAVE_PAGE,
    parentId: PARENT_MENU_IDS.RAINDROP,
    title: '💾 Save current page to unsorted',
    contexts: pageContexts,
  });

  await createMenuItem({
    id: RAINDROP_MENU_IDS.SAVE_LINK,
    parentId: PARENT_MENU_IDS.RAINDROP,
    title: '💾 Save link to unsorted',
    contexts: ['link'],
  });

  await createMenuItem({
    id: RAINDROP_MENU_IDS.SAVE_CLIPBOARD,
    parentId: PARENT_MENU_IDS.RAINDROP,
    title: '🔗 Save link in clipboard to unsorted',
    contexts: allContexts,
  });

  await createMenuItem({
    id: RAINDROP_MENU_IDS.ENCRYPT_SAVE,
    parentId: PARENT_MENU_IDS.RAINDROP,
    title: '🔐 Encrypt && save to unsorted',
    contexts: allContexts,
  });

  // Separator
  await createMenuItem({
    id: 'nenya-raindrop-separator-1',
    parentId: PARENT_MENU_IDS.RAINDROP,
    type: 'separator',
    contexts: allContexts,
  });

  // No project items needed


}

/**
 * Create the Send to LLM submenu with all providers.
 * @returns {Promise<void>}
 */
async function createSendToLLMMenu() {
  await createMenuItem({
    id: PARENT_MENU_IDS.SEND_TO_LLM,
    title: '🤖 Send to LLM',
    contexts: ['page'],
  });

  for (const providerId in LLM_PROVIDER_META) {
    const provider = LLM_PROVIDER_META[providerId];
    await createMenuItem({
      id: `${DYNAMIC_PREFIXES.LLM_PROVIDER}${providerId}`,
      parentId: PARENT_MENU_IDS.SEND_TO_LLM,
      title: provider.name,
      contexts: ['page'],
    });
  }
}

/**
 * Create the Run Code submenu (initially hidden, shown when matching rules exist).
 * @returns {Promise<void>}
 */
async function createRunCodeMenu() {
  await createMenuItem({
    id: PARENT_MENU_IDS.RUN_CODE,
    title: '🚀 Run code',
    contexts: ['page'],
    visible: false, // Initially hidden
  });
}

/**
 * Create root-level "Nenya" menus: Tools, Appearance, and Developer.
 * @returns {Promise<void>}
 */
async function createRootMenus() {
  const contexts = ['page', 'selection', 'link', 'editable', 'image', 'video', 'audio'];

  // --- Tools Submenu (Root Level) ---
  await createMenuItem({
    id: NENYA_MENU_IDS.TOOLS_PARENT,
    // No parentId -> Root level
    title: '🛠️ Tools',
    contexts: contexts,
  });


  await createMenuItem({
    id: NENYA_MENU_IDS.EMOJI_PICKER,
    parentId: NENYA_MENU_IDS.TOOLS_PARENT,
    title: '😀 Emoji Picker',
    contexts: contexts,
  });

  await createMenuItem({
    id: NENYA_MENU_IDS.TAKE_SCREENSHOT,
    parentId: NENYA_MENU_IDS.TOOLS_PARENT,
    title: '📸 Take screenshot',
    contexts: contexts,
  });

  await createMenuItem({
    id: NENYA_MENU_IDS.SCREEN_RECORDING,
    parentId: NENYA_MENU_IDS.TOOLS_PARENT,
    title: '⏺️ Screen recording',
    contexts: contexts,
  });

  await createMenuItem({
    id: NENYA_MENU_IDS.CUSTOM_FILTER,
    parentId: NENYA_MENU_IDS.TOOLS_PARENT,
    title: '⚡️ Hide elements',
    contexts: contexts,
  });

  await createMenuItem({
    id: NENYA_MENU_IDS.AUTO_RELOAD,
    parentId: NENYA_MENU_IDS.TOOLS_PARENT,
    title: '🔁 Auto reload',
    contexts: contexts,
  });

  await createMenuItem({
    id: NENYA_MENU_IDS.DOWNLOAD_MARKDOWN,
    parentId: NENYA_MENU_IDS.TOOLS_PARENT,
    title: '📥 Download as markdown',
    contexts: ['page', 'frame', 'selection', 'editable', 'image'],
  });

  // --- Appearance Submenu (Root Level) ---
  await createMenuItem({
    id: NENYA_MENU_IDS.APPEARANCE_PARENT,
    // No parentId -> Root level
    title: '🎨 Appearance',
    contexts: contexts,
  });

  await createMenuItem({
    id: NENYA_MENU_IDS.BRIGHT_MODE,
    parentId: NENYA_MENU_IDS.APPEARANCE_PARENT,
    title: '🔆 Bright mode',
    contexts: contexts,
  });

  await createMenuItem({
    id: NENYA_MENU_IDS.DARK_MODE,
    parentId: NENYA_MENU_IDS.APPEARANCE_PARENT,
    title: '🌘 Dark mode',
    contexts: contexts,
  });

  // --- Developer Submenu (Root Level) ---
  await createMenuItem({
    id: NENYA_MENU_IDS.DEVELOPER_PARENT,
    // No parentId -> Root level
    title: '💻 Developer',
    contexts: contexts,
  });

  await createMenuItem({
    id: NENYA_MENU_IDS.CUSTOM_CODE_OPTIONS,
    parentId: NENYA_MENU_IDS.DEVELOPER_PARENT,
    title: '📑 Inject JS/CSS',
    contexts: contexts,
  });

  // Note: Import Rule is omitted as file input is difficult from context menu
  // Users can use the popup or options page for that

  // Separator
  await createMenuItem({
    id: 'nenya-separator-options',
    // No parentId -> Root level
    type: 'separator',
    contexts: contexts,
  });

  // Options (Root Level)
  await createMenuItem({
    id: NENYA_MENU_IDS.OPTIONS,
    // No parentId -> Root level
    title: '⚙️ Options',
    contexts: contexts,
  });
}

// ============================================================================
// DYNAMIC MENU UPDATES
// ============================================================================



/**
 * Get "Run code in page" rules from storage.
 * These are manually triggered code snippets that appear in the context menu.
 * @returns {Promise<Array<{id: string, title?: string, patterns: string[], code: string, disabled?: boolean}>>}
 */
async function getRunCodeInPageRules() {
  try {
    const result = await chrome.storage.local.get(RUN_CODE_IN_PAGE_STORAGE_KEY);
    const rules = result[RUN_CODE_IN_PAGE_STORAGE_KEY];
    return Array.isArray(rules) ? rules : [];
  } catch (error) {
    console.warn('[contextMenu] Failed to get run code rules:', error);
    return [];
  }
}

/**
 * Check if a URL matches a pattern using URLPattern.
 * @param {string} url - The URL to check
 * @param {string} pattern - The URL pattern string
 * @returns {boolean}
 */
function urlMatchesPattern(url, pattern) {
  if (!url || !pattern) {
    return false;
  }

  if (typeof URLPattern !== 'undefined') {
    try {
      const urlPattern = new URLPattern(pattern);
      return urlPattern.test(url);
    } catch (error) {
      // Fall back to simple string matching for invalid patterns
    }
  }

  try {
    return url.includes(pattern) || new RegExp(pattern).test(url);
  } catch {
    return false;
  }
}

/**
 * Check if a URL matches any of the given patterns.
 * @param {string} url - The URL to check
 * @param {string[]} patterns - Array of URL patterns
 * @returns {boolean}
 */
function urlMatchesAnyPattern(url, patterns) {
  if (!url || !Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => urlMatchesPattern(url, pattern));
}

/**
 * Get matching "Run code in page" rules for a URL.
 * @param {string} url - The current page URL
 * @returns {Promise<Array<{id: string, title?: string, patterns: string[], code: string}>>}
 */
async function getMatchingCodeRules(url) {
  const rules = await getRunCodeInPageRules();

  return rules.filter((rule) => {
    if (rule.disabled) {
      return false;
    }
    // Rule must have code to be useful
    if (!rule.code || !rule.code.trim()) {
      return false;
    }
    // Check if URL matches any of the rule's patterns
    return urlMatchesAnyPattern(url, rule.patterns);
  });
}



/**
 * Update Run Code submenu based on matching rules for current URL.
 * @param {string} url - The current page URL
 * @returns {Promise<void>}
 */
export async function updateRunCodeSubmenu(url) {
  if (!chrome.contextMenus) {
    return;
  }

  // Get all rules first to know which menu items might exist
  const allRules = await getRunCodeInPageRules();
  const matchingRules = await getMatchingCodeRules(url);

  // Remove existing code menu items by their actual rule IDs
  for (const rule of allRules) {
    if (rule.id) {
      try {
        await new Promise((resolve) => {
          chrome.contextMenus.remove(
            `${DYNAMIC_PREFIXES.RUN_CODE}${rule.id}`,
            () => {
              chrome.runtime.lastError; // Clear error
              resolve(undefined);
            },
          );
        });
      } catch {
        // Ignore errors for non-existent items
      }
    }
  }

  // Remove empty placeholder
  try {
    await new Promise((resolve) => {
      chrome.contextMenus.remove(`${DYNAMIC_PREFIXES.RUN_CODE}empty`, () => {
        chrome.runtime.lastError;
        resolve(undefined);
      });
    });
  } catch {
    // Ignore
  }

  if (matchingRules.length === 0) {
    // Hide the Run Code menu when no matching rules
    try {
      await chrome.contextMenus.update(PARENT_MENU_IDS.RUN_CODE, {
        visible: false,
      });
    } catch (error) {
      console.warn('[contextMenu] Failed to hide Run Code menu:', error);
    }
    return;
  }

  // Show the Run Code menu and add matching rules
  try {
    await chrome.contextMenus.update(PARENT_MENU_IDS.RUN_CODE, {
      visible: true,
    });
  } catch (error) {
    console.warn('[contextMenu] Failed to show Run Code menu:', error);
  }

  for (let i = 0; i < matchingRules.length; i++) {
    const rule = matchingRules[i];
    // Use rule title if available, fall back to pattern
    const ruleTitle =
      typeof rule.title === 'string' && rule.title.trim()
        ? rule.title.trim()
        : rule.patterns[0] || '';
    // Truncate if too long
    const title =
      ruleTitle.length > 40 ? ruleTitle.substring(0, 37) + '...' : ruleTitle;

    await createMenuItem({
      id: `${DYNAMIC_PREFIXES.RUN_CODE}${rule.id}`,
      parentId: PARENT_MENU_IDS.RUN_CODE,
      title: title,
      contexts: ['page'],
    });
  }
}

/**
 * Update screenshot menu visibility based on tab selection.
 * @param {boolean} hasMultipleTabs - Whether multiple tabs are selected
 * @returns {Promise<void>}
 */
export async function updateScreenshotMenuVisibility(hasMultipleTabs) {
  if (!chrome.contextMenus) {
    return;
  }

  try {
    await chrome.contextMenus.update(COPY_MENU_IDS.SCREENSHOT, {
      visible: !hasMultipleTabs,
    });
  } catch (error) {
    console.warn(
      '[contextMenu] Failed to update screenshot visibility:',
      error,
    );
  }
}

// ============================================================================
// MAIN SETUP
// ============================================================================

/**
 * Set up all context menus.
 * @returns {Promise<void>}
 */
export async function setupContextMenus() {
  if (!chrome.contextMenus) {
    console.warn('[contextMenu] Context menus API not available');
    return;
  }

  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(async () => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn(
          '[contextMenu] Failed to clear existing items:',
          error.message,
        );
      }

      try {
        // Create all menu groups in order
        await createCopyMenu();
        await createRaindropMenu();
        await createSendToLLMMenu();
        await createRunCodeMenu();
        await createRootMenus();



        console.log('[contextMenu] All context menus created successfully');
      } catch (setupError) {
        console.error('[contextMenu] Failed to setup menus:', setupError);
      }

      resolve();
    });
  });
}

/**
 * Refresh context menus when underlying data changes.
 * @returns {Promise<void>}
 */
export async function refreshContextMenus() {
  await setupContextMenus();
}

// ============================================================================
// CLICK HANDLER HELPERS
// ============================================================================

/**
 * Check if a menu item ID is a copy menu item.
 * @param {string} menuItemId
 * @returns {boolean}
 */
export function isCopyMenuItem(menuItemId) {
  return Object.values(COPY_MENU_IDS).includes(menuItemId);
}

/**
 * Check if a menu item ID is a Raindrop menu item.
 * @param {string} menuItemId
 * @returns {boolean}
 */
export function isRaindropMenuItem(menuItemId) {
  return Object.values(RAINDROP_MENU_IDS).includes(menuItemId);
}



/**
 * Check if a menu item ID is a Run Code menu item.
 * @param {string} menuItemId
 * @returns {{ ruleId: string } | null}
 */
export function parseRunCodeMenuItem(menuItemId) {
  if (typeof menuItemId !== 'string') {
    return null;
  }

  if (menuItemId.startsWith(DYNAMIC_PREFIXES.RUN_CODE)) {
    const ruleId = menuItemId.replace(DYNAMIC_PREFIXES.RUN_CODE, '');
    if (ruleId && ruleId !== 'empty') {
      return { ruleId };
    }
  }

  return null;
}

/**
 * Check if a menu item ID is a Send to LLM menu item.
 * @param {string} menuItemId
 * @returns {{ providerId: string } | null}
 */
export function parseLLMMenuItem(menuItemId) {
  if (typeof menuItemId !== 'string') {
    return null;
  }

  if (menuItemId.startsWith(DYNAMIC_PREFIXES.LLM_PROVIDER)) {
    const providerId = menuItemId.replace(DYNAMIC_PREFIXES.LLM_PROVIDER, '');
    if (providerId && LLM_PROVIDER_META[providerId]) {
      return { providerId };
    }
  }

  return null;
}

/**
 * Get the copy format type from a menu item ID.
 * @param {string} menuItemId
 * @returns {'title' | 'title-url' | 'title-dash-url' | 'markdown-link' | 'screenshot' | null}
 */
export function getCopyFormatType(menuItemId) {
  switch (menuItemId) {
    case COPY_MENU_IDS.TITLE:
      return 'title';
    case COPY_MENU_IDS.TITLE_URL:
      return 'title-url';
    case COPY_MENU_IDS.TITLE_DASH_URL:
      return 'title-dash-url';
    case COPY_MENU_IDS.MARKDOWN_LINK:
      return 'markdown-link';
    case COPY_MENU_IDS.SCREENSHOT:
      return 'screenshot';
    default:
      return null;
  }
}
