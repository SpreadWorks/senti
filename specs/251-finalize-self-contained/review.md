# Code Review Results

### 1. 1. Add the cleanup fallback path
**File:** `src/flow/lib/flow-context.js`  
**Issue:** `resolveAuthorityFlowState()` returns `flowState: null` whenever `baseFlowManager.load()` is empty. That skips the required last-finalized-spec pointer fallback after worktree cleanup.  
**Suggestion:** Extend the authority helper so the no-cwd-state branch attempts the existing last-finalized-spec pointer resolution before returning `null`.

### 2. 2. Rename `baseFlowManager` to reflect authority
**File:** `src/flow/lib/flow-context.js`  
**Issue:** `baseFlowManager` is vague; in this context it specifically represents the cwd-side flow manager before authority resolution.  
**Suggestion:** Rename it to `cwdFlowManager` or `currentFlowManager` in both `resolveFlowContext()` and `resolveAuthorityFlowState()`.

### 3. 3. Avoid ad hoc authority resolver duplication
**File:** `src/flow/lib/flow-context.js`  
**Issue:** The helper embeds authority selection directly in this file, while the requirements describe a shared authority resolution layer used by next-action, status, resolve-context, resume, and hooks. Keeping the logic local risks drift.  
**Suggestion:** If an authority resolver already exists, call it from this file. If this file is intended to introduce the shared resolver, name/export it accordingly so other flow commands can reuse the same implementation.

### 4. I’ll inspect the touched file plus the referenced helpers so the review is grounded in the repo’s existing patterns, then I’ll keep proposals limited to the diff file as requested.The provided cwd doesn’t contain the expected `src/` tree directly, so I’m checking the workspace layout before drawing conclusions from only the pasted diff.### 1. Remove unused import
**File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `fs` is imported but not used in the changed file.  
**Suggestion:** Remove `import fs from "fs";`.

### 5. 2. Extract commit rollback into a helper
**File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** The commit failure path mixes rollback, error logging, and envelope construction inline. It also does not visibly perform the required `git checkout` restoration after commit failure, leaving rollback behavior harder to reason about.  
**Suggestion:** Extract a `rollbackFinalizeCleanupStep(targetFm, targetRoot, flowJsonRel)` helper that sets the step back to `in_progress`, restores/cleans the staged `flow.json` state as required, and centralizes rollback error handling.

### 6. 3. Rename `missing` to describe the actual value
**File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `buildReportField()` returns `{ report, missing }`, but `missing` is actually an error object, not a boolean or missing-report marker.  
**Suggestion:** Rename it to `reportError` or `error`, e.g. `{ report: null, reportError: err }`, and update `attachReport()` accordingly.

### 7. 4. Make report embedding bounded
**File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** The new finalize-cleanup path embeds report text into the response envelope via `readReportText(path)` without an explicit size bound visible at the call site. If the shared helper reads the full report, this violates the bounded-resource-usage guardrail for bulk data loading.  
**Suggestion:** Ensure the shared helper enforces a maximum report size/text length, or call a bounded variant such as `readReportText(path, { maxBytes: ... })` and return a warning when truncated or oversized.

### 8. 5. Simplify branch deletion flow
**File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** Branch deletion is split across two paths using different `runGit` styles: `["-C", mainRepoPath, ...]` in one branch and `{ cwd: targetRoot }` in the other.  
**Suggestion:** Use one small helper, e.g. `deleteFeatureBranch(repoRoot, featureBranch)`, and call it from both paths for consistent command construction and easier future changes.

### 9. 1. Move Route Semantics Into Executable Structure
**File:** `src/flow/lib/run-finalize-merge.js`  
**Issue:** The added class-level comment encodes detailed PR-route vs squash-route behavior, including registry post-hook semantics, but the invariant is not enforced or made discoverable by code structure here. This can drift as finalize flow behavior changes.  
**Suggestion:** Prefer a small named helper or clearly named branch predicate near the actual route decision, e.g. `isPrCreationOnlyRoute(result)` / `shouldAdvancePostMergeSteps(result)`, and keep the comment there concise. This makes the R19 behavior harder to accidentally break and reduces reliance on a long explanatory block.

### 10. 1. Clarify post-cleanup cwd behavior
**File:** `src/flow/prompts/impl/finalize-cleanup.md`  
**Issue:** Step 3 says “The next `sdd-forge` command runs from the main repository,” but after removing the explicit `cd <mainRepoPath>` instruction, this is ambiguous. It reads like either shell behavior, CLI behavior, or an instruction to the AI.  
**Suggestion:** Reword to make the intended behavior explicit, e.g. “Do not run further commands from the deleted worktree cwd. Use the cleanup envelope for the Report; any later `sdd-forge` command must be run from the main repository or a valid cwd.”

