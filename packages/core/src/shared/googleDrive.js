/* global chrome */

/**
 * Google Drive backup helpers.
 *
 * Users mint their own OAuth refresh token via the Google OAuth Playground
 * (https://developers.google.com/oauthplayground/) using their own client ID
 * and client secret, selecting the `drive.file` scope. This module exchanges
 * that refresh token for short-lived access tokens against Google's token
 * endpoint and reads/writes a single backup file in the user's Drive.
 *
 * No DOM access here — this is pure network/storage logic.
 */

/**
 * @typedef {Object} GoogleDriveConfig
 * @property {string} clientId
 * @property {string} clientSecret
 * @property {string} refreshToken
 * @property {string} [email]
 * @property {string} [connectedAt]
 */

const STORAGE_KEY = 'googleDriveBackup';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const DRIVE_ABOUT_ENDPOINT =
  'https://www.googleapis.com/drive/v3/about?fields=user';
const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT =
  'https://www.googleapis.com/upload/drive/v3/files';
const BACKUP_FILE_NAME = 'nenya-options-backup.json';
const BACKUP_MIME_TYPE = 'application/json';
const BACKUP_FOLDER_NAME = 'Nenya';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

/**
 * Recommended OAuth scope users should select in the OAuth Playground.
 * @type {string}
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * Get the OAuth redirect URI for this extension. Users must register this URI
 * as an authorized redirect URI in their Google OAuth "Web application" client.
 * @returns {string}
 */
export function getRedirectUri() {
  return chrome.identity.getRedirectURL();
}

/**
 * Run the interactive OAuth consent flow and return the authorization code.
 * @param {{ clientId: string }} params
 * @returns {Promise<{ code: string, redirectUri: string }>}
 */
export async function runInteractiveAuth({ clientId }) {
  if (!clientId) {
    throw new Error('Missing Client ID.');
  }
  const redirectUri = getRedirectUri();
  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    access_type: 'offline',
    // Force the consent screen so Google reliably returns a refresh token,
    // even if the user has authorized this client before.
    prompt: 'consent',
  });
  const authUrl = AUTH_ENDPOINT + '?' + authParams.toString();

  /** @type {string} */
  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (redirectResponse) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message || 'Authorization was cancelled.'));
          return;
        }
        if (!redirectResponse) {
          reject(new Error('Authorization was cancelled.'));
          return;
        }
        resolve(redirectResponse);
      },
    );
  });

  let parsedUrl;
  try {
    parsedUrl = new URL(responseUrl);
  } catch (_) {
    throw new Error('Invalid authorization response.');
  }
  const error = parsedUrl.searchParams.get('error');
  if (error) {
    throw new Error('Authorization failed: ' + error);
  }
  const code = parsedUrl.searchParams.get('code');
  if (!code) {
    throw new Error('No authorization code returned by Google.');
  }
  return { code, redirectUri };
}

/**
 * Exchange an authorization code for tokens (including the refresh token).
 * @param {{ clientId: string, clientSecret: string, code: string, redirectUri: string }} params
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
export async function exchangeAuthCode({
  clientId,
  clientSecret,
  code,
  redirectUri,
}) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const data = await response.json();
      detail = data?.error_description || data?.error || '';
    } catch (_) {
      // ignore
    }
    throw new Error(
      'Failed to exchange authorization code' + (detail ? ': ' + detail : '.'),
    );
  }

  const data = await response.json();
  if (!data || typeof data.access_token !== 'string') {
    throw new Error('Invalid token response from Google.');
  }
  if (typeof data.refresh_token !== 'string' || !data.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Ensure the OAuth client is a ' +
        '"Web application" type and try again.',
    );
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

/**
 * Run the full interactive connect flow: consent, code exchange, and email
 * detection. Returns the refresh token and detected account email.
 * @param {{ clientId: string, clientSecret: string }} params
 * @returns {Promise<{ refreshToken: string, email: string }>}
 */
