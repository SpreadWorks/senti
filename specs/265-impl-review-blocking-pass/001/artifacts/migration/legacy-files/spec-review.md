# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Scope filtering can discard required blocking findings
**Target:** R2 / R13 / Data Flow
**Issue:** The spec requires missing or incomplete spec acceptance requirements to be blocking, but R13 and the Data Flow require findings with a missing file path or a file outside the touched-file set to be dropped before PASS calculation. In the existing review command, scope filtering is file-based (`collectTouchedFiles` plus `filterProposalsByScope`). A truly omitted acceptance requirement may have no touched file, or may point to an implementation target that should have been changed but was not. Under the current spec, that blocker would be excluded and the artifact could pass with `blockingFindings.length === 0`.
**Required change:** Define how missing-acceptance blocking findings survive scope filtering, for example by allowing a requirement/expected-target blocker bucket or by exempting R2 missing-acceptance blockers from missing-file/out-of-scope exclusion; also name the exact file-path field used for scope filtering.
**Why blocking:** An implementation can omit a required acceptance behavior, have the reviewer report it without a touched file, and still produce a PASS/ADVISORY artifact because the blocker is excluded before verdict calculation.

### 2. Impl review FAIL transition omits the registry post hook
**Target:** R8 / R9 / T-2 / src/flow/registry.js
**Issue:** The spec assigns PASS, retry, and next-step behavior to `src/flow/lib/run-review.js`, but existing flow step completion is also controlled by `FLOW_COMMANDS.run.review.post` in `src/flow/registry.js`. That hook currently marks the impl `review` step done unless `resetImplEvidenceAfterReviewProposals` sees `proposalCount > 0`. A new structured FAIL artifact may have no `proposalCount`, so updating only `run-review` can still complete the review step and let the flow advance to `gate-impl`.
**Required change:** Add a spec requirement/task for the impl review registry post hook to consume the structured verdict: mark review done only for PASS/ADVISORY and define the FAIL stop/status behavior so gate-impl cannot become the next pending step.
**Why blocking:** The phase-transition acceptance cannot be implemented safely through `run-review` alone; the existing post hook can advance a blocking FAIL to gate-impl despite the new artifact verdict.

### 3. Task-scoped impl review compatibility is unspecified
**Target:** RunReviewCommand task path / src/flow/prompts/task/review.md
**Issue:** Existing impl review has a task-scoped path: `RunReviewCommand` passes `--task-spec` when `currentTaskId` is active, and `src/flow/prompts/task/review.md` mirrors the old proposal-only review contract. The spec only names flow-level impl prompts and describes input as requirement-file map plus diff. It does not say whether the structured `impl-review.json` contract, previous memory, PASS/ADVISORY/FAIL routing, and prompt alignment apply to task-scoped review.
**Required change:** Specify that the structured impl review contract applies to the `--task-spec` task-scoped path, including its prompt update and artifact/verdict behavior, or explicitly define a separate preserved task-review behavior that does not conflict with the shared command path.
**Why blocking:** The same review command can be invoked in task scope; without this compatibility path, implementation may require file-map data that task review does not use, leave task-review instructions stale, or route task review with the old proposal semantics.


## Non-blocking Improvements

### 1. Clarify optional source-review metadata
**Target:** R4 / Data Flow
**Improvement:** The Data Flow says `impl-review.json` stores the source review path, but R4 does not list that field. Clarify whether `sourceReviewPath` or similar metadata is required or only an implementation detail.
**Why non-blocking:** PASS, retry, next-step, and memory behavior can be implemented without this field because the artifact location is already deterministic under `specs/<spec>/impl-review.json`.
