## 1. Spec Coordination
- [ ] 1.1 Resolve overlap with `remove-bookmark-mirror-tabgroups-notifications` so only one final delta owns `mirrorRootFolderSettings` removal from backup payloads.
- [ ] 1.2 Remove or supersede the active `add-notion-search-integration` change artifacts because Notion search is no longer desired.

## 2. Implementation
- [x] 2.1 Remove dark/bright mode options UI, popup shortcuts, shared shortcut IDs, content scripts, storage keys, imports, manifest content script entries, and related libraries if no longer referenced.
- [x] 2.2 Remove block elements options UI, popup custom-filter shortcut, element picker files, background picker handlers, content script registration, storage key, and backup/import-export handling.
- [x] 2.3 Remove LLM chat UI/pages, chat command, saved prompt options UI, provider metadata, provider tab-management/session state, provider injection paths, storage keys, and backup/import-export handling while retaining non-LLM Markdown download.
- [x] 2.4 Remove Notion secret options UI, validation/search background handlers, popup result types/merge/sort/open logic, storage key, and backup/import-export handling.
- [x] 2.5 Remove Raindrop mirror root folder settings from options backup/restore/import/export/reset defaults and ignore older backup fields during restore.
- [x] 2.6 Update manifest permissions/commands/content scripts and documentation to stop advertising or requesting removed features.

## 3. Verification
- [x] 3.1 Run syntax checks for all touched JavaScript files.
- [x] 3.2 Scan for stale references to removed storage keys, commands, content scripts, routes, and docs terms.
- [ ] 3.3 Manually smoke test popup open/search, options page navigation, backup/restore status, and remaining shortcuts.
- [ ] 3.4 Validate OpenSpec once the CLI is available.
