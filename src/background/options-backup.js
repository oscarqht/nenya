/* global chrome */

import {
  loadValidProviderTokens,
  raindropRequest,
  fetchRaindropItems,
  pushNotification,
} from './mirror.js';
import { debounce } from '../shared/debounce.js';
import { OPTIONS_BACKUP_MESSAGES } from '../shared/optionsBackupMessages.js';

const BACKUP_ROOT_COLLECTION_TITLE = 'nenya';
const BACKUP_ITEM_TAG = 'nenya-options-backup';
const BACKUP_ITEM_TYPE = 'article';
const RAINDROP_BATCH_SIZE = 100;
const FETCH_PAGE_LIMIT = 50;

const STATE_STORAGE_KEY = 'optionsBackupState';

const AUTO_RELOAD_RULES_KEY = 'autoReloadRules';
const CUSTOM_CODE_RULES_KEY = 'customCodeRules';
const RUN_CODE_IN_PAGE_RULES_KEY = 'runCodeInPageRules';
const AUTO_GOOGLE_LOGIN_RULES_KEY = 'autoGoogleLoginRules';
const PINNED_SHORTCUTS_KEY = 'pinnedShortcuts';
const PINNED_SEARCH_RESULTS_KEY = 'pinnedSearchResults';
const CUSTOM_SEARCH_ENGINES_KEY = 'customSearchEngines';
const SESSION_ICON_PREFERENCES_KEY = 'sessionIconPreferences';
const UNSORTED_SCREENSHOT_DISABLED_HOSTNAMES_KEY =
  'unsortedScreenshotDisabledHostnames';

/**
 * @typedef {Object} BackupState
 * @property {number | undefined} lastBackupAt
 * @property {number | undefined} lastRestoreAt
 * @property {string | undefined} lastError
 * @property {number | undefined} lastErrorAt
 * @property {number | undefined} lastItemCount
 */

/**
 * @typedef {Object} StoredProviderTokens
 * @property {string} accessToken
 * @property {string} refreshToken
 * @property {number} expiresAt
 */

/**
 * @typedef {Object} FeatureDefinition
 * @property {string} key
 * @property {string} storageKey
 * @property {string} collectionTitle
 * @property {string} urlFeature
 * @property {'items' | 'single' | 'map'} mode
 */

/**
 * @typedef {Object} FeatureCollectionInfo
 * @property {number} id
 * @property {number} lastModified
 */

/**
 * @typedef {Object} FeatureBackupEntry
 * @property {string} itemId
 * @property {string} title
 * @property {unknown} content
 */

/**
 * @typedef {Object} FeatureBackupPayload
 * @property {any[]} autoReloadRules
 * @property {any[]} customCodeRules
 * @property {any[]} runCodeInPageRules
 * @property {any[]} autoGoogleLoginRules
 * @property {any[]} pinnedShortcuts
 * @property {any[]} pinnedSearchResults
 * @property {any[]} customSearchEngines
 * @property {Record<string, string>} sessionIconPreferences
 * @property {string[]} unsortedScreenshotDisabledHostnames
 */

/** @type {FeatureDefinition[]} */
const FEATURE_DEFINITIONS = [
  {
    key: AUTO_RELOAD_RULES_KEY,
    storageKey: AUTO_RELOAD_RULES_KEY,
    collectionTitle: 'auto reload rules',
    urlFeature: AUTO_RELOAD_RULES_KEY,
    mode: 'items',
  },
  {
    key: CUSTOM_CODE_RULES_KEY,
    storageKey: CUSTOM_CODE_RULES_KEY,
    collectionTitle: 'custom code rules',
    urlFeature: CUSTOM_CODE_RULES_KEY,
    mode: 'items',
  },
  {
    key: RUN_CODE_IN_PAGE_RULES_KEY,
    storageKey: RUN_CODE_IN_PAGE_RULES_KEY,
    collectionTitle: 'run code in page rules',
    urlFeature: RUN_CODE_IN_PAGE_RULES_KEY,
    mode: 'items',
  },
  {
    key: AUTO_GOOGLE_LOGIN_RULES_KEY,
    storageKey: AUTO_GOOGLE_LOGIN_RULES_KEY,
    collectionTitle: 'auto google login rules',
    urlFeature: AUTO_GOOGLE_LOGIN_RULES_KEY,
    mode: 'items',
  },
  {
    key: PINNED_SHORTCUTS_KEY,
    storageKey: PINNED_SHORTCUTS_KEY,
    collectionTitle: 'pinned shortcuts',
    urlFeature: PINNED_SHORTCUTS_KEY,
    mode: 'single',
  },
  {
    key: PINNED_SEARCH_RESULTS_KEY,
    storageKey: PINNED_SEARCH_RESULTS_KEY,
    collectionTitle: 'pinned search results',
    urlFeature: PINNED_SEARCH_RESULTS_KEY,
    mode: 'items',
  },
  {
    key: CUSTOM_SEARCH_ENGINES_KEY,
    storageKey: CUSTOM_SEARCH_ENGINES_KEY,
    collectionTitle: 'custom search engines',
    urlFeature: CUSTOM_SEARCH_ENGINES_KEY,
    mode: 'items',
  },
  {
    key: SESSION_ICON_PREFERENCES_KEY,
    storageKey: SESSION_ICON_PREFERENCES_KEY,
    collectionTitle: 'session icon preferences',
    urlFeature: SESSION_ICON_PREFERENCES_KEY,
    mode: 'map',
  },
  {
    key: UNSORTED_SCREENSHOT_DISABLED_HOSTNAMES_KEY,
    storageKey: UNSORTED_SCREENSHOT_DISABLED_HOSTNAMES_KEY,
    collectionTitle: 'unsorted screenshot disabled hostnames',
    urlFeature: UNSORTED_SCREENSHOT_DISABLED_HOSTNAMES_KEY,
    mode: 'items',
  },
];

