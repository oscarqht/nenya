/**
 * Clipboard context menu functionality for copying tab data.
 */

import {
  setActionBadge,
} from './mirror.js';

/**
 * @deprecated Use COPY_MENU_IDS from shared/contextMenus.js instead.
 * Context menu IDs for clipboard operations (kept for backwards compatibility).
 */
export const CLIPBOARD_CONTEXT_MENU_IDS = {
  COPY_TITLE: 'nenya-copy-title',
  COPY_TITLE_URL: 'nenya-copy-title-url',
  COPY_TITLE_DASH_URL: 'nenya-copy-title-dash-url',
  COPY_MARKDOWN_LINK: 'nenya-copy-markdown-link',
  COPY_SCREENSHOT: 'nenya-copy-screenshot',
};

export function setCopySuccessBadge() {
  try {
    setActionBadge('📋', '#00FF00', 2000);
  } catch (error) {
    console.warn('[clipboard] Failed to set success badge:', error);
  }
}

export function setCopyFailureBadge() {
  try {
    setActionBadge('❌', '#ffffff', 2000);
  } catch (error) {
    console.warn('[clipboard] Failed to set failure badge:', error);
  }
}

/**
 * Copy text to clipboard using Chrome extension API.
 * @param {string} text - The text to copy to clipboard.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
async function copyToClipboard(text) {
  try {
    // Inject script into active tab to use navigator.clipboard
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0] && typeof tabs[0].id === 'number') {
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (textToCopy) => {
          navigator.clipboard.writeText(textToCopy);
        },
        args: [text],
      });
      return true;
    }

    return false;
  } catch (error) {
    console.warn('[clipboard] Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Capture a screenshot of the specified tab.
 * @param {number} tabId - The ID of the tab to capture.
 * @returns {Promise<string|null>} - The data URL of the screenshot, or null if failed.
 */
async function captureTabScreenshot(tabId) {
  try {
    // Get the window ID for the tab
    const tab = await chrome.tabs.get(tabId);
    const windowId = tab.windowId;

    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: 'png',
      quality: 100,
    });
    return dataUrl;
  } catch (error) {
    console.warn('[clipboard] Failed to capture screenshot:', error);
    return null;
  }
}

/**
 * Get tab data for clipboard operations.
 * @param {chrome.tabs.Tab[]} tabs - Array of tabs to process.
 * @returns {Promise<Array<{title: string, url: string}>>} - Array of tab data.
 */
async function getTabData(tabs) {
  const validTabs = tabs.filter(
    (tab) => tab && typeof tab.url === 'string' && tab.url.startsWith('http'),
  );

  const tabData = await Promise.all(
    validTabs.map(async (tab) => {
      return {
        title: typeof tab.title === 'string' ? tab.title : '',
        url: tab.url,
      };
    }),
  );

  return tabData;
}

/**
 * Format tab data as titles only.
 * @param {Array<{title: string, url: string}>} tabData - Array of tab data.
 * @returns {string} - Formatted text.
 */
function formatTitle(tabData) {
  return tabData.map((tab) => tab.title).join('\n');
}

/**
 * Format tab data as "Title\nURL".
 * @param {Array<{title: string, url: string}>} tabData - Array of tab data.
 * @returns {string} - Formatted text.
 */
function formatTitleUrl(tabData) {
  return tabData.map((tab) => `${tab.title}\n${tab.url}`).join('\n\n');
}

/**
 * Format tab data as "Title - URL".
 * @param {Array<{title: string, url: string}>} tabData - Array of tab data.
 * @returns {string} - Formatted text.
 */
function formatTitleDashUrl(tabData) {
  return tabData.map((tab) => `${tab.title} - ${tab.url}`).join('\n');
}

/**
 * Format tab data as markdown links "[Title](URL)".
 * @param {Array<{title: string, url: string}>} tabData - Array of tab data.
 * @returns {string} - Formatted text.
 */
function formatMarkdownLink(tabData) {
  return tabData.map((tab) => `[${tab.title}](${tab.url})`).join('\n');
}

/**
 * Handle clipboard copy operations for multiple tabs.
 * @param {string} formatType - The format type to use.
 * @param {chrome.tabs.Tab[]} tabs - Array of tabs to process.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function handleMultiTabCopy(formatType, tabs) {
  const tabData = await getTabData(tabs);

  if (tabData.length === 0) {
    return false;
  }

  let formattedText = '';

  switch (formatType) {
    case 'title':
      formattedText = formatTitle(tabData);
      break;
    case 'title-url':
      formattedText = formatTitleUrl(tabData);
      break;
    case 'title-dash-url':
      formattedText = formatTitleDashUrl(tabData);
      break;
    case 'markdown-link':
      formattedText = formatMarkdownLink(tabData);
      break;
    default:
      return false;
  }

  return await copyToClipboard(formattedText);
}

/**
 * Check if a URL is an extension or system page that can't have scripts injected.
 * @param {string} url - The URL to check.
 * @returns {boolean} - True if the URL is an extension/system page.
 */
