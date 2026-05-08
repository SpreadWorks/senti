# Code Review Results

### 1. 1. Remove stale `hasFileMap` variable after source-selection refactor
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `hasFileMap` is computed but no longer used after switching to unconditional `spec.json` ID loading. This is dead code and can mislead readers into thinking file-map still controls the branch.  
**Suggestion:** Delete `const hasFileMap = Object.keys(fileMap).length > 0;` (and any related stale comments) to keep the control flow accurate and minimal.

### 2. 2. Add an explicit upper bound when enumerating requirement IDs
**File:** `src/lib/spec-json.js`  
**Issue:** `enumerateUsableRequirementIds` iterates all `requirements` entries without a hard cap. This can violate bounded-resource-usage expectations for unusually large `spec.json` inputs.  
**Suggestion:** Introduce a maximum scan count (for example `MAX_REQUIREMENTS_FOR_GATE`) and stop/throw when exceeded, so processing cost is explicitly bounded.

### 3. 3. Convert near-duplicate R5a–R5d tests into a table-driven test
**File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Issue:** The four new R5* cases repeat the same fixture wiring and assertion structure with only small input/output differences. This duplication increases maintenance cost and drift risk.  
**Suggestion:** Define a case table (`name`, `fileMap`, `stubResponse`, `expectStatus`, `expectPattern`) and iterate with one shared test body/helper.

### 4. 4. Clarify helper naming for response format intent
**File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Issue:** `passResponseFor` sounds like it returns a domain object, but it returns a JSON string payload for the stub agent. The mismatch is subtle but hurts readability.  
**Suggestion:** Rename to something explicit like `buildPassResponseJson` (or return an object and stringify at call site) so type/format intent is obvious.
