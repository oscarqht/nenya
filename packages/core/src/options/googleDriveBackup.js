/* global chrome */

import {
  buildExportPayload,
  applyExportPayload,
  showToast,
} from './importExport.js';
import {
  getGoogleDriveConfig,
  saveGoogleDriveConfig,
  clearGoogleDriveConfig,
  connectGoogleDrive,
  getRedirectUri,
  getAccessToken,
  uploadBackup,
  downloadBackup,
} from '../shared/googleDrive.js';

const statusMessage = /** @type {HTMLDivElement | null} */ (
  document.getElementById('googleDriveStatusMessage')
);
const redirectUriEl = /** @type {HTMLElement | null} */ (
  document.getElementById('googleDriveRedirectUri')
);
const clientIdInput = /** @type {HTMLInputElement | null} */ (
  document.getElementById('googleDriveClientId')
);
const clientSecretInput = /** @type {HTMLInputElement | null} */ (
  document.getElementById('googleDriveClientSecret')
);
const connectButton = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('googleDriveConnectButton')
);
const disconnectButton = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('googleDriveDisconnectButton')
);
const driveExportButton = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('optionsFloatingGoogleExportButton')
);
const driveImportButton = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('optionsFloatingGoogleImportButton')
);

/**
 * Render connection status and toggle the disconnect button.
 * @param {import('../shared/googleDrive.js').GoogleDriveConfig | null} config
 * @returns {void}
 */
function renderStatus(config) {
  if (statusMessage) {
    statusMessage.textContent =
      config && config.email
        ? 'Connected as ' + config.email
        : 'Not connected';
  }
  if (disconnectButton) {
    disconnectButton.hidden = !config;
  }
}

/**
 * Load stored config and populate the form / status.
 * @returns {Promise<void>}
 */
async function loadConfig() {
  if (redirectUriEl) {
    try {
      redirectUriEl.textContent = getRedirectUri();
    } catch (_) {
      redirectUriEl.textContent = 'https://<extension-id>.chromiumapp.org/';
    }
  }
  const config = await getGoogleDriveConfig();
  if (config) {
    if (clientIdInput) clientIdInput.value = config.clientId;
    if (clientSecretInput) clientSecretInput.value = config.clientSecret;
  }
  renderStatus(config);
}

/**
 * Run the interactive OAuth flow and save the resulting config on success.
 * @returns {Promise<void>}
 */
async function handleConnectClick() {
  const clientId = clientIdInput?.value.trim() || '';
  const clientSecret = clientSecretInput?.value.trim() || '';

  if (!clientId || !clientSecret) {
    showToast('Please provide your Client ID and Client Secret.', 'error');
    return;
  }

  const previousLabel = connectButton?.textContent;
  if (connectButton) {
    connectButton.disabled = true;
    connectButton.textContent = 'Connecting…';
  }

  try {
    const { refreshToken, email } = await connectGoogleDrive({
      clientId,
      clientSecret,
    });
    /** @type {import('../shared/googleDrive.js').GoogleDriveConfig} */
    const config = {
      clientId,
      clientSecret,
      refreshToken,
      email,
      connectedAt: new Date().toISOString(),
    };
    await saveGoogleDriveConfig(config);
    renderStatus(config);
    showToast('Google Drive connected as ' + email + '.', 'success');
  } catch (error) {
    console.warn('[googleDriveBackup] Connect failed:', error);
    showToast(
      error instanceof Error
        ? error.message
        : 'Failed to connect to Google Drive.',
      'error',
    );
  } finally {
    if (connectButton) {
      connectButton.disabled = false;
      connectButton.textContent = previousLabel || 'Connect with Google';
    }
  }
}

/**
 * Disconnect Google Drive (clear stored config).
 * @returns {Promise<void>}
 */
async function handleDisconnectClick() {
  await clearGoogleDriveConfig();
  if (clientIdInput) clientIdInput.value = '';
  if (clientSecretInput) clientSecretInput.value = '';
  renderStatus(null);
  showToast('Google Drive disconnected.', 'info');
}

/**
 * Save the current options to Google Drive.
 * @returns {Promise<void>}
 */
async function handleDriveExportClick() {
  const config = await getGoogleDriveConfig();
  if (!config) {
    showToast('Connect Google Drive first in the Integration tab.', 'error');
    return;
  }

  const previousLabel = driveExportButton?.textContent;
  if (driveExportButton) {
    driveExportButton.disabled = true;
    driveExportButton.textContent = '🅖…';
  }

  try {
    const payload = await buildExportPayload();
    const accessToken = await getAccessToken(config);
    const { folderUrl } = await uploadBackup(
      accessToken,
      JSON.stringify(payload, null, 2),
    );
    showToast('Options saved to the Nenya folder in Google Drive.', 'success', {
      linkUrl: folderUrl,
      linkText: 'Open folder',
    });
  } catch (error) {
    console.warn('[googleDriveBackup] Save to Drive failed:', error);
    showToast(
      error instanceof Error
        ? error.message
        : 'Failed to save options to Google Drive.',
      'error',
    );
  } finally {
    if (driveExportButton) {
      driveExportButton.disabled = false;
      driveExportButton.textContent = previousLabel || '🅖';
    }
  }
}

/**
 * Restore options from Google Drive.
 * @returns {Promise<void>}
 */
async function handleDriveImportClick() {
  const config = await getGoogleDriveConfig();
  if (!config) {
    showToast('Connect Google Drive first in the Integration tab.', 'error');
    return;
  }

  const previousLabel = driveImportButton?.textContent;
  if (driveImportButton) {
    driveImportButton.disabled = true;
    driveImportButton.textContent = '🅖…';
  }

  try {
    const accessToken = await getAccessToken(config);
    const text = await downloadBackup(accessToken);
    const parsed = JSON.parse(text);
    await applyExportPayload(parsed);
    showToast('Options restored from Google Drive.', 'success');
  } catch (error) {
    console.warn('[googleDriveBackup] Restore from Drive failed:', error);
    showToast(
      error instanceof Error
        ? error.message
        : 'Failed to restore options from Google Drive.',
      'error',
    );
  } finally {
    if (driveImportButton) {
      driveImportButton.disabled = false;
      driveImportButton.textContent = previousLabel || '🅖';
    }
  }
}

/**
 * Initialize Google Drive backup listeners.
 * @returns {void}
 */
function initGoogleDriveBackup() {
  if (connectButton) {
    connectButton.addEventListener('click', () => void handleConnectClick());
  }
  if (disconnectButton) {
    disconnectButton.addEventListener(
      'click',
      () => void handleDisconnectClick(),
    );
  }
  if (driveExportButton) {
    driveExportButton.addEventListener(
      'click',
      () => void handleDriveExportClick(),
    );
  }
  if (driveImportButton) {
    driveImportButton.addEventListener(
      'click',
      () => void handleDriveImportClick(),
    );
  }
  void loadConfig();
}

initGoogleDriveBackup();
