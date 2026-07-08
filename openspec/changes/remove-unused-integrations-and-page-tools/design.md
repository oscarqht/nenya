## Context
The requested removal crosses popup shortcuts, options sections, background message handlers, content scripts, storage schemas, backup/import-export payloads, manifest commands, and documentation. Some related work is already represented by active OpenSpec changes, especially bookmark mirror removal and Notion integration.

## Goals / Non-Goals
- Goals: delete unused feature surfaces and stop persisting their configuration in new backups/exports.
- Goals: keep restores tolerant of older backups by ignoring removed fields rather than failing.
- Goals: keep remaining Raindrop authentication, save-to-unsorted, projects, custom JS/CSS, auto reload, URL processing, title transforms, screenshots, pinned shortcuts, and custom search engines intact unless a direct dependency requires adjustment.
- Non-Goals: migrate old removed settings into new formats or preserve UI affordances for removed features.

## Decisions
- Decision: Remove storage keys from new payloads but ignore them during restore/import when present in old backups.
- Decision: Treat Notion removal as superseding the active `add-notion-search-integration` change, because current product direction no longer includes Notion popup search.
- Decision: Remove LLM chat, saved prompts, provider tab management, and provider injection, but keep the non-LLM Markdown download utility. The retained download path may keep page-content extraction code that is directly needed to produce Markdown files.

## Risks / Trade-offs
- Large deletion risk: message handlers, shortcuts, and option navigation may have stale references. Mitigation: repo-wide reference scans and syntax checks.
- Backup compatibility risk: old backups may contain removed fields. Mitigation: restore/import ignores those fields and applies only supported categories.
- Active-change conflict risk: existing OpenSpec changes may still mention categories being removed. Mitigation: coordinate deltas before implementation and validate when CLI is available.

## Migration Plan
1. Remove UI entry points first so users cannot create new removed settings.
2. Remove background/content-script behavior and manifest registrations.
3. Remove backup/import-export payload fields while keeping old-field tolerance.
4. Remove unused files/libraries after reference scans confirm they are no longer imported.
5. Update docs and specs.

## Open Questions
- None.
