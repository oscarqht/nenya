## MODIFIED Requirements
### Requirement: The background service SHALL execute custom JavaScript payloads securely
The background service SHALL keep automatic Custom JS/CSS page-load injection on the legacy MAIN-world execution path, and it SHALL provide a background-backed fetch helper only to manual, user-triggered Run Code snippets executed through the user-scripts path.

#### Scenario: Execute JS on behalf of the content script
- **GIVEN** the content script requests `{ type: 'INJECT_CUSTOM_JS', ruleId, code }`,
- **THEN** the background service worker MUST verify `sender.tab.id` exists and `code` is non-empty, call `chrome.scripting.executeScript()` with the MAIN-world eval path, and reply `{ success: true }`,
- **AND** host-page CSP MAY block this automatic custom-code path on pages that disallow eval, so stored rules do not gain new page-load execution privileges unexpectedly,
- **AND** errors (invalid tab, injection failure, runtime exceptions) MUST be caught and responded to with `{ success: false, error }` so the caller can log and avoid retry storms.

#### Scenario: Manual Run Code receives a background-backed fetch helper
- **GIVEN** the user manually runs a "Run Code in page" snippet,
- **WHEN** the background builds the user-script wrapper,
- **THEN** it MUST expose a fetch-like helper to the snippet that sends the request through the extension background instead of the page origin,
- **AND** the helper MUST only be available to manual Run Code snippets, not automatic page-load Custom JS/CSS rules.

#### Scenario: Background-backed fetch executes with explicit validation
- **GIVEN** a manual Run Code snippet calls the helper with a URL and optional init object,
- **WHEN** the request reaches the background through the user-script messaging channel,
- **THEN** the background MUST validate that the URL is absolute and that only supported request fields are honored,
- **AND** it MUST perform the network request from the extension origin so matching host permissions can bypass page-origin CORS limits,
- **AND** it MUST return a serializable response object that includes `ok`, `status`, `statusText`, `url`, `redirected`, `headers`, plus body readers that allow the snippet to call `text()` or `json()` on the returned value,
- **AND** request failures or response-body parse failures MUST reject the snippet call with a descriptive error instead of silently returning an unusable result.
