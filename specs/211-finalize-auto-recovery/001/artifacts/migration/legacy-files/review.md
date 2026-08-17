# Code Review Results

### [x] 1. Remove Redundant Route Flags in Pre-sync
**File:** `src/flow/commands/merge.js`  
**Issue:** `runPreSync` accepts `usePr` and returns `skipped: "pr-route"`, but `runMerge` already exits earlier for PR strategy. This creates duplicated branching logic and dead-path complexity.  
**Suggestion:** Remove `usePr` handling from `runPreSync` and make it a focused “worktree squash pre-sync” function. Keep route selection only in `runMerge`.

**Verdict:** APPROVED
**Reason:** `runMerge` already short-circuits PR strategy before calling `runPreSync`, so `usePr`/`"pr-route"` in `runPreSync` is effectively dead branching and can be removed to simplify logic without changing runtime behavior.

### [x] 2. Drop Unused Error Metadata
**File:** `src/flow/commands/merge.js`  
**Issue:** `err.fetchFailed = true` is set on fetch errors but never consumed.  
**Suggestion:** Remove the unused property or wire it into downstream error shaping (e.g., structured finalize result). If it is not used, delete it to keep error contracts minimal.

**Verdict:** APPROVED
**Reason:** `err.fetchFailed` is set but not consumed in downstream shaping/handling; removing it reduces noise and does not change observable behavior.

### [ ] 3. Clarify Preflight Function Naming
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `runFinalizePreflight` and `runPreflightChecks` are similarly named but represent different layers (git access validation vs business prechecks), which is easy to confuse.  
**Suggestion:** Rename `runPreflightChecks` to `runFinalizeEarlyChecks` (or similar) to make intent and call order explicit.

**Verdict:** REJECTED
**Reason:** This is primarily cosmetic (naming-only). It adds churn without clear structural or behavioral improvement.

### [x] 4. Extract Preflight Failure Result Builder
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** The early-stop return object is assembled inline with conditional spreading and repeated metadata assignment, making the failure path harder to scan and maintain.  
**Suggestion:** Extract a helper (e.g., `buildPreflightFailureResult(preflight, state)`) that builds `status/message/reason/steps/artifacts` consistently and keeps `run` flow logic cleaner.

**Verdict:** APPROVED
**Reason:** Extracting the inline preflight-failure object into a helper improves readability and consistency of failure-shape construction, and can be behavior-preserving if field values remain identical.

### [ ] 5. Standardize Helper Error Contract
**File:** `src/lib/git-helpers.js`  
**Issue:** New helpers mix two styles: some return result envelopes (`fetchBranch`, `rebaseOnto`), others throw on failure (`countCommitsBetween`, `listUncommittedFiles`). This inconsistency makes callers harder to reason about.  
**Suggestion:** Align to one pattern (all-throwing or all-envelope) or adopt naming that encodes behavior (`tryFetchBranch`/`mustCountCommitsBetween`) for design consistency.

**Verdict:** REJECTED
**Reason:** Unifying throw/envelope semantics now is high-risk because it can silently alter caller expectations and failure paths; this should not be accepted as a refactor unless all call sites are audited and migrated in one controlled change.
