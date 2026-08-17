# Code Review Results

### [x] 1. Extract hard-gate sum computation into a single helper
**File:** `src/flow/lib/run-auto-check.js`  
**Issue:** Hard-gate sum is computed in multiple places (`hardGateFailed` and `composeAutoCheck`), which duplicates logic and risks divergence if gate rules change again.  
**Suggestion:** Add a small helper like `computeHardGateSum(breakdown)` and reuse it in both locations. This removes duplication and keeps hard-gate semantics centralized.

**Verdict:** APPROVED
**Reason:** This removes real duplication in production logic and lowers drift risk if hard-gate rules change. If the helper is a pure extraction, behavior stays the same.

### [ ] 2. Improve constant naming for pass/fail intent clarity
**File:** `src/flow/lib/run-auto-check.js`  
**Issue:** `HARD_GATE_MIN_SUM` is technically correct but ambiguous about whether it represents a pass threshold, lower bound, or warning threshold.  
**Suggestion:** Rename to something intent-rich like `HARD_GATE_PASS_MIN_SUM` (or `HARD_GATE_REQUIRED_SUM`) so conditionals read clearly (`sum < HARD_GATE_PASS_MIN_SUM`).

**Verdict:** REJECTED
**Reason:** This is mostly naming-only. It may help readability, but it does not materially improve design or correctness, so it does not clear a conservative quality bar.

### [x] 3. Reduce repeated CLI test setup/parsing boilerplate
**File:** `tests/unit/flow/run-auto-check.test.js`  
**Issue:** Multiple tests repeat the same sequence (`setupProject` → `seedFlowState` → `runCli` → `JSON.parse`), which increases noise and maintenance cost.  
**Suggestion:** Extract a local helper in this test file, e.g. `runAutoCheck(tmp, aiOverrides)`, returning parsed envelope. Use it across all test cases to simplify structure and make each test focus only on assertions.

**Verdict:** APPROVED
**Reason:** This is a meaningful test maintainability improvement and reduces copy-paste setup errors. If the helper only wraps existing calls, test behavior remains unchanged.

### [ ] 4. Replace hardcoded score/threshold test literals with named expectations
**File:** `tests/unit/flow/run-auto-check.test.js`  
**Issue:** Assertions like `24` and `16` are magic numbers; if scoring constants change again, multiple tests may fail for non-behavioral reasons.  
**Suggestion:** Define local named constants in the test file (e.g. `EXPECTED_MAX_SCORE`, `EXPECTED_THRESHOLD`) and use those in assertions to improve readability and reduce brittle literals.

**Verdict:** REJECTED
**Reason:** In this case the literals are core contract values, and abstracting them can make regressions less obvious. This is mostly cosmetic and can weaken signal rather than improve it.
