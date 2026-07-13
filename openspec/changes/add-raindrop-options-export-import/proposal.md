# Change: Add Raindrop options export and import

## Why
Options can currently be exported to/imported from a local JSON file or Google Drive, but users who already connect Raindrop.io cannot use it as a portable options backup destination.

## What Changes
- Add manual export and import actions backed by Raindrop.io.
- Store the JSON payload as a single Raindrop item titled `backup.json` in a root collection titled `Nenya`, creating the collection when needed and replacing the previous backup item on export. Because Raindrop rejects `.json` uploads, send the JSON content as a `text/plain` `backup.txt` upload and rename the resulting item title to `backup.json`.
- Restore options by locating `Nenya` and its `backup.json` item, then applying the existing normalized export payload.
- Replace the floating options controls with two rows: Export and Import, each containing file-system, Google Drive, and Raindrop emoji buttons.

## Impact
- Affected specs: `options-restore-backup`
- Affected code: `src/options/index.html`, `src/options/importExport.js`, `src/options/googleDriveBackup.js`, new Raindrop backup bridge/API module, and the background message/API surface.
