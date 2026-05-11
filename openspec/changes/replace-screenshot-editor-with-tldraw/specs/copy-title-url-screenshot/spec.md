## MODIFIED Requirements
### Requirement: Copy Screenshot

The extension MUST support capturing a screenshot of the current tab and opening it in a tldraw-based annotation editor before clipboard or save export.

#### Scenario: Open screenshot in annotation editor

- **GIVEN** a single tab is active
- **WHEN** the user selects "Copy Screenshot"
- **THEN** a screenshot of the visible tab area MUST be captured
- **AND** the screenshot MUST be stored for the editor page using `chrome.storage.local.editorScreenshot`
- **AND** the screenshot editor MUST open as `src/editor/editor.html`
- **AND** the editor page MUST render the screenshot as a locked background image in tldraw
- **AND** the user MUST be able to annotate the screenshot with tldraw tools
- **AND** a success badge MUST be displayed after the editor launches

#### Scenario: Export annotated screenshot to clipboard

- **GIVEN** the screenshot editor contains a captured screenshot and tldraw annotations
- **WHEN** the user chooses Copy
- **THEN** the editor MUST export a flattened image containing the screenshot and annotations
- **AND** the flattened image MUST be written to the clipboard as PNG with `navigator.clipboard.write()`
- **AND** the editor MUST show action feedback when copying succeeds

#### Scenario: Save annotated screenshot

- **GIVEN** the screenshot editor contains a captured screenshot and tldraw annotations
- **WHEN** the user chooses Save
- **THEN** the editor MUST export a flattened image containing the screenshot and annotations
- **AND** the exported image MUST be downloaded with a timestamped screenshot filename
- **AND** the editor MUST show action feedback when saving succeeds

#### Scenario: Keep screenshot editor extension-local

- **GIVEN** the screenshot editor is open
- **WHEN** the editor loads tldraw and its required runtime assets
- **THEN** all JavaScript, CSS, fonts, icons, translations, and other tldraw runtime assets MUST be loaded from extension-local files
- **AND** the editor MUST NOT depend on remote scripts or remote assets at runtime
