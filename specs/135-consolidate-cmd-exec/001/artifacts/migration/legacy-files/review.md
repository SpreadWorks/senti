# Code Review Results

### [x] 1. Restore a Single Source of Truth for Flow Phases
**File:** `src/flow/commands/review.js`
**Issue:** `review.js` still imports `../lib/phases.js`, but that file was deleted. At the same time, `get-guardrail.js`, `set-metric.js`, and `registry.js` now each hard-code different phase lists, reintroducing the drift this codebase had just fixed.
**Suggestion:** Reintroduce a shared phase module such as `src/flow/lib/phases.js` and have `review.js`, `get-guardrail.js`, `set-metric.js`, and `registry.js` all consume it. If phase subsets are intentional, derive them from the shared list instead of duplicating literals.

**Verdict:** APPROVED
**Reason:** The diff confirms that `src/flow/lib/phases.js` (which previously exported `VALID_PHASES` as `Object.freeze(["draft", "spec", "gate", "impl", "test", "lint"])`) was **deleted**. Now `get-guardrail.js` hard-codes `["draft", "spec", "impl", "test", "lint"]` (missing `gate`), `set-metric.js` hard-codes `["draft", "spec", "gate", "test", "impl"]` (missing `lint`, different order), and `registry.js` hard-codes two different literal strings in help text (`"draft, spec, impl, lint"` for guardrail — missing `gate` and `test` — and `"draft, spec, gate, test, impl"` for metric — missing `lint`). This is a clear regression: the previous spec (#135-consolidate-valid-phases) was specifically created to fix this exact drift problem, and this refactor undid it. A shared phase module must be restored.

### [x] 2. Fix the Stale Test Assertion After the File Rename
**File:** `specs/133-restore-issue-comment/tests/issue-comment.test.js`
**Issue:** The test descriptions were updated from `git-state.js` to `git-helpers.js`, but the regex assertions still check for `git-state.js`. That makes the test misleading and likely incorrect.
**Suggestion:** Update the regex patterns and assertion messages to match `git-helpers.js` so the test verifies the actual intended dependency.

**Verdict:** APPROVED
**Reason:** The diff shows `specs/133-restore-issue-comment/tests/issue-comment.test.js` updated the `it()` description strings from `git-state.js` to `git-helpers.js`, but the regex patterns inside the assertions still check for `git-state\.js` (e.g., `/import\s+\{[^}]*commentOnIssue[^}]*\}\s+from\s+["'].*git-state\.js["']/`). Since the actual source file was renamed to `git-helpers.js`, these regex assertions will now fail. The test descriptions say one thing and the assertions verify another — this is a real bug.

### [x] 3. Preserve the Previous `runCommand` Result Contract
**File:** `src/docs/commands/forge.js`
**Issue:** `runCommand()` previously returned `{ ok, code, stdout, stderr }`, but now it directly returns `runCmdAsync()` output, which uses `status` instead of `code`. That is an inconsistent API change hidden inside a refactor.
**Suggestion:** Keep `runCommand()` as a thin adapter that maps `status` back to `code`, or standardize the process helper contract everywhere and update all callers explicitly.

**Verdict:** APPROVED
**Reason:** The diff shows `forge.js` changed `runCommand()` from returning `{ ok, code, stdout, stderr }` (where `code` came from `err?.code ?? 0`) to directly returning `runCmdAsync()` output which uses `{ ok, status, stdout, stderr }`. Any caller checking `result.code` will now get `undefined`. This is a silent contract break. Either `runCommand` should map `status` → `code` for backward compatibility, or all callers must be audited and updated.

### [x] 4. Pass Through Execution Options Consistently in the New Process Helper
**File:** `src/lib/process.js`
**Issue:** The new `runCmd`/`runCmdAsync` helpers do not forward several useful options that older call sites relied on or explicitly set, such as `env` and `maxBuffer`. This makes the abstraction less general and can create behavior regressions.
**Suggestion:** Support pass-through of relevant `execFileSync`/`execFile` options in both helpers, or define a clearly documented minimal option surface and update callers accordingly.

**Verdict:** APPROVED
**Reason:** The diff shows `runCmd` does not forward `env` (the old `runSync` did: `...(opts.env && { env: opts.env })`), and `runCmdAsync` does not forward `maxBuffer` (the old `forge.js` `runCommand` explicitly set `maxBuffer: 20 * 1024 * 1024`). The old `run-retro.js` also used `maxBuffer: 10 * 1024 * 1024`. Dropping `maxBuffer` can cause truncation errors on large diffs; dropping `env` can break `set-metric` tests that rely on `SDD_WORK_ROOT`. These are behavior regressions, not cosmetic issues.

### [x] 5. Extract the Repeated “Diff + Commit Log” Collection Logic
**File:** `src/flow/lib/run-finalize.js`
**Issue:** `run-finalize.js` and `run-report.js` now contain near-identical logic for collecting `git diff --stat` and commit subjects from `baseBranch..HEAD`. This is duplicate code and will drift on the next change.
**Suggestion:** Extract a helper such as `collectGitSummary(root, baseBranch)` in a shared module and reuse it from both commands.

**Verdict:** APPROVED
**Reason:** The diff shows `run-finalize.js` (lines around `executeCommitPost`) and `run-report.js` both contain identical 4-line patterns: `runCmd("git", ["diff", "--stat", ...])` → trim → assign to `implDiffStat`, then `runCmd("git", ["log", "--format=%s", ...])` → trim → split → filter → assign to `commitMessages`. This is textbook duplication across two files. Per the project's own rule ("2箇所以上から呼ばれる場合、共通ヘルパーに抽出すること"), extraction is warranted.

### [x] 6. Reconcile Help Text With Actual Validation Rules
**File:** `src/flow/registry.js`
**Issue:** The help text now hard-codes phase lists that do not match each other and do not match previous behavior. For example, `get guardrail` help omits `test` and `gate`, while `set metric` uses a different set again.
**Suggestion:** Generate help text from the same validation source used by the command implementation, so user-facing docs and runtime behavior cannot diverge.

**Verdict:** APPROVED
**Reason:** This is a direct consequence of Proposal #1. The `registry.js` help text now says `"Phases: draft, spec, impl, lint"` for `get guardrail` (4 phases, missing `gate` and `test`) while the actual `get-guardrail.js` validates against 5 phases (`["draft", "spec", "impl", "test", "lint"]`). For `set metric`, the help says `"Phases: draft, spec, gate, test, impl"` which happens to match the local constant but diverges from `get-guardrail`'s set. Users will receive incorrect guidance. Generating help text from the same validation source eliminates this class of bug entirely.
