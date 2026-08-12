/* global chrome */

/**
 * Relays OAuth results from oh-auth.vercel.app to the extension.
 *
 * oh-auth's callback page tries chrome.runtime.sendMessage(extensionId, ...)
 * directly from the page, which only works on Chrome because Firefox does not
 * support the `matches` field of `externally_connectable`
 * (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/externally_connectable).
 * This content script picks up the same result via postMessage instead, which
 * works the same way on both browsers, and forwards it to the background
 * script over the extension's own internal messaging.
 */
(function () {
  'use strict';

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== 'object' || data.type !== 'oauth_success') {
      return;
    }

    chrome.runtime.sendMessage({
      type: 'oauth_bridge_success',
      provider: data.provider,
      tokens: data.tokens,
    });
  });
})();
