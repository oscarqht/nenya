/* global chrome */

import { getValidTokens, areTokensExpired } from '../shared/tokenRefresh.js';

/**
 * @typedef {Object} ToastifyOptions
 * @property {string} text
 * @property {number} duration
 * @property {string} gravity
 * @property {string} position
 * @property {boolean} close
 * @property {Object} style
 */

/**
 * @typedef {Object} ToastifyInstance
 * @property {() => void} showToast
 */

/**
 * @typedef {function(ToastifyOptions): ToastifyInstance} ToastifyFunction
 */

/**
 * @typedef {Object} WindowWithToastify
 * @property {ToastifyFunction} Toastify
 */

/**
 * @typedef {function(number|Date|string): {format: function(string): string}} DayjsFunction
 */

/**
 * @typedef {Object} ProviderDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} oauthProviderId
 * @property {string} defaultRootFolderName
 * @property {string} [description]
 */

/**
 * @typedef {Object} OAuthSuccessMessage
 * @property {'oauth_success'} type
 * @property {string} provider
 * @property {{ access_token: string, refresh_token: string, expires_in: number }} tokens
 */

/**
 * @typedef {Object} StoredProviderTokens
 * @property {string} accessToken
 * @property {string} refreshToken
 * @property {number} expiresAt
 */

/** @typedef {Record<string, StoredProviderTokens>} StoredTokenMap */

/**
 * @typedef {Object} RootFolderSettings
 * @property {string} parentFolderId
 * @property {string} rootFolderName
 */

/** @typedef {Record<string, RootFolderSettings>} RootFolderSettingsMap */

/**
 * @typedef {Object} BookmarkFolderOption
 * @property {string} id
 * @property {string} path
 */

/** @typedef {'success' | 'error' | 'info'} ToastVariant */

const PROVIDERS = [
  {
    id: 'raindrop',
    name: 'Raindrop.io',
    oauthProviderId: 'raindrop',
    defaultRootFolderName: 'Raindrop',
    description: 'Save bookmarks to your Raindrop.io Unsorted collection.',
  },
];

const STORAGE_KEY = 'cloudAuthTokens';
const ROOT_FOLDER_SETTINGS_KEY = 'mirrorRootFolderSettings';
const DEFAULT_PARENT_FOLDER_ID = '1';
const DEFAULT_PARENT_PATH = '/Bookmarks Bar';
const UNTITLED_FOLDER_LABEL = 'Untitled folder';

const providerSelect = /** @type {HTMLSelectElement} */ (
  document.getElementById('providerSelect')
);
const connectButton = /** @type {HTMLButtonElement} */ (
  document.getElementById('connectButton')
);
const disconnectButton = /** @type {HTMLButtonElement} */ (
  document.getElementById('disconnectButton')
);
const statusMessage = /** @type {HTMLDivElement} */ (
  document.getElementById('statusMessage')
);
const providerDescription = /** @type {HTMLParagraphElement | null} */ (
  document.getElementById('providerDescription')
);

const mainContent = /** @type {HTMLElement} */ (document.querySelector('main'));
const rightSidebar = /** @type {HTMLElement} */ (document.querySelector('nav'));

const STATUS_BASE_CLASS = 'text-sm font-medium min-h-6';
const TOAST_BACKGROUND_BY_VARIANT = {
  success: 'linear-gradient(135deg, #22c55e, #16a34a)',
  error: 'linear-gradient(135deg, #f97316, #ea580c)',
  info: 'linear-gradient(135deg, #3b82f6, #2563eb)',
};

/** @type {StoredTokenMap} */
let tokenCache = {};
/** @type {ProviderDefinition | undefined} */
let currentProvider;

/**
 * Populate the provider selector with the supported providers.
 */
function populateProviderOptions() {
  providerSelect.innerHTML = '';
  PROVIDERS.forEach((provider) => {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = provider.name;
    providerSelect.append(option);
  });
}

/**
 * Retrieve the persisted provider token map.
 * @returns {Promise<StoredTokenMap>}
 */
async function readTokenCache() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = /** @type {StoredTokenMap | undefined} */ (
    result[STORAGE_KEY]
  );
  return stored ?? {};
}

/**
 * Persist the provided token map.
 * @param {StoredTokenMap} map
 * @returns {Promise<void>}
 */
async function writeTokenCache(map) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: map });
}

