# Code Review Results

### 1. 1. Avoid Double Map Lookup
**File:** `src/flow/definition.js`
**Issue:** `scanLatestInProgressLeaf()` calls `order.has(s.id)` and then `order.get(s.id)`, doing two lookups for every matching in-progress step.
**Suggestion:** Use a single `get()` and test for `undefined`, since indexes are numeric:

```js
const index = order.get(s.id);
if (index === undefined) continue;
```

### 2. 2. Clarify Mutable Scan State Naming
**File:** `src/flow/definition.js`
**Issue:** The `state` object passed through `scanLatestInProgressLeaf()` is a mutable accumulator, but the name `state` is broad and can be confused with flow state elsewhere in this module.
**Suggestion:** Rename it to `scan` or `result` consistently, e.g. `scan.scanned`, `scan.step`, `scan.index`, to make the mutation scope clearer.

### 3. 3. Consider Removing Or Demoting Old Finder If Superseded
**File:** `src/flow/definition.js`
**Issue:** `findActiveNode()` no longer uses `findInProgressLeaf()`. If this was the only meaningful caller, keeping the old exported function creates two competing active-step selection semantics.
**Suggestion:** If external callers do not need the old “first in-progress leaf” behavior, remove it or make it private only where still needed. Otherwise, add a short comment explaining why both selection strategies intentionally coexist.

### 4. I’ll inspect the touched file and the nearby helpers it now calls so the proposals are grounded in the existing patterns, while keeping recommendations limited to `src/flow/lib/get-next-action.js`.The provided cwd appears to be a temporary directory rather than the repository root, so those relative paths are not present here. I’ll quickly locate the worktree contents before deciding whether the diff alone is enough.The repository root is the parent of the current temp directory. I found the touched source tree there, so I’m reading via `../src/...` from the current working directory and keeping this to review only.The related helpers already have bounded scans and capped path lists, matching the guardrail rationale. I’m checking status handling next because `next-action` now mirrors part of that output, and duplication there is the likely quality issue.### 1. Make retry/stop merge precedence explicit
**File:** `src/flow/lib/get-next-action.js`  
**Issue:** `attachRetryRecovery` merges `stopView` and `retryRecovery` with object spreads. Shared fields such as `phase` and `recoveryCommand` can be overwritten implicitly, including by `null`.  
**Suggestion:** Build the merged view field-by-field, with documented precedence. For example, use `retryRecovery.recoveryCommand ?? stopView.recoveryCommand` if fallback commands should survive, or intentionally set `null` with an explicit conditional.

### 5. 2. Collapse repeated retry-recovery attachment flow
**File:** `src/flow/lib/get-next-action.js`  
**Issue:** The review and gate branches both build retry recovery data, check it, then call `attachRetryRecovery`. `buildRetryRecoveryForState` is also a thin wrapper around `buildStateRetryRecoveryView`.  
**Suggestion:** Replace this with one helper such as `applyRetryRecoveryView(result, ctx, state, { stopKey, stopView, kind, phase, attempts, max })` that builds and attaches the recovery view in one place.

### 6. 3. Name the propagated output fields
**File:** `src/flow/lib/get-next-action.js`  
**Issue:** The top-level propagation list inside `attachRetryRecovery` is an inline array mixing stop fields and recovery fields. That output contract is easy to miss when adding or renaming fields.  
**Suggestion:** Extract it to a named constant such as `STOP_VIEW_TOP_LEVEL_FIELDS`, and consider a small `copyDefinedFields(result, view, fields)` helper to make the mutation intent clearer.

### 7. 1. Remove Thin Wrapper Around Retry Recovery Builder
**File:** `src/flow/lib/get-status.js`
**Issue:** `buildStatusRetryRecoveryView()` only forwards arguments to `buildStateRetryRecoveryView()` with reordered fields. This adds an extra local abstraction without hiding meaningful complexity.
**Suggestion:** Inline the `buildStateRetryRecoveryView({ root, flowState: state, ... })` calls in `buildStatusReviewViews()` and `buildStatusGateViews()`, or make the wrapper add real status-specific behavior.

