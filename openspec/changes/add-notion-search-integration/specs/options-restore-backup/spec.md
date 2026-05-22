## MODIFIED Requirements
### Requirement: Backup payloads MUST cover every configurable category with normalized data and metadata

Each payload MUST be versioned JSON that contains metadata plus a sanitized copy of local settings, guaranteeing that restores are deterministic.

#### Scenario: Category inventory and sanitation

- **GIVEN** backups run, **THEN** the system MUST capture the following categories using their build/parse/apply helpers: root folder + provider linkage (`mirrorRootFolderSettings`), notification preferences, auto reload rules (identifiers generated when missing, minimum 5 s interval, sanitized URL patterns), dark mode rules, bright mode whitelist, highlight text rules (type limited to `whole-phrase|comma-separated|regex` with valid colors/patterns), block element rules (URLPattern validation and selector arrays), custom code rules (stored from `chrome.storage.local`, invalid patterns still persisted but noted), LLM prompts, URL process rules, auto Google login rules, pinned shortcuts (limited to six whitelisted shortcut ids), screenshot settings (auto-save boolean flag), **title transform rules (URL patterns and transform operations), custom search engines, and `notionIntegrationSecret`**.
- **AND** every `apply*` function MUST normalize incoming payloads, write them back through `chrome.storage` with `suppressBackup` to avoid echo loops, and run any needed follow-up (e.g., re-evaluating auto reload rules).

### Requirement: Backup payload MUST cover all configurable categories in plain JSON

Manual backups SHALL serialize all configurable options into a plain JSON payload that can be restored without CRDT metadata.

#### Scenario: Backup includes normalized categories without Automerge metadata

- **WHEN** a manual backup builds its payload
- **THEN** it SHALL include normalized values for `mirrorRootFolderSettings`, `notificationPreferences`, `autoReloadRules`, `darkModeRules`, `brightModeWhitelist`/`brightModeSettings`, `highlightTextRules`, `blockElementRules`, `customCodeRules`, `llmPrompts`, `urlProcessRules`, `autoGoogleLoginRules`, `screenshotSettings`, `titleTransformRules`, `pinnedShortcuts`, `customSearchEngines`, **and `notionIntegrationSecret`**
- **AND** the payload SHALL omit Automerge metadata and SHALL store only plain JSON fields
- **AND** restore SHALL overwrite the corresponding local keys, applying defaults when fields are missing.
