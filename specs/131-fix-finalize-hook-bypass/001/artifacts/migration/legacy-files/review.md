# Code Review Results

### [x] 1. Remove the unused `commitResult` parameter
**File:** `src/flow/lib/run-finalize.js`
**Issue:** `executeCommitPost(ctx, commitResult)` never uses `commitResult`. This is dead API surface and makes the hook contract look more complex than it is.
**Suggestion:** Drop the second parameter from `executeCommitPost` and from the registry hook call site, or actually use it if post-commit behavior needs commit metadata.

**Verdict:** APPROVED
**Reason:** `executeCommitPost(ctx, commitResult)` declares `commitResult` on line 83 but never reads it — all data is accessed via `ctx._results` and `ctx.flowState`. The registry call site (line 329) passes `result` through the `post(ctx, result)` hook interface, so registry doesn't need changing — only the function signature in `run-finalize.js`. This is dead API surface that misleads readers into thinking commit metadata flows into post-processing. Removing it is safe and clarifying.

### [ ] 2. Eliminate the repetitive finalize step hook definitions
**File:** `src/flow/registry.js`
**Issue:** `merge`, `sync`, and `cleanup` all repeat the same `onError: finalizeOnError("<step>")` pattern, and `commit` differs only by adding `post`. This is small but avoidable duplication.
**Suggestion:** Build `steps` from a small helper or an array of step names, then layer the `commit.post` hook on top. That keeps the registry declarative and reduces maintenance when finalize steps change.

**Verdict:** REJECTED
**Reason:** The current four `steps` entries in registry.js (lines 326–341) are only 16 lines, each is immediately readable, and the `commit` step has a meaningfully different structure (`post` + `onError` vs `onError`-only). Abstracting this into a loop or builder adds indirection for negligible deduplication. The registry is meant to be declarative and scannable — a helper that constructs step definitions works against that goal. The maintenance cost of adding/removing a step is already trivial.

### [ ] 3. Rename `executeCleanupImpl` to match its actual role
**File:** `src/flow/lib/run-finalize.js`
**Issue:** The `Impl` suffix suggests there is a public wrapper or interchangeable implementation, but there is no such abstraction anymore. The name now adds noise rather than meaning.
**Suggestion:** Rename it to `executeCleanup` or `runCleanupStep` so the function name reflects what it does without implying an unused pattern.

**Verdict:** REJECTED
**Reason:** This is cosmetic. The `Impl` suffix was *introduced by this very diff* (the original was `executeCleanup`, the diff renames it *to* `executeCleanupImpl`). The correct fix would be to not rename it in the first place, or revert to `executeCleanup`. But as a standalone follow-up refactoring proposal, renaming a private function that has exactly one call site provides zero quality improvement and creates unnecessary churn.

### [x] 4. Extract repeated “git commit with nothing-to-commit fallback” logic
**File:** `src/flow/lib/run-finalize.js`
**Issue:** The `commit` and `sync` steps both implement the same pattern: run `git commit`, convert “nothing to commit” into `skipped`, otherwise rethrow/fail. This duplicates control flow and error matching.
**Suggestion:** Introduce a small helper like `commitOrSkip({ cwd, message })` that returns `{ status, message }`. Reuse it in both steps to keep the finalize pipeline consistent.

**Verdict:** APPROVED
**Reason:** The commit step (lines 201–209) and the sync step (lines 272–279) implement identical logic: run `git commit`, catch the error, check for `/nothing to commit/i`, return `{ status: "skipped" }` or rethrow. This is genuine behavioral duplication with identical error-matching semantics. A `commitOrSkip(args, opts)` helper would eliminate the duplicated try/catch/regex pattern and ensure both steps handle edge cases consistently. The risk is low since the helper is a pure extraction of existing behavior.

### [x] 5. Move finalize-specific issue-log behavior out of the global registry
**File:** `src/flow/registry.js`
**Issue:** `registry.js` now directly imports `saveIssueLog` and `loadIssueLog` for finalize-only error handling. That couples the shared command registry to one command’s persistence details and weakens design consistency.
**Suggestion:** Move `finalizeOnError` into `src/flow/lib/run-finalize.js` or a finalize-specific helper, and let the registry only wire hooks together. This keeps `registry.js` focused on command metadata rather than command-specific side effects.

**Verdict:** APPROVED
**Reason:** `registry.js` is described as the "single source of truth for flow subcommand metadata" (line 4 comment) and historically only contains declarative wiring (`stepPre`, `stepPost`, metric increments). The new `finalizeOnError` function (lines 41–53) imports `saveIssueLog`/`loadIssueLog` and performs finalize-specific persistence — this is command-specific side-effect logic, not metadata. Moving `finalizeOnError` into `run-finalize.js` (which already owns `executeCommitPost` and `runSubStep`) and exporting it for registry wiring would maintain separation of concerns. The registry would still declare the hooks, but the implementation would live where it belongs.