const OPTION_KEYS = FEATURE_DEFINITIONS.map((feature) => feature.storageKey);

let initialized = false;
let isRestoring = false;

/**
 * Create a default backup state.
 * @returns {BackupState}
 */
function createDefaultState() {
  return {
    lastBackupAt: undefined,
    lastRestoreAt: undefined,
    lastError: undefined,
    lastErrorAt: undefined,
    lastItemCount: undefined,
  };
}

/**
 * Deep clone a JSON-compatible value.
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Ensure local storage has values for all option keys by migrating any
 * existing sync-stored values. Sync keys are no longer written to, but we
 * migrate once so users do not lose prior data.
 * @returns {Promise<void>}
 */
async function migrateOptionsToLocal() {
  const [localValues, syncValues] = await Promise.all([
    chrome.storage.local.get(OPTION_KEYS),
    chrome.storage.sync.get(OPTION_KEYS),
  ]);

  /** @type {Record<string, any>} */
  const updates = {};
  OPTION_KEYS.forEach((key) => {
    if (localValues[key] === undefined && syncValues[key] !== undefined) {
      updates[key] = syncValues[key];
    }
  });

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
}

/**
 * Run one-time initialization.
 * @returns {Promise<void>}
 */
async function ensureInitialized() {
  if (initialized) {
    return;
  }
  await migrateOptionsToLocal();
  initialized = true;
}

/**
 * Load the persisted backup state.
 * @returns {Promise<BackupState>}
 */
async function loadState() {
  const stored = await chrome.storage.local.get(STATE_STORAGE_KEY);
  const state = stored?.[STATE_STORAGE_KEY];
  if (state && typeof state === 'object') {
    return { ...createDefaultState(), ...state };
  }
  return createDefaultState();
}

/**
 * Update the persisted backup state.
 * @param {(draft: BackupState) => void} updater
 * @returns {Promise<BackupState>}
 */
async function updateState(updater) {
  const current = await loadState();
  updater(current);
  const next = { ...createDefaultState(), ...current };
  await chrome.storage.local.set({ [STATE_STORAGE_KEY]: next });
  return next;
}

/**
 * Extract a numeric Raindrop collection id.
 * @param {any} collection
 * @returns {number | null}
 */
function getCollectionId(collection) {
  const rawId = collection?._id ?? collection?.id;
  const id = typeof rawId === 'string' ? Number(rawId) : rawId;
  return Number.isFinite(id) ? Number(id) : null;
}

/**
 * Extract a numeric parent collection id.
 * @param {any} collection
 * @returns {number | null}
 */
function getParentCollectionId(collection) {
  const rawId = collection?.parent?.$id ?? collection?.parent?.id;
  const id = typeof rawId === 'string' ? Number(rawId) : rawId;
  return Number.isFinite(id) ? Number(id) : null;
}

/**
 * Extract a best-effort modified timestamp from a Raindrop object.
 * @param {any} value
 * @returns {number}
 */
function getLastModified(value) {
  return (
    Date.parse(value?.lastUpdate) ||
    Date.parse(value?.updated) ||
    Date.parse(value?.created) ||
    0
  );
}

/**
 * Fetch root and child Raindrop collections.
 * @param {StoredProviderTokens} tokens
 * @returns {Promise<any[]>}
 */
async function fetchBackupCollections(tokens) {
  const [rootResponse, childResponse] = await Promise.all([
    raindropRequest('/collections', tokens),
    raindropRequest('/collections/childrens', tokens),
  ]);
  return [
    ...(Array.isArray(rootResponse?.items) ? rootResponse.items : []),
    ...(Array.isArray(childResponse?.items) ? childResponse.items : []),
  ];
}

