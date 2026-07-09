## Context
Nenya already separates automatic Custom JS/CSS page-load injection from manual Run Code execution. Automatic rules intentionally stay on the legacy MAIN-world path so existing page-load behavior does not change, while manual Run Code executes through `chrome.userScripts.execute()` to avoid host-page CSP issues. The new request is to let manual snippets perform cross-origin requests through the extension background so they are not limited by the page origin's CORS rules.

## Goals / Non-Goals
- Goals:
  - Provide a simple helper callable directly from manual Run Code snippets.
  - Perform network requests from the extension background using existing host permissions.
  - Preserve the current separation between manual Run Code and automatic Custom JS/CSS.
- Non-Goals:
  - Do not change automatic page-load Custom JS/CSS execution.
  - Do not emulate the full browser `Response` prototype.
  - Do not add a generic fetch bridge for arbitrary content scripts outside the manual Run Code flow.

## Decisions
- Decision: Inject a helper into the manual Run Code wrapper rather than requiring each user snippet to hand-roll message passing.
  - Rationale: The feature is specifically for manual snippets, so the wrapper is the narrowest place to expose it.
- Decision: Route messages through the dedicated user-script messaging channel.
  - Rationale: Chrome's userScripts API treats user-script messaging as a separate, less-trusted context, so background handlers should distinguish it from ordinary extension messages.
- Decision: Return a serializable response wrapper with `ok`, `status`, `statusText`, `url`, `redirected`, `headers`, `text()`, and `json()`.
  - Rationale: Most snippets only need these fields and readers. Returning the full native `Response` object is not possible across extension messaging boundaries.
- Decision: Validate the requested URL and restrict supported init fields to an explicit allowlist.
  - Rationale: Even though manual Run Code is user-authored, the background should avoid becoming an unconstrained proxy surface.

## Risks / Trade-offs
- Cookie-backed auth may still fail if the target origin does not have the expected browser session or if the browser blocks the relevant cookies.
- The helper will look fetch-like, but it cannot be behavior-identical to the native `fetch()` and `Response` APIs because the result crosses a messaging boundary.
- Streaming bodies are out of scope, so large responses are buffered before being returned.

## Migration Plan
1. Add the OpenSpec delta and validate it.
2. Update the manual Run Code wrapper to expose the helper.
3. Add background handlers for user-script messages and request execution.
4. Verify that automatic Custom JS/CSS still uses the legacy path unchanged.

## Open Questions
- The helper name should be short and obvious in snippets. `nenyaFetch` is the current default unless product copy prefers another name.