### 11. 1. Avoid unbounded flattening for two known steps
**File:** `src/flow/registry.js`  
**Issue:** `resetSkippedDownstreamSteps()` loads the full flow state, calls `flattenSteps(state.steps || [])`, then searches it for only two known step IDs. This adds unnecessary bulk traversal and may violate the bounded-resource-usage guardrail if `steps` can grow or nest without an explicit limit.  
**Suggestion:** Replace full flattening with a bounded lookup for the two finalize leaves, or add an explicit traversal limit/depth. If the structure is fixed for finalize, prefer locating those leaves through the known finalize subtree instead of flattening every step.

### 12. 2. Split the overloaded status-update helper
**File:** `src/flow/registry.js`  
**Issue:** `tryUpdateStepStatus(target, stepId, status)` now accepts either a hook context or a `FlowManager`, using shape detection on `target.flowManager`. That makes the call contract implicit and weakens naming clarity.  
**Suggestion:** Normalize at call sites and make the helper accept only a `FlowManager`, for example `tryUpdateStepStatus(flowManager, stepId, status)`. Existing callers can pass `ctx.flowManager`, while main-repo hooks pass `targetFm`.

### 13. 3. Avoid repeated linear searches after flattening
**File:** `src/flow/registry.js`  
**Issue:** `resetSkippedDownstreamSteps()` loops over `FINALIZE_DOWNSTREAM_LEAVES` and calls `flat.find(...)` each time. It is minor today, but it is unnecessary duplicate scanning and gets worse if more leaves are added.  
**Suggestion:** Build a `Map` from step id to step once, or do a single pass that checks membership in a `Set` of target IDs. This also makes the function’s intent clearer: update selected downstream finalize steps only.

### 14. I’ll inspect the touched file around the new helper and active-flow resolution so the proposals are grounded in the local patterns, not just the snippet.The provided cwd does not currently contain `src/`; I’ll list the worktree root contents and adjust only if the repository is nested under this directory.### 1. Rename filtered flow list for clarity
**File:** `src/lib/flow-manager.js`  
**Issue:** `active` now means “flows with state, excluding last-finalized spec,” not simply all active-looking flows. The name hides the new post-cleanup exclusion rule.  
**Suggestion:** Rename `active` to `activeCandidates` or `resumableFlows`, and update subsequent references. This makes the fallback semantics clearer.

### 15. 2. Extract the post-cleanup predicate
**File:** `src/lib/flow-manager.js`  
**Issue:** The `scanAllFlows()` fallback now embeds three separate checks inline: has state, has last-finalized pointer, and spec-id exclusion. This logic is central to R17 and likely to matter for future maintenance.  
**Suggestion:** Extract a small private helper such as `_isResolvableActiveFlow(flow, lastFinalizedSpecId)` and use it in the filter. That gives the post-cleanup rule a named home and keeps `resolveActiveFlow()` focused on resolution flow.

### 16. 3. Tighten constant naming
**File:** `src/lib/flow-manager.js`  
**Issue:** `LAST_FINALIZED_SPEC_REL_PATH` can be read as “the finalized spec’s relative path,” but it is actually the pointer file path.  
**Suggestion:** Rename it to `LAST_FINALIZED_SPEC_POINTER_REL_PATH` to distinguish the pointer file from the spec path stored inside it.

### 17. 1. Avoid Duplicating Finalize Step IDs
**File:** `src/templates/partials/flow-tracking.md`  
**Issue:** The exception lists each finalize step ID explicitly after already referring to `finalize-*`. This duplicates the step taxonomy and can drift if finalize steps are added, renamed, or removed.  
**Suggestion:** Simplify to the prefix rule only, e.g. “Exception: steps whose IDs start with `finalize-` are advanced by their own CLI command post hooks; do not advance them manually.”

### 18. 2. Replace “Leaves” With Clearer User-Facing Naming
**File:** `src/templates/partials/flow-tracking.md`  
**Issue:** “leaves” is implementation-oriented terminology and may be unclear in a workflow instruction.  
**Suggestion:** Use “steps” or “step IDs” for consistency with the rest of the sentence.