/**
 * Create a Raindrop collection.
 * @param {StoredProviderTokens} tokens
 * @param {string} title
 * @param {number | null} parentId
 * @returns {Promise<number>}
 */
async function createCollection(tokens, title, parentId = null) {
  /** @type {Record<string, any>} */
  const body = { title, view: 'list' };
  if (Number.isFinite(parentId)) {
    body.parent = { $id: parentId };
  }

  const createResponse = await raindropRequest('/collection', tokens, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const collectionId = getCollectionId(createResponse?.item);
  if (collectionId === null) {
    throw new Error('Unable to prepare Raindrop collection for backups.');
  }
  return collectionId;
}

/**
 * Find the root `nenya` backup collection and feature child collections.
 * @param {StoredProviderTokens} tokens
 * @returns {Promise<{ root: FeatureCollectionInfo | null, features: Map<string, FeatureCollectionInfo> }>}
 */
async function findBackupCollections(tokens) {
  const collections = await fetchBackupCollections(tokens);
  const rootCollection = collections.find(
    (collection) =>
      collection?.title === BACKUP_ROOT_COLLECTION_TITLE &&
      getParentCollectionId(collection) === null,
  );
  const rootId = getCollectionId(rootCollection);
  if (rootId === null) {
    return { root: null, features: new Map() };
  }

  /** @type {Map<string, FeatureCollectionInfo>} */
  const features = new Map();
  FEATURE_DEFINITIONS.forEach((feature) => {
    const collection = collections.find(
      (candidate) =>
        candidate?.title === feature.collectionTitle &&
        getParentCollectionId(candidate) === rootId,
    );
    const id = getCollectionId(collection);
    if (id !== null) {
      features.set(feature.key, {
        id,
        lastModified: getLastModified(collection),
      });
    }
  });

  return {
    root: { id: rootId, lastModified: getLastModified(rootCollection) },
    features,
  };
}

/**
 * Ensure the root and all feature backup collections exist.
 * @param {StoredProviderTokens} tokens
 * @returns {Promise<Map<string, FeatureCollectionInfo>>}
 */
async function ensureFeatureCollections(tokens) {
  let collections = await fetchBackupCollections(tokens);
  let rootCollection = collections.find(
    (collection) =>
      collection?.title === BACKUP_ROOT_COLLECTION_TITLE &&
      getParentCollectionId(collection) === null,
  );
  let rootId = getCollectionId(rootCollection);

  if (rootId === null) {
    rootId = await createCollection(tokens, BACKUP_ROOT_COLLECTION_TITLE);
    collections = await fetchBackupCollections(tokens);
    rootCollection = collections.find(
      (collection) => getCollectionId(collection) === rootId,
    );
  }

  /** @type {Map<string, FeatureCollectionInfo>} */
  const featureCollections = new Map();
  for (const feature of FEATURE_DEFINITIONS) {
    const existing = collections.find(
      (collection) =>
        collection?.title === feature.collectionTitle &&
        getParentCollectionId(collection) === rootId,
    );
    let id = getCollectionId(existing);
    let lastModified = getLastModified(existing);

    if (id === null) {
      id = await createCollection(tokens, feature.collectionTitle, rootId);
      lastModified = Date.now();
    }

    featureCollections.set(feature.key, { id, lastModified });
  }

  return featureCollections;
}

/**
 * Fetch all items within a collection.
 * @param {StoredProviderTokens} tokens
 * @param {number} collectionId
 * @returns {Promise<any[]>}
 */
async function fetchAllCollectionItems(tokens, collectionId) {
  /** @type {any[]} */
  const allItems = [];
  for (let page = 0; page < FETCH_PAGE_LIMIT; page += 1) {
    const pageItems = await fetchRaindropItems(tokens, collectionId, page);
    if (!Array.isArray(pageItems) || pageItems.length === 0) {
      break;
    }
    allItems.push(...pageItems);
    if (pageItems.length < 50) {
      break;
    }
  }
  return allItems;
}

/**
 * Delete a list of item IDs from a collection.
 * @param {StoredProviderTokens} tokens
 * @param {number} collectionId
 * @param {number[]} ids
 * @returns {Promise<void>}
 */
async function deleteItems(tokens, collectionId, ids) {
  const validIds = ids.filter((id) => Number.isFinite(id));
  if (!validIds.length) {
    return;
  }

  for (let index = 0; index < validIds.length; index += RAINDROP_BATCH_SIZE) {
    const chunk = validIds.slice(index, index + RAINDROP_BATCH_SIZE);
    const response = await raindropRequest('/raindrops/' + collectionId, tokens, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: chunk, id: chunk }),
    });

    if (response && response.modified === 0) {
      await raindropRequest('/raindrops/' + collectionId, tokens, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: chunk,
          id: chunk,
          collection: { $id: -99 },
        }),
      });
    }
  }
}

