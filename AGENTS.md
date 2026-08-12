<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# AGENTS.md

## Setup

- Run `npm i` to install dependencies (npm workspaces; installs once at the repo root).

## Code Style

- Use **vanilla JavaScript** (no TypeScript).
- **No bundler or transpiler**; plain source files only. See "Monorepo Layout" below for the one allowed copy script.
- Use **JSDoc** to type all JavaScript source code.
- Use **single quotes** for all string literals.
- Follow clear, readable code conventions (avoid unnecessary abstractions).
- **Wrap all content scripts in IIFEs** (Immediately Invoking Function Expressions) to prevent global variable pollution and ensure proper encapsulation.

## Preferred Frameworks & Libraries

### What to do when a framework/library is needed?

- When you need to use a JavaScript library, **download the CDN (browser-ready) version** of the library and place it in `packages/core/src/libs`.
  - Example: For `lodash`, download the minified CDN file (e.g., `lodash.min.js`) and save it as `packages/core/src/libs/lodash.min.js`.
- Reference these local files in your HTML or JS as needed (e.g., via `<script src="../libs/lodash.min.js"></script>`).
- Do **not** use npm packages or require a build step for library usage.
- Always prefer the **browser-ready, standalone** version from a reputable CDN (such as jsDelivr or unpkg).

### Prefered frameworks & libraries

- **TailwindCSS** for utility-first styling.
- **DaisyUI** for ready-made UI components.
- **daijs** as needed for UI enhancements.

## Monorepo Layout

This is an npm-workspaces monorepo targeting both Chrome and Firefox from one codebase:

```
packages/core/src        # all shared, browser-agnostic source (the former root src/)
packages/core/assets     # shared icons/images (the former root assets/)
apps/chrome/manifest.json  # Chrome MV3 manifest
apps/firefox/manifest.json # Firefox MV3 manifest (background.scripts instead of
                            # service_worker, no sidePanel/userScripts/offscreen, etc.)
apps/chrome/src, apps/chrome/assets     # symlinks into packages/core (dev only)
apps/firefox/src, apps/firefox/assets   # symlinks into packages/core (dev only)
scripts/build.mjs        # plain Node copy script (no bundler) that dereferences the
                          # symlinks into dist/chrome or dist/firefox for packaging/zipping
```

- **Local dev / "Load unpacked"**: point the browser directly at `apps/chrome` or `apps/firefox` — the symlinks make this work with zero build step, exactly like before.
- **Producing a release zip**: run `npm run build:chrome` or `npm run build:firefox`, which calls `scripts/build.mjs`. This is the one permitted build step — a file copy, never a bundler/transpiler — needed only because zip archives can't contain symlinks.
- Code that must differ per browser should feature-detect the API (e.g. `if (chrome.offscreen) { ... }`) rather than branching on browser name, since Firefox aliases `chrome.*` to `browser.*` and simply lacks some Chrome-only APIs (Offscreen, sidePanel, userScripts, desktopCapture).

## Additional Notes

- Do **not** include TypeScript or a bundler/transpiler. `scripts/build.mjs` (plain `fs.cpSync`) is the sole exception, used only to assemble release packages.
- This is a browser extension project (Chrome + Firefox); never use inline JavaScript as this violates the extensions' content security policy.
- Relevant documents (OAuth, Raindrop API, etc.) are available in the `references` folder.
- Reference and update this file if project conventions change.
