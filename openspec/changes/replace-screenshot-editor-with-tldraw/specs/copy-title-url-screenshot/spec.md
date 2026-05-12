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

#### Scenario: Crop screenshot before export

- **GIVEN** the screenshot editor contains a captured screenshot
- **WHEN** the user chooses Crop or presses the `c` keyboard shortcut
- **THEN** the editor MUST enter tldraw image crop mode for the captured screenshot
- **AND** the user MUST be able to adjust the crop using tldraw crop controls
- **AND** the screenshot MUST return to locked background behavior after crop mode ends
- **AND** Copy and Save MUST export using the cropped screenshot bounds

#### Scenario: Preserve close-after-action preference

- **GIVEN** the user changes the Close after copy or save checkbox in the screenshot editor
- **WHEN** the screenshot editor is opened again later
- **THEN** the checkbox MUST restore the user's last chosen value
- **AND** Copy and Save MUST use the restored value when deciding whether to close the editor

#### Scenario: Keep screenshot editor extension-local

- **GIVEN** the screenshot editor is open
- **WHEN** the editor loads tldraw and its required runtime assets
- **THEN** all JavaScript, CSS, fonts, icons, translations, and other tldraw runtime assets MUST be loaded from extension-local files
- **AND** the editor MUST NOT depend on remote scripts or remote assets at runtime

#### Scenario: Reuse annotation options by kind

- **GIVEN** the user creates or restyles a screenshot annotation in the editor
- **WHEN** the user later chooses the same kind of annotation tool again
- **THEN** the editor MUST apply the most recently chosen tldraw style options for that annotation kind before creating the next annotation
- **AND** geo annotation styles MUST be remembered separately for each geo kind, such as rectangle and ellipse
- **AND** the remembered options MUST persist across screenshot editor sessions