/**
 * Normalize a value into an array.
 * @param {unknown} value
 * @returns {any[]}
 */
function asArray(value) {
  return Array.isArray(value) ? clone(value) : [];
}

/**
 * Normalize a value into a string array.
 * @param {unknown} value
 * @returns {string[]}
 */
function asStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim());
}

/**
 * Normalize a value into a string map.
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
function asStringMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  /** @type {Record<string, string>} */
  const result = {};
  Object.entries(value).forEach(([key, mapValue]) => {
    const normalizedKey = typeof key === 'string' ? key.trim() : '';
    const normalizedValue =
      typeof mapValue === 'string' ? mapValue.trim() : '';
    if (normalizedKey && normalizedValue) {
      result[normalizedKey] = normalizedValue;
    }
  });
  return result;
}

/**
 * Return the default value for a feature.
 * @param {FeatureDefinition} feature
 * @returns {any[] | Record<string, string>}
 */
function getDefaultFeatureValue(feature) {
  return feature.mode === 'map' ? {} : [];
}

/**
 * Normalize a stored feature value.
 * @param {FeatureDefinition} feature
 * @param {unknown} value
 * @returns {any[] | Record<string, string>}
 */
function normalizeFeatureValue(feature, value) {
  if (feature.mode === 'map') {
    return asStringMap(value);
  }
  if (feature.key === UNSORTED_SCREENSHOT_DISABLED_HOSTNAMES_KEY) {
    return asStringArray(value);
  }
  return asArray(value);
}

/**
 * Build a backup snapshot from local storage.
 * @returns {Promise<FeatureBackupPayload>}
 */
async function buildBackupPayload() {
  const stored = await chrome.storage.local.get(OPTION_KEYS);
  /** @type {Record<string, any>} */
  const payload = {};

  FEATURE_DEFINITIONS.forEach((feature) => {
    payload[feature.key] = normalizeFeatureValue(
      feature,
      stored?.[feature.storageKey],
    );
  });

  return /** @type {FeatureBackupPayload} */ (clone(payload));
}

/**
 * Apply a backup payload to local storage.
 * @param {Partial<FeatureBackupPayload>} payload
 * @returns {Promise<void>}
 */
async function applyBackupPayload(payload) {
  /** @type {Record<string, any>} */
  const updates = {};

  FEATURE_DEFINITIONS.forEach((feature) => {
    if (!Object.prototype.hasOwnProperty.call(payload || {}, feature.key)) {
      return;
    }
    updates[feature.storageKey] = normalizeFeatureValue(
      feature,
      payload?.[feature.key],
    );
  });

  await chrome.storage.local.set(updates);
}

/**
 * Pick a stable item identifier from a setting item.
 * @param {unknown} item
 * @param {number} index
 * @returns {string}
 */
function getItemIdentifier(item, index) {
  if (typeof item === 'string' && item.trim()) {
    return item.trim();
  }

  if (item && typeof item === 'object') {
    const objectItem = /** @type {Record<string, unknown>} */ (item);
    const candidates = [
      objectItem.id,
      objectItem._id,
      objectItem.shortcut,
      objectItem.name,
      objectItem.title,
      objectItem.url,
      objectItem.pattern,
      objectItem.hostname,
      objectItem.browserId,
    ];
    const found = candidates.find(
      (candidate) => typeof candidate === 'string' && candidate.trim(),
    );
    if (typeof found === 'string') {
      return found.trim();
    }
  }

  return 'item-' + String(index + 1).padStart(4, '0');
}

/**
 * Pick a readable item label.
 * @param {unknown} item
 * @param {string} fallback
 * @returns {string}
 */
function getItemLabel(item, fallback) {
  if (typeof item === 'string' && item.trim()) {
    return item.trim();
  }

  if (item && typeof item === 'object') {
    const objectItem = /** @type {Record<string, unknown>} */ (item);
    const candidates = [
      objectItem.title,
      objectItem.name,
      objectItem.shortcut,
      objectItem.id,
      objectItem.url,
      objectItem.pattern,
      objectItem.hostname,
      objectItem.browserId,
    ];
    const found = candidates.find(
      (candidate) => typeof candidate === 'string' && candidate.trim(),
    );
    if (typeof found === 'string') {
      return found.trim();
    }
  }

  return fallback;
}

/**
 * Build feature backup entries.
 * @param {FeatureDefinition} feature
 * @param {any[] | Record<string, string>} value
 * @returns {FeatureBackupEntry[]}
 */
