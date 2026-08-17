# Code Review Results

### [ ] 1. Extract spec-path resolution to remove duplication
**File:** `src/lib/spec-json.js`  
**Issue:** `loadSpecRequirements()` and `updateSpecRequirementStatus()` both repeat the same `root/specPath` validation and absolute path resolution logic. This duplication increases drift risk (different error wording/behavior over time).  
**Suggestion:** Add a private helper (for example `resolveFlowSpecPath(root, specPath)`) and use it from both functions. Keep validation/error behavior centralized in one place.

**Verdict:** REJECTED
**Reason:** The two call sites do not currently share the same semantics (`loadSpecRequirements` is tolerant and returns `[]`, while `updateSpecRequirementStatus` throws). A single centralized validator can easily change behavior.

### [x] 2. Avoid double-reading `spec.json` in difficulty calculation
**File:** `src/metrics/commands/token.js`  
**Issue:** `computeSpecDifficulty()` reads `spec.json` text with `fs.readFile`, then calls `loadSpecJson(specDir)` which reads/parses the same file again. This is unnecessary I/O and slightly inconsistent style.  
**Suggestion:** Read and parse once, then reuse that parsed object for `computeRequirementCount()` and the same source text for `specMdChars` (or rename that variable to clarify it is JSON length, not markdown).

**Verdict:** APPROVED
**Reason:** This removes real redundant I/O and improves clarity. If implemented by parsing the same already-read file content, behavior should remain unchanged.

### [x] 3. Reduce context-shaping duplication between resume/resolve commands
**File:** `src/flow/lib/get-resolve-context.js`  
**Issue:** This file and `run-resume.js` build near-identical context payloads (`goal`, `scope`, `requirements`, `notes`, etc.), which can drift when one command is updated without the other.  
**Suggestion:** Extract a shared context-builder function and call it from both commands so field selection and requirement-loading behavior stay consistent.

**Verdict:** APPROVED
**Reason:** This is meaningful deduplication with drift-prevention value. It should be behavior-safe if the shared builder preserves the exact current field set and per-command differences.

### [ ] 4. Avoid silently reporting “0 requirements” when spec is missing
**File:** `src/flow/lib/get-status.js`  
**Issue:** `loadSpecRequirements()` failure/no-spec currently collapses to an empty array, so status can report `requirementsProgress: { done: 0, total: 0 }` even when data is unavailable, which is misleading for users.  
**Suggestion:** Distinguish “no requirements” from “requirements unavailable” (for example, add a boolean flag like `requirementsAvailable` or surface a warning field) while keeping the command non-fatal.

**Verdict:** REJECTED
**Reason:** This is a behavior/API change, not a pure refactor. Adding availability/warning semantics can affect existing consumers of `get-status`, so it carries compatibility risk.
