/**
 * Detect whether the extension is currently running in Firefox.
 *
 * Firefox exposes the WebExtension APIs under both `browser.*` (native,
 * promise-based) and `chrome.*` (compatibility alias), so presence of
 * `chrome` alone cannot distinguish it from Chrome/Chromium. `browser.*`
 * with a `runtime.getBrowserInfo` method is unique to Firefox.
 * @returns {boolean}
 */
export function isFirefox() {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (/** @type {any} */ (globalThis).browser) !== 'undefined' &&
    typeof (/** @type {any} */ (globalThis).browser)?.runtime
      ?.getBrowserInfo === 'function'
  );
}
