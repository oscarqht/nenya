# Pinned Shortcuts Specification

## Purpose
Enable users to customize quick-action buttons in the popup header and carry those preferences through JSON import/export.

## Requirements
### Requirement: Pinned shortcuts MUST render in the popup header and trigger their actions
Selected shortcuts SHALL show up as buttons at the top of `src/popup/index.html` and execute their linked handlers.

#### Scenario: Render stored shortcuts or defaults
- **GIVEN** the popup loads
- **THEN** it MUST read `chrome.storage.local.pinnedShortcuts`
- **AND** use the stored order, falling back to `DEFAULT_PINNED_SHORTCUTS` when empty or invalid
- **AND** render at most six buttons excluding the always-present options button.

#### Scenario: Trigger shortcut handlers on click
- **GIVEN** a shortcut button is rendered
- **WHEN** the user clicks it
- **THEN** the button MUST call its configured handler.

#### Scenario: Reflect storage updates live
- **GIVEN** another tab updates `pinnedShortcuts`
- **THEN** the popup listener on `chrome.storage.onChanged` MUST reload shortcuts so new selections appear without reopening the popup.

### Requirement: Users MUST be able to manage pinned shortcuts from the options page
The options page SHALL provide a drag/click UI to curate up to six shortcuts.

#### Scenario: Display pinned and available lists
- **GIVEN** the user opens the Pinned Shortcuts section
- **THEN** the UI MUST show the current pinned order and the remaining available shortcuts
- **AND** each entry MUST display its label, tooltip, and identifier so users understand the action.

#### Scenario: Add, remove, reorder, and reset
- **GIVEN** the user interacts with the pinned list
- **THEN** move controls MUST reorder adjacent items, remove controls MUST remove a shortcut, and add controls MUST append a shortcut when under the max
- **AND** the Reset button MUST restore `DEFAULT_PINNED_SHORTCUTS`
- **AND** all edits MUST persist to `chrome.storage.local.pinnedShortcuts` after normalization.

#### Scenario: Sync edits across tabs
- **GIVEN** pinned shortcuts change in storage
- **THEN** the options page MUST listen via `chrome.storage.onChanged` and re-render.

### Requirement: JSON import/export MUST include pinned shortcuts
The options import/export flow SHALL round-trip the user's shortcut configuration.

#### Scenario: Export pinned shortcuts
- **GIVEN** the user exports options to JSON
- **THEN** the export payload MUST include a `pinnedShortcuts` array derived from `normalizePinnedShortcuts`.

#### Scenario: Import pinned shortcuts
- **GIVEN** the user imports options from JSON
- **THEN** the importer MUST call `applyImportedOptions` with the sanitized `pinnedShortcuts` array
- **AND** write it back to `chrome.storage.local.pinnedShortcuts`.

### Requirement: Save clipboard URL shortcut MUST be available in pinned shortcuts
Users MUST be able to pin a shortcut that saves the URL currently in the clipboard to Raindrop Unsorted.

#### Scenario: Add clipboard save shortcut to shortcut config
- **GIVEN** the popup loads
- **WHEN** the user has pinned the `saveClipboardToUnsorted` shortcut
- **THEN** a button with tooltip "Save link in clipboard to unsorted" MUST render in the shortcuts container
- **AND** clicking the button MUST trigger the clipboard read and save pipeline.

#### Scenario: Clipboard save shortcut participates in JSON import/export
- **GIVEN** a user exports their pinned shortcuts configuration
- **WHEN** `saveClipboardToUnsorted` is in the pinned shortcuts array
- **THEN** it MUST be included in the JSON export payload and restored correctly from JSON import.
