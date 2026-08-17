# Code Review Results

### [x] 1. Restore Composable `runGate` Test Helper API
**File:** `tests/unit/specs/commands/guardrail.test.js`  
**Issue:** `runGate(dir, extraArgs)` allows callers to accidentally pass conflicting `--phase` flags and makes phase intent implicit again.  
**Suggestion:** Switch back to an options object like `runGate(dir, { phase = "spec", extraArgs = [] })` and construct `--phase` in exactly one place to avoid ambiguous test invocations.

**Verdict:** APPROVED
**Reason:** This improves test-call correctness by preventing contradictory `--phase` construction in one place, and it only affects test helper wiring (no production behavior impact if defaults stay equivalent).

### [ ] 2. Use a Mapping Table Instead of Branch Chain
**File:** `src/flow/lib/gate-step.js`  
**Issue:** `resolveGateStepId` uses hard-coded branching, which is less extensible and less consistent with “single source of truth” mapping style.  
**Suggestion:** Replace the branch chain with a frozen map (e.g. `PHASE_TO_STEP`) and a fallback lookup, so adding/removing phases is one-line data change.

**Verdict:** REJECTED
**Reason:** In this small function, the gain is mostly stylistic; table refactors add avoidable regression risk for fallback behavior without clear functional benefit.

### [x] 3. Reintroduce Explicit Active/Released Terminology
**File:** `src/templates/partials/worktree-mode.md`  
**Issue:** The simplified wording removed explicit “active vs released” state definitions, which increases interpretation ambiguity for boundary rules.  
**Suggestion:** Add concise state definitions (`active`, `released`) and reference those terms in MUST rules to keep policy language precise and consistent.

**Verdict:** APPROVED
**Reason:** The wording change materially improves policy precision and reduces interpretation ambiguity, with no runtime behavior change.

### [ ] 4. Reduce Duplication in Approval Messaging
**File:** `src/flow/prompts/plan/approval.md`  
**Issue:** Approval persistence guidance is duplicated across prompt text, locale messages, and command help, creating drift risk.  
**Suggestion:** Centralize the canonical command snippet in one shared message/template source and reference it from prompts/locales.

**Verdict:** REJECTED
**Reason:** Centralization here is mostly maintainability-oriented and introduces cross-file/template coupling risk; benefit is limited unless there is proven drift already causing defects.

### [ ] 5. Extract Shared Test Project Setup Helper
**File:** `tests/unit/flow/set-approval.test.js`  
**Issue:** `createProject`/`setupSpec` embed substantial reusable fixture setup logic inline, duplicating patterns seen in other flow command tests.  
**Suggestion:** Move this setup into `tests/helpers/` (e.g., `createFlowSpecProject`) to reduce duplication and make future flow-command tests shorter and more consistent.

**Verdict:** REJECTED
**Reason:** This is primarily structural cleanup; without clear repeated pain or inconsistency, it adds indirection and potential fixture coupling risk with limited quality gain.

### [ ] 6. Avoid Brittle Full-Property Equality in Schema Test
**File:** `tests/unit/spec/schema.test.js`  
**Issue:** The test hard-codes the exact full property list, so every additive schema change causes churn unrelated to behavior.  
**Suggestion:** Assert required invariants (presence of key fields + schema constraints like `additionalProperties`) instead of exact full-list equality, or split into “required keys” and “known optional keys” checks.

**Verdict:** REJECTED
**Reason:** Relaxing exact property assertions can let unintended schema surface changes slip through; strict schema-shape checks are safer for contract stability.
