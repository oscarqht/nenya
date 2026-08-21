## 1. Specification
- [x] 1.1 Create OpenSpec change proposal, delta spec, and tasks for Arc screenshot decorations.
- [x] 1.2 Validate the OpenSpec change with `openspec validate add-arc-screenshot-decorations --strict`.

## 2. UI and Controls
- [x] 2.1 Add decoration mode toggle button to the screenshot editor toolbar in `editor.html`.
- [x] 2.2 Add Arc-style floating decoration control bar with theme color hue gradient slider and color presets in `editor.html`.
- [x] 2.3 Style the decoration controls and live canvas preview in `editor.css` (soft gradient background, thick semi-transparent rounded border, soft drop shadow).

## 3. Decoration Engine & Canvas Compositing
- [x] 3.1 Implement gradient generator from theme color hue / presets (mint, sunset, lavender, ocean, rose, amber, dark, neutral).
- [x] 3.2 Implement canvas composition function that layers soft gradient background, multi-pass soft drop shadows, thick semi-transparent rounded border, and rounded screenshot/annotations.
- [x] 3.3 Connect Copy and Save actions to export decorated composite image when decoration mode is enabled.

## 4. Preference Persistence & Interactions
- [x] 4.1 Persist decoration enabled state, hue value, active preset, and padding to `chrome.storage.local`.
- [x] 4.2 Restore saved decoration preferences upon opening screenshot editor.
- [x] 4.3 Support keyboard shortcut / intuitive controls for toggling and adjusting decoration.

## 5. Verification
- [x] 5.1 Run `openspec validate add-arc-screenshot-decorations --strict`.
- [x] 5.2 Verify live visual preview in editor, theme color adjustments, and responsive controls.
- [x] 5.3 Verify exported image (copy and save) contains complete Arc-style decoration with high-DPI quality.