/**
 * Store tokens for the given provider.
 * @param {string} providerId
 * @param {StoredProviderTokens} tokens
 * @returns {Promise<void>}
 */
async function setProviderTokens(providerId, tokens) {
  tokenCache[providerId] = tokens;
  await writeTokenCache(tokenCache);
}

/**
 * Remove stored tokens for the given provider.
 * @param {string} providerId
 * @returns {Promise<void>}
 */
async function clearProviderTokens(providerId) {
  delete tokenCache[providerId];
  await writeTokenCache(tokenCache);
}

/**
 * Display a toast notification if Toastify is available.
 * @param {string} message
 * @param {ToastVariant} [variant='info']
 * @returns {void}
 */
function showToast(message, variant = 'info') {
  /** @type {WindowWithToastify} */
  const windowWithToastify = /** @type {any} */ (window);
  if (typeof windowWithToastify.Toastify !== 'function') {
    return;
  }

  const background =
    TOAST_BACKGROUND_BY_VARIANT[variant] ?? TOAST_BACKGROUND_BY_VARIANT.info;

  windowWithToastify
    .Toastify({
      text: message,
      duration: 4000,
      gravity: 'top',
      position: 'right',
      close: true,
      style: {
        background,
      },
    })
    .showToast();
}

/** @type {boolean} */
let isRefreshingTokens = false;

/**
 * Attempt to refresh tokens for the current provider if they are expired.
 * Updates the token cache and re-renders the UI if successful.
 * @returns {Promise<boolean>} - True if tokens are now valid (either were valid or successfully refreshed)
 */
async function attemptTokenRefresh() {
  if (!currentProvider || isRefreshingTokens) {
    return false;
  }

  const storedTokens = tokenCache[currentProvider.id];
  if (!storedTokens) {
    return false;
  }

  // If tokens are not expired, no need to refresh
  if (!areTokensExpired(storedTokens)) {
    return true;
  }

  isRefreshingTokens = true;
  showToast('Refreshing session...', 'info');

  try {
    const result = await getValidTokens(currentProvider.id);

    if (result.tokens && !result.needsReauth) {
      // Refresh succeeded, update cache
      tokenCache[currentProvider.id] = result.tokens;
      showToast('Session refreshed successfully.', 'success');
      renderProviderState();
      return true;
    }

    // Refresh failed
    if (result.error) {
      console.warn('[bookmarks] Token refresh failed:', result.error);
    }
    return false;
  } catch (error) {
    console.error('[bookmarks] Error during token refresh:', error);
    return false;
  } finally {
    isRefreshingTokens = false;
  }
}

/**
 * Derive the status string for the current provider.
 * @param {StoredProviderTokens | undefined} storedTokens
 * @param {boolean} [isRefreshing=false] - Whether tokens are currently being refreshed
 * @returns {{ message: string, statusClass: string }}
 */
function getProviderStatus(storedTokens, isRefreshing = false) {
  if (!currentProvider) {
    return {
      message: 'Choose a provider to get started.',
      statusClass: 'text-base-content/70',
    };
  }

  if (!storedTokens) {
    return {
      message: 'Not connected to ' + currentProvider.name + '.',
      statusClass: 'text-error',
    };
  }

  if (isRefreshing) {
    return {
      message: 'Refreshing session...',
      statusClass: 'text-info',
    };
  }

  const now = Date.now();
  const isActive = storedTokens.expiresAt > now;
  if (isActive) {
    // @ts-ignore - dayjs is loaded globally via script tag
    const formattedDate = dayjs(storedTokens.expiresAt).format(
      'YYYY-MM-DD HH:mm',
    );
    return {
      message:
        'Connected to ' +
        currentProvider.name +
        '. Token expires at ' +
        formattedDate +
        '.',
      statusClass: 'text-success',
    };
  }

  const expiredAt = new Date(storedTokens.expiresAt);
  return {
    message:
      'Connection expired on ' +
      expiredAt.toLocaleString() +
      '. Reconnect to continue.',
    statusClass: 'text-error',
  };
}

/**
 * Update the UI to reflect the currently selected provider and tokens.
 */
