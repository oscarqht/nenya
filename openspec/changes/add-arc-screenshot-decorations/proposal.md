# Change: add arc screenshot decorations

## Why
Users want to quickly transform raw browser screenshots into polished, shareable presentation-ready images in the style of Arc browser's portrait capture. This includes customizable soft gradient backgrounds, thick semi-transparent rounded borders, soft drop shadows, and exporting the decorated composite image to the clipboard or disk.

## What Changes
- Add Arc-style screenshot decoration support to the screenshot editor (`src/editor/editor.html`, `src/editor/editor.js`, `src/editor/editor.css`).
- Add a toolbar toggle and floating decoration bar with a continuous hue/gradient slider and curated color presets (mint, ocean, sunset, lavender, rose, dark slate, neutral).
- Add live editor styling for the decorated screenshot with soft gradient background, thick semi-transparent rounded border, and soft drop shadow.
- Implement an offscreen canvas rendering engine to composite the gradient background, multi-pass soft drop shadows, thick semi-transparent rounded border, and rounded screenshot/annotation layer on Copy and Save.
- Persist decoration preferences (enabled state, theme color hue, preset, and padding) in `chrome.storage.local` across sessions.

## Impact
- Affected specs: `copy-title-url-screenshot`
- Affected code: `packages/core/src/editor/editor.html`, `packages/core/src/editor/editor.js`, `packages/core/src/editor/editor.css`
