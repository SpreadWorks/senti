# Code Review Results

### [x] 1. Restore Explicit `--run-id` Existence Validation
**File:** `src/flow/lib/set-auto.js`  
**Issue:** `resolvePreparingRunId()` now returns `explicitRunId` without checking whether the preparing flow exists, which breaks fail-fast behavior and makes error handling inconsistent with the auto-detect path.  
**Suggestion:** Reintroduce `loadPreparingFlow(explicitRunId)` validation and return a structured `Envelope.fail(..., "PREPARING_FLOW_NOT_FOUND", ...)` before any downstream processing.

**Verdict:** APPROVED
**Reason:** This restores fail-fast, structured error behavior (`PREPARING_FLOW_NOT_FOUND`) and prevents unnecessary downstream work/AI calls for invalid explicit IDs.

### [x] 2. Re-add `integer` Type Support in Generic Schema Validator
**File:** `src/lib/schema-validate.js`  
**Issue:** `integer` handling was removed from `checkType` and numeric constraint evaluation, reducing validator correctness/consistency for schemas that still use `type: "integer"`.  
**Suggestion:** Add back `integer` support in both type checks and numeric constraints (shared with `number`), keeping one unified path for min/max checks.

**Verdict:** APPROVED
**Reason:** Removing `integer` support is a correctness regression for schemas that use `type: "integer"`; re-adding it is a low-risk compatibility fix.

### [ ] 3. Remove Repeated Preset Validation Wiring in Entrypoints
**File:** `src/setup.js`  
**Issue:** `validatePresetChain(...)` invocation logic is duplicated across multiple entrypoints with near-identical argument construction.  
**Suggestion:** Extract a shared helper (for example `validatePresetChainFromConfig(config, root)`) and call it from setup/build/upgrade to reduce drift and keep behavior consistent.

**Verdict:** REJECTED
**Reason:** This is mainly maintainability cleanup; behavior gain is limited, and centralizing may accidentally alter per-entrypoint error handling paths.

### [x] 4. Avoid Fragile Prompt-Assembly Coupling to Regex-Based Tests
**File:** `src/flow/lib/run-draft-task.js`  
**Issue:** `buildDraftPrompt()` relies on subtle newline/layout behavior so tests can strip a section via regex and compare string equality, which is brittle and hard to maintain.  
**Suggestion:** Build prompt sections as structured arrays and join deterministically, and update tests to assert semantic sections instead of exact string-shape equivalence.

**Verdict:** APPROVED
**Reason:** The current regex-coupled string-shape testing is brittle; section-based assembly and semantic assertions improve test robustness without changing intended behavior.

### [x] 5. Fix Step-Marking Consistency in Prepare Flow
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The code marks `branch` and `spec` as done during initialization, which is inconsistent with the intended prepare lifecycle (and the surrounding comment/history expectations).  
**Suggestion:** Mark `branch` and `prepare-spec` as done, leaving `spec` pending until the actual spec step is completed.

**Verdict:** APPROVED
**Reason:** Marking `spec` done during prepare is lifecycle-inconsistent; switching to `prepare-spec` done and leaving `spec` pending is a behavior-correct fix.

### [ ] 6. Reduce Hardcoded Coverage Count Fragility
**File:** `tests/unit/flow/instructions-coverage.test.js`  
**Issue:** The test hardcodes `23` instruction keys, which causes noisy churn whenever keys are added/removed without changing real behavior quality.  
**Suggestion:** Assert invariant relationships (for example “no missing prompt files” and “no orphan prompt files”) and compute expected counts from source-of-truth rules instead of a fixed literal.

**Verdict:** REJECTED
**Reason:** Replacing the fixed count can weaken contract strictness; this is mostly test-maintenance optimization and may reduce sensitivity to unintended rule-surface changes.
