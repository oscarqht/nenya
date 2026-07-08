# Change: Remove unused integrations and page tools

## Why
Several configurable features are no longer used and keep broad permissions, storage keys, backup payload fields, content scripts, and UI surfaces alive. Removing them reduces extension complexity and narrows the behavior users need to understand.

## What Changes
- Remove Raindrop mirror root folder settings from backup/restore/import/export because local browser bookmark mirroring is being removed.
- Remove dark mode and bright mode features, including their options UI, popup shortcuts, content scripts, storage keys, manifest registrations, and backup payload fields.
- Remove block elements, including the element picker, options UI, popup shortcut, content script, storage key, and backup payload field.
- Remove LLM chat/send-context workflows and saved prompts, including popup chat pages, commands, provider-tab management, content extraction/injection paths used only for LLM chat, prompt storage, and backup payload fields.
- Remove Notion integration secret and popup Notion search, and supersede the active `add-notion-search-integration` change.
- Update docs, permission descriptions, and option reset behavior to match the reduced feature set.

## Impact
- Affected specs: `options-restore-backup`, `dark-and-bright-mode`, `block-elements`, `send-context-to-llm`, pending `notion-integration`
- Affected code: `manifest.json`, `src/background`, `src/contentScript`, `src/options`, `src/popup`, `src/shared`, `README.md`, `docs`
- Conflicts/overlap: `remove-bookmark-mirror-tabgroups-notifications` already removes `mirrorRootFolderSettings`; this change should either merge that backup-category removal or update its delta so the final supported category list is consistent.
