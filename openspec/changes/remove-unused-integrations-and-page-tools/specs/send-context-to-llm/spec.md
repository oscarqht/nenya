## REMOVED Requirements
### Requirement: The chat popup SHALL surface eligible context tabs and provider choices

**Reason**: Chat with LLM is no longer a supported feature.
**Migration**: The chat popup entry point and provider selection UI are removed.

### Requirement: The chat popup SHALL manage provider tabs for the current session

**Reason**: Chat with LLM is no longer a supported feature.
**Migration**: Provider tab session state is removed from background and session storage workflows.

### Requirement: Sending or downloading context SHALL validate prerequisites before contacting the background

**Reason**: Chat with LLM is no longer a supported feature.
**Migration**: The send-to-provider workflow is removed. Markdown download remains as a non-LLM utility.

### Requirement: The background page SHALL assemble sanitized context packages

**Reason**: Chat with LLM is no longer a supported feature.
**Migration**: Background context collection used for provider injection is removed. Page-content extraction needed by Markdown download is retained.

### Requirement: The LLM page injector SHALL attach files and prompts, then optionally auto-send

**Reason**: Chat with LLM is no longer a supported feature.
**Migration**: The LLM page injector and provider metadata are removed.

### Requirement: The options page SHALL allow managing saved prompts in sync storage

**Reason**: Saved LLM prompts are no longer supported without the LLM chat feature.
**Migration**: Existing `llmPrompts` values are ignored by active workflows and excluded from new backups/exports.

### Requirement: Saved prompts SHALL participate in the options backup & restore system

**Reason**: Saved LLM prompts are no longer supported.
**Migration**: New backups/exports omit `llmPrompts`; restores/imports ignore older prompt fields.