export async function connectGoogleDrive({ clientId, clientSecret }) {
  if (!clientId || !clientSecret) {
    throw new Error('Missing Client ID or Client Secret.');
  }
  const { code, redirectUri } = await runInteractiveAuth({ clientId });
  const { accessToken, refreshToken } = await exchangeAuthCode({
    clientId,
    clientSecret,
    code,
    redirectUri,
  });
  const user = await getDriveUser(accessToken);
  return { refreshToken, email: user.emailAddress };
}

/**
 * Read the stored Google Drive config.
 * @returns {Promise<GoogleDriveConfig | null>}
 */
export async function getGoogleDriveConfig() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result?.[STORAGE_KEY];
  if (
    !raw ||
    typeof raw !== 'object' ||
    typeof raw.clientId !== 'string' ||
    typeof raw.clientSecret !== 'string' ||
    typeof raw.refreshToken !== 'string'
  ) {
    return null;
  }
  return {
    clientId: raw.clientId,
    clientSecret: raw.clientSecret,
    refreshToken: raw.refreshToken,
    email: typeof raw.email === 'string' ? raw.email : undefined,
    connectedAt:
      typeof raw.connectedAt === 'string' ? raw.connectedAt : undefined,
  };
}

/**
 * Persist the Google Drive config locally.
 * @param {GoogleDriveConfig} config
 * @returns {Promise<void>}
 */
export async function saveGoogleDriveConfig(config) {
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
}

/**
 * Remove the stored Google Drive config.
 * @returns {Promise<void>}
 */
export async function clearGoogleDriveConfig() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

/**
 * Exchange a refresh token for a short-lived access token.
 * @param {{ clientId: string, clientSecret: string, refreshToken: string }} config
 * @returns {Promise<string>} - The access token.
 */
export async function getAccessToken(config) {
  const { clientId, clientSecret, refreshToken } = config;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Google Drive credentials.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const data = await response.json();
      detail = data?.error_description || data?.error || '';
    } catch (_) {
      // ignore
    }
    throw new Error(
      'Failed to obtain access token' + (detail ? ': ' + detail : '.'),
    );
  }

  const data = await response.json();
  if (!data || typeof data.access_token !== 'string') {
    throw new Error('Invalid token response from Google.');
  }
  return data.access_token;
}

/**
 * Fetch the Drive user's info (used to verify read access and detect email).
 * @param {string} accessToken
 * @returns {Promise<{ emailAddress: string, displayName: string }>}
 */
export async function getDriveUser(accessToken) {
  const response = await fetch(DRIVE_ABOUT_ENDPOINT, {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!response.ok) {
    throw new Error('Failed to read Google Drive account (' + response.status + ').');
  }
  const data = await response.json();
  const user = data?.user;
  if (!user || typeof user.emailAddress !== 'string') {
    throw new Error('Could not detect Google account email.');
  }
  return {
    emailAddress: user.emailAddress,
    displayName: typeof user.displayName === 'string' ? user.displayName : '',
  };
}

/**
 * Find the "Nenya" backup folder, creating it if it doesn't exist. With the
 * `drive.file` scope, only folders created by this app are visible/queryable.
 * @param {string} accessToken
 * @returns {Promise<string>} - The folder id.
 */
export async function findOrCreateFolder(accessToken) {
  const params = new URLSearchParams({
    q:
      "name='" +
      BACKUP_FOLDER_NAME +
      "' and mimeType='" +
      FOLDER_MIME_TYPE +
      "' and trashed=false",
    spaces: 'drive',
    fields: 'files(id,name)',
    pageSize: '1',
  });
  const response = await fetch(DRIVE_FILES_ENDPOINT + '?' + params.toString(), {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!response.ok) {
    throw new Error(
      'Failed to query Google Drive folder (' + response.status + ').',
    );
  }
  const data = await response.json();
  const files = Array.isArray(data?.files) ? data.files : [];
  if (files.length > 0 && typeof files[0].id === 'string') {
    return files[0].id;
  }

  // Create the folder.
  const createResponse = await fetch(DRIVE_FILES_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: FOLDER_MIME_TYPE,
    }),
  });
  if (!createResponse.ok) {
    throw new Error(
      'Failed to create the Nenya folder in Google Drive (' +
        createResponse.status +
        ').',
    );
  }
  const created = await createResponse.json();
  if (!created || typeof created.id !== 'string') {
    throw new Error('Invalid folder creation response from Google.');
  }
  return created.id;
}

