# Test Design

### Test Design

- **TC-1: finalize-commit post hook normalizes success statuses**
  - Type: unit
  - Input: command result status `done`, `completed`, `skipped`
  - Expected: `finalize-commit` step status is set to `done` in worktree-side `flow.json`

- **TC-2: finalize-commit preserves failure statuses**
  - Type: unit
  - Input: command result status `failed`, `preflight_failed`
  - Expected: step status remains `failed` / `preflight_failed`; no normalization to `done`

- **TC-3: finalize-commit skips success side effects on failure**
  - Type: unit
  - Input: `finalize-commit` returns `failed` or `preflight_failed`
  - Expected: `executeCommitPost` is not called; retro/report/success-only side effects do not run

- **TC-4: finalize-commit runs success path only for successful statuses**
  - Type: integration
  - Input: `finalize-commit` returns `done`, `completed`, or `skipped`
  - Expected: status becomes `done`; success post hook path executes exactly once

- **TC-5: finalize-merge updates main repo authority after merge**
  - Type: integration
  - Input: worktree flow state has `mainRepoPath`; `finalize-merge` succeeds
  - Expected: main repo `specs/<id>/flow.json` is updated; worktree `flow.json` is not used as authority after merge

- **TC-6: finalize-sync updates main repo flow.json**
  - Type: integration
  - Input: post-merge `finalize-sync` succeeds from worktree cwd
  - Expected: `ctx.flowManager.forRoot(mainRepoPath)` writes `finalize-sync: done` to main repo flow state

- **TC-7: finalize-cleanup post hook is idempotent**
  - Type: unit
  - Input: `finalize-cleanup` body already set step to `done`; post hook runs
  - Expected: post hook re-sets `done` without changing other flow state or causing failure

- **TC-8: authority resolver uses main repo after merge**
  - Type: integration
  - Input: metadata has `worktree:true` and `mainRepoPath`; main repo `specs/<id>/flow.json` exists
  - Expected: `flow get next-action` reads main repo authority and returns next step from main flow state

- **TC-9: authority resolver falls back to current cwd before merge**
  - Type: integration
  - Input: worktree metadata exists but main repo `specs/<id>/flow.json` does not exist
  - Expected: authority is current cwd; `next-action` reads worktree flow state

- **TC-10: authority resolver uses last-finalized-spec after cleanup**
  - Type: integration
  - Input: worktree was removed; `.active-flow` is cleared; last-finalized-spec pointer exists
  - Expected: `flow get next-action`, `status`, and `resolve-context` resolve context from pointer without reactivating flow

- **TC-11: get-status shares same authority as next-action**
  - Type: integration
  - Input: merge completed and main repo flow state differs from stale worktree flow state
  - Expected: `flow get status` reports main repo state, matching `flow get next-action`

- **TC-12: get-resolve-context shares same authority as next-action**
  - Type: integration
  - Input: cleanup completed; last-finalized-spec pointer exists
  - Expected: `flow get resolve-context` resolves finalized spec context from pointer authority

- **TC-13: resolveFlowContext builds ctx.flowState from authority resolver**
  - Type: unit
  - Input: mocked authority resolver returns main repo / cwd / pointer authority
  - Expected: `ctx.flowState` is constructed from the selected authority source in all cases

- **TC-14: registry hooks and FlowCommand share unified ctx.flowState**
  - Type: integration
  - Input: command execution path through registry, get-status, get-resolve-context, run-resume
  - Expected: all consumers observe the same resolved flow state for the same repository condition

- **TC-15: finalize-cleanup embeds report object**
  - Type: integration
  - Input: valid `report.json` exists and cleanup succeeds
  - Expected: envelope has `data.report = { path, text }`; `nextCommand` is absent

- **TC-16: finalize-cleanup handles missing report as warning**
  - Type: unit
  - Input: cleanup succeeds but report cannot be resolved/read
  - Expected: envelope remains `ok:true`; `data.report = null`; warning `REPORT_MISSING` is present

