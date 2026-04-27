# Code Review Results

### [ ] 1. Bound gate prompt payload size
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `diff` is built by concatenating committed/uncommitted/untracked diffs and injected into the AI prompt without an explicit size cap. This is a bounded-resource-usage risk (large repos or generated files can cause unbounded memory/token growth).  
**Suggestion:** Add explicit upper bounds (for example max bytes and/or max changed files), truncate deterministically with a marker, and fail early with a clear envelope code when limits are exceeded.

**Verdict:** REJECTED
**Reason:** Hardening is valuable, but this introduces a new failure mode (or truncated-evaluation path) for large diffs, which is behavior change and could cause false gate outcomes unless contract/spec updates are done first.

### [x] 2. Remove now-dead warning plumbing
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `unusedWarnings` is now always `[]` but is still carried through the flow, which adds dead code paths and cognitive overhead.  
**Suggestion:** Remove `unusedWarnings` and related merge/forwarding logic, or only construct warnings when an active source exists.

**Verdict:** APPROVED
**Reason:** `unusedWarnings` is effectively dead (`[]`), so removing its merge/forwarding path reduces noise without changing runtime behavior.

### [ ] 3. Rename prompt builder to match its current role
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `buildImplCheckPrompt` name still implies test-evidence-aware implementation checking, but the function now performs requirement-vs-diff evaluation only.  
**Suggestion:** Rename to something like `buildRequirementCheckPrompt` (and align local variable names) to keep naming consistent with actual behavior.

**Verdict:** REJECTED
**Reason:** This is primarily cosmetic naming cleanup; low impact on quality and no functional gain.

### [x] 4. Fix schema/action semantic mismatch
**File:** `src/flow/schemas/context-rules.json`  
**Issue:** The `flow.test` action now references `next-action/impl.schema.json`, which mixes two different action semantics and makes the contract harder to reason about.  
**Suggestion:** Introduce a dedicated schema for the current test-step output shape (or rename the action/instructions key to reflect implementation semantics).

**Verdict:** APPROVED
**Reason:** `flow.test` pointing to `impl` schema is a contract mismatch; aligning action semantics and schema improves correctness/maintainability and reduces validation ambiguity.

### [ ] 5. Eliminate repeated step-array literals in task step tests
**File:** `tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js`  
**Issue:** The same `[{ id: "impl" }, { id: "review" }, { id: "gate-impl" }]` patterns are repeated many times, increasing drift risk when step definitions change again.  
**Suggestion:** Extract helper builders (for pending/done/in-progress variants) and reuse them across cases.

**Verdict:** REJECTED
**Reason:** Mostly stylistic DRY refactor in tests; risk of obscuring per-case intent outweighs limited quality gain.

### [x] 6. Replace commented-out removed cases with active assertions
**File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Issue:** `// R2 removed` and `// R4b removed` are dead-comment placeholders; they do not verify the new intended behavior after removing test-change detection.  
**Suggestion:** Add explicit tests for the new contract (for example, test-file edits are no longer mechanically rejected, and retry behavior is governed by current gate logic), then remove placeholder comments.

**Verdict:** APPROVED
**Reason:** Replacing placeholder comments with explicit assertions restores behavioral verification for the new contract and clearly improves regression safety.

### [x] 7. Remove brittle magic-number coverage assertion
**File:** `tests/unit/flow/instructions-coverage.test.js`  
**Issue:** The test hardcodes `keys.length === 16`, which causes churn on every intentional step-set change and doesn’t directly validate correctness.  
**Suggestion:** Assert invariants instead (no orphan prompts, no missing referenced prompts, expected required keys present) and avoid fixed total-count checks.

**Verdict:** APPROVED
**Reason:** Fixed total-count assertions are churn-prone and weakly tied to correctness; invariant-based checks (missing/orphan/required mappings) are a stronger, less brittle signal.