function buildFeatureEntries(feature, value) {
  if (feature.mode === 'single') {
    return [
      {
        itemId: 'all',
        title: feature.collectionTitle,
        content: asArray(value),
      },
    ];
  }

  if (feature.mode === 'map') {
    return Object.entries(asStringMap(value)).map(
      ([browserId, iconPath], index) => ({
        itemId: browserId,
        title:
          String(index + 1).padStart(4, '0') + ' ' + browserId,
        content: { browserId, iconPath },
      }),
    );
  }

  return asArray(value).map((item, index) => {
    const label = getItemLabel(item, feature.collectionTitle);
    return {
      itemId: getItemIdentifier(item, index),
      title: String(index + 1).padStart(4, '0') + ' ' + label,
      content: item,
    };
  });
}

/**
 * Build a backup item URL.
 * @param {FeatureDefinition} feature
 * @param {string} itemId
 * @returns {string}
 */
function buildBackupItemUrl(feature, itemId) {
  return (
    'nenya://' +
    feature.urlFeature +
    '/' +
    encodeURIComponent(itemId || 'item')
  );
}

/**
 * Build the Raindrop item body for a feature entry.
 * @param {number} collectionId
 * @param {FeatureDefinition} feature
 * @param {FeatureBackupEntry} entry
 * @returns {Record<string, any>}
 */
function buildRaindropItemBody(collectionId, feature, entry) {
  const description = JSON.stringify(entry.content, null, 2);
  return {
    collection: { $id: collectionId },
    link: buildBackupItemUrl(feature, entry.itemId),
    title: entry.title,
    excerpt: description,
    note: description,
    tags: [BACKUP_ITEM_TAG, feature.urlFeature],
    type: BACKUP_ITEM_TYPE,
  };
}

/**
 * Save one feature's backup entries into its Raindrop collection.
 * @param {StoredProviderTokens} tokens
 * @param {FeatureDefinition} feature
 * @param {FeatureCollectionInfo} collection
 * @param {any[] | Record<string, string>} value
 * @returns {Promise<number>}
 */
