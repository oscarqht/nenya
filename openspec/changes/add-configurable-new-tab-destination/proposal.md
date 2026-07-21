# Change: Add a configurable New Tab destination

## Why

The Chrome Web Store rejects the current static homepage override because it points to a Raindrop URL that is not owned by the extension developer. Users still need to choose where Nenya's overridden New Tab page sends them.

## What Changes

- Remove the manifest's `chrome_settings_overrides.homepage` declaration so the extension no longer attempts to set Chrome's homepage or ship an unowned homepage URL.
- Add an Options-page setting for the URL opened by Nenya's existing New Tab override.
- Default that setting to the current Raindrop collection URL, validate it as an HTTP(S) URL, and persist it in extension storage.
- Replace the New Tab page's hard-coded redirect with a CSP-compliant external script that reads the saved destination before navigating.

## Impact

- Affected specs: new `new-tab-destination` capability.
- Affected code: `manifest.json`, `src/newtab/`, and `src/options/`.
- No new permissions or third-party libraries.
