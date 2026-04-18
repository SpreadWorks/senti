# Code Review Results

### [x] 1. Revert Out-of-Scope Runtime Changes
**File:** `src/lib/agent.js`  
**Issue:** This spec is documented as “JSDoc only,” but runtime metric behavior was changed (e.g., `durationMs` propagation removed), which introduces scope creep and potential regression.  
**Suggestion:** Revert runtime changes in `src/lib/agent.js`, `src/lib/flow-manager.js`, `src/lib/flow-store.js`, `src/flow/commands/report.js`, `src/metrics/commands/token.js`, and related test deletions so this PR contains only JSDoc/spec-verification changes.

**Verdict:** APPROVED
**Reason:** The diff includes clear runtime/CLI behavior changes and test removals unrelated to a “JSDoc-only” spec, so reverting them improves scope discipline and reduces regression risk.

### [x] 2. Restore Safer Metrics API Shape
**File:** `src/lib/flow-manager.js`  
**Issue:** `accumulateAgentMetrics` was changed from an options object to positional args, increasing misuse risk and reducing readability as fields evolve.  
**Suggestion:** Use `accumulateAgentMetrics(phase, { usage, responseChars, model })` consistently across manager/store/callers.

**Verdict:** APPROVED
**Reason:** Switching back to an options object improves call-site clarity and reduces argument-order mistakes; behavior can remain unchanged if all callers are updated consistently.

### [x] 3. Fix Callback Contract Drift
**File:** `src/flow/commands/report.js`  
**Issue:** `forEachPhase` JSDoc/callback contract implies `(phase, phaseId)`, but implementation now passes only `phase`. This is a naming/design consistency issue.  
**Suggestion:** Either pass `phaseId` again (`Object.entries`) or update the callback signature/JSDoc everywhere to match the new behavior.

**Verdict:** APPROVED
**Reason:** JSDoc/contract mismatch is a real maintenance risk. Aligning signature and implementation (either direction) improves correctness without intended behavior change.

### [ ] 4. Remove Dead Placeholder QA Content
**File:** `specs/191-add-scannable-match-jsdoc/qa.md`  
**Issue:** File contains empty template placeholders (`Q:` / `A:`) that add noise and no value.  
**Suggestion:** Remove this file or replace placeholders with actual resolved clarifications only.

**Verdict:** REJECTED
**Reason:** This is mostly cosmetic cleanup and does not materially improve code quality or behavior safety.

### [ ] 5. Reintroduce Shared Row Finalization Helper
**File:** `src/metrics/commands/token.js`  
**Issue:** Final row-shaping logic is now inlined in `buildRows`, reducing reuse and making future duplication likely (it previously existed as a helper).  
**Suggestion:** Restore a small `finalizeRow(row)` helper and reuse it from row-building paths to keep transformation logic centralized.

**Verdict:** REJECTED
**Reason:** Current duplication is not clearly demonstrated; reintroducing abstraction now is speculative and may add unnecessary indirection.

### [x] 6. Make JSDoc Verification Less Regex-Brittle
**File:** `specs/191-add-scannable-match-jsdoc/tests/jsdoc-contract.test.js`  
**Issue:** The regex can break with minor formatting changes and may match unintended blocks.  
**Suggestion:** Anchor extraction more explicitly to `match(relPath)`’s nearest preceding JSDoc (or parse by line scanning) and keep keyword checks separate for easier maintenance.

**Verdict:** APPROVED
**Reason:** The current regex is fragile; tightening extraction logic improves test reliability with minimal behavioral risk to product code.
