## REMOVED Requirements
### Requirement: The options UI SHALL load and sanitize block element rules stored in sync

**Reason**: Block Elements is no longer a supported feature.
**Migration**: Existing `blockElementRules` values are ignored by active workflows and excluded from new backups/exports.

### Requirement: Users SHALL manage rule patterns, selectors, and enablement via the options detail panel

**Reason**: Block Elements is no longer a supported feature.
**Migration**: The options section and rule management UI are removed.

### Requirement: The popup element picker SHALL let users capture selectors tied to the active tab

**Reason**: Block Elements is no longer a supported feature.
**Migration**: The popup shortcut, picker injection handlers, and picker UI files are removed.

### Requirement: The background and backup pipelines SHALL persist selectors per host and keep them portable

**Reason**: Block Elements is no longer a supported feature.
**Migration**: Background selector persistence and backup/import-export coverage are removed.

### Requirement: The content script SHALL hide matching selectors reliably as pages change

**Reason**: Block Elements is no longer a supported feature.
**Migration**: The content script and manifest registration are removed.
