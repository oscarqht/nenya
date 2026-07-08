# Options Import/Export Specification

## Purpose
Document the supported options portability flow. Options are exported and imported as local JSON files; Raindrop-based backup and restore are not supported.

## Requirements
### Requirement: Options UI MUST expose JSON import and export controls
The options page SHALL present Export and Import actions in the floating options bar without Raindrop backup or restore controls.

#### Scenario: Options floating bar shows JSON actions only
- **WHEN** the options page loads
- **THEN** the floating bar SHALL contain Export and Import controls
- **AND** it SHALL NOT contain Backup, Restore, Raindrop backup status, or Raindrop backup action gating.

### Requirement: JSON export MUST serialize supported configurable categories
Exports SHALL create a versioned JSON file containing the supported options categories.

#### Scenario: Export options to JSON
- **WHEN** the user clicks Export
- **THEN** the extension SHALL download a `nenya-options-YYYYMMDD-HHmm.json` file
- **AND** the payload SHALL include normalized values for auto reload rules, custom code rules, run-code-in-page rules, auto Google login rules, pinned shortcuts, pinned search results, and custom search engines.

### Requirement: JSON import MUST apply supported configurable categories
Imports SHALL read a local JSON export file and write normalized settings back to local storage.

#### Scenario: Import options from JSON
- **WHEN** the user selects a valid Nenya JSON export file
- **THEN** the extension SHALL normalize and store the supported option categories
- **AND** dispatch `nenya-options-imported` so visible option panels can refresh immediately.

#### Scenario: Reject invalid import files
- **WHEN** the selected file is not valid JSON or has an unsupported provider
- **THEN** the extension SHALL leave existing settings unchanged
- **AND** show an import failure toast.

### Requirement: Raindrop options backup and restore MUST be absent
The extension SHALL NOT provide Raindrop-based backup or restore for extension options.

#### Scenario: No Raindrop option backup runtime path
- **WHEN** the service worker starts, handles alarms, or receives runtime messages
- **THEN** it SHALL NOT initialize an options backup service, schedule an options backup alarm, upload options to Raindrop, or restore options from Raindrop.
