# Code Review Results

### [ ] 1. Cache `issue-log` Load Within Gate Evaluation
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `loadIssueLog(root, state.spec)` is called in multiple FAIL branches (`req` and combined guardrail path), duplicating I/O logic and making this flow harder to maintain.  
**Suggestion:** Load `issueLog` once in `runGateOnce` before FAIL branching, and reuse the same object for both `assertNoRepeatedFail(...)` calls.

**Verdict:** REJECTED
**Reason:** In current control flow, only one FAIL branch executes, so `loadIssueLog(...)` is called at most once already. Moving load upfront likely adds unnecessary I/O on PASS paths and can change behavior by introducing new failure points.

### [x] 2. Extract a Shared FAIL-Pair Key Builder
**File:** `src/flow/lib/run-gate.js`  
**Issue:** FAIL identity key construction is duplicated inline (`${guardrail_id}|${normalizeReason(reason)}`), which spreads core matching logic and risks subtle divergence.  
**Suggestion:** Introduce a helper like `buildFailPairKey({ guardrail_id, reason })` and use it in both `priorKeys` creation and current-match checks.

**Verdict:** APPROVED
**Reason:** This removes duplicated key-construction logic in a correctness-critical match path and lowers divergence risk without changing semantics.

### [ ] 3. Tighten “Previous FAIL” Selection Criteria
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `findPreviousFailedEvaluations` currently matches only by `phase` and presence of `failedEvaluations`, which can accidentally select non-target entries if future issue-log shapes expand.  
**Suggestion:** Add stricter predicates (for example expected `step`/`level`/entry type for gate FAIL records) so repeated-fail escalation only compares against intended prior gate-fail entries.

**Verdict:** REJECTED
**Reason:** Stricter predicates are risky unless entry schema invariants are formally guaranteed. Over-constraining selection could miss valid prior FAILs and silently weaken escalation behavior.

### [x] 4. Re-extract Common Search-Directory Assembly
**File:** `tests/run.js`  
**Issue:** The search-directory arrays (`tests/unit`, `tests/e2e`, `src/presets`) are reconstructed in multiple branches, reintroducing duplication after removing `test-runner-search-dirs.js`.  
**Suggestion:** Add small local helpers (for example `defaultSearchDirs()` and `presetSearchDirs(name)`) to centralize path construction and keep flag-branch logic focused on routing.

**Verdict:** APPROVED
**Reason:** There is real duplication in `tests/run.js`; small local helpers can improve maintainability and reduce branch drift, with low behavioral risk if outputs are kept identical.

### [x] 5. Reject Unsupported/Unknown Flags Explicitly
**File:** `tests/run.js`  
**Issue:** After removing `--agent`/`--all` handling, unsupported flags can be silently ignored, which weakens CLI feedback and can hide invocation mistakes.  
**Suggestion:** Add explicit unknown-flag validation (or a whitelist parser) so invalid options fail fast with a clear error message.

**Verdict:** APPROVED
**Reason:** Failing fast on unknown options improves CLI safety and prevents silent mis-invocations; this is a meaningful behavior-quality improvement, not cosmetic.
