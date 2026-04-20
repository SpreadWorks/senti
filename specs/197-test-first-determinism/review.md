# Code Review Results

### [x] 1. Re-centralize Gate Step Resolution
**File:** `src/flow/lib/run-gate.js` (also duplicated in `src/flow/registry.js`)  
**Issue:** `resolveGateStepId()` is now defined in two places, reintroducing branch duplication and drift risk when phase names change again.  
**Suggestion:** Move `resolveGateStepId()` back to a single shared helper module (e.g., `src/flow/lib/gate-step.js`) and import it from both callers.

**Verdict:** APPROVED
**Reason:** This is real duplication with drift risk (`run-gate.js` and `registry.js` now both branch on phase). A shared helper should improve maintainability without changing behavior if logic is moved as-is.

### [x] 2. Extract Repeated “AI Result → Reason” Mapping
**File:** `src/flow/lib/run-gate.js`  
**Issue:** Draft/spec/impl paths each manually convert parsed AI results into `{ verdict, detail }` arrays using near-identical loops.  
**Suggestion:** Add one helper (e.g., `toGateReasons(results)`) and reuse it in all three execution paths to reduce duplication and keep formatting behavior consistent.

**Verdict:** APPROVED
**Reason:** The same mapping logic is repeated across draft/spec/impl paths. A single helper reduces duplication and inconsistency risk with minimal behavioral risk if output shape stays identical.

### [x] 3. Remove Unused Parameter
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkGuardrail(root, targetText, _config, phase, role)` accepts `_config` but never uses it.  
**Suggestion:** Remove the unused parameter from definition and all call sites to simplify the function contract and reduce noise.

**Verdict:** APPROVED
**Reason:** `_config` is unused in `checkGuardrail`, so removing it simplifies the contract and reduces noise. Behavior should remain unchanged if all call sites are updated together.

### [ ] 4. Rename Parser to Match Actual Behavior
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `parseGuardrailResponse()` is used for both guardrail checks and requirement checks, but the name implies guardrail-only parsing.  
**Suggestion:** Rename to a neutral name like `parsePassFailLines()` (or `parseEvaluationLines()`) to improve intent clarity and avoid misleading usage context.

**Verdict:** REJECTED
**Reason:** This is mainly naming/cosmetic. It adds churn and potential call-site break risk with little concrete quality or correctness gain.

### [x] 5. Restore Issue-Log Field Consistency
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `appendIssueLogFromGateResult()` and `appendIssueLogFromGateError()` no longer write `phase`/`level`, while surrounding artifacts and existing flow records expect richer gate context.  
**Suggestion:** Re-add structured fields (`phase`, and `level` when available) to keep issue-log schema consistent and reduce downstream conditional handling.

**Verdict:** APPROVED
**Reason:** Re-adding `phase`/`level` (when available) improves artifact consistency and downstream handling. This is additive metadata and should not alter gate decision behavior.
