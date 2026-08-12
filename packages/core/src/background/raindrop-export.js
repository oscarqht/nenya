/* global chrome */

/**
 * @fileoverview Raindrop Export to Local Bookmarks
 * Exports Raindrop items to a local Chrome bookmark folder
 */

import { getValidTokens } from '../shared/tokenRefresh.js';

const RAINDROP_EXPORT_ENDPOINT = 'https://api.raindrop.io/rest/v1/raindrops/0/export.html';
const RAINDROP_FOLDER_NAME = 'Raindrop';
const RAINDROP_EXPORT_ALARM_NAME = 'raindrop-export-to-bookmarks';
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;
const EXPORT_INTERVAL_MINUTES = 60;
const EXPORT_DELAY_MINUTES = 1;

/**
 * @typedef {Object} RaindropItem
 * @property {string} title
 * @property {string} url
 * @property {string} [description]
 * @property {number} [addDate]
 * @property {number} [lastModified]
 * @property {string} [tags]
 */

/**
 * State to track if an export is currently running
 */
let isExportRunning = false;

// Regex patterns moved outside the loop to avoid re-compilation
const HREF_PATTERN = /HREF="([^"]+)"/i;
const ADD_DATE_PATTERN = /ADD_DATE="([^"]+)"/i;
const LAST_MODIFIED_PATTERN = /LAST_MODIFIED="([^"]+)"/i;
const TAGS_PATTERN = /TAGS="([^"]*)"/i;
// Check for description in the following DD element
const DD_PATTERN = /^\s*<DD>([^<]*(?:<[^D][^>]*>[^<]*)*?)<\/?\s*(?=<DT|$)/i;
const HTML_TAGS_PATTERN = /<[^>]+>/g;

/**
 * Export Raindrop items by calling the export endpoint and parsing the HTML response.
 * @returns {Promise<RaindropItem[]>}
 */
export async function exportRaindropItems() {
  const tokenResult = await getValidTokens('raindrop');
  
  if (!tokenResult.tokens) {
    throw new Error(tokenResult.error || 'No Raindrop connection found');
  }

  const response = await fetch(RAINDROP_EXPORT_ENDPOINT, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + tokenResult.tokens.accessToken,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export Raindrop items: ' + response.status);
  }

  const html = await response.text();
  return parseRaindropExportHtml(html);
}

/**
 * Parse the Raindrop export HTML format (Netscape bookmark format).
 * Uses regex since DOMParser is not available in service workers.
 * @param {string} html
 * @returns {RaindropItem[]}
 */
function parseRaindropExportHtml(html) {
  const items = [];

  // Regex to match <DT><A ...>title</A> patterns
  // Captures the attributes and title separately
  const linkPattern = /<DT><A\s+([^>]+)>([^<]+)<\/A>/gi;
  
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const attributes = match[1];
    const title = match[2].trim();
    
    // Extract HREF attribute
    const hrefMatch = HREF_PATTERN.exec(attributes);
    if (!hrefMatch) {
      continue; // Skip if no URL
    }
    const url = hrefMatch[1];
    
    if (!url || !title) {
      continue; // Skip invalid entries
    }

    const item = {
      title,
      url,
    };

    // Extract optional attributes
    const addDateMatch = ADD_DATE_PATTERN.exec(attributes);
    if (addDateMatch) {
      item.addDate = parseInt(addDateMatch[1], 10) * 1000; // Convert to milliseconds
    }

    const lastModifiedMatch = LAST_MODIFIED_PATTERN.exec(attributes);
    if (lastModifiedMatch) {
      item.lastModified = parseInt(lastModifiedMatch[1], 10) * 1000;
    }

    const tagsMatch = TAGS_PATTERN.exec(attributes);
    if (tagsMatch) {
      item.tags = tagsMatch[1];
    }

    // Check for description in the following DD element
    // Get position after the closing </A> tag
    const afterLink = html.substring(linkPattern.lastIndex);
    const ddMatch = DD_PATTERN.exec(afterLink);
    if (ddMatch) {
      const description = ddMatch[1]
        .replace(HTML_TAGS_PATTERN, '') // Remove any HTML tags
        .trim();
      if (description) {
        item.description = description;
      }
    }

    items.push(item);
  }

  console.log(`[raindrop-export] Parsed ${items.length} items from export`);
  return items;
}

/**
 * Ensure the "Raindrop" bookmark folder exists at the root level.
 * Returns the folder ID.
 * @returns {Promise<string>}
 */
async function ensureRaindropFolder() {
  // Search for existing "Raindrop" folder
  const bookmarks = await chrome.bookmarks.getTree();
  const rootNodes = bookmarks[0].children || [];

  // Check "Bookmarks Bar" and "Other Bookmarks"
  for (const rootNode of rootNodes) {
    if (!rootNode.children) continue;
    
    for (const child of rootNode.children) {
      if (child.title === RAINDROP_FOLDER_NAME && !child.url) {
        console.log(`[raindrop-export] Found existing folder: ${child.id}`);
        return child.id;
      }
    }
  }

  // Create the folder in "Other Bookmarks" (typically id='2')
  const otherBookmarks = rootNodes.find(node => node.id === '2') || rootNodes[0];
  const folder = await chrome.bookmarks.create({
    parentId: otherBookmarks.id,
    title: RAINDROP_FOLDER_NAME,
  });

  console.log(`[raindrop-export] Created new folder: ${folder.id}`);
  return folder.id;
}