### 19. 1. Clarify Post-Cleanup Working Directory Transition
**File:** `src/templates/partials/worktree-mode.md`
**Issue:** The sentence “subsequent `sdd-forge` commands run from the main repository because the worktree no longer exists” can imply that deleting the worktree automatically changes the shell working directory, which is not how shells behave and may confuse agents following this instruction.
**Suggestion:** Reword to make the control-flow explicit: cleanup returns the finalize report in the response envelope, and no additional command should be run from the deleted worktree. If a later command is needed, it must be started with the main repository as its working directory.

### 20. 1. Bound finalize report output size
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The instruction says to place `data.report.text` verbatim in a fenced block, but does not define any maximum size. That leaves report rendering as unbounded bulk output, which conflicts with `bounded-resource-usage`.  
**Suggestion:** Add an explicit size/line bound for `data.report.text`, or state that the cleanup envelope guarantees the report is pre-bounded before the agent renders it. For example: “If `data.report.text` exceeds the envelope’s bounded report limit, surface the provided truncated text and warning metadata verbatim.”

### 21. 1. Fix end-of-section regex anchor
**File:** `tests/unit/flow/skill-report-show-wiring.test.js`  
**Issue:** The section regex uses `\Z`, which JavaScript does not support as an end-of-string anchor. It is treated as a literal `Z`, so the match can fail when `### Worktree boundary` is the final section.  
**Suggestion:** Replace `(?=\n### |\Z)` with `(?=\n### |$)`.

### 22. 2. Restore explicit assertion before dereferencing match
**File:** `tests/unit/flow/skill-report-show-wiring.test.js`  
**Issue:** `match[0]` is accessed without first asserting that `match` exists, which turns a missing section into a TypeError instead of a clear test failure.  
**Suggestion:** Add `assert.ok(match, "SKILL.md must contain a '### Worktree boundary' section");` before `assert.match(match[0], ...)`.

### 23. 3. Tighten assertion to the required field
**File:** `tests/unit/flow/skill-report-show-wiring.test.js`  
**Issue:** The new assertion accepts either `data.report.text` or broad `data.report`, but R14 specifically requires the replacement to handle `data.report.text`. This allows a weaker implementation to pass.  
**Suggestion:** Require `data.report.text` explicitly, or use separate assertions if `data.report` is also intentionally documented.

### 24. 1. Centralize flow authority resolution
**File:** `src/flow/lib/flow-context.js`  
**Issue:** Authority resolution is split between `flow-context.js` and `src/lib/flow-manager.js`, with both touching active-flow and last-finalized fallback semantics. This can drift across status, next-action, resume, hooks, and cleanup paths.  
**Suggestion:** Introduce one shared resolver API, then have `resolveFlowContext()` and command hooks call it instead of duplicating cwd/main/last-finalized selection logic.

### 25. 2. Define a bounded report envelope contract
**File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `run-finalize-cleanup.js` embeds report text, while `src/templates/skills/sdd-forge.flow/SKILL.md` instructs agents to render `data.report.text` verbatim. The producer and consumer do not share an explicit size/truncation contract.  
**Suggestion:** Make cleanup always return a bounded report object such as `{ text, truncated, maxBytes }`, and update the skill template to render that contract directly.

### 26. 3. Unify post-cleanup cwd wording
**File:** `src/flow/prompts/impl/finalize-cleanup.md`  
**Issue:** Both `finalize-cleanup.md` and `src/templates/partials/worktree-mode.md` describe command behavior after worktree deletion, but the wording differs and can imply shell cwd changes automatically.  
**Suggestion:** Use one canonical instruction in the shared worktree-mode partial and reference or mirror it exactly in the cleanup prompt: no further commands from the deleted worktree; later commands must start from the main repository or another valid cwd.

### 27. 4. Avoid duplicated finalize step taxonomy
**File:** `src/templates/partials/flow-tracking.md`  
**Issue:** Finalize step IDs are named in documentation while `src/flow/registry.js` also maintains finalize downstream step identifiers. This creates a cross-file drift risk when finalize steps change.  
**Suggestion:** Prefer the `finalize-` prefix rule in human-facing templates, and keep exact step IDs only in executable registry constants or generated documentation.

### 28. 5. Normalize step-status update interfaces
**File:** `src/flow/registry.js`  
**Issue:** `tryUpdateStepStatus()` accepts either a hook context or a `FlowManager`, while cleanup/finalize paths appear to pass managers directly. That implicit dual interface can cause inconsistent usage across command hooks.  
**Suggestion:** Make `tryUpdateStepStatus(flowManager, stepId, status)` accept only a `FlowManager`; callers should pass `ctx.flowManager` or the resolved authority manager explicitly.
