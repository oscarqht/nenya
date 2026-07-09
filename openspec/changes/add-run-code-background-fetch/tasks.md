## 1. Specification
- [x] 1.1 Add an OpenSpec delta for background-backed fetch in manual Run Code.
- [x] 1.2 Validate the OpenSpec change.

## 2. Implementation
- [x] 2.1 Add a manual Run Code helper that exposes background-backed fetch to user snippets.
- [x] 2.2 Add background request handling that validates and performs the fetch with the extension origin.
- [x] 2.3 Serialize the response into a snippet-friendly shape without changing automatic Custom JS/CSS injection behavior.

## 3. Verification
- [x] 3.1 Run OpenSpec validation and syntax checks for touched scripts.
- [x] 3.2 Manually review the final diff for helper scope, request validation, and response serialization.
