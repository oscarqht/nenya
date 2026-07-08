# Change: Refactor options backup into feature item collections

## Why
The current options backup stores all settings as one serialized backup artifact. The requested format should make each feature's settings visible and editable as normal Raindrop items grouped by feature collection.

## What Changes
- **BREAKING**: Stop reading or writing the previous single backup file/chunk format.
- Create a root `nenya` collection and one child collection per backed-up feature.
- Store each rule/item as an individual Raindrop item with a `nenya://<feature>/<item>` URL and JSON setting content in the item description fields.
- Store `pinnedShortcuts` as one single Raindrop item containing the full shortcut list.
- Restore local settings by reading the per-feature collections.

## Impact
- Affected specs: `options-restore-backup`
- Affected code: `src/background/options-backup.js`
