# Change: replace screenshot editor with tldraw

## Why
The current screenshot editor is a large custom canvas implementation. Using tldraw gives the screenshot flow a maintained annotation editor with mature selection, drawing, shape, arrow, text, history, and image export behavior.

## What Changes
- Replace the custom `src/editor/editor.js` canvas editor surface with a tldraw-based screenshot annotation editor.
- Keep the existing screenshot launch contract: background code stores the captured screenshot in `chrome.storage.local.editorScreenshot` and opens `src/editor/editor.html`.
- Render the captured screenshot as a locked background image in tldraw, then let users annotate it with tldraw's built-in tools.
- Preserve the current primary actions: copy the flattened annotated screenshot to the clipboard, save it as a downloaded image, and optionally close the editor after the action.
- Vendor all tldraw runtime files and static assets locally under `src/libs` so the extension does not load remote scripts or assets at runtime.

## Impact
- Affected specs: `copy-title-url-screenshot`
- Affected code: `src/editor/editor.html`, `src/editor/editor.css`, `src/editor/editor.js`, `src/libs/tldraw/*`
- External dependency: tldraw SDK browser runtime and assets, self-hosted for Chrome extension CSP compatibility
