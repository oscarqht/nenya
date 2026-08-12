/**
 * @fileoverview Shared utilities for managing custom search engines.
 */

/**
 * @typedef {Object} CustomSearchEngine
 * @property {string} id - Unique identifier for the search engine
 * @property {string} name - Display name of the search engine
 * @property {string} shortcut - Short keyword to trigger this search engine
 * @property {string} searchUrl - URL template with %s placeholder for the query
 */

/**
 * Gets all custom search engines from storage.
 * @returns {Promise<CustomSearchEngine[]>}
 */
async function getCustomSearchEngines() {
  const result = await chrome.storage.local.get('customSearchEngines');
  return result.customSearchEngines || [];
}

/**
 * Saves custom search engines to storage.
 * @param {CustomSearchEngine[]} engines
 * @returns {Promise<void>}
 */
async function saveCustomSearchEngines(engines) {
  await chrome.storage.local.set({ customSearchEngines: engines });
}

/**
 * Validates a search engine object.
 * @param {Partial<CustomSearchEngine>} engine
 * @param {CustomSearchEngine[]} existingEngines
 * @param {string} [editingId] - ID of engine being edited (to exclude from duplicate check)
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSearchEngine(engine, existingEngines, editingId) {
  // Validate name
  if (!engine.name || engine.name.trim() === '') {
    return { valid: false, error: 'Name is required' };
  }

  // Validate shortcut
  if (!engine.shortcut || engine.shortcut.trim() === '') {
    return { valid: false, error: 'Shortcut is required' };
  }

  const shortcut = engine.shortcut.trim();
  
  // Check for duplicate shortcut (case-insensitive)
  const duplicate = existingEngines.find(
    (e) =>
      e.shortcut.toLowerCase() === shortcut.toLowerCase() &&
      e.id !== editingId,
  );
  if (duplicate) {
    return { valid: false, error: `Shortcut "${shortcut}" is already used by "${duplicate.name}"` };
  }

  // Validate search URL
  if (!engine.searchUrl || engine.searchUrl.trim() === '') {
    return { valid: false, error: 'Search URL is required' };
  }

  if (!engine.searchUrl.includes('%s')) {
    return { valid: false, error: 'Search URL must contain %s placeholder for the query' };
  }

  return { valid: true };
}

/**
 * Generates a unique ID for a new search engine.
 * @returns {string}
 */
function generateSearchEngineId() {
  return `se-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Normalizes a custom search engine object.
 * @param {Partial<CustomSearchEngine>} engine
 * @returns {CustomSearchEngine}
 */
function normalizeSearchEngine(engine) {
  return {
    id: engine.id || generateSearchEngineId(),
    name: (engine.name || '').trim(),
    shortcut: (engine.shortcut || '').trim(),
    searchUrl: (engine.searchUrl || '').trim(),
  };
}

/**
 * Finds a custom search engine by shortcut (case-insensitive).
 * @param {string} shortcut
 * @param {CustomSearchEngine[]} engines
 * @returns {CustomSearchEngine | undefined}
 */
function findSearchEngineByShortcut(shortcut, engines) {
  const lowerShortcut = shortcut.toLowerCase();
  return engines.find((engine) => engine.shortcut.toLowerCase() === lowerShortcut);
}