- **TC-17: dispatcher accepts Envelope return value**
  - Type: unit
  - Input: `run-finalize-cleanup.js` returns an `Envelope` object directly for report-warning path
  - Expected: dispatcher preserves warnings and does not double-wrap incorrectly

- **TC-18: dispatcher accepts plain object return value**
  - Type: unit
  - Input: finalize command returns existing plain object shape
  - Expected: dispatcher wraps result into a valid envelope with existing behavior preserved

- **TC-19: finalize-cleanup and report show use shared report helper**
  - Type: unit
  - Input: spy/mock `resolveLatestReportPath` and `readReportText`
  - Expected: both `flow report show` and finalize-cleanup envelope generation call the shared helper path; no duplicate resolver implementation is used

- **TC-20: finalize-cleanup transactional happy path**
  - Type: integration
  - Input: cleanup runs with committable main repo `flow.json`
  - Expected: step is set to `done`, file is added and committed, worktree removed, branch deleted, report text embedded, main repo working tree clean

- **TC-21: finalize-cleanup commit failure rollback**
  - Type: integration
  - Input: git commit fails after `finalize-cleanup` step was set to `done`
  - Expected: step rolls back to `in_progress`; main repo `flow.json` is restored via checkout; failure is returned; worktree and branch remain

- **TC-22: finalize-cleanup does not remove worktree on failure**
  - Type: integration
  - Input: cleanup reaches failure before successful commit
  - Expected: worktree directory still exists; branch still exists; rerun is possible

- **TC-23: cleanup commit contains final done state**
  - Type: integration
  - Input: successful cleanup creates git commit
  - Expected: committed `flow.json` contains `finalize-cleanup: done` in the same commit

- **TC-24: post-cleanup active flow is false**
  - Type: integration
  - Input: cleanup completed; `.active-flow` cleared; last-finalized-spec pointer written
  - Expected: `flow get status` returns `active:false`

- **TC-25: resolveActiveFlow does not reactivate last finalized spec**
  - Type: unit
  - Input: no `.active-flow`; last-finalized-spec points to existing spec
  - Expected: active flow scan does not treat that spec as active

- **TC-26: run-resume does not resume finalized flow**
  - Type: integration
  - Input: cleanup completed with last-finalized-spec pointer only
  - Expected: `run-resume` returns `active:false` or equivalent no-resume result

- **TC-27: failed merge marks downstream leaves skipped**
  - Type: integration
  - Input: `finalize-merge` fails
  - Expected: `finalize-sync` and `finalize-cleanup` become `skipped` as current failure behavior requires

- **TC-28: failed merge retry resets skipped leaves**
  - Type: integration
  - Input: flow has `finalize-sync: skipped` and `finalize-cleanup: skipped`; retry `finalize-merge` succeeds
  - Expected: `finalize-merge: done`; skipped downstream leaves reset to `pending`

- **TC-29: retry next-action advances to finalize-sync**
  - Type: integration
  - Input: state after successful merge retry
  - Expected: `promoteNextPendingLeaf` can promote `finalize-sync`; `flow get next-action` returns `finalize-sync`

- **TC-30: skipped dirty flow.json does not block retry preflight**
  - Type: integration
  - Input: dirty `flow.json` contains only onError-written skipped statuses
  - Expected: retry preflight allows retry, or pre-hook resets skipped statuses before dirty check

- **TC-31: PR merge route behavior is preserved**
  - Type: acceptance
  - Input: `commands.gh` enabled and `gh` available; PR creation/merge route selected
  - Expected: only `finalize-merge` is normalized to `done` after PR creation; `finalize-sync` and `finalize-cleanup` remain leaf commands executed individually

- **TC-32: squash merge route is self-contained**
  - Type: acceptance
  - Input: full worktree finalize flow using squash merge route
  - Expected: `finalize-commit`, `finalize-merge`, `finalize-sync`, `finalize-cleanup` complete without manual `cd`, manual `flow set step`, or manual `flow report show`

