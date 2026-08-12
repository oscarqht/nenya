# Project Context

## Purpose
Nenya is a browser extension designed for users who utilize multiple browsers. It provides a comprehensive suite of tools to manage tabs, sessions, and bookmarks, enabling seamless data portability across different browsers. With Nenya, users can create "projects" of tabs, integrate with Raindrop.io, and enhance their browsing experience with various content interaction features, including:
- Auto-reloading pages periodically.
- Rendering any website in dark mode or bright mode based on the operating system's theme.
- Blocking selected elements (e.g., ads, distractions).
- Injecting custom JavaScript and CSS into any website for personalization.
- Sending page content to an LLM chat as context, eliminating the need for copy-pasting.
- Automatically performing Google OAuth login.
- Copying page title and URL in various formats.
- Taking screenshots of pages.
- Picture-in-picture mode and global keyboard shortcuts.

## Tech Stack
Vanilla JavaScript browser extension (Manifest V3), targeting Chrome and Firefox from a single npm-workspaces monorepo.

## Project Conventions

### Code Style
- Use vanilla JavaScript (no TypeScript).
- No bundler or transpiler; plain source files only (the monorepo's `scripts/build.mjs` copy step is the sole exception — see Architecture Patterns).
- Use JSDoc to type all JavaScript source code.
- Use single quotes for all string literals.
- Follow clear, readable code conventions (avoid unnecessary abstractions).
- Wrap all content scripts in IIFEs (Immediately Invoking Function Expressions) to prevent global variable pollution and ensure proper encapsulation.

### Architecture Patterns
The project is an npm workspaces monorepo:
-   **`packages/core/src/`**: All shared, browser-agnostic source, separated into the same directories as before — `background/`, `contentScript/`, `libs/`, `options/`, `popup/`, `shared/`, etc.
-   **`apps/chrome/`**: `manifest.json` for the Chrome MV3 build, plus `src`/`assets` symlinks into `packages/core` for zero-build "Load unpacked" development.
-   **`apps/firefox/`**: `manifest.json` for the Firefox MV3 build (differs from Chrome's mainly in `background` — `scripts` instead of `service_worker` — and drops Chrome-only permissions like `sidePanel`, `userScripts`, `desktopCapture`), plus the same symlink setup.
-   **`scripts/build.mjs`**: a plain Node copy script (no bundler) that dereferences the dev symlinks into `dist/chrome` or `dist/firefox` for packaging/zipping. Run via `npm run build:chrome` / `npm run build:firefox`.
-   Within `packages/core/src/background/`: `clipboard.js`, `mirror.js`, `raindropOptionsBackup.js`, `screen-recorder.js`, etc.
-   Within `packages/core/src/contentScript/`: `auto-google-login.js`, `custom-js-css.js`, `emoji-picker.js`, `youtube-fixes.js`, etc.
-   **`packages/core/src/libs/`**: Stores third-party JavaScript and CSS libraries, such as `ace.js`, `daisyui@5.css`, `dayjs.min.js`, `readability.min.js`, and `tailwindcss@4.js`. These are typically browser-ready, standalone versions.
-   **`packages/core/src/options/`**: Manages the extension's settings and configuration UI.
-   **`packages/core/src/popup/`**: Contains the HTML and JavaScript for the extension's browser action popup.
-   **`packages/core/src/shared/`**: Provides common utilities, helper functions, and shared constants used across different parts of the extension.
-   Chrome-only APIs (Offscreen, sidePanel, userScripts) are feature-detected in code (e.g. `if (chrome.offscreen)`) rather than branched on browser name, so the same source runs on both targets.
### Preferred Frameworks & Libraries
#### What to do when a framework/library is needed?
- When a JavaScript library is required, download the CDN (browser-ready) version and place it in `packages/core/src/libs`.
  - Example: For `lodash`, download the minified CDN file (e.g., `lodash.min.js`) and save it as `packages/core/src/libs/lodash.min.js`.
- Reference these local files in HTML or JavaScript as needed (e.g., via `<script src="../libs/lodash.min.js"></script>`).
- Do not use npm packages or require a build step for library usage.
- Always prefer the browser-ready, standalone version from a reputable CDN (such as jsDelivr or unpkg).

#### Preferred frameworks & libraries
- TailwindCSS for utility-first styling.
- DaisyUI for ready-made UI components.
- Day.js as needed for date and time manipulations.

### Testing Strategy
Currently, testing is performed manually by loading the extension into a browser. There is a desire to integrate automated testing in the future.

### Git Workflow
- Follow the Conventional Commits specification.
- All commit messages should be in lowercase.
- Branch out from `main` for new features or bug fixes.
- Always rebase to the latest `main` before merging.

## Domain Context
The core domain revolves around enhancing browser functionality and user productivity through various content manipulation and management tools. Key concepts include:
- **Tab/Session Management**: Organizing and saving groups of tabs ("projects").
- **Content Interaction**: Modifying how users view and interact with web page content (dark mode, element blocking).
- **Data Portability**: Features like Raindrop.io integration and copying URLs aim to make user data accessible and portable.
- **LLM Integration**: Sending page content to language models for summarization or analysis.

## Important Constraints
- Strict adherence to **vanilla JavaScript**, **no bundler/transpiler**, and **no TypeScript**. The only build tooling permitted is `scripts/build.mjs`, a plain file-copy step for packaging release zips.

## External Dependencies
- Raindrop.io (for bookmark and collection management).
