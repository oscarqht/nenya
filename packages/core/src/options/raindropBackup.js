/* global chrome */

import { applyExportPayload, buildExportPayload, showToast } from './importExport.js';

const exportButton = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('optionsFloatingRaindropExportButton')
);
const importButton = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('optionsFloatingRaindropImportButton')
);

/**
 * @param {string} type
 * @param {Record<string, any>} [message]
 * @returns {Promise<any>}
 */
function sendMessage(type, message = {}) {
  return chrome.runtime.sendMessage({ type, ...message });
}

/**
 * @returns {Promise<void>}
 */
async function handleExportClick() {
  if (!exportButton) {
    return;
  }
  const previousLabel = exportButton.textContent;
  exportButton.disabled = true;
  exportButton.textContent = '💧…';
  try {
    const payload = await buildExportPayload();
    const response = await sendMessage('options:raindropBackup', {
      json: JSON.stringify(payload, null, 2),
    });
    if (!response?.ok) {
      throw new Error(response?.error || 'Failed to save options to Raindrop.');
    }
    showToast('Options saved to Nenya/backup.json in Raindrop.', 'success');
  } catch (error) {
    console.warn('[raindropBackup] Export failed:', error);
    showToast(
      error instanceof Error ? error.message : 'Failed to save options to Raindrop.',
      'error',
    );
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = previousLabel || '💧';
  }
}

/**
 * @returns {Promise<void>}
 */
async function handleImportClick() {
  if (!importButton) {
    return;
  }
  const previousLabel = importButton.textContent;
  importButton.disabled = true;
  importButton.textContent = '💧…';
  try {
    const response = await sendMessage('options:raindropRestore');
    if (!response?.ok) {
      throw new Error(response?.error || 'Failed to restore options from Raindrop.');
    }
    await applyExportPayload(response.payload);
    showToast('Options restored from Nenya/backup.json.', 'success');
  } catch (error) {
    console.warn('[raindropBackup] Import failed:', error);
    showToast(
      error instanceof Error
        ? error.message
        : 'Failed to restore options from Raindrop.',
      'error',
    );
  } finally {
    importButton.disabled = false;
    importButton.textContent = previousLabel || '💧';
  }
}

if (exportButton) {
  exportButton.addEventListener('click', () => void handleExportClick());
}
if (importButton) {
  importButton.addEventListener('click', () => void handleImportClick());
}