function isExtensionOrSystemPage(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return (
    url.startsWith('chrome-extension://') ||
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('moz-extension://')
  );
}

/**
 * Find a regular tab in the same window that can have scripts injected.
 * @param {number} windowId - The window ID.
 * @param {number} excludeTabId - Tab ID to exclude.
 * @returns {Promise<number|null>} - Tab ID if found, null otherwise.
 */
async function findInjectableTab(windowId, excludeTabId) {
  try {
    const tabs = await chrome.tabs.query({ windowId });
    for (const tab of tabs) {
      if (
        tab.id &&
        tab.id !== excludeTabId &&
        tab.url &&
        !isExtensionOrSystemPage(tab.url)
      ) {
        return tab.id;
      }
    }
    return null;
  } catch (error) {
    console.warn('[clipboard] Failed to find injectable tab:', error);
    return null;
  }
}

/**
 * Copy image to clipboard by injecting script into a tab.
 * @param {number} tabId - The tab ID to inject into.
 * @param {string} dataUrl - The data URL of the image.
 * @param {number} [originalTabId] - Optional original tab ID to restore focus to after copying.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
async function copyImageViaTab(tabId, dataUrl, originalTabId) {
  try {
    // Focus the tab first - clipboard API requires document focus
    await chrome.tabs.update(tabId, { active: true });

    // Get the window ID and focus it
    const tab = await chrome.tabs.get(tabId);
    if (tab?.windowId && chrome.windows?.update) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }

    // Wait a bit for the tab to be focused
    await new Promise((resolve) => setTimeout(resolve, 100));

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (dataUrlToCopy) => {
        return new Promise((resolve) => {
          try {
            // Ensure window is focused
            window.focus();

            // Convert data URL to blob
            const byteString = atob(dataUrlToCopy.split(',')[1]);
            const mimeString = dataUrlToCopy
              .split(',')[0]
              .split(':')[1]
              .split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });

            // Write to clipboard
            navigator.clipboard
              .write([
                new ClipboardItem({
                  [blob.type]: blob,
                }),
              ])
              .then(() => {
                resolve({ success: true });
              })
              .catch((error) => {
                console.error('[clipboard] Clipboard write failed:', error);
                resolve({ success: false, error: error.message });
              });
          } catch (error) {
            console.error('[clipboard] Blob conversion failed:', error);
            resolve({ success: false, error: error.message });
          }
        });
      },
      args: [dataUrl],
    });

    // Check if the clipboard operation succeeded
    let success = false;
    if (results && results[0] && results[0].result) {
      const result = results[0].result;
      if (result.success) {
        success = true;
      } else {
        const errorMsg = 'error' in result ? result.error : 'Unknown error';
        console.warn('[clipboard] Clipboard operation failed:', errorMsg);
      }
    }

    // Restore focus to original tab if we switched tabs
    if (
      typeof originalTabId === 'number' &&
      originalTabId !== tabId &&
      success
    ) {
      try {
        await chrome.tabs.update(originalTabId, { active: true });
      } catch (error) {
        console.warn(
          '[clipboard] Failed to restore focus to original tab:',
          error,
        );
      }
    }

    return success;
  } catch (error) {
    console.warn('[clipboard] Failed to copy image via tab:', error);
    return false;
  }
}

/**
 * Handle screenshot capture for a single tab.
 * @param {number} tabId - The ID of the tab to capture.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function handleScreenshotCopy(tabId) {
  const dataUrl = await captureTabScreenshot(tabId);

  if (!dataUrl) {
    return false;
  }

  try {
    // Save to storage
    await chrome.storage.local.set({ editorScreenshot: dataUrl });

    // Open editor
    await chrome.tabs.create({ url: 'src/editor/editor.html' });

    return true;
  } catch (error) {
    console.warn('[clipboard] Failed to open screenshot editor:', error);
    return false;
  }
}

// ============================================================================
// FULL PAGE SCREENSHOT
// ============================================================================

/** Minimum delay (ms) between successive chrome.tabs.captureVisibleTab calls. */
const CAPTURE_MIN_INTERVAL_MS = 550;
/** Max retries when Chrome's per-second capture rate limit is hit. */
const CAPTURE_RATE_LIMIT_MAX_RETRIES = 3;
/** Initial backoff (ms) when the capture rate limit is hit; doubles per retry. */
const CAPTURE_RATE_LIMIT_INITIAL_BACKOFF_MS = 500;
/** Chrome/Skia's approximate max canvas dimension (px) on a single side. */
const MAX_CANVAS_DIMENSION_PX = 32000;
/** Chrome/Skia's approximate max canvas area (px^2). */
const MAX_CANVAS_AREA_PX = 250_000_000;
/** Attribute used to mark elements temporarily hidden during capture. */
const HIDDEN_MARKER_ATTR = 'data-nenya-fph-hidden';

