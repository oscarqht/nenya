## Context

Chrome settings overrides are static manifest declarations, not runtime extension preferences. Chrome Web Store ownership checks therefore cannot be bypassed by storing a value in the Options page.

## Goals / Non-Goals

- Goals: make the existing New Tab redirect configurable and eliminate the unowned homepage override.
- Non-Goals: change the browser's actual homepage setting, add a new permission, or permit non-web URL schemes.

## Decisions

- Use `chrome.storage.sync` for the destination so it follows a signed-in user across their Chrome profiles, matching other user-facing preferences.
- Accept only absolute `http:` and `https:` URLs. Invalid or empty input remains unsaved and the New Tab page falls back to the existing Raindrop destination.
- Load an external `src/newtab/newtab.js` script instead of inline JavaScript so the page complies with Chrome extension CSP.

## Risks / Trade-offs

- Storage reads are asynchronous, so the New Tab page will remain blank briefly before redirecting. This avoids a hard-coded fallback in markup and permits the saved preference to be honored.
- The New Tab override remains an extension behavior that users can disable in Chrome; it does not control Chrome's browser homepage.

## Migration Plan

1. On first use, treat the absent preference as the current Raindrop collection URL.
2. Existing installations retain the same New Tab destination without a storage migration.
3. Removing the homepage override stops future installs from changing Chrome's homepage; Chrome owns any cleanup of a pre-existing homepage setting.
