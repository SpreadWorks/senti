# Code Review Results

### [x] 1. Restore Explicit `--run-id` Existence Validation
**File:** `src/flow/lib/set-auto.js`  
**Issue:** `resolvePreparingRunId()` now returns `explicitRunId` without checking if the preparing flow exists. This can defer failure into mutation paths and produce less-structured errors.  
**Suggestion:** Reintroduce an early existence check (`loadPreparingFlow`) and return a structured fail envelope (e.g., `PREPARING_FLOW_NOT_FOUND`) before any AI call or state mutation.

**Verdict:** APPROVED
**Reason:** This is a real correctness fix: early, structured failure is safer and avoids late mutation-path errors and unnecessary AI work.

### [x] 2. Remove Divergent Run-ID Resolution Logic
**File:** `src/flow/lib/run-auto-check.js`  
**Issue:** Run-id resolution/validation logic is duplicated here and in `set-auto.js`, but behavior and error codes differ, increasing drift risk.  
**Suggestion:** Extract shared preparing-flow run-id resolution into one helper module and reuse it from both commands, with command-specific error-code mapping only where necessary.

**Verdict:** APPROVED
**Reason:** Centralizing shared resolution logic reduces drift/bugs; behavior can stay stable if per-command error-code mapping is preserved.

### [x] 3. Fix Step-ID Inconsistency in Prepare Flow
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The code marks `["branch", "spec"]` as done while nearby comment/history expectations refer to `prepare-spec`; this is naming/behavior inconsistency and likely a regression source.  
**Suggestion:** Align the marked step IDs with the intended workflow (`prepare-spec` vs `spec`) and update comments/tests together so state transitions are unambiguous.

**Verdict:** APPROVED
**Reason:** The current mismatch is behaviorally risky (wrong step progression). Aligning step IDs improves state-machine correctness.

### [x] 4. Restore `integer` Support in Schema Validator
**File:** `src/lib/schema-validate.js`  
**Issue:** `integer` type handling was removed from both constraint checks and `checkType`, which can silently weaken validation for schemas that still use `"type": "integer"`.  
**Suggestion:** Re-add `integer` type support (including min/max checks) or fully migrate all schemas away from `integer` in the same change; avoid partial behavior changes.

**Verdict:** APPROVED
**Reason:** Removing `integer` handling weakens validation semantics. Re-adding it (or fully migrating schemas in the same change) is the safer, correct approach.

### [x] 5. Clarify Retry Semantics in Draft-Task Loop
**File:** `src/flow/lib/run-draft-task.js`  
**Issue:** `while (attempts <= retryMax)` makes total attempts `retryMax + 1`, which is easy to misread and can conflict with user expectations for “max retries.”  
**Suggestion:** Split `maxAttempts` and `maxRetries` explicitly (or switch to a `for` loop with clear bounds) and rename variables to reflect exact semantics.

**Verdict:** APPROVED
**Reason:** The current loop boundary is easy to misread and can cause off-by-one confusion. Clarifying attempts vs retries improves reliability without changing behavior if bounds are kept equivalent.

### [x] 6. Keep CLI Help Aligned With Actual Finalize Capabilities
**File:** `src/flow/registry.js`  
**Issue:** `run finalize` help text dropped `--merge-strategy`, but finalize implementation still appears strategy-aware. This creates UX/documentation drift.  
**Suggestion:** Synchronize help text with supported flags (or remove flag support in code if intentionally deprecated) so command contracts stay consistent.

**Verdict:** APPROVED
**Reason:** Help/implementation drift degrades CLI contract quality. Aligning docs/flags is a practical correctness and UX improvement with low risk.
