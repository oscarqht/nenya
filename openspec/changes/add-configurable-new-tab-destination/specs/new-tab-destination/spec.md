## ADDED Requirements

### Requirement: Configurable New Tab destination

The extension SHALL provide an Options-page setting that lets the user configure the HTTP(S) URL opened by Nenya's New Tab override. When no value has been saved, the extension SHALL use `https://app.raindrop.io/my/0/%E2%9D%A4%EF%B8%8F` as the default destination.

#### Scenario: Save a custom destination

- **WHEN** a user saves a valid absolute HTTP(S) URL in the New Tab destination setting
- **THEN** the extension SHALL persist the URL
- **AND** a newly opened Nenya New Tab page SHALL navigate to that URL

#### Scenario: Reject an invalid destination

- **WHEN** a user tries to save an empty, relative, or non-HTTP(S) URL
- **THEN** the extension SHALL show validation feedback
- **AND** it SHALL preserve the last valid destination

### Requirement: Store-compatible manifest

The extension manifest SHALL NOT declare a Chrome homepage settings override.

#### Scenario: Package inspection

- **WHEN** the extension package is inspected for Chrome Web Store publication
- **THEN** `chrome_settings_overrides.homepage` SHALL be absent
- **AND** the manifest MAY retain the New Tab override
