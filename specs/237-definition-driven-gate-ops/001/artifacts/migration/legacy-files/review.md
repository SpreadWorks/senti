# Code Review Results

### [ ] 変更差分に限定して、設計の一貫性と重複・簡素化の観点でレビューします。まず touched files の実装文脈を読み、提案が本当に diff 内で完結するものだけに絞ります。相対パスが一致していないので、まず worktree 内の実際の repo root を特定します。その上で同じ touched files だけ読みます。repo root は一つ上でした。ここから touched files を読んで、提案の重複や見落としがないか確認します。提案候補が二つ見えています。`gatePhase` と `sideEffects` の定義の持ち方が半端に二重化しているので、`deriveNextAction` 周辺の使われ方だけ追加で確認します。task 側の step id 周りが少し不整合に見えるので、そこだけ事実確認します。ここが本当にズレているなら、一番強い改善提案になります。### 1. Remove the leftover hardcoded task gate mapping
**File:** `src/flow/lib/gate-step.js`  
**Issue:** `PHASE_TO_STEP_ENTRIES` is now derived from `definition.js`, but `TASK_STEP_TO_PHASE` remains a manual map keyed by `"gate"` even though current task definitions use `"gate-impl"`. That leaves the module only partially definition-driven and makes phase routing easy to drift.  
**Suggestion:** Derive the task-side reverse mapping from definition metadata too, or make the exception explicit with naming like `FLOW_STEP_TO_PHASE` and `LEGACY_TASK_STEP_TO_PHASE` so the split behavior is intentional rather than hidden.

**Verdict:** REJECTED
**Reason:** The proposal hedges between two solutions ("derive…or rename") without committing to one, and `TASK_STEP_TO_PHASE` is unchanged by this diff — touching it expands scope beyond the refactor and risks behavior change in `resolveGatePhaseFromState`. If there is a genuine drift (task uses `gate-impl`, not `gate`), it should be raised as a separate spec with explicit intent, not folded in as a "consistency" fix.

### [x] 2. Deduplicate the repeated gate-impl side-effect list
**File:** `src/flow/definition.js`  
**Issue:** The same `["completeTask", "promoteNextTask", "mergeOverview"]` literal appears in both flow-level and task-level `gate-impl` nodes. This duplicates maintenance and weakens the “single source of truth” goal of the refactor.  
**Suggestion:** Extract a shared frozen constant such as `GATE_IMPL_PASS_SIDE_EFFECTS` and reuse it in both node definitions.

**Verdict:** APPROVED
**Reason:** The literal `["completeTask", "promoteNextTask", "mergeOverview"]` is now duplicated in two `gate-impl` nodes inside `definition.js`. The project policy explicitly requires extraction at the second occurrence, the change is local to one file, and a frozen shared constant carries zero behavioral risk while making "single source of truth" actually true.

### [ ] 3. Replace the stringly-typed side-effect chain with a handler table
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `executeGateSideEffects()` dispatches with an `if/else if` chain over string literals. That duplicates knowledge already encoded in `definition.js`, and unknown side-effect ids are silently ignored instead of being surfaced clearly.  
**Suggestion:** Use a `GATE_SIDE_EFFECT_HANDLERS` map from effect id to async function, then dispatch via lookup. This removes branching noise, centralizes supported effects, and lets you warn explicitly on unknown effect ids.

**Verdict:** REJECTED
**Reason:** The effect-id set is already centralized in `definition.js`; the if/else only dispatches three known values that share no uniform signature (one needs `state`, one wraps `mutate`, one constructs and `await`s a command). A handler map would still encode the same three branches plus extra wrapper functions, and lazy `await import(...)` semantics need to be preserved per branch. Net change is cosmetic with marginal complexity cost.

### [ ] 4. Make the auto-promote caller test less refactor-fragile
**File:** `tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js`  
**Issue:** The grep-based assertion for “exactly 4 invocation lines across 3 sites” is tied to source layout, not behavior. Harmless refactors like extracting helpers, reformatting lines, or consolidating calls will break the test without changing runtime behavior.  
**Suggestion:** Keep the behavioral assertions already in the file, but replace the grep/count check with a behavior-level test that exercises the PASS path through the gate side-effect runner and verifies the resulting task completion/promotion effects.

**Verdict:** REJECTED
**Reason:** This grep-based test is intentional architectural enforcement of the "single caller boundary" invariant for `promoteNextPending` (per spec 226 and the documented regression history at sites 196/199/208/215/226). Its purpose is precisely to catch silent additions of new call sites that a behavioral test would miss. Replacing it with a behavior test would discard the guard the test was written to provide; the diff already correctly updates the file name to reflect the refactor.