### 8. 2. Collapse One-Off Retry Recovery Selection Helper
**File:** `src/flow/lib/get-status.js`
**Issue:** `resolveStatusRetryRecovery()` is only a three-branch priority selector and is called once. The helper name sounds like it performs resolution logic, but it only picks review before gate.
**Suggestion:** Replace it with a direct expression near the output construction, for example `const retryRecovery = reviewViews?.retryRecovery || gateViews?.retryRecovery || null;`. If priority is semantically important, add a short comment there.

### 9. 3. Reduce Duplicate Recovery View Construction
**File:** `src/flow/lib/get-status.js`
**Issue:** `buildStatusReviewViews()` and `buildStatusGateViews()` both construct retry recovery views with the same shape: `kind`, `phase`, `attempts`, and `max`.
**Suggestion:** Extract a shared helper that takes `{ root, state, kind, phase, attempts, max }` and returns the recovery view. This would keep review/gate-specific resolution separate while eliminating repeated object construction.

### 10. I’ll inspect the touched file around the changed helper so the proposals stay scoped to the diff and grounded in existing usage.The provided cwd is a temporary review directory and doesn’t contain the source tree at that relative path. I’ll check the local layout before deciding whether the diff alone is enough.The source tree appears to be one level above `.tmp`, still inside the active worktree. I’m going to read only the touched file to keep the review scoped.### 1. Avoid a shell-metacharacter placeholder in the recovery command
**File:** `src/flow/lib/review-failure.js`  
**Issue:** `retryResetCommand()` now returns `--reason <text>`. If this `recoveryCommand` is copied into a shell, `<text>` is parsed as input redirection, so the displayed command is not safely runnable. The helper name also implies it returns an executable command, not a template.  
**Suggestion:** Make the helper accept a concrete reason and emit a runnable command, or rename/split it as a command template helper. For example, prefer `retryResetCommand(phase, reason)` with a quoted reason value, or rename to `retryResetCommandTemplate()` if the placeholder is intentional.

### 11. I’ll inspect the touched file around the new recovery logic and nearby retry patterns so the proposals are grounded in the existing design.The diff paths are relative to the repository root, but the current directory is the flow `.tmp` directory. I’m checking the local layout before reading the file.The repository root is the parent worktree. I found the target file there and will read only the touched areas and closely related recovery helpers.### 1. Remove duplicated recoverable phase knowledge
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `GATE_RECOVERY_PHASES` duplicates the gate recoverability rules already owned by `retry-recovery.js` through `persistCurrentRecoveryBaseline()`. If the recoverable phase list changes, this file can silently drift.  
**Suggestion:** Remove `GATE_RECOVERY_PHASES` and let `persistCurrentRecoveryBaseline()` decide whether the target is recoverable. Keep only the mutation preconditions in `persistGateRecoveryBaseline()`.

### 12. 2. Bound the baseline scan
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `hasGateRecoveryBaseline()` scans `state.reviewRecoveryBaselines` with `.some()` and no explicit upper bound. This conflicts with the bounded-resource-usage guardrail for bulk state scans.  
**Suggestion:** Add an explicit scan cap in this file, for example `MAX_GATE_RECOVERY_BASELINE_SCAN`, and fail closed for `seedOnly` when the list exceeds the cap, or scan only the bounded latest entries that can be relevant.

### 13. 3. Rename `seedOnly` to express behavior
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `seedOnly` is vague; the actual behavior is “persist only if this target has no baseline yet.”  
**Suggestion:** Rename the option to something like `onlyIfMissing` or `preserveExistingBaseline`, and update the single call site in `checkRetryBelowMax()`.

### 14. 4. Align gate recovery mutation helpers with review naming
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `persistGateRecoveryBaseline()` mixes capability checks, mutation, duplicate avoidance, and persistence. `run-review.js` uses clearer helper separation with `canMutateRecoveryState()` and a mutation wrapper.  
**Suggestion:** Split this into a small `canMutateGateRecoveryState(ctx)` helper and a focused mutation helper. This keeps gate/review recovery patterns consistent and makes the early-return conditions easier to read.

### 15. 1. Avoid double recovery baseline persistence on exhaustion
**File:** `src/flow/lib/run-review.js`  
**Issue:** A final FAIL can call `mutateReviewRecoveryState()` in `updateReviewRetryCounter()`, then the next retry gate can call it again in `checkReviewRetryBelowMax()`. That duplicates the same recovery-baseline side effect for one exhaustion path.  
**Suggestion:** Choose one canonical persistence point, preferably the point where the counter reaches exhaustion, and make the retry-gate path a fallback only when no baseline exists.

