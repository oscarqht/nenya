# Change: add background-backed fetch for manual Run Code

## Why
Manual "Run Code in page" snippets currently execute in the page's browser context, so direct `fetch()` calls from sites like `https://x.com` still hit normal web CORS restrictions. Users need a supported way to make authenticated cross-origin requests from manual snippets without rewriting each script around extension internals.

## What Changes
- Add a background-backed fetch helper that is available to manual Run Code snippets.
- Keep the helper scoped to user-triggered manual Run Code, not automatic Custom JS/CSS page-load rules.
- Define the request and response contract, including support for URL, method, headers, body, and credential mode passthrough.
- Return response status, headers, final URL, and body readers in a snippet-friendly shape so user code can work with the result similarly to `fetch()`.

## Impact
- Affected specs: `custom-js-css`
- Affected code: `src/background/index.js`, manual Run Code wrapper generation, and any related options or popup surfaces that document or trigger Run Code
