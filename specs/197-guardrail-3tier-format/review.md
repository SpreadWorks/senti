# Code Review Results

### [x] 1. Remove duplicated gate-step mapping
**File:** `src/flow/lib/run-gate.js` and `src/flow/registry.js`  
**Issue:** `resolveGateStepId()` is implemented in two places with the same branching logic, which risks drift when phases change again.  
**Suggestion:** Extract one shared helper (for example `src/flow/lib/gate-step.js`) and import it from both files.

**Verdict:** APPROVED
**Reason:** Real duplication with drift risk exists; extracting one shared resolver improves maintainability with minimal behavior risk if both call sites are switched together.

### [ ] 2. Eliminate unused/underused report builder
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `buildGateReport()` exists but runtime pass/fail paths (`gatePass`/`gateFail`) build report objects manually, so report-shape logic is split and partly duplicated.  
**Suggestion:** Either (a) use `buildGateReport()` inside `gatePass`/`gateFail` as the single report constructor, or (b) remove it if test-only utility is not intended for production.

**Verdict:** REJECTED
**Reason:** Proposal is ambiguous (`use` or `remove`). Removing it can break current tests/contracts, and wiring it in needs careful shape parity; as written, risk is too high for a safe refactor call.

### [x] 3. Avoid double phase filtering in guardrail checks
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkGuardrail()` filters guardrails once, then calls `buildGuardrailPrompt()` which filters again internally.  
**Suggestion:** Pass already-filtered guardrails into the prompt builder (or create `buildGuardrailPromptFromFiltered`) to remove duplicate logic and keep a single filtering point.

**Verdict:** APPROVED
**Reason:** This removes redundant logic and centralizes filtering without changing intent, reducing inconsistency risk.

### [x] 4. Clarify naming for implementation-level gate executor
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `executeImpl()` now handles both `task-impl` and `integration`, so the name no longer matches behavior.  
**Suggestion:** Rename to something phase-neutral like `executeDiffBasedGate()` or `executeImplementationGate()` for consistency with the new 3-tier model.

**Verdict:** APPROVED
**Reason:** Name no longer matches scope (`task-impl` + `integration`), so a neutral rename improves readability/maintainability with low behavioral risk if references are updated atomically.

### [ ] 5. Remove effectively dead strictness path or wire it properly
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `executeSpec()` hardcodes `const strict = false`, so strict checks in `checkSpecText()` are never used in real gate flow (only in tests).  
**Suggestion:** Either wire strict mode to an actual runtime condition (for example review/final gate context) or simplify by removing strict-only branches to reduce dead logic.

**Verdict:** REJECTED
**Reason:** Current proposal bundles two materially different changes. Wiring strict mode could alter runtime behavior, and removing strict branches may drop intended validation; too risky without a concrete runtime contract.

### [x] 6. Enforce complete evaluation coverage for schema consistency
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `parseEvaluationResponse()` validates unknown/duplicate IDs but does not ensure all expected IDs are present, despite prompt contract saying “exactly one entry per guardrail.”  
**Suggestion:** After parsing, compare `seen` with `knownIds` and throw `EvaluationSchemaError` on missing IDs. This keeps evaluation behavior deterministic and aligned with prompt design.

**Verdict:** APPROVED
**Reason:** This closes a real correctness gap (missing guardrails can pass silently) and aligns behavior with the declared “exactly one per guardrail” contract.