async function saveFeatureBackup(tokens, feature, collection, value) {
  const existingItems = await fetchAllCollectionItems(tokens, collection.id);
  const entries = buildFeatureEntries(feature, value);
  /** @type {Map<string, any[]>} */
  const existingByLink = new Map();

  existingItems.forEach((item) => {
    const link = typeof item?.link === 'string' ? item.link : '';
    if (!link) {
      return;
    }
    const list = existingByLink.get(link) || [];
    list.push(item);
    existingByLink.set(link, list);
  });

  if (!entries.length) {
    await deleteItems(
      tokens,
      collection.id,
      existingItems
        .map((item) => Number(item?._id ?? item?.id))
        .filter((id) => Number.isFinite(id)),
    );
    return 0;
  }

  const bodies = entries.map((entry) =>
    buildRaindropItemBody(collection.id, feature, entry),
  );
  const desiredLinks = new Set(
    bodies
      .map((body) => (typeof body.link === 'string' ? body.link : ''))
      .filter(Boolean),
  );
  /** @type {number[]} */
  const staleIds = [];

  for (const body of bodies) {
    const link = typeof body.link === 'string' ? body.link : '';
    const matchingItems = link ? existingByLink.get(link) || [] : [];
    const primaryItem = matchingItems[0];
    const primaryId = Number(primaryItem?._id ?? primaryItem?.id);

    if (Number.isFinite(primaryId)) {
      await raindropRequest('/raindrop/' + primaryId, tokens, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      matchingItems.slice(1).forEach((duplicate) => {
        const duplicateId = Number(duplicate?._id ?? duplicate?.id);
        if (Number.isFinite(duplicateId)) {
          staleIds.push(duplicateId);
        }
      });
      continue;
    }

    await raindropRequest('/raindrop', tokens, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  existingItems.forEach((item) => {
    const link = typeof item?.link === 'string' ? item.link : '';
    const id = Number(item?._id ?? item?.id);
    if (Number.isFinite(id) && (!link || !desiredLinks.has(link))) {
      staleIds.push(id);
    }
  });
  await deleteItems(tokens, collection.id, staleIds);

  return entries.length;
}

/**
 * Parse a feature backup item.
 * @param {FeatureDefinition} feature
 * @param {any} item
 * @returns {{ content: unknown, lastModified: number } | null}
 */
function parseFeatureBackupItem(feature, item) {
  const link = typeof item?.link === 'string' ? item.link : '';
  if (!link.startsWith('nenya://' + feature.urlFeature + '/')) {
    return null;
  }

  const raw =
    typeof item?.note === 'string' && item.note.trim()
      ? item.note
      : typeof item?.excerpt === 'string'
        ? item.excerpt
        : '';

  if (!raw.trim()) {
    return null;
  }

  try {
    return {
      content: JSON.parse(raw),
      lastModified: getLastModified(item),
    };
  } catch (error) {
    console.warn('[options-backup] Failed to parse backup item:', error);
    return null;
  }
}

/**
 * Load full Raindrop item details when collection listing omits note/excerpt.
 * @param {StoredProviderTokens} tokens
 * @param {any} item
 * @returns {Promise<any | null>}
 */
async function fetchFullRaindropItem(tokens, item) {
  const id = Number(item?._id ?? item?.id);
  if (!Number.isFinite(id)) {
    return null;
  }

  try {
    const response = await raindropRequest('/raindrop/' + id, tokens);
    return response?.item || null;
  } catch (error) {
    console.warn('[options-backup] Failed to fetch backup item details:', error);
    return null;
  }
}

/**
 * Sort Raindrop backup items into their authored order.
 * @param {any[]} items
 * @returns {any[]}
 */
function sortBackupItems(items) {
  return [...items].sort((a, b) => {
    const titleA = typeof a?.title === 'string' ? a.title : '';
    const titleB = typeof b?.title === 'string' ? b.title : '';
    if (titleA !== titleB) {
      return titleA.localeCompare(titleB);
    }
    return getLastModified(a) - getLastModified(b);
  });
}

/**
 * Restore a feature value from Raindrop items.
 * @param {StoredProviderTokens} tokens
 * @param {FeatureDefinition} feature
 * @param {any[]} items
 * @returns {Promise<{ value: any[] | Record<string, string>, lastModified: number, itemCount: number }>}
 */
async function restoreFeatureValue(tokens, feature, items) {
  let lastModified = 0;
  /** @type {Array<{ content: unknown, lastModified: number }>} */
  const parsedItems = [];

  for (const item of sortBackupItems(items)) {
    let parsed = parseFeatureBackupItem(feature, item);
    if (!parsed) {
      const fullItem = await fetchFullRaindropItem(tokens, item);
      parsed = fullItem ? parseFeatureBackupItem(feature, fullItem) : null;
    }
    if (parsed) {
      parsedItems.push(parsed);
    }
  }

  parsedItems.forEach((parsed) => {
    lastModified = Math.max(lastModified, parsed?.lastModified || 0);
  });

  if (feature.mode === 'single') {
    const first = parsedItems[0]?.content;
    return { value: asArray(first), lastModified, itemCount: parsedItems.length };
  }

  if (feature.mode === 'map') {
    /** @type {Record<string, string>} */
    const mapValue = {};
    parsedItems.forEach((parsed) => {
      const content = parsed?.content;
      if (!content || typeof content !== 'object' || Array.isArray(content)) {
        return;
      }
      const record = /** @type {Record<string, unknown>} */ (content);
      const browserId =
        typeof record.browserId === 'string' ? record.browserId.trim() : '';
      const iconPath =
        typeof record.iconPath === 'string' ? record.iconPath.trim() : '';
      if (browserId && iconPath) {
        mapValue[browserId] = iconPath;
      }
    });
    return { value: mapValue, lastModified, itemCount: parsedItems.length };
  }

  const values = parsedItems.map((parsed) => parsed?.content);
  if (feature.key === UNSORTED_SCREENSHOT_DISABLED_HOSTNAMES_KEY) {
    return {
      value: asStringArray(values),
      lastModified,
      itemCount: parsedItems.length,
    };
  }

  return { value: values, lastModified, itemCount: parsedItems.length };
}

/**
 * Store all configured feature backups as Raindrop items.
 * @param {StoredProviderTokens} tokens
 * @param {FeatureBackupPayload} payload
 * @returns {Promise<number>}
 */
async function saveBackupPayload(tokens, payload) {
  const featureCollections = await ensureFeatureCollections(tokens);
  let itemCount = 0;

  for (const feature of FEATURE_DEFINITIONS) {
    const collection = featureCollections.get(feature.key);
    if (!collection) {
      throw new Error('Missing backup collection: ' + feature.collectionTitle);
    }
    itemCount += await saveFeatureBackup(
      tokens,
      feature,
      collection,
      payload[feature.key],
    );
  }

  return itemCount;
}

/**
 * Download all feature backup data from Raindrop.
 * @param {StoredProviderTokens} tokens
 * @returns {Promise<{ payload: Partial<FeatureBackupPayload> | null, lastModified: number }>}
 */
async function downloadBackupPayload(tokens) {
  const { root, features } = await findBackupCollections(tokens);
  if (!root) {
    return { payload: null, lastModified: 0 };
  }

  /** @type {Record<string, any>} */
  const payload = {};
  let lastModified = root.lastModified;
  let foundAnyFeature = false;

  for (const feature of FEATURE_DEFINITIONS) {
    const collection = features.get(feature.key);
    if (!collection) {
      continue;
    }

    foundAnyFeature = true;
    lastModified = Math.max(lastModified, collection.lastModified);
    const items = await fetchAllCollectionItems(tokens, collection.id);
    const restored = await restoreFeatureValue(tokens, feature, items);
    if (items.length > 0 && restored.itemCount === 0) {
      console.warn(
        '[options-backup] Skipping restore for unreadable backup collection:',
        feature.collectionTitle,
      );
      continue;
    }
    payload[feature.key] = restored.value;
    lastModified = Math.max(lastModified, restored.lastModified);
  }

  if (!foundAnyFeature) {
    return { payload: null, lastModified: 0 };
  }

  return {
    payload: /** @type {Partial<FeatureBackupPayload>} */ (payload),
    lastModified,
  };
}

/**
 * Execute an automatic restore when Raindrop appears newer.
 * @returns {Promise<void>}
 */
export async function runAutomaticRestore() {
  await ensureInitialized();

  const extensionId = chrome.runtime.id;
  const optionsUrl = `chrome-extension://${extensionId}/src/options/index.html`;
  const tabs = await chrome.tabs.query({ url: optionsUrl });
  if (tabs.length > 0) {
    return;
  }

  const tokens = await loadValidProviderTokens();
  if (!tokens) {
    return;
  }

  try {
    const { lastModified } = await downloadBackupPayload(tokens);
    if (!lastModified) {
      return;
    }
    const state = await loadState();
    if (state.lastBackupAt && state.lastBackupAt >= lastModified) {
      return;
    }
    await runManualRestore();
  } catch (error) {
    console.warn('[options-backup] Automatic restore failed:', error);
  }
}

/**
 * Execute a startup sync comparing local and Raindrop versions.
 * @returns {Promise<void>}
 */
export async function runStartupSync() {
  await ensureInitialized();

  const extensionId = chrome.runtime.id;
  const optionsUrl = `chrome-extension://${extensionId}/src/options/index.html`;
  const tabs = await chrome.tabs.query({ url: optionsUrl });
  if (tabs.length > 0) {
    return;
  }

  const tokens = await loadValidProviderTokens();
  if (!tokens) {
    return;
  }

  try {
    const { lastModified: raindropLastModified } =
      await downloadBackupPayload(tokens);
    const state = await loadState();
    const localLastBackupAt = state.lastBackupAt || 0;

    if (raindropLastModified > localLastBackupAt) {
      await runManualRestore();
    } else {
      await runManualBackup();
    }
  } catch (error) {
    console.warn('[options-backup] Startup sync failed:', error);
  }
}

/**
 * Execute a manual backup.
 * @returns {Promise<{ ok: boolean, errors: string[], state: BackupState }>}
 */
export async function runManualBackup() {
  await ensureInitialized();

  const tokens = await loadValidProviderTokens();
  if (!tokens) {
    return {
      ok: false,
      errors: [
        'No Raindrop connection found. Connect your account to back up settings.',
      ],
      state: await loadState(),
    };
  }

  try {
    const payload = await buildBackupPayload();
    const itemCount = await saveBackupPayload(tokens, payload);

    const state = await updateState((draft) => {
      draft.lastBackupAt = Date.now();
      draft.lastError = undefined;
      draft.lastErrorAt = undefined;
      draft.lastItemCount = itemCount;
    });

    return { ok: true, errors: [], state };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');
    const state = await updateState((draft) => {
      draft.lastError = message;
      draft.lastErrorAt = Date.now();
    });
    return {
      ok: false,
      errors: [message],
      state,
    };
  }
}

/**
 * Execute a manual restore.
 * @returns {Promise<{ ok: boolean, errors: string[], state: BackupState }>}
 */
export async function runManualRestore() {
  await ensureInitialized();

  isRestoring = true;
  const resetRestoring = () => {
    setTimeout(() => {
      isRestoring = false;
    }, 2000);
  };

  const tokens = await loadValidProviderTokens();
  if (!tokens) {
    resetRestoring();
    return {
      ok: false,
      errors: [
        'No Raindrop connection found. Connect your account to restore settings.',
      ],
      state: await loadState(),
    };
  }

  try {
    const { payload, lastModified } = await downloadBackupPayload(tokens);

    if (!payload) {
      const state = await updateState((draft) => {
        draft.lastError = 'No backup found in Raindrop.';
        draft.lastErrorAt = Date.now();
      });
      resetRestoring();
      return {
        ok: false,
        errors: ['No backup found in Raindrop.'],
        state,
      };
    }

    await applyBackupPayload(payload);
    const state = await updateState((draft) => {
      draft.lastRestoreAt = Date.now();
      draft.lastError = undefined;
      draft.lastErrorAt = undefined;
      if (lastModified > 0) {
        draft.lastBackupAt = lastModified;
      }
    });
    resetRestoring();
    return { ok: true, errors: [], state };
  } catch (error) {
    resetRestoring();
    const message =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');
    const state = await updateState((draft) => {
      draft.lastError = message;
      draft.lastErrorAt = Date.now();
    });
    return {
      ok: false,
      errors: [message],
      state,
    };
  }
}

/**
 * Reset configurable options to defaults and clear backup state errors.
 * @returns {Promise<{ ok: boolean, errors: string[], state: BackupState }>}
 */
export async function resetOptionsToDefaults() {
  await ensureInitialized();

  isRestoring = true;
  const resetRestoring = () => {
    setTimeout(() => {
      isRestoring = false;
    }, 2000);
  };

  /** @type {Record<string, any>} */
  const updates = {};
  FEATURE_DEFINITIONS.forEach((feature) => {
    updates[feature.storageKey] = getDefaultFeatureValue(feature);
  });
  await chrome.storage.local.set(updates);

  const state = await updateState((draft) => {
    draft.lastRestoreAt = Date.now();
    draft.lastError = undefined;
    draft.lastErrorAt = undefined;
    draft.lastItemCount = undefined;
  });

  resetRestoring();
  return { ok: true, errors: [], state };
}

/**
 * Retrieve the latest backup status snapshot.
 * @returns {Promise<{ ok: boolean, state: BackupState, loggedIn: boolean }>}
 */
export async function getBackupStatus() {
  await ensureInitialized();
  const [tokens, state] = await Promise.all([
    loadValidProviderTokens(),
    loadState(),
  ]);
  return {
    ok: true,
    state,
    loggedIn: Boolean(tokens),
  };
}

/**
 * Handle incoming runtime messages related to options backup.
 * @param {{ type?: string }} message
 * @param {(response?: any) => void} sendResponse
 * @returns {boolean}
 */
export function handleOptionsBackupMessage(message, sendResponse) {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  switch (message.type) {
    case OPTIONS_BACKUP_MESSAGES.STATUS: {
      void getBackupStatus()
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : String(error ?? 'Unknown error'),
          }),
        );
      return true;
    }
    case OPTIONS_BACKUP_MESSAGES.BACKUP_NOW: {
      void runManualBackup()
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({
            ok: false,
            errors: [
              error instanceof Error
                ? error.message
                : String(error ?? 'Unknown error'),
            ],
          }),
        );
      return true;
    }
    case OPTIONS_BACKUP_MESSAGES.RESTORE_NOW: {
      void runManualRestore()
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({
            ok: false,
            errors: [
              error instanceof Error
                ? error.message
                : String(error ?? 'Unknown error'),
            ],
          }),
        );
      return true;
    }
    case OPTIONS_BACKUP_MESSAGES.RESET_DEFAULTS: {
      void resetOptionsToDefaults()
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : String(error ?? 'Unknown error'),
          }),
        );
      return true;
    }
    default:
      return false;
  }
}

