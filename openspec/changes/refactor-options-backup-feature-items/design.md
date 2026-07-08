## Context
Options backup now needs to use Raindrop itself as a structured settings store. Users should see separate collections under `nenya`, with one item per rule where possible.

## Goals / Non-Goals
- Goals: store each backed-up feature in its own Raindrop child collection.
- Goals: use `nenya://<feature>/<item>` links for backup items.
- Goals: keep `pinnedShortcuts` as one single item because the list is one ordered toolbar configuration.
- Non-Goals: maintain backward compatibility with previous uploaded-file or chunked-item backup formats.

## Decisions
- Decision: create a root `nenya` collection and feature child collections like `auto reload rules`.
- Decision: write JSON content to both `excerpt` and `note`; Raindrop exposes `excerpt` as the item description while `note` gives a fallback for longer content.
- Decision: create fresh feature backup items on each backup and then delete stale items from that feature collection.
- Decision: use zero-padded title prefixes to preserve ordered arrays during restore.

## Risks / Trade-offs
- Raindrop URL validation may reject custom schemes. This follows the requested `nenya://` URL format; any API rejection should be surfaced as a backup error.
- Per-feature item writes are more API calls than one backup item. The data becomes inspectable and independently restorable.

## Migration Plan
1. Stop reading old `nenya / backup` artifacts.
2. On next backup, create the new collection tree and write the current local state.
3. On restore, treat the feature collections as authoritative.
