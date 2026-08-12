/* global chrome */

import {
  loadValidProviderTokens,
  raindropRequest,
} from './mirror.js';

const COLLECTION_TITLE = 'Nenya';
const BACKUP_FILE_NAME = 'backup.json';
const UPLOAD_FILE_NAME = 'backup.txt';
const PAGE_SIZE = 100;

/**
 * @param {any} value
 * @returns {number | null}
 */
function getId(value) {
  const rawId = value?._id ?? value?.id;
  const id = typeof rawId === 'string' ? Number(rawId) : rawId;
  return Number.isFinite(id) ? Number(id) : null;
}

/**
 * @param {import('./mirror.js').StoredProviderTokens} tokens
 * @returns {Promise<number | null>}
 */
async function findBackupCollection(tokens) {
  const response = await raindropRequest('/collections', tokens);
  const existing = (Array.isArray(response?.items) ? response.items : []).find(
    (collection) => collection?.title === COLLECTION_TITLE,
  );
  const existingId = getId(existing);
  if (existingId !== null) {
    return existingId;
  }

  return null;
}

/**
 * @param {import('./mirror.js').StoredProviderTokens} tokens
 * @returns {Promise<number>}
 */
async function ensureBackupCollection(tokens) {
  const existingId = await findBackupCollection(tokens);
  if (existingId !== null) {
    return existingId;
  }

  const created = await raindropRequest('/collection', tokens, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: COLLECTION_TITLE }),
  });
  const collectionId = getId(created?.item);
  if (collectionId === null) {
    throw new Error('Unable to create the Nenya Raindrop collection.');
  }
  return collectionId;
}

/**
 * @param {import('./mirror.js').StoredProviderTokens} tokens
 * @param {number} collectionId
 * @returns {Promise<any[]>}
 */
async function fetchBackupItems(tokens, collectionId) {
  const items = [];
  for (let page = 0; page < 50; page += 1) {
    const response = await raindropRequest(
      '/raindrops/' + collectionId + '?perpage=' + PAGE_SIZE + '&page=' + page,
      tokens,
    );
    const pageItems = Array.isArray(response?.items) ? response.items : [];
    items.push(...pageItems);
    if (pageItems.length < PAGE_SIZE) {
      break;
    }
  }
  return items;
}

/**
 * @param {import('./mirror.js').StoredProviderTokens} tokens
 * @param {number} collectionId
 * @param {number[]} ids
 * @returns {Promise<void>}
 */
async function deleteBackupItems(tokens, collectionId, ids) {
  if (ids.length === 0) {
    return;
  }
  await raindropRequest('/raindrops/' + collectionId, tokens, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

/**
 * @param {import('./mirror.js').StoredProviderTokens} tokens
 * @param {number} collectionId
 * @param {string} json
 * @returns {Promise<void>}
 */
async function uploadBackupFile(tokens, collectionId, json) {
  const existingItems = await fetchBackupItems(tokens, collectionId);
  const existingIds = existingItems
    .filter(
      (item) =>
        item?.title === BACKUP_FILE_NAME ||
        item?.file?.name === BACKUP_FILE_NAME ||
        item?.file?.name === UPLOAD_FILE_NAME,
    )
    .map(getId)
    .filter((id) => id !== null);
  await deleteBackupItems(tokens, collectionId, existingIds);

  const formData = new FormData();
  formData.append('collectionId', String(collectionId));
  formData.append(
    'file',
    new Blob([json], { type: 'text/plain' }),
    UPLOAD_FILE_NAME,
  );
  const response = await raindropRequest('/raindrop/file', tokens, {
    method: 'PUT',
    body: formData,
  });
  const uploadedItemId = getId(response?.item);
  if (uploadedItemId !== null) {
    await raindropRequest('/raindrop/' + uploadedItemId, tokens, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: BACKUP_FILE_NAME }),
    });
  }
}

/**
 * @param {import('./mirror.js').StoredProviderTokens} tokens
 * @param {number} collectionId
 * @returns {Promise<any>}
 */
async function downloadBackupFile(tokens, collectionId) {
  const items = await fetchBackupItems(tokens, collectionId);
  const backupItem = items.find(
    (item) =>
      item?.title === BACKUP_FILE_NAME ||
      item?.file?.name === BACKUP_FILE_NAME ||
      item?.file?.name === UPLOAD_FILE_NAME,
  );
  const downloadUrl = backupItem?.file?.link || backupItem?.link;
  if (!downloadUrl) {
    throw new Error('No backup.json file found in the Nenya collection.');
  }

  const response = await fetch(downloadUrl, {
    headers: { Authorization: 'Bearer ' + tokens.accessToken },
  });
  if (!response.ok) {
    throw new Error('Failed to download backup.json from Raindrop.');
  }
  return response.json();
}

/**
 * @param {string} json
 * @returns {Promise<{ ok: boolean, payload?: any, error?: string }>}
 */
export async function handleRaindropOptionsBackup(json) {
  const tokens = await loadValidProviderTokens();
  if (!tokens) {
    throw new Error('Connect Raindrop.io first in the Integration tab.');
  }
  const collectionId = await ensureBackupCollection(tokens);
  await uploadBackupFile(tokens, collectionId, json);
  return { ok: true };
}

/**
 * @returns {Promise<{ ok: boolean, payload?: any, error?: string }>}
 */
export async function handleRaindropOptionsRestore() {
  const tokens = await loadValidProviderTokens();
  if (!tokens) {
    throw new Error('Connect Raindrop.io first in the Integration tab.');
  }
  const collectionId = await findBackupCollection(tokens);
  if (collectionId === null) {
    throw new Error('No Nenya Raindrop collection found.');
  }
  const payload = await downloadBackupFile(tokens, collectionId);
  return { ok: true, payload };
}