function renderProviderState() {
  const storedTokens = currentProvider
    ? tokenCache[currentProvider.id]
    : undefined;
  const status = getProviderStatus(storedTokens);
  statusMessage.textContent = status.message;
  statusMessage.className =
    STATUS_BASE_CLASS + (status.statusClass ? ' ' + status.statusClass : '');

  if (providerDescription) {
    providerDescription.textContent = currentProvider?.description ?? '';
  }

  const hasSelection = Boolean(currentProvider);
  connectButton.hidden = !hasSelection;
  disconnectButton.hidden = !hasSelection || !storedTokens;
  connectButton.textContent = storedTokens ? 'Reconnect' : 'Connect';

  const isLoggedIn = hasSelection && Boolean(storedTokens);

  // Show/hide sidebar based on login status (section visibility is controlled by NavigationManager)
  if (isLoggedIn) {
    rightSidebar.style.display = '';
    mainContent.style.marginRight = '';
  } else {
    rightSidebar.style.display = 'none';
    mainContent.style.marginRight = '0';
  }

  // Re-apply section visibility to ensure only one section is shown
  // This is important after login verification which may happen after NavigationManager initializes
  if (
    window.navigationManager &&
    typeof window.navigationManager.reapplySectionVisibility === 'function'
  ) {
    window.navigationManager.reapplySectionVisibility();
  }
}

/**
 * Handle provider selection changes.
 */
function handleProviderChange() {
  const selectedId = providerSelect.value;
  currentProvider = PROVIDERS.find((provider) => provider.id === selectedId);
  renderProviderState();
}

/**
 * Start the OAuth flow for the selected provider.
 */
function handleConnectClick() {
  if (!currentProvider) {
    return;
  }

  const statePayload = {
    extensionId: chrome.runtime.id,
    providerId: currentProvider.id,
  };

  const oauthUrl =
    'https://oh-auth.vercel.app/auth/' +
    currentProvider.oauthProviderId +
    '?state=' +
    encodeURIComponent(JSON.stringify(statePayload));
  void chrome.tabs.create({ url: oauthUrl });
}

/**
 * Clear stored tokens for the selected provider and reset all local data.
 */
async function handleDisconnectClick() {
  if (!currentProvider) {
    return;
  }

  try {
    // Clear provider tokens
    await clearProviderTokens(currentProvider.id);



    renderProviderState();
    showToast(
      'Disconnected from ' +
        currentProvider.name +
        '. All local data has been cleared.',
      'info',
    );
  } catch (error) {
    console.error('[bookmarks] Error during logout:', error);
    showToast(
      'Error during logout. Some data may not have been cleared.',
      'error',
    );
  }
}

/**
 * Process successful OAuth responses delivered to the extension.
 * @param {OAuthSuccessMessage} message
 */
async function processOAuthSuccess(message) {
  const provider = PROVIDERS.find(
    (definition) => definition.oauthProviderId === message.provider,
  );
  if (!provider) {
    return;
  }

  const expiresInMs = Number(message.tokens.expires_in) * 1000;
  const record = {
    accessToken: message.tokens.access_token,
    refreshToken: message.tokens.refresh_token,
    expiresAt: Date.now() + expiresInMs,
  };

  await setProviderTokens(provider.id, record);

  if (currentProvider && currentProvider.id === provider.id) {
    renderProviderState();
  }

  showToast('Connected to ' + provider.name + '.', 'success');
}

/**
 * Listen for external OAuth messages sent back to the extension.
 */
function registerExternalMessageListener() {
  chrome.runtime.onMessageExternal.addListener((message) => {
    if (typeof message !== 'object' || message === null) {
      return false;
    }

    if (message.type === 'oauth_success') {
      void processOAuthSuccess(/** @type {OAuthSuccessMessage} */ (message));
    }

    return false;
  });
}

/**
 * Initialize the options page.
 */
async function init() {
  populateProviderOptions();

  tokenCache = await readTokenCache();

  providerSelect.addEventListener('change', handleProviderChange);
  connectButton.addEventListener('click', handleConnectClick);
  disconnectButton.addEventListener('click', () => {
    void handleDisconnectClick();
  });

  registerExternalMessageListener();

  if (PROVIDERS.length > 0) {
    providerSelect.value = PROVIDERS[0].id;
    currentProvider = PROVIDERS[0];
  }

  renderProviderState();

  // Attempt to refresh tokens if they are expired
  // This runs in the background and will update the UI if successful
  const storedTokens = currentProvider
    ? tokenCache[currentProvider.id]
    : undefined;
  if (storedTokens && areTokensExpired(storedTokens)) {
    void attemptTokenRefresh();
  }
}

void init();
