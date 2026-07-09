## MODIFIED Requirements
### Requirement: Backup payload MUST cover all supported configurable categories in plain JSON

Manual backups SHALL serialize supported configurable options into a plain JSON payload that can be restored without CRDT metadata, and SHALL omit settings for removed features.

#### Scenario: Backup excludes removed categories

- **WHEN** a manual backup builds its payload
- **THEN** it SHALL NOT include `mirrorRootFolderSettings`, `darkModeRules`, `brightModeWhitelist`, `blockElementRules`, `llmPrompts`, or `notionIntegrationSecret`
- **AND** restore SHALL ignore those fields if present in older backup files
- **AND** supported categories such as auto reload rules, custom code rules, URL process rules, auto Google login rules, screenshot settings, title transform rules, pinned shortcuts, pinned search results, and custom search engines SHALL continue to round-trip.

### Requirement: Options data MUST be persisted in local storage only

Supported option categories SHALL be stored in `chrome.storage.local`; removed categories SHALL NOT be read, written, reset, backed up, or restored by active option workflows.

#### Scenario: Option writes use local storage for supported categories

- **WHEN** any supported option category is saved by the UI or background helpers
- **THEN** the values SHALL be written to `chrome.storage.local` under their respective keys
- **AND** no active workflow SHALL write removed feature keys such as `darkModeRules`, `brightModeWhitelist`, `blockElementRules`, `llmPrompts`, or `notionIntegrationSecret`.

#### Scenario: Manual backup reads from the supported local copy

- **WHEN** a manual backup or restore runs
- **THEN** it SHALL read from `chrome.storage.local` only for supported option categories.