/**
 * Find the existing backup file id within the given folder, if any.
 * @param {string} accessToken
 * @param {string} folderId
 * @returns {Promise<string | null>}
 */
export async function findBackupFile(accessToken, folderId) {
  const params = new URLSearchParams({
    q:
      "name='" +
      BACKUP_FILE_NAME +
      "' and '" +
      folderId +
      "' in parents and trashed=false",
    spaces: 'drive',
    fields: 'files(id,name)',
    pageSize: '1',
  });
  const response = await fetch(DRIVE_FILES_ENDPOINT + '?' + params.toString(), {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!response.ok) {
    throw new Error('Failed to query Google Drive (' + response.status + ').');
  }
  const data = await response.json();
  const files = Array.isArray(data?.files) ? data.files : [];
  return files.length > 0 && typeof files[0].id === 'string'
    ? files[0].id
    : null;
}

/**
 * Build a shareable URL to a Google Drive folder.
 * @param {string} folderId
 * @returns {string}
 */
export function getFolderUrl(folderId) {
  return 'https://drive.google.com/drive/folders/' + folderId;
}

/**
 * Upload (create or overwrite) the backup file in Drive.
 * @param {string} accessToken
 * @param {string} jsonString - The serialized backup payload.
 * @returns {Promise<{ folderId: string, folderUrl: string }>}
 */
export async function uploadBackup(accessToken, jsonString) {
  const folderId = await findOrCreateFolder(accessToken);
  const existingId = await findBackupFile(accessToken, folderId);

  if (existingId) {
    // Overwrite existing file content.
    const response = await fetch(
      DRIVE_UPLOAD_ENDPOINT + '/' + existingId + '?uploadType=media',
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': BACKUP_MIME_TYPE,
        },
        body: jsonString,
      },
    );
    if (!response.ok) {
      throw new Error(
        'Failed to update backup in Google Drive (' + response.status + ').',
      );
    }
    return { folderId, folderUrl: getFolderUrl(folderId) };
  }

  // Create a new file with metadata + content via multipart upload.
  const boundary = 'nenya-boundary-' + Date.now().toString(36);
  const metadata = {
    name: BACKUP_FILE_NAME,
    mimeType: BACKUP_MIME_TYPE,
    parents: [folderId],
  };
  const multipartBody =
    '--' +
    boundary +
    '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    '\r\n--' +
    boundary +
    '\r\nContent-Type: ' +
    BACKUP_MIME_TYPE +
    '\r\n\r\n' +
    jsonString +
    '\r\n--' +
    boundary +
    '--';

  const response = await fetch(DRIVE_UPLOAD_ENDPOINT + '?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'multipart/related; boundary=' + boundary,
    },
    body: multipartBody,
  });
  if (!response.ok) {
    throw new Error(
      'Failed to create backup in Google Drive (' + response.status + ').',
    );
  }
  return { folderId, folderUrl: getFolderUrl(folderId) };
}

/**
 * Download the backup file content from Drive.
 * @param {string} accessToken
 * @returns {Promise<string>} - The raw JSON text of the backup.
 */
export async function downloadBackup(accessToken) {
  const folderId = await findOrCreateFolder(accessToken);
  const fileId = await findBackupFile(accessToken, folderId);
  if (!fileId) {
    throw new Error('No backup file found in the Nenya folder in Google Drive.');
  }
  const response = await fetch(
    DRIVE_FILES_ENDPOINT + '/' + fileId + '?alt=media',
    {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
    },
  );
  if (!response.ok) {
    throw new Error(
      'Failed to download backup from Google Drive (' + response.status + ').',
    );
  }
  return response.text();
}
