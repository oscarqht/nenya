## Context
The screenshot command currently captures a visible tab, writes the data URL to `chrome.storage.local.editorScreenshot`, and opens `src/editor/editor.html`. The editor page then uses a custom canvas tool stack to render the screenshot, manage annotations, and export a flattened image.

tldraw is distributed as a React SDK. Its documentation requires React 18 or 19, `tldraw.css`, and static asset folders such as fonts, icons, embed icons, and translations. It can export the canvas to raster formats through `editor.toImage()`.

Chrome extension pages should not depend on remote JavaScript or remote assets at runtime. This project also avoids build steps and keeps browser-ready third-party libraries in `src/libs`.

## Goals
- Use tldraw as the screenshot annotation editor.
- Keep the existing screenshot entry point and storage key.
- Keep copy, save, and close-after-action behavior available from the editor page.
- Keep all third-party runtime files local and pinned.
- Avoid adding a bundler, TypeScript, or React source compilation.

## Non-Goals
- Recreate every custom canvas-only tool in the first tldraw replacement.
- Add collaboration, tldraw sync, cloud persistence, or multiplayer behavior.
- Store screenshot annotation documents for later editing.

## Technical Decisions
- Vendor a pinned browser-ready tldraw ESM bundle plus React runtime files under `src/libs/tldraw/`.
- Vendor tldraw's required static asset folders under `src/libs/tldraw/assets/` and pass local asset URLs to the tldraw component.
- Replace the editor page body with a small extension toolbar plus a full-viewport tldraw mount container.
- On tldraw mount, load `editorScreenshot`, create an image asset from its data URL, create an image shape at page origin, lock it, send it behind user annotations, and fit the viewport to that image.
- Implement Copy and Save by exporting the current tldraw page content as a flattened image. Copy uses PNG for clipboard compatibility; Save downloads a timestamped image.
- Keep the screenshot image itself in-memory on the editor page and do not upload it to any service.

## Risks
- tldraw's default UI and assets are larger than the current custom editor, so the vendored dependency size will increase.
- tldraw does not map one-to-one to the existing toolbar. If specific old tools such as blur or crop are still required, they should be added as custom tldraw tools or a follow-up capability.
- The SDK does not follow semantic versioning, so the vendored version must be pinned and upgraded deliberately.
