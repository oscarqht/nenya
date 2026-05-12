## 1. Specification
- [x] 1.1 Add an OpenSpec delta for the tldraw screenshot editor.
- [x] 1.2 Validate the OpenSpec change.

## 2. Dependency Vendoring
- [x] 2.1 Select and pin a tldraw SDK version.
- [x] 2.2 Download browser-ready tldraw, React runtime, CSS, and static assets into `src/libs/tldraw/`.
- [x] 2.3 Verify the editor page loads without remote runtime requests.

## 3. Implementation
- [x] 3.1 Replace the custom screenshot editor mount with a tldraw mount.
- [x] 3.2 Load `editorScreenshot` from `chrome.storage.local` and insert it as a locked background image shape.
- [x] 3.3 Wire Copy to export the annotated tldraw content as PNG and write it to the clipboard.
- [x] 3.4 Wire Save to export the annotated tldraw content to a timestamped downloaded image.
- [x] 3.5 Preserve close-after-action behavior.
- [x] 3.6 Remove or isolate obsolete custom canvas editor code.
- [x] 3.7 Persist and reuse tldraw annotation style options by annotation kind.
- [x] 3.8 Persist and restore the close-after-action checkbox value.
- [x] 3.9 Add screenshot crop mode, keyboard shortcut, and cropped-bounds export support.

## 4. Verification
- [x] 4.1 Run `openspec validate replace-screenshot-editor-with-tldraw --strict`.
- [ ] 4.2 Load the extension and verify screenshot capture opens the tldraw editor.
- [ ] 4.3 Verify annotation, undo/redo, copy, save, and close-after-action behavior.
- [x] 4.4 Verify no remote script or asset requests are needed by the editor page.