### 16. 2. Replace string trigger constants with a grouped object
**File:** `src/flow/lib/run-review.js`  
**Issue:** `REVIEW_RECOVERY_TRIGGER_RETRY_EXHAUSTED`, `REVIEW_RECOVERY_TRIGGER_STOP`, and `REVIEW_RECOVERY_TRIGGER_VERDICT_FAIL` repeat the `REVIEW_RECOVERY_TRIGGER_` prefix and make call sites noisy.  
**Suggestion:** Use a frozen object such as `ReviewRecoveryTrigger.retryExhausted`, `ReviewRecoveryTrigger.stop`, and `ReviewRecoveryTrigger.verdictFail` to match the file’s existing OOP/value-object style more closely and improve readability.

### 17. 3. Clarify `mutateReviewRecoveryState` callback naming
**File:** `src/flow/lib/run-review.js`  
**Issue:** The callback name `afterPersist` describes timing but not responsibility. At the call site, it writes review stop state, so the callback is really additional flow-state mutation inside the same transaction.  
**Suggestion:** Rename it to something like `mutateState` or `onPersistedState` so the helper’s contract is clearer.

### 18. 4. Simplify optional chaining in recovery-state guard
**File:** `src/flow/lib/run-review.js`  
**Issue:** `canMutateRecoveryState(ctx)` uses `ctx?.flowManager?.mutate` after already checking `ctx?.root`; the repeated optional chaining adds visual noise.  
**Suggestion:** Use `return Boolean(ctx?.root && typeof ctx.flowManager?.mutate === "function");` or inline this guard if it remains single-use.

### 19. 5. Make the fallback mutation path explicit
**File:** `src/flow/lib/run-review.js`  
**Issue:** In the review-stop path, `writeReviewStopState(ctx.flowState, failure)` is used only when recovery persistence fails. That fallback mutates a different state reference than the `flowManager.mutate()` path, which makes the side-effect model harder to reason about.  
**Suggestion:** Extract a named helper such as `persistReviewStopRecoveryState()` that encapsulates both the baseline persistence and stop-state fallback, with a clear return value for whether durable state was updated.

### 20. 1. Avoid Empty `grants` Noise On Non-Recovery Resets
**File:** `src/flow/lib/set-retry.js`
**Issue:** The command now always returns `grants`, even for ordinary non-exhausted resets where it is always an empty array. That adds a new response shape detail with no useful signal.
**Suggestion:** Only include `grants` when at least one recovery grant was created, or rename it to something explicit like `recoveryGrants` and omit it when empty.

### 21. 2. Simplify The Thin `RetryResetOperation` Wrapper
**File:** `src/flow/lib/set-retry.js`
**Issue:** `RetryResetOperation` is mostly a frozen data bag with one derived boolean and one getter. It does not enforce much invariant beyond what the surrounding code already controls, so it adds indirection to a short command flow.
**Suggestion:** Either inline the operation objects in the local `operations` array, or make the class carry the behavior that currently lives in the two loops, such as `isExhausted()` and `apply(ctx)`, so the abstraction earns its place.

### 22. 3. Consolidate Recovery Rejection Formatting
**File:** `src/flow/lib/set-retry.js`
**Issue:** `formatRecoveryRejectionCode()` and `failRecoveryRejection()` are tightly coupled single-use helpers. Splitting them makes the rejection path harder to scan without reducing duplication.
**Suggestion:** Inline the code normalization inside `failRecoveryRejection()`, or move both into a small rejection value/helper in the recovery module if other retry recovery callers need the same envelope shape later.

### 23. 1. Reduce duplicated recovery command wording
**File:** `src/flow/prompts/impl/review.md`
**Issue:** The recovery command is described twice in one bullet: a generic placeholder form and the impl-specific command. This increases drift risk and may encourage literal placeholder use.
**Suggestion:** Keep the impl-specific command as the primary instruction, and move the generic form to a short parenthetical if needed.