/**
 * Initialize backup service.
 * @returns {Promise<void>}
 */
export async function initializeOptionsBackupService() {
  await ensureInitialized();
  setupAutoBackupListener();
}

/**
 * Set up a listener for option changes to trigger auto-backup.
 * @returns {void}
 */
function setupAutoBackupListener() {
  const debouncedBackup = debounce(() => {
    void runManualBackup().catch((error) => {
      console.warn('[options-backup] Auto-backup failed:', error);
    });
  }, 5000);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    if (isRestoring) {
      return;
    }

    const keys = Object.keys(changes);
    if (keys.length === 1 && keys[0] === STATE_STORAGE_KEY) {
      return;
    }

    const hasOptionChanges = keys.some((key) => OPTION_KEYS.includes(key));
    if (hasOptionChanges) {
      debouncedBackup();
    }
  });
}

/**
 * Lifecycle handler.
 * @param {string} trigger
 * @returns {Promise<void>}
 */
export async function handleOptionsBackupLifecycle(trigger) {
  await ensureInitialized();
  if (trigger === 'login') {
    const status = await getBackupStatus();
    if (!status.loggedIn) {
      void pushNotification(
        'options-backup',
        'Options backup',
        'Connect Raindrop to enable manual backup and restore.',
        'nenya://options',
      );
    } else {
      void runManualRestore().catch((error) => {
        console.warn('[options-backup] Restore after login failed:', error);
      });
    }
  }
}