/**
 * Delete all bookmarks inside the "Raindrop" folder.
 * @param {string} folderId
 * @returns {Promise<void>}
 */
async function clearRaindropFolder(folderId) {
  const children = await chrome.bookmarks.getChildren(folderId);
  
  console.log(`[raindrop-export] Clearing ${children.length} bookmarks from folder`);
  
  // Delete all children concurrently
  await Promise.all(children.map(child => chrome.bookmarks.removeTree(child.id)));
}

/**
 * Check if a URL should be ignored.
 * @param {string} url
 * @returns {boolean}
 */
function shouldIgnoreUrl(url) {
  if (!url) return true;
  return (
    url.includes('nenya.local') ||
    url.includes('api.raindrop.io') ||
    url.includes('up.raindrop.io')
  );
}

/**
 * Delay execution for a specified number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Export Raindrop items to the local bookmark folder.
 * This is the main function that orchestrates the entire export process.
 * @returns {Promise<{success: boolean, message: string, count?: number}>}
 */
export async function exportRaindropItemsToBookmarks() {
  // Check if an export is already running
  if (isExportRunning) {
    console.log('[raindrop-export] Export already in progress, skipping');
    return {
      success: false,
      message: 'Export already in progress',
    };
  }

  isExportRunning = true;

  try {
    console.log('[raindrop-export] Starting export to bookmarks');

    // 1. Ensure the "Raindrop" folder exists
    const folderId = await ensureRaindropFolder();

    // 2. Clear all existing bookmarks in the folder
    await clearRaindropFolder(folderId);

    // 3. Export Raindrop items
    const rawItems = await exportRaindropItems();

    // Filter items based on URL patterns
    const items = rawItems.filter(item => !shouldIgnoreUrl(item.url));

    // 4. Create bookmarks for each item (batched)
    console.log(`[raindrop-export] Creating ${items.length} bookmarks (filtered from ${rawItems.length})`);
    
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      console.log(`[raindrop-export] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)`);

      const promises = batch.map(item =>
        chrome.bookmarks.create({
          parentId: folderId,
          title: item.title,
          url: item.url,
        }).catch(err => console.warn(`[raindrop-export] Failed to create bookmark for ${item.url}:`, err))
      );

      await Promise.all(promises);

      if (i + BATCH_SIZE < items.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    console.log('[raindrop-export] Export completed successfully');
    
    return {
      success: true,
      message: `Successfully exported ${items.length} items to bookmarks`,
      count: items.length,
    };
  } catch (error) {
    console.error('[raindrop-export] Export failed:', error);
    
    return {
      success: false,
      message: error.message || 'Failed to export Raindrop items',
    };
  } finally {
    isExportRunning = false;
  }
}

/**
 * Set up the hourly alarm to export Raindrop items to bookmarks.
 * @returns {Promise<void>}
 */
export async function setupRaindropExportAlarm() {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    console.warn('[raindrop-export] chrome.alarms API not available');
    return;
  }

  // Clear any existing alarm first
  await chrome.alarms.clear(RAINDROP_EXPORT_ALARM_NAME);

  // Create a new alarm that runs every hour
  chrome.alarms.create(RAINDROP_EXPORT_ALARM_NAME, {
    periodInMinutes: EXPORT_INTERVAL_MINUTES,
    delayInMinutes: EXPORT_DELAY_MINUTES,
  });

  console.log('[raindrop-export] Hourly export alarm set up');
}

/**
 * Clear the Raindrop export alarm.
 * @returns {Promise<void>}
 */
export async function clearRaindropExportAlarm() {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    return;
  }

  await chrome.alarms.clear(RAINDROP_EXPORT_ALARM_NAME);
  console.log('[raindrop-export] Export alarm cleared');
}

/**
 * Handle alarm events for Raindrop export.
 * @param {chrome.alarms.Alarm} alarm
 */
export async function handleRaindropExportAlarm(alarm) {
  if (alarm.name !== RAINDROP_EXPORT_ALARM_NAME) {
    return;
  }

  console.log('[raindrop-export] Alarm triggered, starting export');
  const result = await exportRaindropItemsToBookmarks();
  
  if (result.success) {
    console.log(`[raindrop-export] ${result.message}`);
  } else {
    console.error(`[raindrop-export] ${result.message}`);
  }
}

/**
 * Initialize the Raindrop export feature.
 * Sets up the alarm and listens for alarm events.
 */
export function initRaindropExport() {
  // Set up the alarm
  void setupRaindropExportAlarm();

  // Listen for alarm events
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    chrome.alarms.onAlarm.addListener((alarm) => {
      void handleRaindropExportAlarm(alarm);
    });
  }

  console.log('[raindrop-export] Raindrop export feature initialized');
}
