# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Duplicate review-phase→step map across two files
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Issue:** **File:** `src/flow/commands/review.js`
**Issue:** `REVIEW_PHASE_NODE_MAP` (lines 81–86) duplicates the new `REVIEW_STEP_BY_PHASE` map in `definition.js` (the `draft-questions`/`draft-coverage`/`spec`/`test` entries are byte-identical). `definition.js` is now the owner of definition-derived mappings (R1/R5 move this ownership server-side), yet `review.js` re-derives phase→review-step locally. This is exactly the "消費側が生データを import して独自に導出する" anti-pattern called out in CLAUDE.md (モジュールのカプセル化), and it means a future step-id rename must be applied in two places.
**Suggestion:** Expose a definition-side query (e.g. `reviewStepIdForPhase(phase)` or reuse `resolveRuntimeStep`/`reviewStepIdForInput`) from `definition.js` and have `getReviewMaxAttempts` call it, deleting `REVIEW_PHASE_NODE_MAP` from `review.js`.
**Suggestion:** **File:** `src/flow/commands/review.js`
**Issue:** `REVIEW_PHASE_NODE_MAP` (lines 81–86) duplicates the new `REVIEW_STEP_BY_PHASE` map in `definition.js` (the `draft-questions`/`draft-coverage`/`spec`/`test` entries are byte-identical). `definition.js` is now the owner of definition-derived mappings (R1/R5 move this ownership server-side), yet `review.js` re-derives phase→review-step locally. This is exactly the "消費側が生データを import して独自に導出する" anti-pattern called out in CLAUDE.md (モジュールのカプセル化), and it means a future step-id rename must be applied in two places.
**Suggestion:** Expose a definition-side query (e.g. `reviewStepIdForPhase(phase)` or reuse `resolveRuntimeStep`/`reviewStepIdForInput`) from `definition.js` and have `getReviewMaxAttempts` call it, deleting `REVIEW_PHASE_NODE_MAP` from `review.js`.
**Rationale:** Loop review proposal.

### 2. 2. Repeated draft-phase predicate
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`
**Issue:** The literal check `phase === "draft" || phase === "draft-questions" || phase === "draft-coverage"` is duplicated in `reviewStepIdForInput` (line 247) and `resolvePlanReviewLifecycle` (line 283), and a near-variant (`startsWith("draft-")`) appears in `draftReviewRouteForInput` (line 241). Per the project rule, a pattern repeated 2+ times should be extracted immediately.
**Suggestion:** Add a small `isDraftPhase(phase)` helper and use it in all three sites so the set of draft phase names is defined once.
**Suggestion:** **File:** `src/flow/definition.js`
**Issue:** The literal check `phase === "draft" || phase === "draft-questions" || phase === "draft-coverage"` is duplicated in `reviewStepIdForInput` (line 247) and `resolvePlanReviewLifecycle` (line 283), and a near-variant (`startsWith("draft-")`) appears in `draftReviewRouteForInput` (line 241). Per the project rule, a pattern repeated 2+ times should be extracted immediately.
**Suggestion:** Add a small `isDraftPhase(phase)` helper and use it in all three sites so the set of draft phase names is defined once.
**Rationale:** Loop review proposal.

### 3. 3. Repeated "passing verdict" predicate
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`
**Issue:** `verdict === "PASS" || verdict === "ADVISORY"` is repeated in `resolvePlanReviewLifecycle` (spec branch line 291, test branch line 303) and `resolveImplReviewLifecycle` (line 322); the verdict string literals (`PASS`/`ADVISORY`/`FAIL`/`TOOLING_FAILURE`) are scattered as magic strings throughout the lifecycle resolvers.
**Suggestion:** Introduce a `isPassingVerdict(verdict)` helper (and optionally a frozen `VERDICTS` constant set) so verdict semantics live in one place and typos are caught centrally.
**Suggestion:** **File:** `src/flow/definition.js`
**Issue:** `verdict === "PASS" || verdict === "ADVISORY"` is repeated in `resolvePlanReviewLifecycle` (spec branch line 291, test branch line 303) and `resolveImplReviewLifecycle` (line 322); the verdict string literals (`PASS`/`ADVISORY`/`FAIL`/`TOOLING_FAILURE`) are scattered as magic strings throughout the lifecycle resolvers.
**Suggestion:** Introduce a `isPassingVerdict(verdict)` helper (and optionally a frozen `VERDICTS` constant set) so verdict semantics live in one place and typos are caught centrally.
**Rationale:** Loop review proposal.

### 4. 4. Repeated finalize downstream step list
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`
**Issue:** The literal `["finalize-sync", "finalize-cleanup"]` is hardcoded three times inside `resolveFinalizeLifecycle` (lines 368, 376, 395). This is the "finalize downstream leaf list" that R5 explicitly wants to stop being hardcoded; even though `definition.js` is the legitimate owner, repeating the literal defeats single-sourcing.
**Suggestion:** Hoist a module-level `const FINALIZE_DOWNSTREAM_STEPS = Object.freeze(["finalize-sync", "finalize-cleanup"])` and reference it in all three spots.
**Suggestion:** **File:** `src/flow/definition.js`
**Issue:** The literal `["finalize-sync", "finalize-cleanup"]` is hardcoded three times inside `resolveFinalizeLifecycle` (lines 368, 376, 395). This is the "finalize downstream leaf list" that R5 explicitly wants to stop being hardcoded; even though `definition.js` is the legitimate owner, repeating the literal defeats single-sourcing.
**Suggestion:** Hoist a module-level `const FINALIZE_DOWNSTREAM_STEPS = Object.freeze(["finalize-sync", "finalize-cleanup"])` and reference it in all three spots.
**Rationale:** Loop review proposal.

### 5. 5. Duplicated `currentStepId || "impl-review"` fallback
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`
**Issue:** `input.currentStepId || "impl-review"` appears twice in `resolveImplReviewLifecycle` (lines 323 and 334), embedding the same default in two branches.
**Suggestion:** Compute `const implStepId = input.currentStepId || "impl-review";` once at the top of the function and reuse it.
**Suggestion:** **File:** `src/flow/definition.js`
**Issue:** `input.currentStepId || "impl-review"` appears twice in `resolveImplReviewLifecycle` (lines 323 and 334), embedding the same default in two branches.
**Suggestion:** Compute `const implStepId = input.currentStepId || "impl-review";` once at the top of the function and reuse it.
**Rationale:** Loop review proposal.

### 6. 6. `gateStepIdForPhase` rebuilds the phase map on every call
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`
**Issue:** `gateStepIdForPhase` (line 235–237) calls `Object.fromEntries(collectGatePhaseEntries())` on every invocation, re-walking the definition tree each time it resolves a single phase. It is called from both `resolveRuntimeStep` and `resolveGateLifecycle`.
**Suggestion:** Build the entry map once (module-level lazily-initialized constant, mirroring the static `REVIEW_STEP_BY_PHASE`), or have `definition.js` expose a memoized gate-phase lookup, since the definition is frozen and never changes at runtime.

---

**Guardrail — Bounded Resource Usage:** No violation. The new lifecycle code iterates only over frozen fixed-size arrays (`IMPL_REVIEW_RESET_RANGE`, `REBUILDABLE_TEST_ARTIFACT_PATHS`), the relocated recursive step-tree helpers remain depth-bounded by `MAX_DEPTH`/`assertDepth`, and no new retry or recursion path is introduced without an explicit bound.
**Suggestion:** **File:** `src/flow/definition.js`
**Issue:** `gateStepIdForPhase` (line 235–237) calls `Object.fromEntries(collectGatePhaseEntries())` on every invocation, re-walking the definition tree each time it resolves a single phase. It is called from both `resolveRuntimeStep` and `resolveGateLifecycle`.
**Suggestion:** Build the entry map once (module-level lazily-initialized constant, mirroring the static `REVIEW_STEP_BY_PHASE`), or have `definition.js` expose a memoized gate-phase lookup, since the definition is frozen and never changes at runtime.

---

**Guardrail — Bounded Resource Usage:** No violation. The new lifecycle code iterates only over frozen fixed-size arrays (`IMPL_REVIEW_RESET_RANGE`, `REBUILDABLE_TEST_ARTIFACT_PATHS`), the relocated recursive step-tree helpers remain depth-bounded by `MAX_DEPTH`/`assertDepth`, and no new retry or recursion path is introduced without an explicit bound.
**Rationale:** Loop review proposal.

### 7. 1. Duplicate review-phase→step map across two files
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Issue:** **File:** `src/flow/commands/review.js`
**Issue:** `REVIEW_PHASE_NODE_MAP` (lines 81–86) duplicates the new `REVIEW_STEP_BY_PHASE` map in `definition.js` (the `draft-questions`/`draft-coverage`/`spec`/`test` entries are byte-identical). `definition.js` is now the owner of definition-derived mappings (R1/R5 move this ownership server-side), yet `review.js` re-derives phase→review-step locally. This is exactly the "消費側が生データを import して独自に導出する" anti-pattern called out in CLAUDE.md (モジュールのカプセル化), and it means a future step-id rename must be applied in two places.
**Suggestion:** Expose a definition-side query (e.g. `reviewStepIdForPhase(phase)` or reuse `resolveRuntimeStep`/`reviewStepIdForInput`) from `definition.js` and have `getReviewMaxAttempts` call it, deleting `REVIEW_PHASE_NODE_MAP` from `review.js`.
**Suggestion:** **File:** `src/flow/commands/review.js`
**Issue:** `REVIEW_PHASE_NODE_MAP` (lines 81–86) duplicates the new `REVIEW_STEP_BY_PHASE` map in `definition.js` (the `draft-questions`/`draft-coverage`/`spec`/`test` entries are byte-identical). `definition.js` is now the owner of definition-derived mappings (R1/R5 move this ownership server-side), yet `review.js` re-derives phase→review-step locally. This is exactly the "消費側が生データを import して独自に導出する" anti-pattern called out in CLAUDE.md (モジュールのカプセル化), and it means a future step-id rename must be applied in two places.
**Suggestion:** Expose a definition-side query (e.g. `reviewStepIdForPhase(phase)` or reuse `resolveRuntimeStep`/`reviewStepIdForInput`) from `definition.js` and have `getReviewMaxAttempts` call it, deleting `REVIEW_PHASE_NODE_MAP` from `review.js`.
**Rationale:** Loop review proposal.

### 8. 2. Repeated draft-phase predicate
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`
**Issue:** The literal check `phase === "draft" || phase === "draft-questions" || phase === "draft-coverage"` is duplicated in `reviewStepIdForInput` (line 247) and `resolvePlanReviewLifecycle` (line 283), and a near-variant (`startsWith("draft-")`) appears in `draftReviewRouteForInput` (line 241). Per the project rule, a pattern repeated 2+ times should be extracted immediately.
**Suggestion:** Add a small `isDraftPhase(phase)` helper and use it in all three sites so the set of draft phase names is defined once.
**Suggestion:** **File:** `src/flow/definition.js`
**Issue:** The literal check `phase === "draft" || phase === "draft-questions" || phase === "draft-coverage"` is duplicated in `reviewStepIdForInput` (line 247) and `resolvePlanReviewLifecycle` (line 283), and a near-variant (`startsWith("draft-")`) appears in `draftReviewRouteForInput` (line 241). Per the project rule, a pattern repeated 2+ times should be extracted immediately.
**Suggestion:** Add a small `isDraftPhase(phase)` helper and use it in all three sites so the set of draft phase names is defined once.
**Rationale:** Loop review proposal.

### 9. 3. Repeated "passing verdict" predicate
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`
**Issue:** `verdict === "PASS" || verdict === "ADVISORY"` is repeated in `resolvePlanReviewLifecycle` (spec branch line 291, test branch line 303) and `resolveImplReviewLifecycle` (line 322); the verdict string literals (`PASS`/`ADVISORY`/`FAIL`/`TOOLING_FAILURE`) are scattered as magic strings throughout the lifecycle resolvers.
**Suggestion:** Introduce a `isPassingVerdict(verdict)` helper (and optionally a frozen `VERDICTS` constant set) so verdict semantics live in one place and typos are caught centrally.
**Suggestion:** **File:** `src/flow/definition.js`
**Issue:** `verdict === "PASS" || verdict === "ADVISORY"` is repeated in `resolvePlanReviewLifecycle` (spec branch line 291, test branch line 303) and `resolveImplReviewLifecycle` (line 322); the verdict string literals (`PASS`/`ADVISORY`/`FAIL`/`TOOLING_FAILURE`) are scattered as magic strings throughout the lifecycle resolvers.
**Suggestion:** Introduce a `isPassingVerdict(verdict)` helper (and optionally a frozen `VERDICTS` constant set) so verdict semantics live in one place and typos are caught centrally.
**Rationale:** Loop review proposal.

### 10. 4. Repeated finalize downstream step list
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`
**Issue:** The literal `["finalize-sync", "finalize-cleanup"]` is hardcoded three times inside `resolveFinalizeLifecycle` (lines 368, 376, 395). This is the "finalize downstream leaf list" that R5 explicitly wants to stop being hardcoded; even though `definition.js` is the legitimate owner, repeating the literal defeats single-sourcing.
**Suggestion:** Hoist a module-level `const FINALIZE_DOWNSTREAM_STEPS = Object.freeze(["finalize-sync", "finalize-cleanup"])` and reference it in all three spots.
**Suggestion:** **File:** `src/flow/definition.js`
**Issue:** The literal `["finalize-sync", "finalize-cleanup"]` is hardcoded three times inside `resolveFinalizeLifecycle` (lines 368, 376, 395). This is the "finalize downstream leaf list" that R5 explicitly wants to stop being hardcoded; even though `definition.js` is the legitimate owner, repeating the literal defeats single-sourcing.
**Suggestion:** Hoist a module-level `const FINALIZE_DOWNSTREAM_STEPS = Object.freeze(["finalize-sync", "finalize-cleanup"])` and reference it in all three spots.
**Rationale:** Loop review proposal.

### 11. 5. Duplicated `currentStepId || "impl-review"` fallback
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`
**Issue:** `input.currentStepId || "impl-review"` appears twice in `resolveImplReviewLifecycle` (lines 323 and 334), embedding the same default in two branches.
**Suggestion:** Compute `const implStepId = input.currentStepId || "impl-review";` once at the top of the function and reuse it.
**Suggestion:** **File:** `src/flow/definition.js`
**Issue:** `input.currentStepId || "impl-review"` appears twice in `resolveImplReviewLifecycle` (lines 323 and 334), embedding the same default in two branches.
**Suggestion:** Compute `const implStepId = input.currentStepId || "impl-review";` once at the top of the function and reuse it.
**Rationale:** Loop review proposal.

### 12. 6. `gateStepIdForPhase` rebuilds the phase map on every call
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`
**Issue:** `gateStepIdForPhase` (line 235–237) calls `Object.fromEntries(collectGatePhaseEntries())` on every invocation, re-walking the definition tree each time it resolves a single phase. It is called from both `resolveRuntimeStep` and `resolveGateLifecycle`.
**Suggestion:** Build the entry map once (module-level lazily-initialized constant, mirroring the static `REVIEW_STEP_BY_PHASE`), or have `definition.js` expose a memoized gate-phase lookup, since the definition is frozen and never changes at runtime.

---

**Guardrail — Bounded Resource Usage:** No violation. The new lifecycle code iterates only over frozen fixed-size arrays (`IMPL_REVIEW_RESET_RANGE`, `REBUILDABLE_TEST_ARTIFACT_PATHS`), the relocated recursive step-tree helpers remain depth-bounded by `MAX_DEPTH`/`assertDepth`, and no new retry or recursion path is introduced without an explicit bound.
**Suggestion:** **File:** `src/flow/definition.js`
**Issue:** `gateStepIdForPhase` (line 235–237) calls `Object.fromEntries(collectGatePhaseEntries())` on every invocation, re-walking the definition tree each time it resolves a single phase. It is called from both `resolveRuntimeStep` and `resolveGateLifecycle`.
**Suggestion:** Build the entry map once (module-level lazily-initialized constant, mirroring the static `REVIEW_STEP_BY_PHASE`), or have `definition.js` expose a memoized gate-phase lookup, since the definition is frozen and never changes at runtime.

