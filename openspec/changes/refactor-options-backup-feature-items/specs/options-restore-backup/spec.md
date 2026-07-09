## MODIFIED Requirements
### Requirement: Structured Raindrop Options Backup
The system SHALL back up supported option categories as Raindrop collections and items instead of a single uploaded file or serialized backup item.

#### Scenario: Backup writes feature collections
- **WHEN** options backup runs
- **THEN** the system SHALL ensure a root `nenya` collection exists
- **AND** the system SHALL ensure each supported feature has its own child collection under `nenya`
- **AND** each non-shortcut feature item SHALL be saved as a Raindrop item in the matching feature collection.

#### Scenario: Backup writes item content
- **WHEN** a feature item is saved to Raindrop
- **THEN** its URL SHALL use `nenya://<feature>/<item id or name>`
- **AND** its description content SHALL contain the serialized setting item.

#### Scenario: Backup writes pinned shortcuts
- **WHEN** `pinnedShortcuts` is saved to Raindrop
- **THEN** the system SHALL save one Raindrop item in the pinned shortcuts feature collection
- **AND** that item's description content SHALL contain the full ordered shortcuts list.

#### Scenario: Restore reads feature collections
- **WHEN** restore runs
- **THEN** the system SHALL reconstruct supported local option keys from the matching feature collections
- **AND** it SHALL NOT read legacy uploaded-file or single serialized backup item formats.