- **TC-33: worktree finalize e2e happy path**
  - Type: acceptance
  - Input: run full worktree finalize sequence from worktree cwd; inspect status/report from main repo cwd after cleanup
  - Expected: every leaf reaches `done`; authority switches to main after merge; cleanup envelope contains `data.report`; main repo is clean; worktree and branch are deleted; active flow is cleared

- **TC-34: finalize prompts remove old manual steps**
  - Type: unit
  - Input: `src/flow/prompts/impl/finalize-{commit,merge,sync,cleanup}.md`
  - Expected: prompts do not contain `cd <mainRepoPath>`, manual `flow set step` for finalize steps, or manual `flow report show`

- **TC-35: cleanup prompt uses envelope report text**
  - Type: unit
  - Input: `finalize-cleanup.md`
  - Expected: prompt instructs reading/pasting `envelope.data.report.text`

- **TC-36: SKILL.md removes old cleanup/report flow**
  - Type: unit
  - Input: `src/templates/skills/sdd-forge.flow/SKILL.md`
  - Expected: no old `cd <mainRepoPath>`, `flow report show`, or finalize-related manual `flow set step` guidance remains

- **TC-37: SKILL.md includes envelope-based cleanup instruction**
  - Type: unit
  - Input: `src/templates/skills/sdd-forge.flow/SKILL.md`
  - Expected: cleanup post-step instruction uses envelope `data.report.text`

- **TC-38: flow-tracking partial excludes finalize steps**
  - Type: unit
  - Input: `src/templates/partials/flow-tracking.md`
  - Expected: manual flow tracking guidance explicitly excludes `finalize-*`

- **TC-39: worktree-mode partial removes post-cleanup cd**
  - Type: unit
  - Input: `src/templates/partials/worktree-mode.md`
  - Expected: no `cd <main-repository-path>` post-cleanup MUST instruction; envelope-based one-step operation is documented

- **TC-40: template regression regex finds zero old patterns**
  - Type: unit
  - Input: `SKILL.md` and `worktree-mode.md`
  - Expected: regex counts are zero for `flow report show`, `cd <mainRepoPath>` / `cd <main-repository-path>`, and `flow set step.*finalize-`

- **TC-41: existing skill-report-show wiring test is updated**
  - Type: unit
  - Input: `tests/unit/flow/skill-report-show-wiring.test.js`
  - Expected: no assertion requires old `flow report show` MUST text; assertions require absence of old string and presence of `data.report.text` cleanup guidance

- **TC-42: finalize preflight help message is updated**
  - Type: unit
  - Input: `buildFinalizePreflightError()` failure
  - Expected: error message references `sdd-forge flow run finalize-commit --help`, not `sdd-forge flow run finalize --help`

- **TC-43: old nextCommand field is not emitted**
  - Type: unit
  - Input: successful `finalize-cleanup`
  - Expected: envelope `data` does not include `nextCommand`

- **TC-44: boundary status values outside known set**
  - Type: unit
  - Input: command result status is unknown, empty, or missing
  - Expected: implementation follows explicit fallback behavior without incorrectly marking step `done`; warning/failure behavior is deterministic

- **TC-45: missing mainRepoPath metadata before merge**
  - Type: unit
  - Input: authority resolver receives incomplete worktree metadata
  - Expected: resolver falls back to cwd authority or returns a clear failure; it does not write to an undefined main repo path

- **TC-46: stale worktree flow does not override main authority**
  - Type: integration
  - Input: after merge, worktree `flow.json` has different status than main repo `flow.json`
  - Expected: next-action/status/resolve-context use main repo state only

- **TC-47: cleanup report read failure after successful commit**
  - Type: integration
  - Input: cleanup commit succeeds, but report text read fails
  - Expected: command returns `ok:true` with `REPORT_MISSING` warning and does not roll back successful cleanup commit

- **TC-48: template changes are propagated by upgrade**
  - Type: acceptance
  - Input: templates/partials or skill templates changed, then `sdd-forge upgrade` runs
  - Expected: generated `.claude/skills` / `.agents/skills` content reflects new envelope-based finalize instructions where applicable