---

**Guardrail — Bounded Resource Usage:** No violation. The new lifecycle code iterates only over frozen fixed-size arrays (`IMPL_REVIEW_RESET_RANGE`, `REBUILDABLE_TEST_ARTIFACT_PATHS`), the relocated recursive step-tree helpers remain depth-bounded by `MAX_DEPTH`/`assertDepth`, and no new retry or recursion path is introduced without an explicit bound.
**Rationale:** Loop review proposal.

### 13. 1. `flattenForGate` duplicates `flattenSteps` and lacks a depth bound
**Failure mode:** refactor
**File:** src/flow/lib/gate-step.js
**Issue:** **File:** `src/flow/lib/gate-step.js`
**Issue:** `flattenForGate` (lines 84–94) is a byte-for-byte reimplementation of `flattenSteps` from `step-tree.js` (leaf-only flatten). The sibling files in this same change set (`get-check.js`, `get-next-action.js`) were migrated to import `flattenSteps` from `./step-tree.js`, but `gate-step.js` kept its local copy. This both duplicates logic and leaves `gate-step.js` importing flow-tree utilities inconsistently with R2 ("all consumers shall import those utilities from the step-tree module"). Additionally, `flattenForGate` recurses on `s.children` with **no depth limit**, whereas `flattenSteps` enforces `MAX_STEP_TREE_DEPTH` via `assertDepth`. This is a **bounded-resource-usage** guardrail concern: the recursive flatten here is unbounded while the canonical implementation it duplicates is bounded.
**Suggestion:** Import `flattenSteps` from `./step-tree.js` and delete the local `flattenForGate` function; replace the single call site on line 40 (`flattenForGate(state.steps)`) with `flattenSteps(state.steps)`. This removes the duplication and inherits the existing depth bound in one move.
**Suggestion:** **File:** `src/flow/lib/gate-step.js`
**Issue:** `flattenForGate` (lines 84–94) is a byte-for-byte reimplementation of `flattenSteps` from `step-tree.js` (leaf-only flatten). The sibling files in this same change set (`get-check.js`, `get-next-action.js`) were migrated to import `flattenSteps` from `./step-tree.js`, but `gate-step.js` kept its local copy. This both duplicates logic and leaves `gate-step.js` importing flow-tree utilities inconsistently with R2 ("all consumers shall import those utilities from the step-tree module"). Additionally, `flattenForGate` recurses on `s.children` with **no depth limit**, whereas `flattenSteps` enforces `MAX_STEP_TREE_DEPTH` via `assertDepth`. This is a **bounded-resource-usage** guardrail concern: the recursive flatten here is unbounded while the canonical implementation it duplicates is bounded.
**Suggestion:** Import `flattenSteps` from `./step-tree.js` and delete the local `flattenForGate` function; replace the single call site on line 40 (`flattenForGate(state.steps)`) with `flattenSteps(state.steps)`. This removes the duplication and inherits the existing depth bound in one move.
**Rationale:** Loop review proposal.

### 14. 1. `flattenForGate` duplicates `flattenSteps` and lacks a depth bound
**Failure mode:** refactor
**File:** src/flow/lib/gate-step.js
**Issue:** **File:** `src/flow/lib/gate-step.js`
**Issue:** `flattenForGate` (lines 84–94) is a byte-for-byte reimplementation of `flattenSteps` from `step-tree.js` (leaf-only flatten). The sibling files in this same change set (`get-check.js`, `get-next-action.js`) were migrated to import `flattenSteps` from `./step-tree.js`, but `gate-step.js` kept its local copy. This both duplicates logic and leaves `gate-step.js` importing flow-tree utilities inconsistently with R2 ("all consumers shall import those utilities from the step-tree module"). Additionally, `flattenForGate` recurses on `s.children` with **no depth limit**, whereas `flattenSteps` enforces `MAX_STEP_TREE_DEPTH` via `assertDepth`. This is a **bounded-resource-usage** guardrail concern: the recursive flatten here is unbounded while the canonical implementation it duplicates is bounded.
**Suggestion:** Import `flattenSteps` from `./step-tree.js` and delete the local `flattenForGate` function; replace the single call site on line 40 (`flattenForGate(state.steps)`) with `flattenSteps(state.steps)`. This removes the duplication and inherits the existing depth bound in one move.
**Suggestion:** **File:** `src/flow/lib/gate-step.js`
**Issue:** `flattenForGate` (lines 84–94) is a byte-for-byte reimplementation of `flattenSteps` from `step-tree.js` (leaf-only flatten). The sibling files in this same change set (`get-check.js`, `get-next-action.js`) were migrated to import `flattenSteps` from `./step-tree.js`, but `gate-step.js` kept its local copy. This both duplicates logic and leaves `gate-step.js` importing flow-tree utilities inconsistently with R2 ("all consumers shall import those utilities from the step-tree module"). Additionally, `flattenForGate` recurses on `s.children` with **no depth limit**, whereas `flattenSteps` enforces `MAX_STEP_TREE_DEPTH` via `assertDepth`. This is a **bounded-resource-usage** guardrail concern: the recursive flatten here is unbounded while the canonical implementation it duplicates is bounded.
**Suggestion:** Import `flattenSteps` from `./step-tree.js` and delete the local `flattenForGate` function; replace the single call site on line 40 (`flattenForGate(state.steps)`) with `flattenSteps(state.steps)`. This removes the duplication and inherits the existing depth bound in one move.
**Rationale:** Loop review proposal.

### 15. 2. Triplicated `findActiveNode({ steps, tasks, currentTaskId })` literal
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Issue:** **File:** `src/flow/lib/get-next-action.js`
**Issue:** The new object-argument form of `findActiveNode` is constructed from the same three `state` fields at three call sites (lines 191–195, 210–214, 225–229), each rebuilding the identical `{ steps: state.steps, tasks: state.tasks, currentTaskId: state.currentTaskId }` literal. Per the project rule "同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出する", this crosses the threshold.
**Suggestion:** Add a thin local helper, e.g. `const activeNodeOf = (s) => findActiveNode({ steps: s.steps, tasks: s.tasks, currentTaskId: s.currentTaskId });`, and replace the three call sites with `activeNodeOf(state)`. This keeps the call sites readable and confines the shape of `findActiveNode`'s argument to one place.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`
**Issue:** The new object-argument form of `findActiveNode` is constructed from the same three `state` fields at three call sites (lines 191–195, 210–214, 225–229), each rebuilding the identical `{ steps: state.steps, tasks: state.tasks, currentTaskId: state.currentTaskId }` literal. Per the project rule "同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出する", this crosses the threshold.
**Suggestion:** Add a thin local helper, e.g. `const activeNodeOf = (s) => findActiveNode({ steps: s.steps, tasks: s.tasks, currentTaskId: s.currentTaskId });`, and replace the three call sites with `activeNodeOf(state)`. This keeps the call sites readable and confines the shape of `findActiveNode`'s argument to one place.
**Rationale:** Loop review proposal.

### 16. 2. Triplicated `findActiveNode({ steps, tasks, currentTaskId })` literal
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Issue:** **File:** `src/flow/lib/get-next-action.js`
**Issue:** The new object-argument form of `findActiveNode` is constructed from the same three `state` fields at three call sites (lines 191–195, 210–214, 225–229), each rebuilding the identical `{ steps: state.steps, tasks: state.tasks, currentTaskId: state.currentTaskId }` literal. Per the project rule "同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出する", this crosses the threshold.
**Suggestion:** Add a thin local helper, e.g. `const activeNodeOf = (s) => findActiveNode({ steps: s.steps, tasks: s.tasks, currentTaskId: s.currentTaskId });`, and replace the three call sites with `activeNodeOf(state)`. This keeps the call sites readable and confines the shape of `findActiveNode`'s argument to one place.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`
**Issue:** The new object-argument form of `findActiveNode` is constructed from the same three `state` fields at three call sites (lines 191–195, 210–214, 225–229), each rebuilding the identical `{ steps: state.steps, tasks: state.tasks, currentTaskId: state.currentTaskId }` literal. Per the project rule "同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出する", this crosses the threshold.
**Suggestion:** Add a thin local helper, e.g. `const activeNodeOf = (s) => findActiveNode({ steps: s.steps, tasks: s.tasks, currentTaskId: s.currentTaskId });`, and replace the three call sites with `activeNodeOf(state)`. This keeps the call sites readable and confines the shape of `findActiveNode`'s argument to one place.
**Rationale:** Loop review proposal.

