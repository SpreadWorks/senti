# Code Review Results

### [x] 1. Reintroduce Shared Context Builder to Remove Duplication
**File:** `src/flow/lib/get-resolve-context.js`  
**Issue:** `extractSection`, phase-to-skill mapping, spec summary loading, git status collection, and envelope shaping are duplicated almost line-for-line with `run-resume.js`. This increases drift risk.  
**Suggestion:** Move shared logic back into a single helper module (e.g. restore `resolve-context-envelope.js`) and have both commands consume it, adding only command-specific fields in each command.

**Verdict:** APPROVED
**Reason:** This is meaningful deduplication of contract-shaping logic and reduces drift risk; behavior can remain unchanged if shared output fields are kept identical.

### [x] 2. Fix Main Repo Path Semantics in Worktree Mode
**File:** `src/flow/lib/get-resolve-context.js`  
**Issue:** `mainRepoPath` is set to `root`, which can be the worktree path, making `mainRepoPath` potentially incorrect/misleading in worktree execution.  
**Suggestion:** Use `ctx.mainRoot` for `mainRepoPath` and keep `root` only for command execution context.

**Verdict:** APPROVED
**Reason:** `mainRepoPath = root` is incorrect in worktree execution; switching to `ctx.mainRoot` matches intended semantics and fixes incorrect path reporting.

### [x] 3. Keep `run-resume` Path Semantics Consistent with Resolve Context
**File:** `src/flow/lib/run-resume.js`  
**Issue:** Same `mainRepoPath = root` issue exists here, causing possible contract drift and incorrect recovery path hints.  
**Suggestion:** Use `ctx.mainRoot` for `mainRepoPath` and centralize this in the shared envelope builder to avoid reintroducing divergence.

**Verdict:** APPROVED
**Reason:** Same correctness issue as #2; aligning both commands avoids contract drift and prevents broken recovery hints.

### [x] 4. Remove Mixed Requirement Sources in Retro
**File:** `src/flow/lib/run-retro.js`  
**Issue:** `requirementsText` is built from `specJson.requirements`, but emptiness is validated against `state.requirements`. This can produce contradictory behavior and false failures.  
**Suggestion:** Pick one source of truth in this function and use it consistently for both validation and prompt text construction.

**Verdict:** APPROVED
**Reason:** Building prompt text from one source while validating emptiness from another is internally inconsistent and can cause false failures.

### [x] 5. Align `set-summary` Input Contract with Persistence Shape
**File:** `src/flow/lib/set-summary.js`  
**Issue:** Validation accepts `{text, status}` objects, but the command forwards raw elements to `setRequirements`, which treats each item as a description value. Object entries can be persisted as object-valued `desc`.  
**Suggestion:** Normalize input before write: convert strings/objects into `{ desc: string, status }` (or restrict accepted input to strings only) so stored schema stays consistent.

**Verdict:** APPROVED
**Reason:** Current validation/persistence mismatch can store malformed requirement entries (object-valued `desc`), so normalization or stricter input is a real correctness fix.

### [ ] 6. Eliminate Redundant Spec Load in Token Metrics
**File:** `src/metrics/commands/token.js`  
**Issue:** `computeSpecDifficulty` reads `spec.json` text, then calls `loadSpecJson(specDir)` and ignores the returned object. This is redundant I/O and effectively dead work.  
**Suggestion:** Parse/validate once and reuse the parsed result for both validation and requirement counting logic.

**Verdict:** REJECTED
**Reason:** Removing dead I/O is good, but the proposed “reuse parsed result for requirement counting” likely changes current metric behavior; that is not a safe refactor unless behavior change is explicitly intended.
