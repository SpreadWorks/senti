# Code Review Results

### [x] 1. Reintroduce CLI test helpers to remove repetition
**File:** `tests/unit/flow/set-issue-log.test.js`  
**Issue:** `execFileSync("node", [...])` and identical `env` wiring are duplicated across many test cases after helper removal, increasing maintenance cost and drift risk.  
**Suggestion:** Restore small local helpers like `runSetIssueLog(tmp, args)` and `runSetIssueLogExpectFail(tmp, args)` to centralize command invocation and reduce repeated boilerplate.

**Verdict:** APPROVED
**Reason:** This is a real maintainability improvement in test code (removes duplicated command/env wiring) and should not change behavior if helpers are thin wrappers.

### [x] 2. Extract duplicated precondition failure emission
**File:** `src/lib/dispatcher.js`  
**Issue:** `requiresConfig` and `requiresFlow` branches both build failure envelopes, write JSON, set exit code, and return. This duplicates control-flow and error-output logic.  
**Suggestion:** Add a shared helper (for example `emitPreconditionFailure(code, message)`) and reuse it for both checks.

**Verdict:** APPROVED
**Reason:** `requiresConfig` and `requiresFlow` failure paths clearly duplicate envelope/exit handling; extracting a shared helper reduces drift risk with no intended behavior change.

### [x] 3. Remove unused stderr capture state in test harness
**File:** `tests/unit/lib/dispatcher-requires-config.test.js`  
**Issue:** `stderr` is accumulated in `io()` but never asserted in any test, which is dead test setup code.  
**Suggestion:** Remove `stderr` variable and the `stderr` writer from `io()` unless stderr assertions are intentionally added.

**Verdict:** APPROVED
**Reason:** `stderr` capture is dead setup in that test file today; removing it is low-risk cleanup with no behavioral impact.

### [ ] 4. Align config access style with command precondition policy
**File:** `src/docs/commands/forge.js` (and similar in `src/docs/commands/changelog.js`, `readme.js`, `review.js`, `text.js`)  
**Issue:** Optional chaining was added broadly (`config?.x`) even in commands that likely require config, which can silently mask missing preconditions and create inconsistent command contracts.  
**Suggestion:** Choose one consistent pattern per command: either declare `requiresConfig: true` and use direct config access, or keep nullable access only for commands explicitly intended to run without config.

**Verdict:** REJECTED
**Reason:** The direction is sound, but this is behavior-sensitive: misclassifying which commands truly require config can change runtime behavior. Without a command-by-command contract and tests, breakage risk is too high.

### [x] 5. Clean stale flow metadata carried from renamed spec
**File:** `specs/193-container-config-null-register/flow.json`  
**Issue:** The file appears partially derived from another spec (renamed path + inherited metrics/history), which leaves unrelated noise and weakens traceability.  
**Suggestion:** Normalize the file to only current-spec lifecycle/metrics data (or regenerate it), removing migrated historical artifacts that are not part of this spec’s execution history.

**Verdict:** APPROVED
**Reason:** Normalizing/regenerating `specs/.../flow.json` improves traceability and is process-metadata cleanup, not product-runtime behavior.