### 24. 2. Clarify the reason placeholder
**File:** `src/flow/prompts/impl/review.md`
**Issue:** `--reason <text>` is technically correct, but prompt consumers may copy `<text>` literally or provide a vague reason.
**Suggestion:** Rename the placeholder to something more intention-revealing, such as `--reason "<changed evidence summary>"`, and state that the reason must describe the evidence change.

### 25. 1. Merge Redundant Recovery Guidance
**File:** `src/flow/prompts/plan/review-test.md`  
**Issue:** The two new bullets repeat closely related recovery rules: required reason, audit entry, one re-evaluation, and unchanged evidence rejection.  
**Suggestion:** Combine them into one bullet so the recovery contract is stated once and is harder to drift in future edits.

### 26. 2. Prefer The Phase-Specific Command
**File:** `src/flow/prompts/plan/review-test.md`  
**Issue:** The generic command `sdd-forge flow set retry reset <gate|review> <phase> ...` adds avoidable ambiguity inside a prompt specifically for `review test`.  
**Suggestion:** Use only the concrete command for this context: `sdd-forge flow set retry reset review test --reason <text> --yes`.

### 27. 1. Align Recovery Wording With Requirement
**File:** `src/flow/prompts/task/review.md`
**Issue:** The requirement says guidance should describe “unchanged-state rejection,” but the new text says “unchanged evidence is rejected.” That is close, but narrower and may drift from the audited recovery semantics.
**Suggestion:** Change the final sentence to use the requirement terminology, for example: “The reason is required and audited, one re-evaluation is granted, and unchanged state/evidence is rejected.”

### 28. 2. Simplify Recovery Command Guidance
**File:** `src/flow/prompts/task/review.md`
**Issue:** “Use `review` for review recovery and `gate` for gate recovery” duplicates what the `<gate|review>` placeholder already conveys, and the order differs from the prose.
**Suggestion:** Use one concise sentence: “Recovery command: `sdd-forge flow set retry reset <review|gate> <phase> --reason <text> --yes`.”

### 29. I’ll inspect the touched file around the diff before proposing anything, so the feedback lines up with the local patterns instead of judging the snippet in isolation.The provided cwd does not contain `src/flow/registry.js`, so I’m checking the workspace shape. I’ll keep the review scoped to the diff file either way.### 1. Derive retry help phases from route metadata
**File:** `src/flow/registry.js`
**Issue:** `RETRY_HELP_REVIEW_PHASES` hard-codes `draft-questions` and `draft-coverage`, which are already represented in draft review route metadata. This creates drift risk if draft review routes change.
**Suggestion:** Import `DRAFT_REVIEW_ROUTES` alongside `draftReviewRouteForRetryPhase` and build the review help list from `DRAFT_REVIEW_ROUTES.map((route) => route.retryPhase)` plus the non-draft review phases.

### 30. 2. Use clearer names for help-only phase constants
**File:** `src/flow/registry.js`
**Issue:** `RETRY_HELP_GATE_PHASES` and `RETRY_HELP_REVIEW_PHASES` sound like validation constants, but they are only display lists for the retry-reset help text.
**Suggestion:** Rename them to something like `RETRY_RESET_GATE_PHASE_ARGS` and `RETRY_RESET_REVIEW_PHASE_ARGS`, or group them under `RETRY_RESET_PHASE_ARGS_BY_KIND`, to make their purpose explicit.

### 31. 3. Simplify repeated recovery wording
**File:** `src/flow/registry.js`
**Issue:** The help text repeats “audited” / “recovery” concepts across adjacent lines, making the command description a little heavier than needed.
**Suggestion:** Collapse the last two lines to something like: `Requires changed evidence, records --reason, grants exactly one re-evaluation, and rejects unchanged evidence. --yes is required.`

### 32. 1. Replace Run ID migration record object with a small class
**File:** `src/lib/flow-store.js`  
**Issue:** `createRunIdMigration()` returns a plain object for a meaningful stateful value (`path`, `runId`, `contentBeforeRunId`). This is inconsistent with the project’s OOP-by-convention rule for typed values and scatters rollback eligibility behavior across helper functions.  
**Suggestion:** Introduce a `RunIdMigration` class that enforces the retained-content size invariant in the constructor and owns `canRollback()` / `rollback()` behavior. This would remove the ad hoc record shape and make `_lastRunIdMigration`’s contract clearer.

