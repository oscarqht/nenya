# Custom Search Engines Specification

## Purpose
Document custom search engine management and JSON import/export behavior.

## Requirements
### Requirement: Users MUST be able to manage custom search engines from the options page
The options page MUST expose a dedicated section for creating, editing, and deleting custom search engines.

#### Scenario: Add a new custom search engine
- **GIVEN** the user navigates to the custom search engines options section
- **WHEN** the user clicks "Add search engine"
- **AND** enters a name, shortcut, and search URL containing `%s`
- **AND** clicks "Save"
- **THEN** the system MUST validate that the shortcut is non-empty, unique, and the search URL contains the `%s` placeholder
- **AND** save the engine to `chrome.storage.local.customSearchEngines`
- **AND** display the new engine in the list.

#### Scenario: Edit an existing custom search engine
- **GIVEN** the user has one or more custom search engines saved
- **WHEN** the user clicks "Edit" on a search engine entry and saves valid changes
- **THEN** the system MUST update the engine in storage
- **AND** reflect the changes in the list.

#### Scenario: Delete a custom search engine
- **GIVEN** the user has one or more custom search engines saved
- **WHEN** the user clicks "Delete" on a search engine entry and confirms deletion
- **THEN** the system MUST remove the engine from storage
- **AND** remove it from the displayed list.

#### Scenario: Reject invalid search engine entries
- **GIVEN** the user attempts to add or edit a search engine
- **WHEN** the shortcut is empty, the shortcut is already used by another engine, or the search URL does not contain `%s`
- **THEN** the system MUST display an error message
- **AND** not save the invalid entry.

### Requirement: Popup search MUST support custom search engine shortcuts
When the user types a search query starting with a custom search engine shortcut, the popup MUST trigger a search on that engine instead of Google.

#### Scenario: Trigger custom search engine from popup
- **GIVEN** the user has a custom search engine with shortcut "dd" and URL "https://duckduckgo.com/?q=%s"
- **WHEN** the user types "dd privacy tools" in the popup search input and presses Enter
- **THEN** the system MUST replace `%s` in the search URL with the encoded query
- **AND** open "https://duckduckgo.com/?q=privacy%20tools" in a new tab
- **AND** close the popup.

#### Scenario: Fall back to Google search when no shortcut matches
- **GIVEN** the user has custom search engines saved
- **WHEN** the user types "random query" with no matching shortcut and presses Enter
- **THEN** the system MUST open a Google search for "random query"
- **AND** close the popup.

#### Scenario: Handle custom search with no query text
- **GIVEN** the user has a custom search engine with shortcut "dd"
- **WHEN** the user types only "dd" and presses Enter
- **THEN** the system MUST treat it as a regular Google search query.

#### Scenario: Search shortcuts are case-insensitive
- **GIVEN** the user has a custom search engine with shortcut "dd"
- **WHEN** the user types "DD privacy tools" or "Dd privacy tools"
- **THEN** the system MUST match the shortcut case-insensitively.

### Requirement: Custom search engines MUST be included in JSON import and export
The JSON import/export functionality MUST include custom search engines.

#### Scenario: Export custom search engines to JSON
- **GIVEN** the user has custom search engines saved
- **WHEN** the user exports options to JSON
- **THEN** the export MUST include a `customSearchEngines` field
- **AND** the field MUST contain an array of normalized search engine objects
- **AND** the field MUST be included even if the array is empty.

#### Scenario: Import custom search engines from JSON
- **GIVEN** the user imports options from JSON
- **WHEN** the JSON contains a `customSearchEngines` field
- **THEN** the import MUST read and validate the custom search engines
- **AND** write the normalized engines to `chrome.storage.local.customSearchEngines`
- **AND** the options page UI MUST reflect the imported custom search engines immediately.

#### Scenario: Handle missing custom search engines in JSON import
- **GIVEN** the user imports options from JSON
- **WHEN** the JSON does NOT contain a `customSearchEngines` field
- **THEN** the import MUST NOT modify existing custom search engines
- **AND** no error or warning MUST be shown.