/**
 * Read page/viewport metrics needed to plan a full-page capture.
 * @param {number} tabId - The tab to inspect.
 * @returns {Promise<{scrollWidth: number, scrollHeight: number, viewportWidth: number, viewportHeight: number, devicePixelRatio: number, origScrollX: number, origScrollY: number}>}
 */
async function getPageMetrics(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      scrollWidth: Math.max(
        document.documentElement.scrollWidth,
        document.body ? document.body.scrollWidth : 0,
      ),
      scrollHeight: Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0,
      ),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      origScrollX: window.scrollX,
      origScrollY: window.scrollY,
    }),
  });

  const metrics = results && results[0] && results[0].result;
  if (!metrics) {
    throw new Error('Could not read page metrics for this page.');
  }
  return metrics;
}

/**
 * Scroll the page to the given position and wait for it to settle
 * (repaint + a short delay for lazy-loaded content).
 * @param {number} tabId - The tab to scroll.
 * @param {number} x - Target scrollX.
 * @param {number} y - Target scrollY.
 * @returns {Promise<void>}
 */
async function scrollAndSettle(tabId, x, y) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (scrollX, scrollY) =>
      new Promise((resolve) => {
        window.scrollTo(scrollX, scrollY);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 100);
          });
        });
      }),
    args: [x, y],
  });
}

/**
 * Temporarily hide fixed/sticky positioned elements so they don't get
 * duplicated down the stitched image as the page scrolls.
 * @param {number} tabId - The tab to modify.
 * @returns {Promise<void>}
 */
async function hideFixedElements(tabId, markerAttr) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (attr) => {
      const all = document.querySelectorAll('body *');
      for (const el of all) {
        const position = getComputedStyle(el).position;
        if (position === 'fixed' || position === 'sticky') {
          el.setAttribute(attr, '1');
          el.style.setProperty('visibility', 'hidden', 'important');
        }
      }
    },
    args: [markerAttr],
  });
}

/**
 * Restore elements previously hidden by hideFixedElements.
 * @param {number} tabId - The tab to modify.
 * @returns {Promise<void>}
 */
async function restoreFixedElements(tabId, markerAttr) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (attr) => {
      const hidden = document.querySelectorAll(`[${attr}]`);
      for (const el of hidden) {
        el.style.removeProperty('visibility');
        el.removeAttribute(attr);
      }
    },
    args: [markerAttr],
  });
}

/**
 * Capture the visible tab, retrying with backoff if Chrome's per-second
 * capture rate limit is hit.
 * @param {number} windowId - The window to capture.
 * @param {{lastCaptureAt: number}} rateState - Mutable timestamp of the last successful call.
 * @returns {Promise<string>} - The data URL of the capture.
 */
async function captureViewportWithRateLimit(windowId, rateState) {
  const sinceLast = Date.now() - rateState.lastCaptureAt;
  if (sinceLast < CAPTURE_MIN_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, CAPTURE_MIN_INTERVAL_MS - sinceLast),
    );
  }

  let backoff = CAPTURE_RATE_LIMIT_INITIAL_BACKOFF_MS;
  for (let attempt = 0; attempt <= CAPTURE_RATE_LIMIT_MAX_RETRIES; attempt++) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: 'png',
      });
      rateState.lastCaptureAt = Date.now();
      return dataUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit = message.includes(
        'MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND',
      );
      if (!isRateLimit || attempt === CAPTURE_RATE_LIMIT_MAX_RETRIES) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff *= 2;
    }
  }

  throw new Error('Failed to capture viewport after retries.');
}