### 33. 2. Use byte length consistently for retained flow-state content
**File:** `src/lib/flow-store.js`  
**Issue:** `MAX_FLOW_STATE_READ_BYTES` is a byte limit, but `createRunIdMigration()` checks `contentBeforeRunId.length`, which counts UTF-16 code units, not UTF-8 bytes. That makes the bound’s meaning inconsistent.  
**Suggestion:** Use `Buffer.byteLength(contentBeforeRunId, "utf8")` for the retained-content check, or pass the `statSync().size` value through from `readBoundedFlowStateText()` so both read and retain limits use the same byte measurement.

### 34. 3. Reduce duplicate bounded-size error construction
**File:** `src/lib/flow-store.js`  
**Issue:** `readBoundedFlowStateText()` and `createRunIdMigration()` duplicate nearly identical max-size error formatting.  
**Suggestion:** Extract a small helper such as `assertBoundedFlowStateBytes(size, action)` so the size policy and error wording stay centralized. This also makes future changes to the resource bound less error-prone.

### 35. 1. Clarify The Retry Limit Wording
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`
**Issue:** “grants one re-evaluation” is slightly ambiguous; it could read like each reset grants another retry rather than enforcing a one-time limit.
**Suggestion:** Reword to explicitly state the cap, e.g. “allows at most one re-evaluation” or “permits one re-evaluation only.”

### 36. 2. Avoid Mixing Explanatory Text Into The Command List
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`
**Issue:** The new `# Retry recovery...` line appears inline with command examples. If this section is intended as a command reference, the comment style is inconsistent with the surrounding command-only list and may be overlooked or copied as shell text.
**Suggestion:** Move the explanation into prose immediately before or after the command block, for example as a Markdown sentence: “Retry recovery requires `--reason`, records an audit entry, permits only one re-evaluation, and rejects unchanged evidence.”

### 37. 1. Centralize Retry-Recovery View Construction
**File:** `src/flow/lib/get-next-action.js`
**Issue:** `get-next-action.js` and `get-status.js` both introduce local wrappers/helpers around retry-recovery view construction, with repeated `kind`, `phase`, `attempts`, and `max` mapping. This creates two output-shaping paths for the same recovery concept.
**Suggestion:** Move the shared view assembly into `retry-recovery.js` or a small flow view helper, then have both status and next-action call it directly with the same interface.

### 38. 2. Standardize Recovery Command Templates
**File:** `src/flow/lib/review-failure.js`
**Issue:** Recovery command wording appears across `review-failure.js`, registry help, prompts, and the skill template, but the placeholder varies between generic and phase-specific forms. The shared `--reason <text>` form is also risky if copied into a shell.
**Suggestion:** Define one command-template formatter, preferably emitting `--reason "<changed evidence summary>"`, and reuse that wording in help text, prompts, and generated recovery commands.

### 39. 3. Avoid Duplicated Recoverable Phase Lists
**File:** `src/flow/lib/run-gate.js`
**Issue:** Gate/review retry phase knowledge is duplicated across `run-gate.js`, `registry.js`, and prompt text. These lists can drift from the actual recoverability rules owned by retry-recovery behavior and route metadata.
**Suggestion:** Keep recoverable phase metadata in one module and derive gate/review help lists, validation behavior, and prompt examples from that source.

### 40. 4. Align Recovery Mutation Helper Shape
**File:** `src/flow/lib/run-gate.js`
**Issue:** `run-review.js` uses clearer recovery mutation helpers such as capability checks and mutation wrappers, while `run-gate.js` combines capability checks, duplicate avoidance, mutation, and persistence in one helper. The option name `seedOnly` also differs from the behavior described elsewhere as preserving an existing baseline.
**Suggestion:** Give gate and review recovery persistence the same helper structure and option vocabulary, e.g. `canMutateRecoveryState()` plus `persistRecoveryBaseline({ onlyIfMissing: true })`.

### 41. 5. Use Recovery-Specific Output Names Consistently
**File:** `src/flow/lib/set-retry.js`
**Issue:** `set-retry.js` exposes `grants`, while prompts and help describe “one re-evaluation” or “recovery grants.” The short generic field name is less clear than the surrounding recovery terminology and may be confused with unrelated permissions.
**Suggestion:** Rename the response field to `recoveryGrants` and omit it when empty, then align any consumers or documentation with that name.
