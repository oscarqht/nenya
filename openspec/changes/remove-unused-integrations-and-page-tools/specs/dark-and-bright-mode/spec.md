## REMOVED Requirements
### Requirement: Users SHALL manage URL-specific dark mode rules from the options page

**Reason**: Dark mode is no longer a supported feature.
**Migration**: Existing `darkModeRules` values are ignored by active workflows and excluded from new backups/exports.

### Requirement: The dark mode content script SHALL enable Dark Reader on matching pages while the OS theme is dark

**Reason**: Dark mode is no longer a supported feature.
**Migration**: The Dark Reader content script and manifest registration are removed.

### Requirement: Users SHALL maintain a validated bright mode whitelist from the options page

**Reason**: Bright mode is no longer a supported feature.
**Migration**: Existing `brightModeWhitelist` values are ignored by active workflows and excluded from new backups/exports.

### Requirement: The bright mode content script SHALL enforce light-mode rendering for matching pages while the OS theme is light

**Reason**: Bright mode is no longer a supported feature.
**Migration**: The bright mode content script and manifest registration are removed.
