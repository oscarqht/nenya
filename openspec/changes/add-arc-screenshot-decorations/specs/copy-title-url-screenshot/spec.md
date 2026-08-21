## ADDED Requirements
### Requirement: Arc Screenshot Decorations

The screenshot editor MUST support Arc browser style screenshot decorations including a soft gradient background, thick semi-transparent rounded corner border, and soft drop shadow around the screenshot.

#### Scenario: Toggle decoration mode
- **GIVEN** the screenshot editor is open with a captured screenshot
- **WHEN** the user toggles the decoration mode control
- **THEN** the editor MUST enable or disable the Arc decoration frame
- **AND** the live canvas preview MUST immediately reflect the decorated or plain state

#### Scenario: Customize theme color with hue slider and presets
- **GIVEN** decoration mode is enabled in the screenshot editor
- **WHEN** the user moves the hue gradient slider or selects a theme preset
- **THEN** the theme color gradient background MUST dynamically update
- **AND** the gradient MUST render as a soft, harmonious multi-stop gradient derived from the selected theme

#### Scenario: Render thick semi-transparent rounded border and drop shadow
- **GIVEN** decoration mode is enabled
- **WHEN** viewing the screenshot in the editor or exporting the image
- **THEN** a thick semi-transparent rounded border MUST surround the screenshot
- **AND** a soft drop shadow MUST be rendered beneath the decorated screenshot frame
- **AND** the screenshot corners MUST be rounded to match the inner frame radius

#### Scenario: Export decorated screenshot to clipboard and file
- **GIVEN** decoration mode is enabled with custom theme settings and optional annotations
- **WHEN** the user clicks Copy or Save
- **THEN** the editor MUST composite the soft gradient background, drop shadow, thick semi-transparent border, rounded screenshot, and annotations into a single high-quality image
- **AND** Copy MUST write the composite image to the clipboard as PNG
- **AND** Save MUST download the composite image to disk

#### Scenario: Persist decoration preferences across sessions
- **GIVEN** the user modifies decoration settings (enabled state, theme hue, preset, padding)
- **WHEN** the screenshot editor is opened again later
- **THEN** the editor MUST restore the user's last saved decoration preferences from local storage