/**
 * Convert a Blob to a base64 data URL. Service workers have no FileReader,
 * so this base64-encodes the ArrayBuffer manually in chunks.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  const base64 = btoa(binary);
  return `data:${blob.type || 'image/png'};base64,${base64}`;
}

/**
 * Compute the list of scrollY positions (CSS px) needed to tile the full
 * page height, clamping the final tile to the bottom of the page.
 * @param {number} scrollHeight
 * @param {number} viewportHeight
 * @param {number} devicePixelRatio
 * @returns {number[]}
 */
function computeTilePositions(scrollHeight, viewportHeight, devicePixelRatio) {
  if (scrollHeight <= viewportHeight) {
    return [0];
  }

  const roundingMargin = Math.ceil(
    devicePixelRatio >= 1 ? devicePixelRatio : 1 / devicePixelRatio,
  );
  const stepHeight = Math.max(1, viewportHeight - roundingMargin);

  const positions = [];
  let y = 0;
  while (true) {
    if (y + viewportHeight >= scrollHeight) {
      positions.push(Math.max(0, scrollHeight - viewportHeight));
      break;
    }
    positions.push(y);
    y += stepHeight;
  }
  return positions;
}

/**
 * Orchestrate a full-page capture: measure the page, tile-scroll through it
 * capturing and stitching each viewport into one tall PNG, then restore the
 * page's original scroll position and any temporarily hidden elements.
 * @param {number} tabId - The tab to capture.
 * @param {(current: number, total: number) => void} [onProgress] - Optional progress callback.
 * @returns {Promise<string|null>} - The stitched PNG data URL, or null on failure.
 */
async function captureFullPageScreenshot(tabId, onProgress) {
  const tab = await chrome.tabs.get(tabId);
  const windowId = tab.windowId;

  const metrics = await getPageMetrics(tabId);
  const { scrollWidth, scrollHeight, viewportWidth, viewportHeight, devicePixelRatio, origScrollX, origScrollY } =
    metrics;

  const dpr = devicePixelRatio || 1;
  const canvasWidth = Math.round(Math.min(scrollWidth, viewportWidth) * dpr);
  const canvasHeight = Math.round(scrollHeight * dpr);

  if (
    canvasWidth > MAX_CANVAS_DIMENSION_PX ||
    canvasHeight > MAX_CANVAS_DIMENSION_PX ||
    canvasWidth * canvasHeight > MAX_CANVAS_AREA_PX
  ) {
    throw new Error('Page is too long to capture as one image.');
  }

  const positions = computeTilePositions(scrollHeight, viewportHeight, dpr);
  const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  const rateState = { lastCaptureAt: 0 };
  let fixedElementsHidden = false;

  try {
    for (let i = 0; i < positions.length; i++) {
      const y = positions[i];
      await scrollAndSettle(tabId, origScrollX, y);

      const dataUrl = await captureViewportWithRateLimit(windowId, rateState);
      const blob = await (await fetch(dataUrl)).blob();
      const bitmap = await createImageBitmap(blob);
      ctx.drawImage(bitmap, 0, Math.round(y * dpr));
      bitmap.close();

      if (i === 0 && positions.length > 1 && !fixedElementsHidden) {
        await hideFixedElements(tabId, HIDDEN_MARKER_ATTR);
        fixedElementsHidden = true;
      }

      if (typeof onProgress === 'function') {
        onProgress(i + 1, positions.length);
      }
    }
  } finally {
    try {
      if (fixedElementsHidden) {
        await restoreFixedElements(tabId, HIDDEN_MARKER_ATTR);
      }
    } catch (error) {
      console.warn('[clipboard] Failed to restore hidden elements:', error);
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (x, y) => window.scrollTo(x, y),
        args: [origScrollX, origScrollY],
      });
    } catch (error) {
      console.warn('[clipboard] Failed to restore scroll position:', error);
    }
  }

  const finalBlob = await canvas.convertToBlob({ type: 'image/png' });
  return await blobToDataUrl(finalBlob);
}

/**
 * Handle full-page screenshot capture for a single tab: scroll through the
 * whole page, stitch the tiles into one image, and hand it off to the
 * screenshot editor exactly like handleScreenshotCopy.
 * @param {number} tabId - The ID of the tab to capture.
 * @param {(current: number, total: number) => void} [onProgress] - Optional progress callback.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function handleFullPageScreenshotCopy(tabId, onProgress) {
  try {
    const dataUrl = await captureFullPageScreenshot(tabId, onProgress);
    if (!dataUrl) {
      return false;
    }

    await chrome.storage.local.set({ editorScreenshot: dataUrl });
    await chrome.tabs.create({ url: 'src/editor/editor.html' });

    return true;
  } catch (error) {
    console.warn('[clipboard] Failed to capture full page screenshot:', error);
    return false;
  }
}

/**
 * @deprecated Context menus are now created centrally in shared/contextMenus.js
 * This function is kept for backwards compatibility but does nothing.
 * @returns {void}
 */
