## 1. Implementation
- [x] 1.1 Define backed-up feature collections and item serialization rules.
- [x] 1.2 Replace single-payload backup writes with per-feature Raindrop collection/item writes.
- [x] 1.3 Replace single-payload restore reads with per-feature collection/item reads.
- [x] 1.4 Include remaining user preferences that should sync through backup.
- [x] 1.5 Remove legacy file/chunk backup compatibility paths.

## 2. Verification
- [x] 2.1 Run syntax checks for the refactored backup service.
- [x] 2.2 Scan for stale legacy backup constants and paths.
