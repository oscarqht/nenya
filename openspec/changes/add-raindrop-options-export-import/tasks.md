## 1. Raindrop backup flow
- [x] 1.1 Add a background Raindrop API bridge that uses the existing token validation/refresh path.
- [x] 1.2 Ensure the root `Nenya` collection exists and create/update the `backup.json` item with the serialized options payload.
- [x] 1.3 Read and validate the `backup.json` item from `Nenya`, then apply it through the existing import normalization path.

## 2. Options UI
- [x] 2.1 Update the floating controls to two Export/Import rows with file, Google Drive, and Raindrop emoji buttons.
- [x] 2.2 Wire the new Raindrop buttons and preserve the existing file and Google Drive flows.
- [x] 2.3 Add clear connection/error/success feedback for Raindrop actions.

## 3. Verification
- [x] 3.1 Update the current options import/export specification delta.
- [x] 3.2 Run OpenSpec strict validation and JavaScript syntax checks.