export function setupClipboardContextMenus() {
  // Context menus are now created centrally in shared/contextMenus.js
  // This function is kept for backwards compatibility
}

/**
 * Handle context menu clicks for clipboard operations.
 * @param {chrome.contextMenus.OnClickData} info - Context menu click information.
 * @param {chrome.tabs.Tab} tab - The tab where the context menu was clicked.
 * @returns {Promise<void>}
 */
export async function handleClipboardContextMenuClick(info, tab) {
  const { menuItemId } = info;

  if (!Object.values(CLIPBOARD_CONTEXT_MENU_IDS).includes(String(menuItemId))) {
    return;
  }

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

    if (menuItemId === CLIPBOARD_CONTEXT_MENU_IDS.COPY_SCREENSHOT) {
      // Screenshot only works with single tab
      if (tabs.length === 1 && typeof tabs[0].id === 'number') {
        success = await handleScreenshotCopy(tabs[0].id);
      }
    } else {
      // Handle text formats
      let formatType = '';
      switch (menuItemId) {
        case CLIPBOARD_CONTEXT_MENU_IDS.COPY_TITLE:
          formatType = 'title';
          break;
        case CLIPBOARD_CONTEXT_MENU_IDS.COPY_TITLE_URL:
          formatType = 'title-url';
          break;
        case CLIPBOARD_CONTEXT_MENU_IDS.COPY_TITLE_DASH_URL:
          formatType = 'title-dash-url';
          break;
        case CLIPBOARD_CONTEXT_MENU_IDS.COPY_MARKDOWN_LINK:
          formatType = 'markdown-link';
          break;
      }

      if (formatType) {
        success = await handleMultiTabCopy(formatType, tabs);
      }
    }

    // Conclude badge animation with success/failure emoji
    if (success) {
      setCopySuccessBadge();
    } else {
      setCopyFailureBadge();
    }

  } catch (error) {
    console.error('[clipboard] Context menu click failed:', error);
    setCopyFailureBadge();
  }
}

/**
 * Handle clipboard commands from keyboard shortcuts.
 * @param {string} command - The command name.
 * @returns {Promise<void>}
 */
export async function handleClipboardCommand(command) {
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

    if (command === 'copy-screenshot') {
      // Screenshot only works with single tab
      if (tabs.length === 1 && typeof tabs[0].id === 'number') {
        success = await handleScreenshotCopy(tabs[0].id);
      } else {
        setCopyFailureBadge();
        return;
      }
    } else if (command === 'copy-full-page-screenshot') {
      // Full page screenshot only works with single tab
      if (tabs.length === 1 && typeof tabs[0].id === 'number') {
        success = await handleFullPageScreenshotCopy(tabs[0].id);
      } else {
        setCopyFailureBadge();
        return;
      }
    } else {
      // Handle text formats
      let formatType = '';
      switch (command) {
        case 'copy-title':
          formatType = 'title';
          break;
        case 'copy-title-url':
          formatType = 'title-url';
          break;
        case 'copy-title-dash-url':
          formatType = 'title-dash-url';
          break;
        case 'copy-markdown-link':
          formatType = 'markdown-link';
          break;
      }

      if (formatType) {
        success = await handleMultiTabCopy(formatType, tabs);
      }
    }

    // Set badge based on result
    if (success) {
      setCopySuccessBadge();
    } else {
      setCopyFailureBadge();
    }
  } catch (error) {
    console.error('[clipboard] Command failed:', error);
    setCopyFailureBadge();
  }
}

/**
 * Update context menu visibility based on tab selection.
 * This function should be called when tab selection changes to hide/show
 * the screenshot option based on whether multiple tabs are selected.
 * @returns {Promise<void>}
 */
export async function updateClipboardContextMenuVisibility() {
  if (!chrome.contextMenus) {
    return;
  }

  try {
    const tabs = await chrome.tabs.query({
      currentWindow: true,
      highlighted: true,
    });
    const hasMultipleTabs = tabs && tabs.length > 1;

    // Update screenshot menu item visibility
    chrome.contextMenus.update(CLIPBOARD_CONTEXT_MENU_IDS.COPY_SCREENSHOT, {
      visible: !hasMultipleTabs,
    });
  } catch (error) {
    console.warn(
      '[clipboard] Failed to update context menu visibility:',
      error,
    );
  }
}
