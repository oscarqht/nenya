## MODIFIED Requirements
### Requirement: Options UI MUST expose JSON import and export controls
The options page SHALL present Export and Import rows in the floating options bar. Each row SHALL provide separate controls for local file, Google Drive, and Raindrop.io actions, labeled with `🗃️`, `🅖`, and `💧` respectively.

#### Scenario: Options floating bar shows all JSON destinations
- **WHEN** the options page loads
- **THEN** the floating bar SHALL contain an Export row and an Import row
- **AND** each row SHALL contain file-system, Google Drive, and Raindrop controls
- **AND** the controls SHALL use `🗃️`, `🅖`, and `💧` as their visible labels

### Requirement: Raindrop options export MUST store one JSON backup item
When the user exports options to Raindrop, the extension SHALL ensure a root collection named `Nenya` exists and SHALL create or replace one item titled `backup.json` in that collection. Because Raindrop rejects `.json` file uploads, the extension SHALL upload the JSON content as `text/plain` using a `.txt` transport filename, then rename the resulting item title to `backup.json`. The item content SHALL be the same versioned JSON payload used by local-file and Google Drive export.

#### Scenario: Export options to Raindrop
- **WHEN** the user clicks the Raindrop control in the Export row while Raindrop is connected
- **THEN** the extension SHALL ensure the root `Nenya` collection exists
- **AND** it SHALL save the current normalized options payload as `backup.json` in that collection
- **AND** a success notification SHALL be shown

#### Scenario: Export options to Raindrop without a connection
- **WHEN** the user clicks the Raindrop control in the Export row without valid Raindrop credentials
- **THEN** the extension SHALL leave local options unchanged
- **AND** it SHALL show a connection/error notification

### Requirement: Raindrop options import MUST restore the JSON backup item
When the user imports options from Raindrop, the extension SHALL locate the root `Nenya` collection and its `backup.json` item, parse the item JSON, and apply it through the same normalization and refresh path as local-file import.

#### Scenario: Import options from Raindrop
- **WHEN** the user clicks the Raindrop control in the Import row and a valid `Nenya/backup.json` item exists
- **THEN** the extension SHALL normalize and store the supported option categories
- **AND** it SHALL dispatch `nenya-options-imported` so visible option panels refresh immediately
- **AND** a success notification SHALL be shown

#### Scenario: Reject missing or invalid Raindrop backup
- **WHEN** the `Nenya` collection or `backup.json` item is missing, or its content is invalid
- **THEN** the extension SHALL leave existing settings unchanged
- **AND** it SHALL show an import failure notification

### Requirement: Raindrop options backup and restore MUST be absent
The extension SHALL perform Raindrop options export or import only in response to the corresponding floating controls and SHALL NOT add automatic backup alarms or startup synchronization.

#### Scenario: No automatic Raindrop options backup
- **WHEN** the service worker starts or handles an alarm
- **THEN** it SHALL NOT upload or restore the options backup item unless a manual options action requested it
