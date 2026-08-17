# Code Review Results

### [x] 1. Extract Preparing Metadata Resolution
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** `issue`/`request` resolution is done inline with mutable locals and ad-hoc fallback checks, while `set-init` has related parsing/normalization logic. This spreads one concern across commands.  
**Suggestion:** Add a shared helper (for example in `src/lib/flow-state.js`) that resolves `{ issue, request }` from CLI + preparing-flow, and reuse it in both `flow set init` and `flow prepare` paths.

**Verdict:** APPROVED
**Reason:** This targets a real cohesion issue (issue/request resolution split across commands) and can reduce drift if the helper preserves current precedence/validation (`CLI > preparing file`, `--issue` integer rules).

### [ ] 2. Clarify Variable Naming for Run ID and Resolved Inputs
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** Names like `runIdArg`, `flowRunId`, `preparing`, and mutable `issue`/`request` make it harder to distinguish “input” vs “resolved” values.  
**Suggestion:** Rename to explicit intent names such as `requestedRunId`, `resolvedRunId`, `preparingFlow`, `resolvedIssue`, and `resolvedRequest` to improve readability and reduce future mistakes.

**Verdict:** REJECTED
**Reason:** Mostly cosmetic renaming. Readability may improve, but by itself it does not materially improve design or correctness.

### [x] 3. Remove Legacy Test Naming Drift
**File:** `tests/e2e/flow/commands/resume.test.js`  
**Issue:** The file name implies resume-command coverage, but current content tests `flow set note`. This is legacy drift and acts like dead structure in the test suite.  
**Suggestion:** Rename the file to match behavior (for example `set-note.test.js`) or move tests under the proper command directory to keep test intent consistent with file layout.

**Verdict:** APPROVED
**Reason:** Aligning test file location/name with actual covered behavior improves suite maintainability and discoverability, with negligible runtime behavior risk.

### [ ] 4. Simplify Step Status Updates
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** `writeFlowState` updates step statuses via repeated `find` calls in a loop over IDs. This is repetitive and scales poorly as step updates grow.  
**Suggestion:** Extract a small helper like `markStepsDone(steps, ["branch", "spec"])` that iterates once (using a `Set`) and centralize status mutation logic for consistency.

**Verdict:** REJECTED
**Reason:** This is premature abstraction for a tiny, localized loop. It adds indirection without clear correctness or maintainability gains at current scale.