### 17. 1. Duplicate node-lookup-then-step-done pattern
**Failure mode:** refactor
**File:** src/flow/lib/resolve-auto-check-input.js
**Issue:** **File:** `src/flow/lib/resolve-auto-check-input.js`
**Issue:** After this diff, `isSpecApproved` (line 33-36) and `isDraftGateDone` (line 38-41) are byte-for-byte identical except for the node key string:
```js
export function isSpecApproved(state) {
  const node = getFlowNode("approval");
  return node ? isStepDone(state, node.id) : false;
}
function isDraftGateDone(state) {
  const node = getFlowNode("draft-gate");
  return node ? isStepDone(state, node.id) : false;
}
```
The diff edited both of these lines (changing `resolveNodeFor(FLOW_DEFINITION, "...")` → `getFlowNode("...")`), so they are in scope. The project rule (`CLAUDE.md`: extract a shared helper at the 2nd occurrence, don't wait for the 3rd) applies directly.
**Suggestion:** Extract a private helper and define both predicates in terms of it:
```js
function isNodeStepDone(state, key) {
  const node = getFlowNode(key);
  return node ? isStepDone(state, node.id) : false;
}
export function isSpecApproved(state) { return isNodeStepDone(state, "approval"); }
function isDraftGateDone(state) { return isNodeStepDone(state, "draft-gate"); }
```

---

No other issues found in the touched files:
- **get-status.js** / **resolve-context-envelope.js**: pure import relocation and a single call-site API swap; no duplication, dead code, or naming problems introduced.
- **Guardrail `bounded-resource-usage`**: not implicated — this change introduces no recursion, retry loop, or bulk load. (`flattenSteps`/`findStepById` recurse over the static step tree but are unchanged by this diff and bounded by the definition's fixed depth.)
**Suggestion:** **File:** `src/flow/lib/resolve-auto-check-input.js`
**Issue:** After this diff, `isSpecApproved` (line 33-36) and `isDraftGateDone` (line 38-41) are byte-for-byte identical except for the node key string:
```js
export function isSpecApproved(state) {
  const node = getFlowNode("approval");
  return node ? isStepDone(state, node.id) : false;
}
function isDraftGateDone(state) {
  const node = getFlowNode("draft-gate");
  return node ? isStepDone(state, node.id) : false;
}
```
The diff edited both of these lines (changing `resolveNodeFor(FLOW_DEFINITION, "...")` → `getFlowNode("...")`), so they are in scope. The project rule (`CLAUDE.md`: extract a shared helper at the 2nd occurrence, don't wait for the 3rd) applies directly.
**Suggestion:** Extract a private helper and define both predicates in terms of it:
```js
function isNodeStepDone(state, key) {
  const node = getFlowNode(key);
  return node ? isStepDone(state, node.id) : false;
}
export function isSpecApproved(state) { return isNodeStepDone(state, "approval"); }
function isDraftGateDone(state) { return isNodeStepDone(state, "draft-gate"); }
```

---

No other issues found in the touched files:
- **get-status.js** / **resolve-context-envelope.js**: pure import relocation and a single call-site API swap; no duplication, dead code, or naming problems introduced.
- **Guardrail `bounded-resource-usage`**: not implicated — this change introduces no recursion, retry loop, or bulk load. (`flattenSteps`/`findStepById` recurse over the static step tree but are unchanged by this diff and bounded by the definition's fixed depth.)
**Rationale:** Loop review proposal.

### 18. 1. Duplicate node-lookup-then-step-done pattern
**Failure mode:** refactor
**File:** src/flow/lib/resolve-auto-check-input.js
**Issue:** **File:** `src/flow/lib/resolve-auto-check-input.js`
**Issue:** After this diff, `isSpecApproved` (line 33-36) and `isDraftGateDone` (line 38-41) are byte-for-byte identical except for the node key string:
```js
export function isSpecApproved(state) {
  const node = getFlowNode("approval");
  return node ? isStepDone(state, node.id) : false;
}
function isDraftGateDone(state) {
  const node = getFlowNode("draft-gate");
  return node ? isStepDone(state, node.id) : false;
}
```
The diff edited both of these lines (changing `resolveNodeFor(FLOW_DEFINITION, "...")` → `getFlowNode("...")`), so they are in scope. The project rule (`CLAUDE.md`: extract a shared helper at the 2nd occurrence, don't wait for the 3rd) applies directly.
**Suggestion:** Extract a private helper and define both predicates in terms of it:
```js
function isNodeStepDone(state, key) {
  const node = getFlowNode(key);
  return node ? isStepDone(state, node.id) : false;
}
export function isSpecApproved(state) { return isNodeStepDone(state, "approval"); }
function isDraftGateDone(state) { return isNodeStepDone(state, "draft-gate"); }
```

---

No other issues found in the touched files:
- **get-status.js** / **resolve-context-envelope.js**: pure import relocation and a single call-site API swap; no duplication, dead code, or naming problems introduced.
- **Guardrail `bounded-resource-usage`**: not implicated — this change introduces no recursion, retry loop, or bulk load. (`flattenSteps`/`findStepById` recurse over the static step tree but are unchanged by this diff and bounded by the definition's fixed depth.)
**Suggestion:** **File:** `src/flow/lib/resolve-auto-check-input.js`
**Issue:** After this diff, `isSpecApproved` (line 33-36) and `isDraftGateDone` (line 38-41) are byte-for-byte identical except for the node key string:
```js
export function isSpecApproved(state) {
  const node = getFlowNode("approval");
  return node ? isStepDone(state, node.id) : false;
}
function isDraftGateDone(state) {
  const node = getFlowNode("draft-gate");
  return node ? isStepDone(state, node.id) : false;
}
```
The diff edited both of these lines (changing `resolveNodeFor(FLOW_DEFINITION, "...")` → `getFlowNode("...")`), so they are in scope. The project rule (`CLAUDE.md`: extract a shared helper at the 2nd occurrence, don't wait for the 3rd) applies directly.
**Suggestion:** Extract a private helper and define both predicates in terms of it:
```js
function isNodeStepDone(state, key) {
  const node = getFlowNode(key);
  return node ? isStepDone(state, node.id) : false;
}
export function isSpecApproved(state) { return isNodeStepDone(state, "approval"); }
function isDraftGateDone(state) { return isNodeStepDone(state, "draft-gate"); }
```

---

No other issues found in the touched files:
- **get-status.js** / **resolve-context-envelope.js**: pure import relocation and a single call-site API swap; no duplication, dead code, or naming problems introduced.
- **Guardrail `bounded-resource-usage`**: not implicated — this change introduces no recursion, retry loop, or bulk load. (`flattenSteps`/`findStepById` recurse over the static step tree but are unchanged by this diff and bounded by the definition's fixed depth.)
**Rationale:** Loop review proposal.

### 19. 1. Duplicate node-lookup-then-step-done pattern
**Failure mode:** refactor
**File:** src/flow/lib/resolve-auto-check-input.js
**Issue:** **File:** `src/flow/lib/resolve-auto-check-input.js`
**Issue:** After this diff, `isSpecApproved` (line 33-36) and `isDraftGateDone` (line 38-41) are byte-for-byte identical except for the node key string:
```js
export function isSpecApproved(state) {
  const node = getFlowNode("approval");
  return node ? isStepDone(state, node.id) : false;
}
function isDraftGateDone(state) {
  const node = getFlowNode("draft-gate");
  return node ? isStepDone(state, node.id) : false;
}
```
The diff edited both of these lines (changing `resolveNodeFor(FLOW_DEFINITION, "...")` → `getFlowNode("...")`), so they are in scope. The project rule (`CLAUDE.md`: extract a shared helper at the 2nd occurrence, don't wait for the 3rd) applies directly.
**Suggestion:** Extract a private helper and define both predicates in terms of it:
```js
function isNodeStepDone(state, key) {
  const node = getFlowNode(key);
  return node ? isStepDone(state, node.id) : false;
}
export function isSpecApproved(state) { return isNodeStepDone(state, "approval"); }
function isDraftGateDone(state) { return isNodeStepDone(state, "draft-gate"); }
```

---

No other issues found in the touched files:
- **get-status.js** / **resolve-context-envelope.js**: pure import relocation and a single call-site API swap; no duplication, dead code, or naming problems introduced.
- **Guardrail `bounded-resource-usage`**: not implicated — this change introduces no recursion, retry loop, or bulk load. (`flattenSteps`/`findStepById` recurse over the static step tree but are unchanged by this diff and bounded by the definition's fixed depth.)
**Suggestion:** **File:** `src/flow/lib/resolve-auto-check-input.js`
**Issue:** After this diff, `isSpecApproved` (line 33-36) and `isDraftGateDone` (line 38-41) are byte-for-byte identical except for the node key string:
```js
export function isSpecApproved(state) {
  const node = getFlowNode("approval");
  return node ? isStepDone(state, node.id) : false;
}
function isDraftGateDone(state) {
  const node = getFlowNode("draft-gate");
  return node ? isStepDone(state, node.id) : false;
}
```
The diff edited both of these lines (changing `resolveNodeFor(FLOW_DEFINITION, "...")` → `getFlowNode("...")`), so they are in scope. The project rule (`CLAUDE.md`: extract a shared helper at the 2nd occurrence, don't wait for the 3rd) applies directly.
**Suggestion:** Extract a private helper and define both predicates in terms of it:
```js
function isNodeStepDone(state, key) {
  const node = getFlowNode(key);
  return node ? isStepDone(state, node.id) : false;
}
export function isSpecApproved(state) { return isNodeStepDone(state, "approval"); }
function isDraftGateDone(state) { return isNodeStepDone(state, "draft-gate"); }
```

---

No other issues found in the touched files:
- **get-status.js** / **resolve-context-envelope.js**: pure import relocation and a single call-site API swap; no duplication, dead code, or naming problems introduced.
- **Guardrail `bounded-resource-usage`**: not implicated — this change introduces no recursion, retry loop, or bulk load. (`flattenSteps`/`findStepById` recurse over the static step tree but are unchanged by this diff and bounded by the definition's fixed depth.)
**Rationale:** Loop review proposal.

### 20. 1. `flattenSteps` replacement changes traversal semantics (leaf-only vs. all-nodes)
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Issue:** The removed local `flattenSteps` pushed **every** node (parents *and* leaves):
```js
flat.push(s);                       // every node, including parents
if (Array.isArray(s.children)) flat.push(...flattenSteps(s.children));
```
The `flattenSteps` now imported from `./step-tree.js` pushes **only leaf nodes** (it recurses into `children` without pushing the parent). These are not equivalent. The consumer at lines 715–724 collects steps carrying `runtimeLog` and matches them by `id`. If any group/parent node can ever carry a `runtimeLog`, the new leaf-only behavior silently drops it and runtime-log adoption regresses during finalize-cleanup.
**Suggestion:** Confirm that `runtimeLog` is only ever set on leaf steps (in which case the `!wtStep.runtimeLog` filter makes the two implementations equivalent and this is safe). If parent nodes can hold a `runtimeLog`, this consumer needs the all-nodes variant, not the leaf-only one — the unification under a single name is hiding a behavioral change. Add/keep a spec-local test that asserts the finalize-cleanup runtime-log adoption against a tree with `runtimeLog` on both leaf and non-leaf nodes to lock the intended semantics.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Issue:** The removed local `flattenSteps` pushed **every** node (parents *and* leaves):
```js
flat.push(s);                       // every node, including parents
if (Array.isArray(s.children)) flat.push(...flattenSteps(s.children));
```
The `flattenSteps` now imported from `./step-tree.js` pushes **only leaf nodes** (it recurses into `children` without pushing the parent). These are not equivalent. The consumer at lines 715–724 collects steps carrying `runtimeLog` and matches them by `id`. If any group/parent node can ever carry a `runtimeLog`, the new leaf-only behavior silently drops it and runtime-log adoption regresses during finalize-cleanup.
**Suggestion:** Confirm that `runtimeLog` is only ever set on leaf steps (in which case the `!wtStep.runtimeLog` filter makes the two implementations equivalent and this is safe). If parent nodes can hold a `runtimeLog`, this consumer needs the all-nodes variant, not the leaf-only one — the unification under a single name is hiding a behavioral change. Add/keep a spec-local test that asserts the finalize-cleanup runtime-log adoption against a tree with `runtimeLog` on both leaf and non-leaf nodes to lock the intended semantics.
**Rationale:** Loop review proposal.

### 21. 2. Mid-file `import` statement reduces readability
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Issue:** Line 1610 keeps an `import { resolveMaxAttempts } from "../definition.js";` buried in the middle of the file (under the "Retry counter & escalation" banner). ES module imports are hoisted regardless of position, so placing it here only obscures the module's true dependency set and diverges from the top-of-file import convention used by the other touched files (`run-prepare-spec.js`, `run-finalize-cleanup.js`). The diff already edited this exact line, so it is in-scope to tidy.
**Suggestion:** Move the `resolveMaxAttempts` import into the top import block with the file's other imports and delete the mid-file import line.

---

Note on the `bounded-resource-usage` guardrail: the three touched files introduce no unbounded recursion/retry/bulk-load. The removed recursive `flattenSteps` was actually replaced by a depth-bounded implementation (`assertDepth`/`MAX_STEP_TREE_DEPTH`) in `step-tree.js`, which is an improvement. `findStepById`/`findFirstPendingLeaf` in `step-tree.js` recurse without a depth bound, but `step-tree.js` is **not** part of this diff, so per the scope constraint I am not raising a proposal against it.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Issue:** Line 1610 keeps an `import { resolveMaxAttempts } from "../definition.js";` buried in the middle of the file (under the "Retry counter & escalation" banner). ES module imports are hoisted regardless of position, so placing it here only obscures the module's true dependency set and diverges from the top-of-file import convention used by the other touched files (`run-prepare-spec.js`, `run-finalize-cleanup.js`). The diff already edited this exact line, so it is in-scope to tidy.
**Suggestion:** Move the `resolveMaxAttempts` import into the top import block with the file's other imports and delete the mid-file import line.

---

Note on the `bounded-resource-usage` guardrail: the three touched files introduce no unbounded recursion/retry/bulk-load. The removed recursive `flattenSteps` was actually replaced by a depth-bounded implementation (`assertDepth`/`MAX_STEP_TREE_DEPTH`) in `step-tree.js`, which is an improvement. `findStepById`/`findFirstPendingLeaf` in `step-tree.js` recurse without a depth bound, but `step-tree.js` is **not** part of this diff, so per the scope constraint I am not raising a proposal against it.
**Rationale:** Loop review proposal.

### 22. 1. `flattenSteps` replacement changes traversal semantics (leaf-only vs. all-nodes)
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Issue:** The removed local `flattenSteps` pushed **every** node (parents *and* leaves):
```js
flat.push(s);                       // every node, including parents
if (Array.isArray(s.children)) flat.push(...flattenSteps(s.children));
```
The `flattenSteps` now imported from `./step-tree.js` pushes **only leaf nodes** (it recurses into `children` without pushing the parent). These are not equivalent. The consumer at lines 715–724 collects steps carrying `runtimeLog` and matches them by `id`. If any group/parent node can ever carry a `runtimeLog`, the new leaf-only behavior silently drops it and runtime-log adoption regresses during finalize-cleanup.
**Suggestion:** Confirm that `runtimeLog` is only ever set on leaf steps (in which case the `!wtStep.runtimeLog` filter makes the two implementations equivalent and this is safe). If parent nodes can hold a `runtimeLog`, this consumer needs the all-nodes variant, not the leaf-only one — the unification under a single name is hiding a behavioral change. Add/keep a spec-local test that asserts the finalize-cleanup runtime-log adoption against a tree with `runtimeLog` on both leaf and non-leaf nodes to lock the intended semantics.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Issue:** The removed local `flattenSteps` pushed **every** node (parents *and* leaves):
```js
flat.push(s);                       // every node, including parents
if (Array.isArray(s.children)) flat.push(...flattenSteps(s.children));
```
The `flattenSteps` now imported from `./step-tree.js` pushes **only leaf nodes** (it recurses into `children` without pushing the parent). These are not equivalent. The consumer at lines 715–724 collects steps carrying `runtimeLog` and matches them by `id`. If any group/parent node can ever carry a `runtimeLog`, the new leaf-only behavior silently drops it and runtime-log adoption regresses during finalize-cleanup.
**Suggestion:** Confirm that `runtimeLog` is only ever set on leaf steps (in which case the `!wtStep.runtimeLog` filter makes the two implementations equivalent and this is safe). If parent nodes can hold a `runtimeLog`, this consumer needs the all-nodes variant, not the leaf-only one — the unification under a single name is hiding a behavioral change. Add/keep a spec-local test that asserts the finalize-cleanup runtime-log adoption against a tree with `runtimeLog` on both leaf and non-leaf nodes to lock the intended semantics.
**Rationale:** Loop review proposal.

### 23. 2. Mid-file `import` statement reduces readability
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Issue:** Line 1610 keeps an `import { resolveMaxAttempts } from "../definition.js";` buried in the middle of the file (under the "Retry counter & escalation" banner). ES module imports are hoisted regardless of position, so placing it here only obscures the module's true dependency set and diverges from the top-of-file import convention used by the other touched files (`run-prepare-spec.js`, `run-finalize-cleanup.js`). The diff already edited this exact line, so it is in-scope to tidy.
**Suggestion:** Move the `resolveMaxAttempts` import into the top import block with the file's other imports and delete the mid-file import line.

---

Note on the `bounded-resource-usage` guardrail: the three touched files introduce no unbounded recursion/retry/bulk-load. The removed recursive `flattenSteps` was actually replaced by a depth-bounded implementation (`assertDepth`/`MAX_STEP_TREE_DEPTH`) in `step-tree.js`, which is an improvement. `findStepById`/`findFirstPendingLeaf` in `step-tree.js` recurse without a depth bound, but `step-tree.js` is **not** part of this diff, so per the scope constraint I am not raising a proposal against it.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Issue:** Line 1610 keeps an `import { resolveMaxAttempts } from "../definition.js";` buried in the middle of the file (under the "Retry counter & escalation" banner). ES module imports are hoisted regardless of position, so placing it here only obscures the module's true dependency set and diverges from the top-of-file import convention used by the other touched files (`run-prepare-spec.js`, `run-finalize-cleanup.js`). The diff already edited this exact line, so it is in-scope to tidy.
**Suggestion:** Move the `resolveMaxAttempts` import into the top import block with the file's other imports and delete the mid-file import line.

---

Note on the `bounded-resource-usage` guardrail: the three touched files introduce no unbounded recursion/retry/bulk-load. The removed recursive `flattenSteps` was actually replaced by a depth-bounded implementation (`assertDepth`/`MAX_STEP_TREE_DEPTH`) in `step-tree.js`, which is an improvement. `findStepById`/`findFirstPendingLeaf` in `step-tree.js` recurse without a depth bound, but `step-tree.js` is **not** part of this diff, so per the scope constraint I am not raising a proposal against it.
**Rationale:** Loop review proposal.

### 24. 1. Dead code: orphaned impl-downstream step-id computation
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`
**Issue:** After `resetImplEvidenceAfterReviewProposals` was changed to delegate to `resetImplEvidenceStateAfterReviewProposals(...)` (definition.js), the local constant `IMPL_REVIEW_DOWNSTREAM_STEP_IDS` (line 48) is no longer referenced anywhere (confirmed across `src/`). It is now computed only to be discarded. Its sole producer `inclusiveFlowLeafStepIdsBetween` (lines 72–83) and the cap constant `MAX_IMPL_DOWNSTREAM_RESET_STEPS` (line 45) are likewise dead, and `getFlowBranchLeafIds` (imported line 14) is used only by that dead function. The explanatory comment at lines 46–47 also no longer describes any live behavior.
**Suggestion:** Remove `IMPL_REVIEW_DOWNSTREAM_STEP_IDS`, `inclusiveFlowLeafStepIdsBetween`, `MAX_IMPL_DOWNSTREAM_RESET_STEPS`, the lines 46–47 comment, and drop `getFlowBranchLeafIds` from the `../definition.js` import (keeping `resolveMaxAttempts` and the reset alias). The bounded-resource guard (the `> MAX...` check) should now live with the moved reset logic in definition.js, so nothing of value is lost here.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Issue:** After `resetImplEvidenceAfterReviewProposals` was changed to delegate to `resetImplEvidenceStateAfterReviewProposals(...)` (definition.js), the local constant `IMPL_REVIEW_DOWNSTREAM_STEP_IDS` (line 48) is no longer referenced anywhere (confirmed across `src/`). It is now computed only to be discarded. Its sole producer `inclusiveFlowLeafStepIdsBetween` (lines 72–83) and the cap constant `MAX_IMPL_DOWNSTREAM_RESET_STEPS` (line 45) are likewise dead, and `getFlowBranchLeafIds` (imported line 14) is used only by that dead function. The explanatory comment at lines 46–47 also no longer describes any live behavior.
**Suggestion:** Remove `IMPL_REVIEW_DOWNSTREAM_STEP_IDS`, `inclusiveFlowLeafStepIdsBetween`, `MAX_IMPL_DOWNSTREAM_RESET_STEPS`, the lines 46–47 comment, and drop `getFlowBranchLeafIds` from the `../definition.js` import (keeping `resolveMaxAttempts` and the reset alias). The bounded-resource guard (the `> MAX...` check) should now live with the moved reset logic in definition.js, so nothing of value is lost here.
**Rationale:** Loop review proposal.

### 25. 2. Confusing near-duplicate names for the two reset functions
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`
**Issue:** The local exported orchestrator `resetImplEvidenceAfterReviewProposals(ctx, result)` and the imported definition-side helper aliased as `resetImplEvidenceStateAfterReviewProposals` differ only by the infix word `State`. The two are easy to confuse at call sites, and the alias exists solely to dodge a name collision rather than to convey intent.
**Suggestion:** Rename the alias to express the action it performs on the draft state, e.g. `applyImplEvidenceResetAfterReviewProposals`, making the command-level wrapper vs. state-mutation helper distinction obvious: `import { resetImplEvidenceAfterReviewProposals as applyImplEvidenceResetAfterReviewProposals } from "../definition.js"`.

Note on the bounded-resource-usage guardrail: no violation in the touched files. The recursion/bulk bound (`MAX_IMPL_DOWNSTREAM_RESET_STEPS`) is being removed here only because the code it guarded is dead and the same cap moved into `definition.js` (outside this diff); the touched files contain no unbounded recursion, retry, or bulk-load paths.

The other two files (`run-reopen-draft.js`, `set-retry.js`) are pure import-path relocations to `./step-tree.js` with no quality issues.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Issue:** The local exported orchestrator `resetImplEvidenceAfterReviewProposals(ctx, result)` and the imported definition-side helper aliased as `resetImplEvidenceStateAfterReviewProposals` differ only by the infix word `State`. The two are easy to confuse at call sites, and the alias exists solely to dodge a name collision rather than to convey intent.
**Suggestion:** Rename the alias to express the action it performs on the draft state, e.g. `applyImplEvidenceResetAfterReviewProposals`, making the command-level wrapper vs. state-mutation helper distinction obvious: `import { resetImplEvidenceAfterReviewProposals as applyImplEvidenceResetAfterReviewProposals } from "../definition.js"`.

Note on the bounded-resource-usage guardrail: no violation in the touched files. The recursion/bulk bound (`MAX_IMPL_DOWNSTREAM_RESET_STEPS`) is being removed here only because the code it guarded is dead and the same cap moved into `definition.js` (outside this diff); the touched files contain no unbounded recursion, retry, or bulk-load paths.

The other two files (`run-reopen-draft.js`, `set-retry.js`) are pure import-path relocations to `./step-tree.js` with no quality issues.
**Rationale:** Loop review proposal.

### 26. 1. Dead code: orphaned impl-downstream step-id computation
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`
**Issue:** After `resetImplEvidenceAfterReviewProposals` was changed to delegate to `resetImplEvidenceStateAfterReviewProposals(...)` (definition.js), the local constant `IMPL_REVIEW_DOWNSTREAM_STEP_IDS` (line 48) is no longer referenced anywhere (confirmed across `src/`). It is now computed only to be discarded. Its sole producer `inclusiveFlowLeafStepIdsBetween` (lines 72–83) and the cap constant `MAX_IMPL_DOWNSTREAM_RESET_STEPS` (line 45) are likewise dead, and `getFlowBranchLeafIds` (imported line 14) is used only by that dead function. The explanatory comment at lines 46–47 also no longer describes any live behavior.
**Suggestion:** Remove `IMPL_REVIEW_DOWNSTREAM_STEP_IDS`, `inclusiveFlowLeafStepIdsBetween`, `MAX_IMPL_DOWNSTREAM_RESET_STEPS`, the lines 46–47 comment, and drop `getFlowBranchLeafIds` from the `../definition.js` import (keeping `resolveMaxAttempts` and the reset alias). The bounded-resource guard (the `> MAX...` check) should now live with the moved reset logic in definition.js, so nothing of value is lost here.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Issue:** After `resetImplEvidenceAfterReviewProposals` was changed to delegate to `resetImplEvidenceStateAfterReviewProposals(...)` (definition.js), the local constant `IMPL_REVIEW_DOWNSTREAM_STEP_IDS` (line 48) is no longer referenced anywhere (confirmed across `src/`). It is now computed only to be discarded. Its sole producer `inclusiveFlowLeafStepIdsBetween` (lines 72–83) and the cap constant `MAX_IMPL_DOWNSTREAM_RESET_STEPS` (line 45) are likewise dead, and `getFlowBranchLeafIds` (imported line 14) is used only by that dead function. The explanatory comment at lines 46–47 also no longer describes any live behavior.
**Suggestion:** Remove `IMPL_REVIEW_DOWNSTREAM_STEP_IDS`, `inclusiveFlowLeafStepIdsBetween`, `MAX_IMPL_DOWNSTREAM_RESET_STEPS`, the lines 46–47 comment, and drop `getFlowBranchLeafIds` from the `../definition.js` import (keeping `resolveMaxAttempts` and the reset alias). The bounded-resource guard (the `> MAX...` check) should now live with the moved reset logic in definition.js, so nothing of value is lost here.
**Rationale:** Loop review proposal.

### 27. 2. Confusing near-duplicate names for the two reset functions
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`
**Issue:** The local exported orchestrator `resetImplEvidenceAfterReviewProposals(ctx, result)` and the imported definition-side helper aliased as `resetImplEvidenceStateAfterReviewProposals` differ only by the infix word `State`. The two are easy to confuse at call sites, and the alias exists solely to dodge a name collision rather than to convey intent.
**Suggestion:** Rename the alias to express the action it performs on the draft state, e.g. `applyImplEvidenceResetAfterReviewProposals`, making the command-level wrapper vs. state-mutation helper distinction obvious: `import { resetImplEvidenceAfterReviewProposals as applyImplEvidenceResetAfterReviewProposals } from "../definition.js"`.

Note on the bounded-resource-usage guardrail: no violation in the touched files. The recursion/bulk bound (`MAX_IMPL_DOWNSTREAM_RESET_STEPS`) is being removed here only because the code it guarded is dead and the same cap moved into `definition.js` (outside this diff); the touched files contain no unbounded recursion, retry, or bulk-load paths.

The other two files (`run-reopen-draft.js`, `set-retry.js`) are pure import-path relocations to `./step-tree.js` with no quality issues.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Issue:** The local exported orchestrator `resetImplEvidenceAfterReviewProposals(ctx, result)` and the imported definition-side helper aliased as `resetImplEvidenceStateAfterReviewProposals` differ only by the infix word `State`. The two are easy to confuse at call sites, and the alias exists solely to dodge a name collision rather than to convey intent.
**Suggestion:** Rename the alias to express the action it performs on the draft state, e.g. `applyImplEvidenceResetAfterReviewProposals`, making the command-level wrapper vs. state-mutation helper distinction obvious: `import { resetImplEvidenceAfterReviewProposals as applyImplEvidenceResetAfterReviewProposals } from "../definition.js"`.

Note on the bounded-resource-usage guardrail: no violation in the touched files. The recursion/bulk bound (`MAX_IMPL_DOWNSTREAM_RESET_STEPS`) is being removed here only because the code it guarded is dead and the same cap moved into `definition.js` (outside this diff); the touched files contain no unbounded recursion, retry, or bulk-load paths.

The other two files (`run-reopen-draft.js`, `set-retry.js`) are pure import-path relocations to `./step-tree.js` with no quality issues.
**Rationale:** Loop review proposal.

### 28. 1. Dead code: orphaned impl-downstream step-id computation
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`
**Issue:** After `resetImplEvidenceAfterReviewProposals` was changed to delegate to `resetImplEvidenceStateAfterReviewProposals(...)` (definition.js), the local constant `IMPL_REVIEW_DOWNSTREAM_STEP_IDS` (line 48) is no longer referenced anywhere (confirmed across `src/`). It is now computed only to be discarded. Its sole producer `inclusiveFlowLeafStepIdsBetween` (lines 72–83) and the cap constant `MAX_IMPL_DOWNSTREAM_RESET_STEPS` (line 45) are likewise dead, and `getFlowBranchLeafIds` (imported line 14) is used only by that dead function. The explanatory comment at lines 46–47 also no longer describes any live behavior.
**Suggestion:** Remove `IMPL_REVIEW_DOWNSTREAM_STEP_IDS`, `inclusiveFlowLeafStepIdsBetween`, `MAX_IMPL_DOWNSTREAM_RESET_STEPS`, the lines 46–47 comment, and drop `getFlowBranchLeafIds` from the `../definition.js` import (keeping `resolveMaxAttempts` and the reset alias). The bounded-resource guard (the `> MAX...` check) should now live with the moved reset logic in definition.js, so nothing of value is lost here.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Issue:** After `resetImplEvidenceAfterReviewProposals` was changed to delegate to `resetImplEvidenceStateAfterReviewProposals(...)` (definition.js), the local constant `IMPL_REVIEW_DOWNSTREAM_STEP_IDS` (line 48) is no longer referenced anywhere (confirmed across `src/`). It is now computed only to be discarded. Its sole producer `inclusiveFlowLeafStepIdsBetween` (lines 72–83) and the cap constant `MAX_IMPL_DOWNSTREAM_RESET_STEPS` (line 45) are likewise dead, and `getFlowBranchLeafIds` (imported line 14) is used only by that dead function. The explanatory comment at lines 46–47 also no longer describes any live behavior.
**Suggestion:** Remove `IMPL_REVIEW_DOWNSTREAM_STEP_IDS`, `inclusiveFlowLeafStepIdsBetween`, `MAX_IMPL_DOWNSTREAM_RESET_STEPS`, the lines 46–47 comment, and drop `getFlowBranchLeafIds` from the `../definition.js` import (keeping `resolveMaxAttempts` and the reset alias). The bounded-resource guard (the `> MAX...` check) should now live with the moved reset logic in definition.js, so nothing of value is lost here.
**Rationale:** Loop review proposal.

### 29. 2. Confusing near-duplicate names for the two reset functions
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`
**Issue:** The local exported orchestrator `resetImplEvidenceAfterReviewProposals(ctx, result)` and the imported definition-side helper aliased as `resetImplEvidenceStateAfterReviewProposals` differ only by the infix word `State`. The two are easy to confuse at call sites, and the alias exists solely to dodge a name collision rather than to convey intent.
**Suggestion:** Rename the alias to express the action it performs on the draft state, e.g. `applyImplEvidenceResetAfterReviewProposals`, making the command-level wrapper vs. state-mutation helper distinction obvious: `import { resetImplEvidenceAfterReviewProposals as applyImplEvidenceResetAfterReviewProposals } from "../definition.js"`.

Note on the bounded-resource-usage guardrail: no violation in the touched files. The recursion/bulk bound (`MAX_IMPL_DOWNSTREAM_RESET_STEPS`) is being removed here only because the code it guarded is dead and the same cap moved into `definition.js` (outside this diff); the touched files contain no unbounded recursion, retry, or bulk-load paths.

The other two files (`run-reopen-draft.js`, `set-retry.js`) are pure import-path relocations to `./step-tree.js` with no quality issues.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Issue:** The local exported orchestrator `resetImplEvidenceAfterReviewProposals(ctx, result)` and the imported definition-side helper aliased as `resetImplEvidenceStateAfterReviewProposals` differ only by the infix word `State`. The two are easy to confuse at call sites, and the alias exists solely to dodge a name collision rather than to convey intent.
**Suggestion:** Rename the alias to express the action it performs on the draft state, e.g. `applyImplEvidenceResetAfterReviewProposals`, making the command-level wrapper vs. state-mutation helper distinction obvious: `import { resetImplEvidenceAfterReviewProposals as applyImplEvidenceResetAfterReviewProposals } from "../definition.js"`.

Note on the bounded-resource-usage guardrail: no violation in the touched files. The recursion/bulk bound (`MAX_IMPL_DOWNSTREAM_RESET_STEPS`) is being removed here only because the code it guarded is dead and the same cap moved into `definition.js` (outside this diff); the touched files contain no unbounded recursion, retry, or bulk-load paths.

The other two files (`run-reopen-draft.js`, `set-retry.js`) are pure import-path relocations to `./step-tree.js` with no quality issues.
**Rationale:** Loop review proposal.

### 30. 1. Unused `phase` parameter in `incrementMetric`
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** `RegistryLifecycleAdapter.incrementMetric(phase, counter)` declares a `phase` parameter, but the method body only ever reads `counter` (`reviewRetry` / `gateRetry`). The `phase` argument is dead — it is never referenced.
**Suggestion:** Drop the unused parameter: `async incrementMetric(counter)` and update the caller in `resolveLifecycle`/action `apply` accordingly. If the action class passes `phase` positionally, fix the call site too so the signature reflects actual usage.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** `RegistryLifecycleAdapter.incrementMetric(phase, counter)` declares a `phase` parameter, but the method body only ever reads `counter` (`reviewRetry` / `gateRetry`). The `phase` argument is dead — it is never referenced.
**Suggestion:** Drop the unused parameter: `async incrementMetric(counter)` and update the caller in `resolveLifecycle`/action `apply` accordingly. If the action class passes `phase` positionally, fix the call site too so the signature reflects actual usage.
**Rationale:** Loop review proposal.

### 31. 2. Duplicate phase resolution inside `executeSideEffects`
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** The constructor already computes `this.phase = result?.artifacts?.phase || ctx.phase;`, but `executeSideEffects()` recomputes the identical expression locally: `const phase = this.result?.artifacts?.phase || this.ctx.phase;`. This is duplicated logic that can silently diverge from the canonical `this.phase`.
**Suggestion:** Reuse the field: `await gateMod.executeGateSideEffects(this.ctx, this.phase);` and remove the local `phase` variable.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** The constructor already computes `this.phase = result?.artifacts?.phase || ctx.phase;`, but `executeSideEffects()` recomputes the identical expression locally: `const phase = this.result?.artifacts?.phase || this.ctx.phase;`. This is duplicated logic that can silently diverge from the canonical `this.phase`.
**Suggestion:** Reuse the field: `await gateMod.executeGateSideEffects(this.ctx, this.phase);` and remove the local `phase` variable.
**Rationale:** Loop review proposal.

### 32. 3. Inconsistent construction of finalize step ids
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** A `finalizeCommand(suffix)` helper was introduced and used for `finalize-sync` / `finalize-cleanup` (`finalizeCommand("sync")`, `finalizeCommand("cleanup")`), but `finalize-commit` and `finalize-merge` still pass literal strings (`command: "finalize-commit"`, `command: "finalize-merge"`). Mixing the helper with raw literals for the same family of ids is the kind of same-file naming/pattern inconsistency the project rules call out, and it makes the helper's purpose ambiguous.
**Suggestion:** Pick one convention for all four finalize entries — either use `finalizeCommand("commit")` / `finalizeCommand("merge")` everywhere, or drop the helper and use literals everywhere. Given the prior source-comment rationale about avoiding literal leaf-id strings, standardizing on `finalizeCommand(...)` for all finalize commands is the more consistent choice.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** A `finalizeCommand(suffix)` helper was introduced and used for `finalize-sync` / `finalize-cleanup` (`finalizeCommand("sync")`, `finalizeCommand("cleanup")`), but `finalize-commit` and `finalize-merge` still pass literal strings (`command: "finalize-commit"`, `command: "finalize-merge"`). Mixing the helper with raw literals for the same family of ids is the kind of same-file naming/pattern inconsistency the project rules call out, and it makes the helper's purpose ambiguous.
**Suggestion:** Pick one convention for all four finalize entries — either use `finalizeCommand("commit")` / `finalizeCommand("merge")` everywhere, or drop the helper and use literals everywhere. Given the prior source-comment rationale about avoiding literal leaf-id strings, standardizing on `finalizeCommand(...)` for all finalize commands is the more consistent choice.
**Rationale:** Loop review proposal.

### 33. 4. Hardcoded `"finalize-"` prefix branch in `setStepStatus`
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** `setStepStatus(step, status)` branches on `step.startsWith("finalize-")` to decide whether to route the update through `ctx.flowManager` with `specId` versus the phase-scoped ctx. R5 explicitly says registry hooks "shall not hardcode flow step ids ... for definition-derived decisions." This prefix test re-encodes a definition concept (which steps are main-repo/finalize-scoped) inside registry.js.
**Suggestion:** Have the lifecycle action carry the routing intent (e.g. an explicit `scope: "main-repo"` flag or `specId` requirement on the status-transition action) so the adapter dispatches on action data rather than re-deriving it from the step-id string prefix.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** `setStepStatus(step, status)` branches on `step.startsWith("finalize-")` to decide whether to route the update through `ctx.flowManager` with `specId` versus the phase-scoped ctx. R5 explicitly says registry hooks "shall not hardcode flow step ids ... for definition-derived decisions." This prefix test re-encodes a definition concept (which steps are main-repo/finalize-scoped) inside registry.js.
**Suggestion:** Have the lifecycle action carry the routing intent (e.g. an explicit `scope: "main-repo"` flag or `specId` requirement on the status-transition action) so the adapter dispatches on action data rather than re-deriving it from the step-id string prefix.
**Rationale:** Loop review proposal.

### 34. 5. Repeated dynamic `import("./lib/run-*.js")` scattered across methods
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** `import("./lib/run-review.js")`, `import("./lib/run-gate.js")`, and `import("./lib/run-finalize.js")` are each performed in multiple separate adapter methods (`incrementMetric`, `appendIssueLog`, `runReviewHook`, `executeSideEffects`, `runFinalizeHook`). The lazy-module-loading pattern is duplicated 3+ times per module.
**Suggestion:** Extract a small memoized accessor (e.g. `#reviewMod()`, `#gateMod()`, `#finalizeMod()` that cache the dynamic import on the instance) so each module is imported through one place. This removes the repeated import boilerplate and avoids re-importing the same module within a single lifecycle application.

No bounded-resource-usage violations found: the new loops (`resetSteps`, `skipSteps`, the `for (const action of actions)` loop) all iterate over caller-supplied finite arrays derived from the definition, and no new recursion or unbounded retry/bulk-load is introduced in these files.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** `import("./lib/run-review.js")`, `import("./lib/run-gate.js")`, and `import("./lib/run-finalize.js")` are each performed in multiple separate adapter methods (`incrementMetric`, `appendIssueLog`, `runReviewHook`, `executeSideEffects`, `runFinalizeHook`). The lazy-module-loading pattern is duplicated 3+ times per module.
**Suggestion:** Extract a small memoized accessor (e.g. `#reviewMod()`, `#gateMod()`, `#finalizeMod()` that cache the dynamic import on the instance) so each module is imported through one place. This removes the repeated import boilerplate and avoids re-importing the same module within a single lifecycle application.

No bounded-resource-usage violations found: the new loops (`resetSteps`, `skipSteps`, the `for (const action of actions)` loop) all iterate over caller-supplied finite arrays derived from the definition, and no new recursion or unbounded retry/bulk-load is introduced in these files.
**Rationale:** Loop review proposal.

### 35. 1. Unused `phase` parameter in `incrementMetric`
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** `RegistryLifecycleAdapter.incrementMetric(phase, counter)` declares a `phase` parameter, but the method body only ever reads `counter` (`reviewRetry` / `gateRetry`). The `phase` argument is dead — it is never referenced.
**Suggestion:** Drop the unused parameter: `async incrementMetric(counter)` and update the caller in `resolveLifecycle`/action `apply` accordingly. If the action class passes `phase` positionally, fix the call site too so the signature reflects actual usage.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** `RegistryLifecycleAdapter.incrementMetric(phase, counter)` declares a `phase` parameter, but the method body only ever reads `counter` (`reviewRetry` / `gateRetry`). The `phase` argument is dead — it is never referenced.
**Suggestion:** Drop the unused parameter: `async incrementMetric(counter)` and update the caller in `resolveLifecycle`/action `apply` accordingly. If the action class passes `phase` positionally, fix the call site too so the signature reflects actual usage.
**Rationale:** Loop review proposal.

### 36. 2. Duplicate phase resolution inside `executeSideEffects`
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** The constructor already computes `this.phase = result?.artifacts?.phase || ctx.phase;`, but `executeSideEffects()` recomputes the identical expression locally: `const phase = this.result?.artifacts?.phase || this.ctx.phase;`. This is duplicated logic that can silently diverge from the canonical `this.phase`.
**Suggestion:** Reuse the field: `await gateMod.executeGateSideEffects(this.ctx, this.phase);` and remove the local `phase` variable.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** The constructor already computes `this.phase = result?.artifacts?.phase || ctx.phase;`, but `executeSideEffects()` recomputes the identical expression locally: `const phase = this.result?.artifacts?.phase || this.ctx.phase;`. This is duplicated logic that can silently diverge from the canonical `this.phase`.
**Suggestion:** Reuse the field: `await gateMod.executeGateSideEffects(this.ctx, this.phase);` and remove the local `phase` variable.
**Rationale:** Loop review proposal.

### 37. 3. Inconsistent construction of finalize step ids
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** A `finalizeCommand(suffix)` helper was introduced and used for `finalize-sync` / `finalize-cleanup` (`finalizeCommand("sync")`, `finalizeCommand("cleanup")`), but `finalize-commit` and `finalize-merge` still pass literal strings (`command: "finalize-commit"`, `command: "finalize-merge"`). Mixing the helper with raw literals for the same family of ids is the kind of same-file naming/pattern inconsistency the project rules call out, and it makes the helper's purpose ambiguous.
**Suggestion:** Pick one convention for all four finalize entries — either use `finalizeCommand("commit")` / `finalizeCommand("merge")` everywhere, or drop the helper and use literals everywhere. Given the prior source-comment rationale about avoiding literal leaf-id strings, standardizing on `finalizeCommand(...)` for all finalize commands is the more consistent choice.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** A `finalizeCommand(suffix)` helper was introduced and used for `finalize-sync` / `finalize-cleanup` (`finalizeCommand("sync")`, `finalizeCommand("cleanup")`), but `finalize-commit` and `finalize-merge` still pass literal strings (`command: "finalize-commit"`, `command: "finalize-merge"`). Mixing the helper with raw literals for the same family of ids is the kind of same-file naming/pattern inconsistency the project rules call out, and it makes the helper's purpose ambiguous.
**Suggestion:** Pick one convention for all four finalize entries — either use `finalizeCommand("commit")` / `finalizeCommand("merge")` everywhere, or drop the helper and use literals everywhere. Given the prior source-comment rationale about avoiding literal leaf-id strings, standardizing on `finalizeCommand(...)` for all finalize commands is the more consistent choice.
**Rationale:** Loop review proposal.

### 38. 4. Hardcoded `"finalize-"` prefix branch in `setStepStatus`
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** `setStepStatus(step, status)` branches on `step.startsWith("finalize-")` to decide whether to route the update through `ctx.flowManager` with `specId` versus the phase-scoped ctx. R5 explicitly says registry hooks "shall not hardcode flow step ids ... for definition-derived decisions." This prefix test re-encodes a definition concept (which steps are main-repo/finalize-scoped) inside registry.js.
**Suggestion:** Have the lifecycle action carry the routing intent (e.g. an explicit `scope: "main-repo"` flag or `specId` requirement on the status-transition action) so the adapter dispatches on action data rather than re-deriving it from the step-id string prefix.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** `setStepStatus(step, status)` branches on `step.startsWith("finalize-")` to decide whether to route the update through `ctx.flowManager` with `specId` versus the phase-scoped ctx. R5 explicitly says registry hooks "shall not hardcode flow step ids ... for definition-derived decisions." This prefix test re-encodes a definition concept (which steps are main-repo/finalize-scoped) inside registry.js.
**Suggestion:** Have the lifecycle action carry the routing intent (e.g. an explicit `scope: "main-repo"` flag or `specId` requirement on the status-transition action) so the adapter dispatches on action data rather than re-deriving it from the step-id string prefix.
**Rationale:** Loop review proposal.

### 39. 5. Repeated dynamic `import("./lib/run-*.js")` scattered across methods
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** `import("./lib/run-review.js")`, `import("./lib/run-gate.js")`, and `import("./lib/run-finalize.js")` are each performed in multiple separate adapter methods (`incrementMetric`, `appendIssueLog`, `runReviewHook`, `executeSideEffects`, `runFinalizeHook`). The lazy-module-loading pattern is duplicated 3+ times per module.
**Suggestion:** Extract a small memoized accessor (e.g. `#reviewMod()`, `#gateMod()`, `#finalizeMod()` that cache the dynamic import on the instance) so each module is imported through one place. This removes the repeated import boilerplate and avoids re-importing the same module within a single lifecycle application.

No bounded-resource-usage violations found: the new loops (`resetSteps`, `skipSteps`, the `for (const action of actions)` loop) all iterate over caller-supplied finite arrays derived from the definition, and no new recursion or unbounded retry/bulk-load is introduced in these files.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** `import("./lib/run-review.js")`, `import("./lib/run-gate.js")`, and `import("./lib/run-finalize.js")` are each performed in multiple separate adapter methods (`incrementMetric`, `appendIssueLog`, `runReviewHook`, `executeSideEffects`, `runFinalizeHook`). The lazy-module-loading pattern is duplicated 3+ times per module.
**Suggestion:** Extract a small memoized accessor (e.g. `#reviewMod()`, `#gateMod()`, `#finalizeMod()` that cache the dynamic import on the instance) so each module is imported through one place. This removes the repeated import boilerplate and avoids re-importing the same module within a single lifecycle application.

No bounded-resource-usage violations found: the new loops (`resetSteps`, `skipSteps`, the `for (const action of actions)` loop) all iterate over caller-supplied finite arrays derived from the definition, and no new recursion or unbounded retry/bulk-load is introduced in these files.
**Rationale:** Loop review proposal.

### 40. 1. Unused `phase` parameter in `incrementMetric`
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** `RegistryLifecycleAdapter.incrementMetric(phase, counter)` declares a `phase` parameter, but the method body only ever reads `counter` (`reviewRetry` / `gateRetry`). The `phase` argument is dead — it is never referenced.
**Suggestion:** Drop the unused parameter: `async incrementMetric(counter)` and update the caller in `resolveLifecycle`/action `apply` accordingly. If the action class passes `phase` positionally, fix the call site too so the signature reflects actual usage.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** `RegistryLifecycleAdapter.incrementMetric(phase, counter)` declares a `phase` parameter, but the method body only ever reads `counter` (`reviewRetry` / `gateRetry`). The `phase` argument is dead — it is never referenced.
**Suggestion:** Drop the unused parameter: `async incrementMetric(counter)` and update the caller in `resolveLifecycle`/action `apply` accordingly. If the action class passes `phase` positionally, fix the call site too so the signature reflects actual usage.
**Rationale:** Loop review proposal.

### 41. 2. Duplicate phase resolution inside `executeSideEffects`
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** The constructor already computes `this.phase = result?.artifacts?.phase || ctx.phase;`, but `executeSideEffects()` recomputes the identical expression locally: `const phase = this.result?.artifacts?.phase || this.ctx.phase;`. This is duplicated logic that can silently diverge from the canonical `this.phase`.
**Suggestion:** Reuse the field: `await gateMod.executeGateSideEffects(this.ctx, this.phase);` and remove the local `phase` variable.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** The constructor already computes `this.phase = result?.artifacts?.phase || ctx.phase;`, but `executeSideEffects()` recomputes the identical expression locally: `const phase = this.result?.artifacts?.phase || this.ctx.phase;`. This is duplicated logic that can silently diverge from the canonical `this.phase`.
**Suggestion:** Reuse the field: `await gateMod.executeGateSideEffects(this.ctx, this.phase);` and remove the local `phase` variable.
**Rationale:** Loop review proposal.

### 42. 3. Inconsistent construction of finalize step ids
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** A `finalizeCommand(suffix)` helper was introduced and used for `finalize-sync` / `finalize-cleanup` (`finalizeCommand("sync")`, `finalizeCommand("cleanup")`), but `finalize-commit` and `finalize-merge` still pass literal strings (`command: "finalize-commit"`, `command: "finalize-merge"`). Mixing the helper with raw literals for the same family of ids is the kind of same-file naming/pattern inconsistency the project rules call out, and it makes the helper's purpose ambiguous.
**Suggestion:** Pick one convention for all four finalize entries — either use `finalizeCommand("commit")` / `finalizeCommand("merge")` everywhere, or drop the helper and use literals everywhere. Given the prior source-comment rationale about avoiding literal leaf-id strings, standardizing on `finalizeCommand(...)` for all finalize commands is the more consistent choice.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** A `finalizeCommand(suffix)` helper was introduced and used for `finalize-sync` / `finalize-cleanup` (`finalizeCommand("sync")`, `finalizeCommand("cleanup")`), but `finalize-commit` and `finalize-merge` still pass literal strings (`command: "finalize-commit"`, `command: "finalize-merge"`). Mixing the helper with raw literals for the same family of ids is the kind of same-file naming/pattern inconsistency the project rules call out, and it makes the helper's purpose ambiguous.
**Suggestion:** Pick one convention for all four finalize entries — either use `finalizeCommand("commit")` / `finalizeCommand("merge")` everywhere, or drop the helper and use literals everywhere. Given the prior source-comment rationale about avoiding literal leaf-id strings, standardizing on `finalizeCommand(...)` for all finalize commands is the more consistent choice.
**Rationale:** Loop review proposal.

### 43. 4. Hardcoded `"finalize-"` prefix branch in `setStepStatus`
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** `setStepStatus(step, status)` branches on `step.startsWith("finalize-")` to decide whether to route the update through `ctx.flowManager` with `specId` versus the phase-scoped ctx. R5 explicitly says registry hooks "shall not hardcode flow step ids ... for definition-derived decisions." This prefix test re-encodes a definition concept (which steps are main-repo/finalize-scoped) inside registry.js.
**Suggestion:** Have the lifecycle action carry the routing intent (e.g. an explicit `scope: "main-repo"` flag or `specId` requirement on the status-transition action) so the adapter dispatches on action data rather than re-deriving it from the step-id string prefix.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** `setStepStatus(step, status)` branches on `step.startsWith("finalize-")` to decide whether to route the update through `ctx.flowManager` with `specId` versus the phase-scoped ctx. R5 explicitly says registry hooks "shall not hardcode flow step ids ... for definition-derived decisions." This prefix test re-encodes a definition concept (which steps are main-repo/finalize-scoped) inside registry.js.
**Suggestion:** Have the lifecycle action carry the routing intent (e.g. an explicit `scope: "main-repo"` flag or `specId` requirement on the status-transition action) so the adapter dispatches on action data rather than re-deriving it from the step-id string prefix.
**Rationale:** Loop review proposal.

### 44. 5. Repeated dynamic `import("./lib/run-*.js")` scattered across methods
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** `import("./lib/run-review.js")`, `import("./lib/run-gate.js")`, and `import("./lib/run-finalize.js")` are each performed in multiple separate adapter methods (`incrementMetric`, `appendIssueLog`, `runReviewHook`, `executeSideEffects`, `runFinalizeHook`). The lazy-module-loading pattern is duplicated 3+ times per module.
**Suggestion:** Extract a small memoized accessor (e.g. `#reviewMod()`, `#gateMod()`, `#finalizeMod()` that cache the dynamic import on the instance) so each module is imported through one place. This removes the repeated import boilerplate and avoids re-importing the same module within a single lifecycle application.

No bounded-resource-usage violations found: the new loops (`resetSteps`, `skipSteps`, the `for (const action of actions)` loop) all iterate over caller-supplied finite arrays derived from the definition, and no new recursion or unbounded retry/bulk-load is introduced in these files.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** `import("./lib/run-review.js")`, `import("./lib/run-gate.js")`, and `import("./lib/run-finalize.js")` are each performed in multiple separate adapter methods (`incrementMetric`, `appendIssueLog`, `runReviewHook`, `executeSideEffects`, `runFinalizeHook`). The lazy-module-loading pattern is duplicated 3+ times per module.
**Suggestion:** Extract a small memoized accessor (e.g. `#reviewMod()`, `#gateMod()`, `#finalizeMod()` that cache the dynamic import on the instance) so each module is imported through one place. This removes the repeated import boilerplate and avoids re-importing the same module within a single lifecycle application.

No bounded-resource-usage violations found: the new loops (`resetSteps`, `skipSteps`, the `for (const action of actions)` loop) all iterate over caller-supplied finite arrays derived from the definition, and no new recursion or unbounded retry/bulk-load is introduced in these files.
**Rationale:** Loop review proposal.

### 45. 1. Stale hardcoded count in doc comment
**Failure mode:** refactor
**File:** src/lib/skill-rules.js
**Issue:** **File:** `src/lib/skill-rules.js`
**Issue:** The comment `/** Canonical scope-aware leaf id strings (24 entries). */` (line 31) hardcodes the entry count as "24". `VALID_SKILL_RULE_PHASES` is now derived dynamically from `collectFlowLeafIds()` + `collectTaskLeafIds()`, so the actual count tracks the definition module. The magic number in the comment will silently drift out of sync whenever a leaf is added or removed, becoming misleading documentation.
**Suggestion:** Drop the parenthetical count and describe the source instead, e.g. `/** Canonical scope-aware leaf id strings: flow.<leaf> + task.<leaf> from definition.js. */`. This removes the drift hazard without losing intent.

No bounded-resource-usage concerns: the changes introduce no recursion, retries, or bulk loading; the leaf-id collection is bounded by the static flow/task definitions.
**Suggestion:** **File:** `src/lib/skill-rules.js`
**Issue:** The comment `/** Canonical scope-aware leaf id strings (24 entries). */` (line 31) hardcodes the entry count as "24". `VALID_SKILL_RULE_PHASES` is now derived dynamically from `collectFlowLeafIds()` + `collectTaskLeafIds()`, so the actual count tracks the definition module. The magic number in the comment will silently drift out of sync whenever a leaf is added or removed, becoming misleading documentation.
**Suggestion:** Drop the parenthetical count and describe the source instead, e.g. `/** Canonical scope-aware leaf id strings: flow.<leaf> + task.<leaf> from definition.js. */`. This removes the drift hazard without losing intent.

No bounded-resource-usage concerns: the changes introduce no recursion, retries, or bulk loading; the leaf-id collection is bounded by the static flow/task definitions.
**Rationale:** Loop review proposal.

### 46. 1. Stale hardcoded count in doc comment
**Failure mode:** refactor
**File:** src/lib/skill-rules.js
**Issue:** **File:** `src/lib/skill-rules.js`
**Issue:** The comment `/** Canonical scope-aware leaf id strings (24 entries). */` (line 31) hardcodes the entry count as "24". `VALID_SKILL_RULE_PHASES` is now derived dynamically from `collectFlowLeafIds()` + `collectTaskLeafIds()`, so the actual count tracks the definition module. The magic number in the comment will silently drift out of sync whenever a leaf is added or removed, becoming misleading documentation.
**Suggestion:** Drop the parenthetical count and describe the source instead, e.g. `/** Canonical scope-aware leaf id strings: flow.<leaf> + task.<leaf> from definition.js. */`. This removes the drift hazard without losing intent.

No bounded-resource-usage concerns: the changes introduce no recursion, retries, or bulk loading; the leaf-id collection is bounded by the static flow/task definitions.
**Suggestion:** **File:** `src/lib/skill-rules.js`
**Issue:** The comment `/** Canonical scope-aware leaf id strings (24 entries). */` (line 31) hardcodes the entry count as "24". `VALID_SKILL_RULE_PHASES` is now derived dynamically from `collectFlowLeafIds()` + `collectTaskLeafIds()`, so the actual count tracks the definition module. The magic number in the comment will silently drift out of sync whenever a leaf is added or removed, becoming misleading documentation.
**Suggestion:** Drop the parenthetical count and describe the source instead, e.g. `/** Canonical scope-aware leaf id strings: flow.<leaf> + task.<leaf> from definition.js. */`. This removes the drift hazard without losing intent.

No bounded-resource-usage concerns: the changes introduce no recursion, retries, or bulk loading; the leaf-id collection is bounded by the static flow/task definitions.
**Rationale:** Loop review proposal.

### 47. 1. Stale hardcoded count in doc comment
**Failure mode:** refactor
**File:** src/lib/skill-rules.js
**Issue:** **File:** `src/lib/skill-rules.js`
**Issue:** The comment `/** Canonical scope-aware leaf id strings (24 entries). */` (line 31) hardcodes the entry count as "24". `VALID_SKILL_RULE_PHASES` is now derived dynamically from `collectFlowLeafIds()` + `collectTaskLeafIds()`, so the actual count tracks the definition module. The magic number in the comment will silently drift out of sync whenever a leaf is added or removed, becoming misleading documentation.
**Suggestion:** Drop the parenthetical count and describe the source instead, e.g. `/** Canonical scope-aware leaf id strings: flow.<leaf> + task.<leaf> from definition.js. */`. This removes the drift hazard without losing intent.

No bounded-resource-usage concerns: the changes introduce no recursion, retries, or bulk loading; the leaf-id collection is bounded by the static flow/task definitions.
**Suggestion:** **File:** `src/lib/skill-rules.js`
**Issue:** The comment `/** Canonical scope-aware leaf id strings (24 entries). */` (line 31) hardcodes the entry count as "24". `VALID_SKILL_RULE_PHASES` is now derived dynamically from `collectFlowLeafIds()` + `collectTaskLeafIds()`, so the actual count tracks the definition module. The magic number in the comment will silently drift out of sync whenever a leaf is added or removed, becoming misleading documentation.
**Suggestion:** Drop the parenthetical count and describe the source instead, e.g. `/** Canonical scope-aware leaf id strings: flow.<leaf> + task.<leaf> from definition.js. */`. This removes the drift hazard without losing intent.

No bounded-resource-usage concerns: the changes introduce no recursion, retries, or bulk loading; the leaf-id collection is bounded by the static flow/task definitions.
**Rationale:** Loop review proposal.

### 48. 1. Stale `TASK_DEFINITION` references in test names and assertion messages
**Failure mode:** refactor
**File:** tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js
**Issue:** **File:** `tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js`
**Issue:** The diff replaces the raw `TASK_DEFINITION` import with the API calls `collectTaskLeafIds()` / `getTaskNode()`, but the surrounding test titles and assertion messages still name the now-removed symbol: `it("TASK_DEFINITION has no approval/gate/update-overview entries")`, `it("TASK_DEFINITION has task-gate entry")`, and `"TASK_DEFINITION must not include update-overview"`. After R1/R6 remove `TASK_DEFINITION` as an export, these strings describe a thing that no longer exists, which misleads anyone reading test output or grepping for the symbol.
**Suggestion:** Update the test descriptions and assertion messages to reflect the new definition-side API surface, e.g. `it("task scope has no approval/gate/update-overview leaf ids")`, `it("task scope has a task-gate node")`, and `"task leaf ids must not include update-overview"`. This keeps the test vocabulary aligned with the post-refactor public API.
**Suggestion:** **File:** `tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js`
**Issue:** The diff replaces the raw `TASK_DEFINITION` import with the API calls `collectTaskLeafIds()` / `getTaskNode()`, but the surrounding test titles and assertion messages still name the now-removed symbol: `it("TASK_DEFINITION has no approval/gate/update-overview entries")`, `it("TASK_DEFINITION has task-gate entry")`, and `"TASK_DEFINITION must not include update-overview"`. After R1/R6 remove `TASK_DEFINITION` as an export, these strings describe a thing that no longer exists, which misleads anyone reading test output or grepping for the symbol.
**Suggestion:** Update the test descriptions and assertion messages to reflect the new definition-side API surface, e.g. `it("task scope has no approval/gate/update-overview leaf ids")`, `it("task scope has a task-gate node")`, and `"task leaf ids must not include update-overview"`. This keeps the test vocabulary aligned with the post-refactor public API.
**Rationale:** Loop review proposal.

### 49. 1. Stale `TASK_DEFINITION` references in test names and assertion messages
**Failure mode:** refactor
**File:** tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js
**Issue:** **File:** `tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js`
**Issue:** The diff replaces the raw `TASK_DEFINITION` import with the API calls `collectTaskLeafIds()` / `getTaskNode()`, but the surrounding test titles and assertion messages still name the now-removed symbol: `it("TASK_DEFINITION has no approval/gate/update-overview entries")`, `it("TASK_DEFINITION has task-gate entry")`, and `"TASK_DEFINITION must not include update-overview"`. After R1/R6 remove `TASK_DEFINITION` as an export, these strings describe a thing that no longer exists, which misleads anyone reading test output or grepping for the symbol.
**Suggestion:** Update the test descriptions and assertion messages to reflect the new definition-side API surface, e.g. `it("task scope has no approval/gate/update-overview leaf ids")`, `it("task scope has a task-gate node")`, and `"task leaf ids must not include update-overview"`. This keeps the test vocabulary aligned with the post-refactor public API.
**Suggestion:** **File:** `tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js`
**Issue:** The diff replaces the raw `TASK_DEFINITION` import with the API calls `collectTaskLeafIds()` / `getTaskNode()`, but the surrounding test titles and assertion messages still name the now-removed symbol: `it("TASK_DEFINITION has no approval/gate/update-overview entries")`, `it("TASK_DEFINITION has task-gate entry")`, and `"TASK_DEFINITION must not include update-overview"`. After R1/R6 remove `TASK_DEFINITION` as an export, these strings describe a thing that no longer exists, which misleads anyone reading test output or grepping for the symbol.
**Suggestion:** Update the test descriptions and assertion messages to reflect the new definition-side API surface, e.g. `it("task scope has no approval/gate/update-overview leaf ids")`, `it("task scope has a task-gate node")`, and `"task leaf ids must not include update-overview"`. This keeps the test vocabulary aligned with the post-refactor public API.
**Rationale:** Loop review proposal.

### 50. 1. Stale `TASK_DEFINITION` references in test names and assertion messages
**Failure mode:** refactor
**File:** tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js
**Issue:** **File:** `tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js`
**Issue:** The diff replaces the raw `TASK_DEFINITION` import with the API calls `collectTaskLeafIds()` / `getTaskNode()`, but the surrounding test titles and assertion messages still name the now-removed symbol: `it("TASK_DEFINITION has no approval/gate/update-overview entries")`, `it("TASK_DEFINITION has task-gate entry")`, and `"TASK_DEFINITION must not include update-overview"`. After R1/R6 remove `TASK_DEFINITION` as an export, these strings describe a thing that no longer exists, which misleads anyone reading test output or grepping for the symbol.
**Suggestion:** Update the test descriptions and assertion messages to reflect the new definition-side API surface, e.g. `it("task scope has no approval/gate/update-overview leaf ids")`, `it("task scope has a task-gate node")`, and `"task leaf ids must not include update-overview"`. This keeps the test vocabulary aligned with the post-refactor public API.
**Suggestion:** **File:** `tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js`
**Issue:** The diff replaces the raw `TASK_DEFINITION` import with the API calls `collectTaskLeafIds()` / `getTaskNode()`, but the surrounding test titles and assertion messages still name the now-removed symbol: `it("TASK_DEFINITION has no approval/gate/update-overview entries")`, `it("TASK_DEFINITION has task-gate entry")`, and `"TASK_DEFINITION must not include update-overview"`. After R1/R6 remove `TASK_DEFINITION` as an export, these strings describe a thing that no longer exists, which misleads anyone reading test output or grepping for the symbol.
**Suggestion:** Update the test descriptions and assertion messages to reflect the new definition-side API surface, e.g. `it("task scope has no approval/gate/update-overview leaf ids")`, `it("task scope has a task-gate node")`, and `"task leaf ids must not include update-overview"`. This keeps the test vocabulary aligned with the post-refactor public API.
**Rationale:** Loop review proposal.

### 51. 1. Duplicate import statement from the same module
**Failure mode:** refactor
**File:** tests/unit/flow/auto-upgrade-next-action.test.js
**Issue:** **File:** `tests/unit/flow/auto-upgrade-next-action.test.js`
**Issue:** Lines 7-8 import from the same module `../../helpers/flow-setup.js` in two separate `import` statements:
```js
import { setupFlow, setStepDone } from "../../helpers/flow-setup.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
```
This is redundant duplication of the module specifier. Since this file is touched by the migration and the project rule directs fixing obvious consistency issues in changed files, it is in scope.
**Suggestion:** Merge into a single import:
```js
import { setupFlow, setStepDone, makeFlowManager } from "../../helpers/flow-setup.js";
```

No other issues found. The remaining changes (import-source updates in `tests/unit/flow.test.js` and `tests/unit/flow/draft-refine-migration.test.js`) correctly relocate `flattenSteps`/`findStepById` to the new `step-tree.js` module per R2/R6 and need no further changes. No bounded-resource-usage concerns apply to these test files.
**Suggestion:** **File:** `tests/unit/flow/auto-upgrade-next-action.test.js`
**Issue:** Lines 7-8 import from the same module `../../helpers/flow-setup.js` in two separate `import` statements:
```js
import { setupFlow, setStepDone } from "../../helpers/flow-setup.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
```
This is redundant duplication of the module specifier. Since this file is touched by the migration and the project rule directs fixing obvious consistency issues in changed files, it is in scope.
**Suggestion:** Merge into a single import:
```js
import { setupFlow, setStepDone, makeFlowManager } from "../../helpers/flow-setup.js";
```

No other issues found. The remaining changes (import-source updates in `tests/unit/flow.test.js` and `tests/unit/flow/draft-refine-migration.test.js`) correctly relocate `flattenSteps`/`findStepById` to the new `step-tree.js` module per R2/R6 and need no further changes. No bounded-resource-usage concerns apply to these test files.
**Rationale:** Loop review proposal.

### 52. 1. Duplicate import statement from the same module
**Failure mode:** refactor
**File:** tests/unit/flow/auto-upgrade-next-action.test.js
**Issue:** **File:** `tests/unit/flow/auto-upgrade-next-action.test.js`
**Issue:** Lines 7-8 import from the same module `../../helpers/flow-setup.js` in two separate `import` statements:
```js
import { setupFlow, setStepDone } from "../../helpers/flow-setup.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
```
This is redundant duplication of the module specifier. Since this file is touched by the migration and the project rule directs fixing obvious consistency issues in changed files, it is in scope.
**Suggestion:** Merge into a single import:
```js
import { setupFlow, setStepDone, makeFlowManager } from "../../helpers/flow-setup.js";
```

No other issues found. The remaining changes (import-source updates in `tests/unit/flow.test.js` and `tests/unit/flow/draft-refine-migration.test.js`) correctly relocate `flattenSteps`/`findStepById` to the new `step-tree.js` module per R2/R6 and need no further changes. No bounded-resource-usage concerns apply to these test files.
**Suggestion:** **File:** `tests/unit/flow/auto-upgrade-next-action.test.js`
**Issue:** Lines 7-8 import from the same module `../../helpers/flow-setup.js` in two separate `import` statements:
```js
import { setupFlow, setStepDone } from "../../helpers/flow-setup.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
```
This is redundant duplication of the module specifier. Since this file is touched by the migration and the project rule directs fixing obvious consistency issues in changed files, it is in scope.
**Suggestion:** Merge into a single import:
```js
import { setupFlow, setStepDone, makeFlowManager } from "../../helpers/flow-setup.js";
```

No other issues found. The remaining changes (import-source updates in `tests/unit/flow.test.js` and `tests/unit/flow/draft-refine-migration.test.js`) correctly relocate `flattenSteps`/`findStepById` to the new `step-tree.js` module per R2/R6 and need no further changes. No bounded-resource-usage concerns apply to these test files.
**Rationale:** Loop review proposal.

### 53. 1. Duplicate import statement from the same module
**Failure mode:** refactor
**File:** tests/unit/flow/auto-upgrade-next-action.test.js
**Issue:** **File:** `tests/unit/flow/auto-upgrade-next-action.test.js`
**Issue:** Lines 7-8 import from the same module `../../helpers/flow-setup.js` in two separate `import` statements:
```js
import { setupFlow, setStepDone } from "../../helpers/flow-setup.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
```
This is redundant duplication of the module specifier. Since this file is touched by the migration and the project rule directs fixing obvious consistency issues in changed files, it is in scope.
**Suggestion:** Merge into a single import:
```js
import { setupFlow, setStepDone, makeFlowManager } from "../../helpers/flow-setup.js";
```

No other issues found. The remaining changes (import-source updates in `tests/unit/flow.test.js` and `tests/unit/flow/draft-refine-migration.test.js`) correctly relocate `flattenSteps`/`findStepById` to the new `step-tree.js` module per R2/R6 and need no further changes. No bounded-resource-usage concerns apply to these test files.
**Suggestion:** **File:** `tests/unit/flow/auto-upgrade-next-action.test.js`
**Issue:** Lines 7-8 import from the same module `../../helpers/flow-setup.js` in two separate `import` statements:
```js
import { setupFlow, setStepDone } from "../../helpers/flow-setup.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
```
This is redundant duplication of the module specifier. Since this file is touched by the migration and the project rule directs fixing obvious consistency issues in changed files, it is in scope.
**Suggestion:** Merge into a single import:
```js
import { setupFlow, setStepDone, makeFlowManager } from "../../helpers/flow-setup.js";
```

No other issues found. The remaining changes (import-source updates in `tests/unit/flow.test.js` and `tests/unit/flow/draft-refine-migration.test.js`) correctly relocate `flattenSteps`/`findStepById` to the new `step-tree.js` module per R2/R6 and need no further changes. No bounded-resource-usage concerns apply to these test files.
**Rationale:** Loop review proposal.

### 54. 1. Extract repeated `resolveMaxAttempts` assertion pattern into a helper
**Failure mode:** refactor
**File:** tests/unit/flow/flow-steps.test.js
**Issue:** **File:** `tests/unit/flow/flow-steps.test.js`
**Issue:** The migration to `getFlowNode(...)` touches five consecutive test bodies that all repeat the identical three-line shape: fetch a node by id, then assert `resolveMaxAttempts({ autoApprove: true })` and `resolveMaxAttempts({ autoApprove: false })`. This duplication (5 occurrences) matches the project rule of extracting a shared helper once a pattern repeats in 2+ places.
**Suggestion:** Add a small local helper and collapse the five cases, e.g.:
```js
function assertMaxAttempts(id, expected) {
  const node = getFlowNode(id);
  assert.equal(node.resolveMaxAttempts({ autoApprove: true }), expected);
  assert.equal(node.resolveMaxAttempts({ autoApprove: false }), expected);
}
```
Then each test becomes `assertMaxAttempts("draft-questions-review", 1);` etc. This removes the boilerplate and makes the per-node expected value the only varying detail. (Note: most cases assert the same value for both `autoApprove` modes; the helper above assumes that. If any node is intended to differ by mode, keep that case inline rather than forcing it through the helper.)

---

The remaining changes across all three files (`finalize-merge-retry.test.js`, `get-next-action.test.js`, and the import line in `flow-steps.test.js`) are pure import-path relocations (`findStepById`/`flattenSteps` → `step-tree.js`, `resolveNodeFor(FLOW_DEFINITION, …)` → `getFlowNode(…)`). They correctly track the R1/R2/R6 boundary move and need no further change.

No guardrail violations found: the diff is test-only and introduces no recursion, retries, or bulk loading subject to **bounded-resource-usage**.
**Suggestion:** **File:** `tests/unit/flow/flow-steps.test.js`
**Issue:** The migration to `getFlowNode(...)` touches five consecutive test bodies that all repeat the identical three-line shape: fetch a node by id, then assert `resolveMaxAttempts({ autoApprove: true })` and `resolveMaxAttempts({ autoApprove: false })`. This duplication (5 occurrences) matches the project rule of extracting a shared helper once a pattern repeats in 2+ places.
**Suggestion:** Add a small local helper and collapse the five cases, e.g.:
```js
function assertMaxAttempts(id, expected) {
  const node = getFlowNode(id);
  assert.equal(node.resolveMaxAttempts({ autoApprove: true }), expected);
  assert.equal(node.resolveMaxAttempts({ autoApprove: false }), expected);
}
```
Then each test becomes `assertMaxAttempts("draft-questions-review", 1);` etc. This removes the boilerplate and makes the per-node expected value the only varying detail. (Note: most cases assert the same value for both `autoApprove` modes; the helper above assumes that. If any node is intended to differ by mode, keep that case inline rather than forcing it through the helper.)

---

The remaining changes across all three files (`finalize-merge-retry.test.js`, `get-next-action.test.js`, and the import line in `flow-steps.test.js`) are pure import-path relocations (`findStepById`/`flattenSteps` → `step-tree.js`, `resolveNodeFor(FLOW_DEFINITION, …)` → `getFlowNode(…)`). They correctly track the R1/R2/R6 boundary move and need no further change.

No guardrail violations found: the diff is test-only and introduces no recursion, retries, or bulk loading subject to **bounded-resource-usage**.
**Rationale:** Loop review proposal.

### 55. 1. Extract repeated `resolveMaxAttempts` assertion pattern into a helper
**Failure mode:** refactor
**File:** tests/unit/flow/flow-steps.test.js
**Issue:** **File:** `tests/unit/flow/flow-steps.test.js`
**Issue:** The migration to `getFlowNode(...)` touches five consecutive test bodies that all repeat the identical three-line shape: fetch a node by id, then assert `resolveMaxAttempts({ autoApprove: true })` and `resolveMaxAttempts({ autoApprove: false })`. This duplication (5 occurrences) matches the project rule of extracting a shared helper once a pattern repeats in 2+ places.
**Suggestion:** Add a small local helper and collapse the five cases, e.g.:
```js
function assertMaxAttempts(id, expected) {
  const node = getFlowNode(id);
  assert.equal(node.resolveMaxAttempts({ autoApprove: true }), expected);
  assert.equal(node.resolveMaxAttempts({ autoApprove: false }), expected);
}
```
Then each test becomes `assertMaxAttempts("draft-questions-review", 1);` etc. This removes the boilerplate and makes the per-node expected value the only varying detail. (Note: most cases assert the same value for both `autoApprove` modes; the helper above assumes that. If any node is intended to differ by mode, keep that case inline rather than forcing it through the helper.)

---

The remaining changes across all three files (`finalize-merge-retry.test.js`, `get-next-action.test.js`, and the import line in `flow-steps.test.js`) are pure import-path relocations (`findStepById`/`flattenSteps` → `step-tree.js`, `resolveNodeFor(FLOW_DEFINITION, …)` → `getFlowNode(…)`). They correctly track the R1/R2/R6 boundary move and need no further change.

No guardrail violations found: the diff is test-only and introduces no recursion, retries, or bulk loading subject to **bounded-resource-usage**.
**Suggestion:** **File:** `tests/unit/flow/flow-steps.test.js`
**Issue:** The migration to `getFlowNode(...)` touches five consecutive test bodies that all repeat the identical three-line shape: fetch a node by id, then assert `resolveMaxAttempts({ autoApprove: true })` and `resolveMaxAttempts({ autoApprove: false })`. This duplication (5 occurrences) matches the project rule of extracting a shared helper once a pattern repeats in 2+ places.
**Suggestion:** Add a small local helper and collapse the five cases, e.g.:
```js
function assertMaxAttempts(id, expected) {
  const node = getFlowNode(id);
  assert.equal(node.resolveMaxAttempts({ autoApprove: true }), expected);
  assert.equal(node.resolveMaxAttempts({ autoApprove: false }), expected);
}
```
Then each test becomes `assertMaxAttempts("draft-questions-review", 1);` etc. This removes the boilerplate and makes the per-node expected value the only varying detail. (Note: most cases assert the same value for both `autoApprove` modes; the helper above assumes that. If any node is intended to differ by mode, keep that case inline rather than forcing it through the helper.)

---

The remaining changes across all three files (`finalize-merge-retry.test.js`, `get-next-action.test.js`, and the import line in `flow-steps.test.js`) are pure import-path relocations (`findStepById`/`flattenSteps` → `step-tree.js`, `resolveNodeFor(FLOW_DEFINITION, …)` → `getFlowNode(…)`). They correctly track the R1/R2/R6 boundary move and need no further change.

No guardrail violations found: the diff is test-only and introduces no recursion, retries, or bulk loading subject to **bounded-resource-usage**.
**Rationale:** Loop review proposal.

### 56. 1. Extract repeated `resolveMaxAttempts` assertion pattern into a helper
**Failure mode:** refactor
**File:** tests/unit/flow/flow-steps.test.js
**Issue:** **File:** `tests/unit/flow/flow-steps.test.js`
**Issue:** The migration to `getFlowNode(...)` touches five consecutive test bodies that all repeat the identical three-line shape: fetch a node by id, then assert `resolveMaxAttempts({ autoApprove: true })` and `resolveMaxAttempts({ autoApprove: false })`. This duplication (5 occurrences) matches the project rule of extracting a shared helper once a pattern repeats in 2+ places.
**Suggestion:** Add a small local helper and collapse the five cases, e.g.:
```js
function assertMaxAttempts(id, expected) {
  const node = getFlowNode(id);
  assert.equal(node.resolveMaxAttempts({ autoApprove: true }), expected);
  assert.equal(node.resolveMaxAttempts({ autoApprove: false }), expected);
}
```
Then each test becomes `assertMaxAttempts("draft-questions-review", 1);` etc. This removes the boilerplate and makes the per-node expected value the only varying detail. (Note: most cases assert the same value for both `autoApprove` modes; the helper above assumes that. If any node is intended to differ by mode, keep that case inline rather than forcing it through the helper.)

---

The remaining changes across all three files (`finalize-merge-retry.test.js`, `get-next-action.test.js`, and the import line in `flow-steps.test.js`) are pure import-path relocations (`findStepById`/`flattenSteps` → `step-tree.js`, `resolveNodeFor(FLOW_DEFINITION, …)` → `getFlowNode(…)`). They correctly track the R1/R2/R6 boundary move and need no further change.

No guardrail violations found: the diff is test-only and introduces no recursion, retries, or bulk loading subject to **bounded-resource-usage**.
**Suggestion:** **File:** `tests/unit/flow/flow-steps.test.js`
**Issue:** The migration to `getFlowNode(...)` touches five consecutive test bodies that all repeat the identical three-line shape: fetch a node by id, then assert `resolveMaxAttempts({ autoApprove: true })` and `resolveMaxAttempts({ autoApprove: false })`. This duplication (5 occurrences) matches the project rule of extracting a shared helper once a pattern repeats in 2+ places.
**Suggestion:** Add a small local helper and collapse the five cases, e.g.:
```js
function assertMaxAttempts(id, expected) {
  const node = getFlowNode(id);
  assert.equal(node.resolveMaxAttempts({ autoApprove: true }), expected);
  assert.equal(node.resolveMaxAttempts({ autoApprove: false }), expected);
}
```
Then each test becomes `assertMaxAttempts("draft-questions-review", 1);` etc. This removes the boilerplate and makes the per-node expected value the only varying detail. (Note: most cases assert the same value for both `autoApprove` modes; the helper above assumes that. If any node is intended to differ by mode, keep that case inline rather than forcing it through the helper.)

---

The remaining changes across all three files (`finalize-merge-retry.test.js`, `get-next-action.test.js`, and the import line in `flow-steps.test.js`) are pure import-path relocations (`findStepById`/`flattenSteps` → `step-tree.js`, `resolveNodeFor(FLOW_DEFINITION, …)` → `getFlowNode(…)`). They correctly track the R1/R2/R6 boundary move and need no further change.

No guardrail violations found: the diff is test-only and introduces no recursion, retries, or bulk loading subject to **bounded-resource-usage**.
**Rationale:** Loop review proposal.

### 57. 1. Duplicate instruction-key collection across three test cases
**Failure mode:** refactor
**File:** tests/unit/flow/instructions-coverage.test.js
**Issue:** **File:** `tests/unit/flow/instructions-coverage.test.js`
**Issue:** The same three-line idiom is repeated in three `it` blocks (lines 99–101, 118–120, 139–141):
```js
const flowKeys = collectInstructionKeys(collectFlowNodes());
const taskKeys = collectInstructionKeys(collectTaskNodes());
const keys = [...flowKeys, ...taskKeys]; // (two of the three)
```
The import migration touched exactly these lines, so the duplication is now in the changed set. The project rule requires extracting a shared helper when the same pattern appears in 2+ places without waiting for a third occurrence — and here it appears three times.
**Suggestion:** Add a module-level helper and call it from each test:
```js
function collectAllInstructionKeys() {
  return [
    ...collectInstructionKeys(collectFlowNodes()),
    ...collectInstructionKeys(collectTaskNodes()),
  ];
}
```
Then each test uses `const keys = collectAllInstructionKeys();` (and `new Set(collectAllInstructionKeys())` for the orphan test), removing the repeated `flowKeys`/`taskKeys` plumbing.

---

No other issues found in the two single-line import changes (`resolve-auto-check-input.test.js`, `run-auto-check-phase.test.js`) — they are clean relocations of `flattenSteps`/`findStepById` to `src/flow/lib/step-tree.js`, consistent with R2.

No bounded-resource-usage violations: the recursive `walk` helpers traverse a finite static definition tree and the on-disk prompt directory, and none of them were newly introduced by this diff.
**Suggestion:** **File:** `tests/unit/flow/instructions-coverage.test.js`
**Issue:** The same three-line idiom is repeated in three `it` blocks (lines 99–101, 118–120, 139–141):
```js
const flowKeys = collectInstructionKeys(collectFlowNodes());
const taskKeys = collectInstructionKeys(collectTaskNodes());
const keys = [...flowKeys, ...taskKeys]; // (two of the three)
```
The import migration touched exactly these lines, so the duplication is now in the changed set. The project rule requires extracting a shared helper when the same pattern appears in 2+ places without waiting for a third occurrence — and here it appears three times.
**Suggestion:** Add a module-level helper and call it from each test:
```js
function collectAllInstructionKeys() {
  return [
    ...collectInstructionKeys(collectFlowNodes()),
    ...collectInstructionKeys(collectTaskNodes()),
  ];
}
```
Then each test uses `const keys = collectAllInstructionKeys();` (and `new Set(collectAllInstructionKeys())` for the orphan test), removing the repeated `flowKeys`/`taskKeys` plumbing.

---

No other issues found in the two single-line import changes (`resolve-auto-check-input.test.js`, `run-auto-check-phase.test.js`) — they are clean relocations of `flattenSteps`/`findStepById` to `src/flow/lib/step-tree.js`, consistent with R2.

No bounded-resource-usage violations: the recursive `walk` helpers traverse a finite static definition tree and the on-disk prompt directory, and none of them were newly introduced by this diff.
**Rationale:** Loop review proposal.

### 58. 1. Duplicate instruction-key collection across three test cases
**Failure mode:** refactor
**File:** tests/unit/flow/instructions-coverage.test.js
**Issue:** **File:** `tests/unit/flow/instructions-coverage.test.js`
**Issue:** The same three-line idiom is repeated in three `it` blocks (lines 99–101, 118–120, 139–141):
```js
const flowKeys = collectInstructionKeys(collectFlowNodes());
const taskKeys = collectInstructionKeys(collectTaskNodes());
const keys = [...flowKeys, ...taskKeys]; // (two of the three)
```
The import migration touched exactly these lines, so the duplication is now in the changed set. The project rule requires extracting a shared helper when the same pattern appears in 2+ places without waiting for a third occurrence — and here it appears three times.
**Suggestion:** Add a module-level helper and call it from each test:
```js
function collectAllInstructionKeys() {
  return [
    ...collectInstructionKeys(collectFlowNodes()),
    ...collectInstructionKeys(collectTaskNodes()),
  ];
}
```
Then each test uses `const keys = collectAllInstructionKeys();` (and `new Set(collectAllInstructionKeys())` for the orphan test), removing the repeated `flowKeys`/`taskKeys` plumbing.

---

No other issues found in the two single-line import changes (`resolve-auto-check-input.test.js`, `run-auto-check-phase.test.js`) — they are clean relocations of `flattenSteps`/`findStepById` to `src/flow/lib/step-tree.js`, consistent with R2.

No bounded-resource-usage violations: the recursive `walk` helpers traverse a finite static definition tree and the on-disk prompt directory, and none of them were newly introduced by this diff.
**Suggestion:** **File:** `tests/unit/flow/instructions-coverage.test.js`
**Issue:** The same three-line idiom is repeated in three `it` blocks (lines 99–101, 118–120, 139–141):
```js
const flowKeys = collectInstructionKeys(collectFlowNodes());
const taskKeys = collectInstructionKeys(collectTaskNodes());
const keys = [...flowKeys, ...taskKeys]; // (two of the three)
```
The import migration touched exactly these lines, so the duplication is now in the changed set. The project rule requires extracting a shared helper when the same pattern appears in 2+ places without waiting for a third occurrence — and here it appears three times.
**Suggestion:** Add a module-level helper and call it from each test:
```js
function collectAllInstructionKeys() {
  return [
    ...collectInstructionKeys(collectFlowNodes()),
    ...collectInstructionKeys(collectTaskNodes()),
  ];
}
```
Then each test uses `const keys = collectAllInstructionKeys();` (and `new Set(collectAllInstructionKeys())` for the orphan test), removing the repeated `flowKeys`/`taskKeys` plumbing.

---

No other issues found in the two single-line import changes (`resolve-auto-check-input.test.js`, `run-auto-check-phase.test.js`) — they are clean relocations of `flattenSteps`/`findStepById` to `src/flow/lib/step-tree.js`, consistent with R2.

No bounded-resource-usage violations: the recursive `walk` helpers traverse a finite static definition tree and the on-disk prompt directory, and none of them were newly introduced by this diff.
**Rationale:** Loop review proposal.

### 59. 1. Duplicate instruction-key collection across three test cases
**Failure mode:** refactor
**File:** tests/unit/flow/instructions-coverage.test.js
**Issue:** **File:** `tests/unit/flow/instructions-coverage.test.js`
**Issue:** The same three-line idiom is repeated in three `it` blocks (lines 99–101, 118–120, 139–141):
```js
const flowKeys = collectInstructionKeys(collectFlowNodes());
const taskKeys = collectInstructionKeys(collectTaskNodes());
const keys = [...flowKeys, ...taskKeys]; // (two of the three)
```
The import migration touched exactly these lines, so the duplication is now in the changed set. The project rule requires extracting a shared helper when the same pattern appears in 2+ places without waiting for a third occurrence — and here it appears three times.
**Suggestion:** Add a module-level helper and call it from each test:
```js
function collectAllInstructionKeys() {
  return [
    ...collectInstructionKeys(collectFlowNodes()),
    ...collectInstructionKeys(collectTaskNodes()),
  ];
}
```
Then each test uses `const keys = collectAllInstructionKeys();` (and `new Set(collectAllInstructionKeys())` for the orphan test), removing the repeated `flowKeys`/`taskKeys` plumbing.

---

No other issues found in the two single-line import changes (`resolve-auto-check-input.test.js`, `run-auto-check-phase.test.js`) — they are clean relocations of `flattenSteps`/`findStepById` to `src/flow/lib/step-tree.js`, consistent with R2.

No bounded-resource-usage violations: the recursive `walk` helpers traverse a finite static definition tree and the on-disk prompt directory, and none of them were newly introduced by this diff.
**Suggestion:** **File:** `tests/unit/flow/instructions-coverage.test.js`
**Issue:** The same three-line idiom is repeated in three `it` blocks (lines 99–101, 118–120, 139–141):
```js
const flowKeys = collectInstructionKeys(collectFlowNodes());
const taskKeys = collectInstructionKeys(collectTaskNodes());
const keys = [...flowKeys, ...taskKeys]; // (two of the three)
```
The import migration touched exactly these lines, so the duplication is now in the changed set. The project rule requires extracting a shared helper when the same pattern appears in 2+ places without waiting for a third occurrence — and here it appears three times.
**Suggestion:** Add a module-level helper and call it from each test:
```js
function collectAllInstructionKeys() {
  return [
    ...collectInstructionKeys(collectFlowNodes()),
    ...collectInstructionKeys(collectTaskNodes()),
  ];
}
```
Then each test uses `const keys = collectAllInstructionKeys();` (and `new Set(collectAllInstructionKeys())` for the orphan test), removing the repeated `flowKeys`/`taskKeys` plumbing.

---

No other issues found in the two single-line import changes (`resolve-auto-check-input.test.js`, `run-auto-check-phase.test.js`) — they are clean relocations of `flattenSteps`/`findStepById` to `src/flow/lib/step-tree.js`, consistent with R2.

No bounded-resource-usage violations: the recursive `walk` helpers traverse a finite static definition tree and the on-disk prompt directory, and none of them were newly introduced by this diff.
**Rationale:** Loop review proposal.

### 60. 1. Duplicated inline task-object literal across derivePhase tests
**Failure mode:** refactor
**File:** tests/unit/lib/flow-helpers-tasks.test.js
**Issue:** **File:** `tests/unit/lib/flow-helpers-tasks.test.js`
**Issue:** Three tests (lines 74–92, 94–112, 114–134) each construct a nearly identical task object literal inline — same `id`, `spec`, `origin`, `parent`, `steps: buildInitialTaskSteps("plan")`, `requirements`, `summary` fields, differing only in `status` and which step is forced to `in_progress`. This repeats the same shape 3 times in one file. Per the project rule ("同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出する"), this should be factored out. Note: this is pre-existing in the file, not introduced by the one-line diff, so it is optional cleanup.
**Suggestion:** Add a `makeTask(overrides = {})` helper next to the existing `makeState` helper that returns the canonical task object, then have each test spread overrides (e.g. `makeTask({ status: "in_progress" })`) and set the in-progress step. This removes the triple duplication and keeps the field shape defined in one place.

No other issues found. No bounded-resource-usage (recursion/retry/bulk-load) concerns apply to this change.
**Suggestion:** **File:** `tests/unit/lib/flow-helpers-tasks.test.js`
**Issue:** Three tests (lines 74–92, 94–112, 114–134) each construct a nearly identical task object literal inline — same `id`, `spec`, `origin`, `parent`, `steps: buildInitialTaskSteps("plan")`, `requirements`, `summary` fields, differing only in `status` and which step is forced to `in_progress`. This repeats the same shape 3 times in one file. Per the project rule ("同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出する"), this should be factored out. Note: this is pre-existing in the file, not introduced by the one-line diff, so it is optional cleanup.
**Suggestion:** Add a `makeTask(overrides = {})` helper next to the existing `makeState` helper that returns the canonical task object, then have each test spread overrides (e.g. `makeTask({ status: "in_progress" })`) and set the in-progress step. This removes the triple duplication and keeps the field shape defined in one place.

No other issues found. No bounded-resource-usage (recursion/retry/bulk-load) concerns apply to this change.
**Rationale:** Loop review proposal.

### 61. 1. Inconsistent migration to the `step-tree.js` module leaves a duplicate `flattenSteps`
**Failure mode:** refactor
**File:** src/flow/lib/gate-step.js
**Issue:** **File:** `src/flow/lib/gate-step.js`
**Issue:** This change set migrated `get-check.js`, `get-next-action.js`, `get-status.js`, `run-finalize-cleanup.js`, `run-reopen-draft.js`, and `set-retry.js` to import `flattenSteps`/`findStepById` from `./step-tree.js` (per R2: "all consumers shall import those utilities from the step-tree module"). But `gate-step.js` kept a local `flattenForGate` that is a byte-for-byte reimplementation of the canonical leaf-only `flattenSteps`. The result is a cross-file inconsistency: one consumer in the same migration is the lone holdout, and its private copy lacks the depth bound (`assertDepth`/`MAX_STEP_TREE_DEPTH`) that the canonical version enforces.
**Suggestion:** Import `flattenSteps` from `./step-tree.js` in `gate-step.js` and delete `flattenForGate`, completing the migration uniformly across all consumers.
**Suggestion:** **File:** `src/flow/lib/gate-step.js`
**Issue:** This change set migrated `get-check.js`, `get-next-action.js`, `get-status.js`, `run-finalize-cleanup.js`, `run-reopen-draft.js`, and `set-retry.js` to import `flattenSteps`/`findStepById` from `./step-tree.js` (per R2: "all consumers shall import those utilities from the step-tree module"). But `gate-step.js` kept a local `flattenForGate` that is a byte-for-byte reimplementation of the canonical leaf-only `flattenSteps`. The result is a cross-file inconsistency: one consumer in the same migration is the lone holdout, and its private copy lacks the depth bound (`assertDepth`/`MAX_STEP_TREE_DEPTH`) that the canonical version enforces.
**Suggestion:** Import `flattenSteps` from `./step-tree.js` in `gate-step.js` and delete `flattenForGate`, completing the migration uniformly across all consumers.
**Rationale:** Loop review proposal.

### 62. 2. Duplicate phase→review-step map across `review.js` and `definition.js`
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Issue:** **File:** `src/flow/commands/review.js`
**Issue:** `REVIEW_PHASE_NODE_MAP` in `review.js` duplicates `REVIEW_STEP_BY_PHASE` in `definition.js` (the `draft-questions`/`draft-coverage`/`spec`/`test` entries are identical). The refactor moved ownership of definition-derived mappings into `definition.js`, but `review.js` still re-derives the same phase→step mapping locally — violating the encapsulation rule (consumers must not re-derive data the owning module already holds). A step-id rename would now require edits in two files.
**Suggestion:** Expose a definition-side query (e.g. `reviewStepIdForPhase(phase)`) from `definition.js` and have `review.js` call it, deleting `REVIEW_PHASE_NODE_MAP`.
**Suggestion:** **File:** `src/flow/commands/review.js`
**Issue:** `REVIEW_PHASE_NODE_MAP` in `review.js` duplicates `REVIEW_STEP_BY_PHASE` in `definition.js` (the `draft-questions`/`draft-coverage`/`spec`/`test` entries are identical). The refactor moved ownership of definition-derived mappings into `definition.js`, but `review.js` still re-derives the same phase→step mapping locally — violating the encapsulation rule (consumers must not re-derive data the owning module already holds). A step-id rename would now require edits in two files.
**Suggestion:** Expose a definition-side query (e.g. `reviewStepIdForPhase(phase)`) from `definition.js` and have `review.js` call it, deleting `REVIEW_PHASE_NODE_MAP`.
**Rationale:** Loop review proposal.

### 63. 3. Confusing near-duplicate names for the paired reset functions
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`
**Issue:** The reset logic was split across two files, producing two functions whose names differ only by the infix word `State`: the command-level wrapper `resetImplEvidenceAfterReviewProposals` (run-review.js) and the definition-side state mutator imported as `resetImplEvidenceStateAfterReviewProposals` (definition.js). The alias exists only to dodge a name collision, not to convey intent, making the two trivially confusable at call sites across the file boundary.
**Suggestion:** Rename the imported alias to express its action, e.g. `applyImplEvidenceResetAfterReviewProposals`, so the wrapper-vs-mutator distinction is clear at every call site.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Issue:** The reset logic was split across two files, producing two functions whose names differ only by the infix word `State`: the command-level wrapper `resetImplEvidenceAfterReviewProposals` (run-review.js) and the definition-side state mutator imported as `resetImplEvidenceStateAfterReviewProposals` (definition.js). The alias exists only to dodge a name collision, not to convey intent, making the two trivially confusable at call sites across the file boundary.
**Suggestion:** Rename the imported alias to express its action, e.g. `applyImplEvidenceResetAfterReviewProposals`, so the wrapper-vs-mutator distinction is clear at every call site.
**Rationale:** Loop review proposal.

### 64. 4. Finalize step-id derivation is scattered and handled inconsistently across `definition.js` and `registry.js`
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** Handling of the finalize step-id family is split inconsistently across two files. In `definition.js`, the downstream list `["finalize-sync", "finalize-cleanup"]` is hardcoded three times. In `registry.js`, a `finalizeCommand(suffix)` helper is used for `finalize-sync`/`finalize-cleanup` but `finalize-commit`/`finalize-merge` still use raw string literals, and `setStepStatus` re-derives "is this a finalize step" via a `step.startsWith("finalize-")` prefix test. R5 explicitly wants this finalize leaf-id knowledge single-sourced in the definition and not re-encoded in registry hooks. The same conceptual set of ids is thus expressed three different ways across the two files.
**Suggestion:** Single-source the finalize step ids in `definition.js` (a frozen `FINALIZE_DOWNSTREAM_STEPS` plus a query for finalize-scoped routing), have `registry.js` consume that query instead of the `"finalize-"` prefix test, and standardize all four finalize entries on `finalizeCommand(...)`.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** Handling of the finalize step-id family is split inconsistently across two files. In `definition.js`, the downstream list `["finalize-sync", "finalize-cleanup"]` is hardcoded three times. In `registry.js`, a `finalizeCommand(suffix)` helper is used for `finalize-sync`/`finalize-cleanup` but `finalize-commit`/`finalize-merge` still use raw string literals, and `setStepStatus` re-derives "is this a finalize step" via a `step.startsWith("finalize-")` prefix test. R5 explicitly wants this finalize leaf-id knowledge single-sourced in the definition and not re-encoded in registry hooks. The same conceptual set of ids is thus expressed three different ways across the two files.
**Suggestion:** Single-source the finalize step ids in `definition.js` (a frozen `FINALIZE_DOWNSTREAM_STEPS` plus a query for finalize-scoped routing), have `registry.js` consume that query instead of the `"finalize-"` prefix test, and standardize all four finalize entries on `finalizeCommand(...)`.
**Rationale:** Loop review proposal.

### 65. 5. Mid-file import in `run-gate.js` diverges from the top-of-file convention used by sibling migrated files
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Issue:** `run-gate.js` keeps `import { resolveMaxAttempts } from "../definition.js";` buried mid-file, whereas the other lib files touched in this same change set (`run-prepare-spec.js`, `run-finalize-cleanup.js`, etc.) place all `../definition.js` imports in the top import block. This is a cross-file convention inconsistency introduced by the migration, obscuring the module's true dependency set.
**Suggestion:** Move the `resolveMaxAttempts` import into the top import block, matching the other migrated lib files.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Issue:** `run-gate.js` keeps `import { resolveMaxAttempts } from "../definition.js";` buried mid-file, whereas the other lib files touched in this same change set (`run-prepare-spec.js`, `run-finalize-cleanup.js`, etc.) place all `../definition.js` imports in the top import block. This is a cross-file convention inconsistency introduced by the migration, obscuring the module's true dependency set.
**Suggestion:** Move the `resolveMaxAttempts` import into the top import block, matching the other migrated lib files.
**Rationale:** Loop review proposal.

### 66. 6. Inconsistent cleanup of references to the removed `TASK_DEFINITION`/`FLOW_DEFINITION` exports
**Failure mode:** refactor
**File:** tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js
**Issue:** **File:** `tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js`
**Issue:** The migration dropped the raw `TASK_DEFINITION`/`FLOW_DEFINITION` exports in favor of `getTaskNode()`/`collectTaskLeafIds()`/`getFlowNode()`, but references to the removed symbols survive in several files: test titles and assertion messages still name `TASK_DEFINITION` (t6 test), and `skill-rules.js` carries a doc comment hardcoding "24 entries" for a now dynamically-derived leaf-id set. The vocabulary describing the new definition-side API is thus stale and inconsistent across files relative to the actual exported surface.
**Suggestion:** Sweep the migrated files to align naming with the new API — rename test descriptions/messages to speak of "task scope leaf ids"/"nodes", and replace the `skill-rules.js` "(24 entries)" count with a description of its derivation source.
**Suggestion:** **File:** `tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js`
**Issue:** The migration dropped the raw `TASK_DEFINITION`/`FLOW_DEFINITION` exports in favor of `getTaskNode()`/`collectTaskLeafIds()`/`getFlowNode()`, but references to the removed symbols survive in several files: test titles and assertion messages still name `TASK_DEFINITION` (t6 test), and `skill-rules.js` carries a doc comment hardcoding "24 entries" for a now dynamically-derived leaf-id set. The vocabulary describing the new definition-side API is thus stale and inconsistent across files relative to the actual exported surface.
**Suggestion:** Sweep the migrated files to align naming with the new API — rename test descriptions/messages to speak of "task scope leaf ids"/"nodes", and replace the `skill-rules.js` "(24 entries)" count with a description of its derivation source.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 13
- Out of scope: 0
