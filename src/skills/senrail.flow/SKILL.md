---
name: senrail.flow
description: Run the Spec-Driven Development flow end-to-end after the user explicitly invokes Spec-Driven Development flow, explicitly requests a flow start, or resumes an active flow. Thin dispatcher over the CLI's next-action facility.
---

# Spec-Driven Development Flow

This skill drives a full Spec-Driven Development flow from an explicitly started request all the way through finalization. It is a **thin dispatcher**: per-step procedures live in the CLI's data-driven next-action facility (`senrail flow get next-action`), not in this file.

## Core Principle

<!-- include("@skills/partials/core-principle.md") -->

### Prompt guidance placement contract

When implementing prompt guidance movement between flow skill files or flow prompt files, inspect related shared regression tests and update their placement-contract assertions. The checks must cover old-placement removal assertions and new-placement presence assertions. This rule applies to general prompt guidance movement, not a single guidance topic.

## Flow Progress Tracking

<!-- include("@skills/partials/flow-tracking.md") -->

All flow step IDs are defined in the CLI schema. The dispatcher obtains the current step and instructions from `senrail flow get next-action` — the skill itself does not encode per-step sequencing.

## Context Recording (Compaction Resilience)

<!-- include("@skills/partials/context-recording.md") -->
- After flow.json is created (prelude step), record the request: `senrail flow set request "<user's original request>"`

## Metric Recording (Read Tool)

**MUST: When reading files directly with the Read tool (not via `senrail flow get context`), record the metric:**
- During draft work after reading `docs/` files: `senrail flow set metric draft docsRead`
- During draft work after reading `src/` files: `senrail flow set metric draft srcRead`

Use a phase accepted by `senrail flow set metric`. Accepted phases are defined by the CLI's `VALID_PHASES` list. Step keys returned by next-action, such as `test`, `scenario-validity`, `test-review`, `impl-review`, `impl-gate`, and `retro`, are not phase arguments.

Note: `senrail flow get context` automatically records these metrics via hooks — manual recording is only needed for direct Read tool usage.

## Choice Format

<!-- include("@skills/partials/choice-format.md") -->

<!-- include("@skills/partials/ai-question-style.md") -->

## Required Sequence

### A. Entry — branch on flow state

Run bare `senrail flow get status` first. This is a display and branch-decision check; it is not a target selection mechanism.

- For an explicit new flow-start request, inspect the bare status result before B. Prelude. `active: true` is not by itself a reason to stop a new flow start; parallel flows are allowed when the new target is addressed by an explicit preparing `runId`.
- Do not continue an existing active flow merely because bare status reports one. Existing-flow continuation requires the user's intent to match that Issue/spec/runId, verified by target-aware status.
- When starting a new Issue/spec while another flow is active, the prelude must use the explicit preparing `runId` returned by `senrail flow set init`; never rely on cwd, bare active status, or implicit current flow selection to choose the target.
- Use target-aware status for required prelude verification and for explicit existing-target continuation. Do not treat bare active status as target selection.
- If an existing target `runId` is known, run `senrail flow get status <runId> --expect-run-id <runId>` before dispatcher actions. Add every known `--expect-issue <n>` and `--expect-spec <spec>` guard.
- If an existing target spec is known and no runId is available, run `senrail flow get status --expect-spec <spec>` before dispatcher actions.
- If target-aware status returns `ACTIVE_FLOW_MISMATCH`, stop before
  `next-action`, repair, run, finalize, cleanup, or file edits unless a fresh
  CLI response selects the intended Flow.
- After the explicit existing-target guard passes, continue to the autoApprove checks and `requires_approval` handling.
- Evaluate target mismatch before autoApprove or `requires_approval` for existing-flow continuation; neither can bypass `ACTIVE_FLOW_MISMATCH`.

- If the user's latest request explicitly invokes Spec-Driven Development flow, explicitly requests starting the flow, or provides an Issue/spec target as part of a flow-start instruction → go to **B. Prelude**.
- If the user explicitly requests recovery of an interrupted active Flow → follow `senrail.flow-direct` for the exact target.
- If the user's latest request is to continue the current active flow and `active: true` → go to **C. Dispatcher loop**.
- If `active: false` and there is no explicit flow-start request → tell the user there is no active flow and stop. Do not start the flow, and do not present a mandatory startup choice for ordinary requests.

### B. Prelude (pre-flow setup)

Use this path when no active flow exists, or when starting an additional flow with an explicit preparing `runId`. The prelude creates a fresh flow state; after it completes, proceed to the dispatcher loop.

Parallel-flow rules:
- `senrail flow set init [--issue N] [--request ...]` may be run even when another flow is active; it only creates a preparing state.
- After `set init`, immediately record `data.runId` as the opaque
  `targetRunId`. Before `prepare`, run `senrail flow get status <runId> --expect-run-id <runId>`
  plus every known `--expect-issue <n>` and `--expect-spec <spec>` guard,
  substituting both `<runId>` occurrences from that same stored value. If this
  does not report the intended preparing flow, STOP.
- Run prepare only as `senrail flow prepare ... --run-id <runId>`. Never run bare `senrail flow prepare` while an unrelated flow is active.
- Never run bare `senrail flow get next-action`, bare `senrail flow run ...`, repair, finalize, cleanup, or file edits for a target while another unrelated flow is active; use explicit runId/Issue/spec target guards first.

B.0. **Initialize flow state**
   - **Input parsing rules** — apply these rules to the user's raw input before running `set init`:
     - `#<number>` → always interpret as a GitHub Issue. Capture the number for `--issue`.
     - `issue <number>` or similar explicit forms → treat as a GitHub Issue.
     - `spec <number>` or a path under the configured spec root → treat as a local spec reference (do not pass as `--issue`).
     - A bare number (e.g., `133`) → ambiguous input. Do not pass as `--issue`; include in the request text so prelude Q1 can disambiguate.
   - Run `senrail flow set init [--issue N] [--request "<user raw text>"]` to create a preparing state file (`.active-flow.<runId>`).
   - Save the returned `runId` from `data.runId` as the opaque `targetRunId`
     for use in B.4. Reuse it verbatim rather than copying the UUID again.

B.0.5. **Preflight summary and auto-mode eligibility check** (spec 208, phase-aware input per spec 220, ba40)
   - If an Issue is linked, ensure its body is reflected into `--request` at `flow set init` (fetch with `senrail flow get issue <n>` if needed). The CLI derives the input statically from the preparing flow state (`issue + request`) — `--input` is no longer accepted.
   - Build a preflight interpretation before auto-check. Use only the user's request and linked Issue content; do not inspect project code and do not invent project-specific fields.
     - Format: `Goal` + `Scope` + `Out of Scope` (if inferable) + 1-3 line description.
     - If the original request is too thin but a bounded interpretation can be derived directly from the words given, persist the refined request with `senrail flow set request "<Goal/Scope/description text>" --run-id <runId>` before auto-check.
   - Run `senrail flow run auto-check --run-id <runId>` and read `data.eligible` and `data.breakdown`. `--run-id` is required in preparing mode (spec 220 removed the single-preparing auto-select).
   - **If `eligible: false` and the breakdown points to missing specBuildability, ambiguity, verifiability, or scopeBoundedness**:
     - Refine the preflight interpretation from the same request / Issue text and the breakdown reason.
     - Persist the refined request with `senrail flow set request "<refined Goal/Scope/description text>" --run-id <runId>`.
     - Re-run `senrail flow run auto-check --run-id <runId>`.
     - Retry this preflight refinement at most 2 times. If still ineligible, continue with the normal B.1 → B.2 → B.3 flow; do not display the auto-mode prompt.
   - **If `eligible: true`**: present the auto-mode prompt using the Choice Format. This prompt is also the intent confirmation: the user is approving the displayed Goal + Scope + description and choosing whether to enter auto mode.
     - Description (inside lines): show the preflight `Goal` + `Scope` + 1-3 line description that was sent to auto-check.
     - Choices: `[1] Enable auto — summary is correct; AI proceeds without confirmations` `[2] Keep manual — revise or confirm intent before continuing`.
     - Note below choices: "You can switch later with `/senrail.flow-auto on`."
     - If user picks `[1]`:
       - Run `senrail flow set auto on --run-id <runId>` (the CLI trusts the verdict already persisted by `run auto-check` above and writes `autoApprove: true` to the preparing flow so `flow prepare` will inherit it; no second AI call. Rejection here means STOP).
       - **Skip B.1 and B.2.** Use work-environment = worktree and base-branch = current branch by default.
       - Treat the accepted preflight summary as Draft Q1. Derive the spec `--title`: short, max 30 characters, lowercase English, hyphen-separated.
       - Proceed to B.4.
     - If user picks `[2]`: continue with the normal B.1 → B.2 → B.3 flow.
   - **If `eligible: false`**: do NOT display the auto-mode prompt. Continue with the normal B.1 → B.2 → B.3 flow. The result is still persisted in the flow state `autoCheck` for audit.

B.1. **Choose work environment**
   - **Auto-detect:** if `.git` is a file (not directory) in the project root, you are already inside a worktree — skip the choice and use `--no-branch` automatically.
   - Otherwise: run `senrail flow get prompt plan.work-environment` and present the choices.

B.2. **Choose base branch**
   - For work-environment options 1 (worktree) and 2 (branch): run `senrail flow get prompt plan.base-branch` and present the choices. Append `` (`<current-branch>`) `` to the description.
     - `[1]` → use `--base <current-branch>`.
     - `[2]` → ask which branch and use `--base <user-specified-branch>`.

B.3. **Draft Q1 — intent confirmation**
   - **Preflight auto skip:** if B.0.5 `[1]` was accepted, this confirmation is already satisfied by the accepted preflight Goal + Scope + description. Do not ask again.
   - If an Issue number was captured, run `senrail flow get issue <number>` to fetch the title and body.
   - Present a concise summary using the unified Goal + Scope + 1–3 line description format (same shape the auto-check prompt uses in B.0.5).
   - Ask with the Choice Format: `[1] Yes [2] Revise [3] Other`. **Retry limit: 1 round.** If `[3]` is selected twice, STOP.
   - Derive the spec `--title`: short, max 30 characters, lowercase English, hyphen-separated.

B.4. **Prepare spec (silent)**
   - Commands (based on B.1, or B.0.5 auto default when preflight auto was accepted). `--run-id <runId>` from B.0 inherits `--issue` and `--request`:
     - Worktree: `senrail flow prepare --title "..." --base <branch> --worktree --run-id <runId>`
     - Branch: `senrail flow prepare --title "..." --base <branch> --run-id <runId>`
     - No branch: `senrail flow prepare --title "..." --no-branch --run-id <runId>`
   - On `{ok: false, code: "DIRTY_WORKTREE"}` → run `senrail flow get prompt plan.dirty-worktree` and present the choices; do not retry until clean.
   - After a successful prepare, immediately verify the promoted target:
     - If an Issue number was captured and the prepared spec is known from the prepare response: `senrail flow get status <runId> --expect-run-id <runId> --expect-issue <n> --expect-spec <spec>`.
     - If an Issue number was captured but the prepared spec is not known: `senrail flow get status <runId> --expect-run-id <runId> --expect-issue <n>`.
     - If no Issue number was captured but the prepared spec is known from the prepare response: `senrail flow get status <runId> --expect-run-id <runId> --expect-spec <spec>`.
   - If verification returns `ACTIVE_FLOW_MISMATCH`, classify it as terminal
     unless a fresh CLI response selects the intended Flow. For any other
     `ok: false` or mismatching `data.runId` /
     `data.issue` / `data.spec` / branch / worktree, STOP immediately. Do not
     run `next-action`, `run`, `repair`, `finalize`, `cleanup`, or file edits.
   - After verification succeeds, bind the dispatcher target for the rest of this flow:
     - Keep `targetRunId` equal to the exact opaque runId returned by the CLI.
     - Set `targetIssue = <n>` when an Issue was captured.
     - Set `targetSpec = <spec>` from the prepare/status response when known.
     - Use only CLI-returned opaque binding tokens for normal dispatcher
       continuation. Do not assemble runId, Issue, or spec guards yourself.
   - All subsequent target-sensitive dispatcher commands for this flow MUST use
     the current CLI-generated binding until `finalize-cleanup` completes and
     releases the flow.

Proceed to **C. Dispatcher loop**.

Note:
- Plan-phase test flow: next-action selects `test`, `scenario-validity`, and `test-review`. `test` writes spec-local tests, `scenario-validity` persists `scenario-validity-result.json` and `tests/.raw/scenario-validity.log`, and `test-review` performs static test review.
- Upgrade artifact flow: when `src/skills/**`, `src/presets/**`, or upgrade source files are changed, run `senrail upgrade` after those edits. Active-flow upgrade writes `upgrade-result.json` and `tests/.raw/upgrade.log`; integration gate treats that artifact as the upgrade evidence input and rejects missing, failed, or stale checked paths.
- Impl-phase test flow: `test-execute` runs after `implement`, owns spec-local evidence, and persists `test-execute-result.json` version `"2"` plus raw output. It runs targeted project regression only for configured `test.projectPaths` changes unless `test.testExecuteRegression` explicitly overrides that policy. Full project regression is deferred to `final-regression` after `retro`.
- Subsequent steps (`test-result-review`, `impl-review`, flow-level `impl-gate`, `retro`) read those impl-phase artifacts and do not re-run tests. `final-regression` runs the full project command once after retro and before finalize.
- Hard stops: Prepare/docs-scan and `analysis.json` read/validation failures stop the flow. A started targeted project regression failure is valid evidence and advances to `test-result-review`; a prerequisite failure before command start is a hard stop and must not be hidden with manual step completion. `final-regression` failures are classified in `final-regression-result.json`; environment, sandbox, permission, timeout, dependency, and invalid-command failures carry a typed recovery policy and explicit resume instruction instead of returning to the normal implementation repair loop.
- On impl-gate FAIL, show every Observation from `data.artifacts.nextAction.diagnosis.observations` and use those observations as the primary repair input.
- When updating base guardrails, apply the guardrail rewrite rubric: named violation, diff-verification condition, and severity-policy.

<!-- include("@skills/partials/placeholder-artifact-permission.md") -->

### C. Dispatcher loop

Run the CLI-returned `senrail flow run dispatch --expect-binding <token>` command as the only owner of
`execute_step`, `execute_command`, and `repair_evidence` directives. Do not
manually dispatch those directives outside this command. The command invokes
the configured agent abstraction, not an agent-host hook, and verifies the
durable Flow and repository state after every worker finishes.

The command is strictly serial: one worker and every review/gate/test command
it starts must finish in the foreground before the dispatcher refreshes
`next-action`. A long-running command is not “no progress.” Do not start a
second review while the first process is running.

The CLI owns the guarded refresh equivalent to
`senrail flow get next-action --expect-binding <token>`. CLI-provided worker
instructions remain target-bound when they use
CLI-returned binding commands. If a target-sensitive command cannot accept the
CLI-generated binding, STOP instead of running an unguarded substitute. Manual
step completion is never a substitute for the dispatcher's verified
continuation.

Handle the returned `data.dispatch.boundary`:

1. `approval_required`: explain the current step and wait for explicit user
   approval. Retain `approvalToken` privately. After approval, run
   `senrail flow run dispatch --approve <approvalToken> --expect-binding <token>`.
   The CLI binds the token to the exact guarded action and continues in the
   same process. A stale token is not permission to execute anything.
2. `auto_upgrade_decision`: present the standard auto-mode choice. If the user
   explicitly selects auto, run `senrail flow set auto on --expect-binding <token>`;
   otherwise run `senrail flow set auto off --expect-binding <token>`. Immediately
   resume `senrail flow run dispatch --expect-binding <token>` in the same turn.
3. `await_user_decision`: explain every materially different choice in the
   user's language without exposing raw action IDs or commands. Wait for the
   user's choice, execute only its current exact action, then immediately
   resume `senrail flow run dispatch --expect-binding <token>`. Adoption/reconciliation,
   risk acceptance, deletion, orphan handling, and force actions always require
   explicit user selection.
   - For `KEEP_STRICT_FLOW`, leave the Flow unchanged and report the strict
     blocker.
   - For `ENABLE_NONBLOCKING`, record the bounded reason with
     `senrail flow set policy nonblocking --reason "<reason>" --expect-binding <token>`,
     then resume dispatch.
4. `blocked`: report the returned reason and resume instruction as the concrete
   blocker. `FLOW_DISPATCH_AGENT_FAILED`, `FLOW_DISPATCH_STALLED`, and
   `FLOW_DISPATCH_LIMIT_REACHED` are failures, not progress summaries and not
   permission to mark a step complete manually.
   - `FLOW_DISPATCH_BUSY` means another live dispatcher owns this Flow. Wait
     for that invocation to finish; never start a replacement review.
   - `FLOW_DISPATCH_LOCK_STALE` fails closed because the former dispatcher may
     have left a detached worker running. Verify that the complete prior
     process tree has ended before explicit lease recovery; never delete or
     reclaim the lease merely because no new artifact has appeared.
5. `completed`, `aborted`, or `idle`: report the terminal state.
6. `target_mismatch`, or a top-level `ACTIVE_FLOW_MISMATCH` /
   `FLOW_TARGET_NOT_FOUND` returned before dispatch acquires the target: exit
   only when the exact guarded target genuinely no longer exists. Ambiguity,
   and state corruption are not successful completion.

A worker's text response is diagnostic only. The CLI never accepts that text
as step completion; it refreshes the exact target and continues while a
non-terminal directive remains. Do not ask the user to invoke `$senrail.flow`
again merely to advance a normal step.

### Loop exit condition

The loop exits only at a dispatcher boundary described above: a terminal
directive, real user decision or approval, concrete dispatcher/Flow blocker,
state corruption, or true/unrecovered target mismatch.
If `targetRunId`
is known, use `senrail flow get status <targetRunId> --expect-binding <token>` for final
readback; the binding validates that the resolved flow still matches the
dispatcher target. Retry exhaustion
by itself is not an exit condition when the directive provides deterministic
recovery or evidence repair.

## Post-flow: plugin lifecycle

Optional post-flow handling is implemented by plugin hooks and issue-log candidates. The flow skill must not run integration-specific commands after completion; report any hook warnings that the flow command recorded, then stop.

## Universal Guardrails

These apply to every step executed by the dispatcher. They are enforced here because they are cross-cutting — the per-step instructions assume them.

### Approval-gated transitions

- Do not advance past any step whose `requires_approval` is `true` without explicit user approval.
- **autoApprove exception:** when `autoApprove: true`, `requires_approval: true` is satisfied by auto-selecting `[1]`.
- **Non-auto-selectable actions:** autoApprove never selects already-merged adoption/reconcile, risk acceptance, deletion, orphan handling, or force actions.

### No-auto-promote

- Do not implement code before the spec gate has PASSed, tests are written, and the user has approved the spec (plan-phase gate chain).
- Do not finalize before the impl-phase gate has PASSed.

### Worktree boundary

<!-- include("@skills/partials/worktree-mode.md") -->
- Before merge, consider running `git rebase <baseBranch>` in the worktree to incorporate upstream changes and avoid post-merge test failures.
- The finalize phase is decomposed into 4 independent leaf steps driven by the dispatcher: `finalize-commit` → `finalize-merge` → `finalize-sync` → `finalize-cleanup`. Each step has its own CLI command (`senrail flow run finalize-commit`, etc.) and prompt. Each command's post hook normalizes its own step status to `done` on success — do not advance these steps manually.
- **MUST: Do NOT run `senrail flow run finalize-cleanup` in background.** Run it in the foreground and wait for it to complete before proceeding.
- **MUST: After `senrail flow run finalize-cleanup` completes successfully**, the cleanup command itself displays the finalize Report in a non-stdout `Finalize Report` block when `data.report.text` is present. The response envelope still contains `data.report.text` for machine callers; do not rely on manually pasting it as the primary delivery path. If `data.report` is `null`, an envelope `errors` entry with code `REPORT_MISSING` explains why - surface that warning to the user instead of fabricating Report contents. The cleanup command itself removes the worktree and writes `.senrail/last-finalized-spec`; the next `senrail` command runs from the main repository.
- **MUST: When `finalize-cleanup` returns `ORPHAN_COMMITS_DETECTED`, present the cherry-pick / abort / force-continue choice to the user.** This is an explicit exception to autoApprove auto-select: silently picking force-continue would lose feature-branch commits permanently. The envelope ships `data.orphanCommits` (sha + subject) and `data.recoveryOptions = ["cherry-pick", "abort", "force-continue"]` — show the commit list and the choice block, then act on the user's selection (`--auto-rescue` for cherry-pick, halt for abort, `--force` for force-continue with explicit user confirmation). `SQUASH_BASELINE_MISSING` and `SQUASH_BASELINE_DIVERGED` are similar manual-recovery prompts; surface their `errors[0].messages` verbatim.

### Draft Return: phase-aware

When spec writing discovers a missing user decision that belongs in draft QA:
- Use `senrail flow run reopen-draft --reason "<text>"` to return to the draft phase.
- Pre-implementation plan flows do not require a done task. On success, the command marks `draft` as `in_progress` and resets downstream plan steps so draft review, gate, spec, approval, and test planning run again.
- Existing spec artifacts are retained and the reopen reason is recorded in `issue-log.json` so the next draft pass can see why the return happened.

When `reopen-draft` fails or reports a recovery choice, surface that recovery through Choice Format and wait for the user's decision unless `autoApprove` explicitly covers the choice and the skill does not list it as an exception.

### Draft Return: implementation-phase spec corrections

When source verification during implementation discovers a contradictory or missing spec decision:
- Use the guarded correction route even when no task is done: `senrail flow run reopen-draft --category spec-correction --reason "<audit reason>" --expect-run-id <runId> --expect-spec <spec> --expect-issue <issue>`.
- For an Issue-less flow, replace `--expect-issue <issue>` with `--expect-no-issue`. Do not fabricate or assign an Issue.
- Read `runId`, spec, and Issue presence/value from the active flow returned by `senrail flow get next-action`; do not infer identity from a branch name or path.
- On success, preserve the current worktree and partial source changes. Resume through draft/spec clarification, spec review, gate, approval, and test design in the regular order before returning to implementation.

### Draft Return: implementation-phase task additions

When implementation reveals that the spec needs additional tasks:
- **MUST: Do not add tasks dynamically via any CLI during impl.** The only legitimate path is to return to the draft phase, append new tasks to `spec.json.tasks[]`, and re-approve.
- Use `senrail flow run reopen-draft [--reason "<text>"]` to rewind the draft step. Preconditions for implementation-phase task additions: at least one done task exists and the flow lifecycle is still `active`.
- After `reopen-draft` succeeds: edit `spec.json.tasks[]` to append new tasks (new entries must have `added_round = max(existing) + 1`). Existing tasks' `id` / `origin` / `added_round` are invariant — the spec gate rejects any changes to those fields. `title` / `description` of existing tasks may be corrected.
- Proceed through `draft-gate → spec → spec-gate → approval` again. `spec.json` remains the source of truth; the approval prompt renders `spec.md` only when the user needs the human-readable view. The approval post-hook reflects only the new tasks into `flow.json.tasks[]`; existing tasks keep their status and steps.

### Command execution discipline

- **NEVER chain or background `senrail` commands.** Each `senrail` command must be run as a separate, foreground Bash invocation. Do not use `&&`, `||`, `;`, pipes, or `run_in_background`. If a command ends up in the background, wait for the completion notification before proceeding.
- **NEVER run `senrail flow set auto on` yourself.** Only the user can enable autoApprove mode (via `/senrail.flow-auto` or explicit instruction).

## Hard Stops

- Do not write code before the approach plan is user-approved.
- Do not start `finalize-commit` without its required user confirmation unless the autoApprove exception applies; subsequent finalize leaves follow their `requires_approval` value and hook-managed transitions.
- Do not bypass a failed gate. Re-fetch the guarded next action and follow its typed retry, defer, decision, or external-block outcome.
- Do not proceed past a step whose `requires_approval` is `true` without user confirmation unless the autoApprove exception applies.
- Do not `cd` out of the worktree during an active flow (except after finalize cleanup completes).

**autoApprove exception:** when `autoApprove: true`, the rules "do not proceed without user confirmation" and "do not finalize without asking" are satisfied by auto-selecting `[1]`. All other hard stops remain in effect.

## Issue Log Recording

<!-- include("@skills/partials/issue-log-recording.md") -->

## Commands (reference)

```bash
# Reference forms below omit `--expect-binding <token>`; when a dispatcher target is bound, append the CLI-generated binding token.
senrail flow get status
senrail flow get next-action
senrail flow get context [<path> | --search "..."] [--raw]
senrail flow get guardrail <draft|spec|task-spec|task-impl|integration|test|lint|review>  # alias: impl -> task-impl
senrail flow get prompt <kind>
senrail flow get check <target>
senrail flow get issue <number>
senrail flow get qa-count
senrail flow get resolve-context
senrail flow set init [--issue N] [--request "..."]
senrail flow set step <id> <status>
senrail flow set summary '<JSON array>'
senrail flow set req <reqId|zeroBasedIndex> <status>
senrail flow set request "<text>"
senrail flow set note "<text>"
senrail flow set issue <number>
senrail flow set metric <phase> <counter>
senrail flow set issue-log --step <id> --reason "<text>" [--trigger "<text>"] [--resolution "<text>"] [--guardrail-candidate "<text>"]
senrail flow set retry reset <gate|review> <phase> --reason <text> --yes
# Retry recovery reason is required, records an audit entry, grants one re-evaluation, and rejects unchanged evidence.
senrail flow prepare --title "..." [--base branch] [--worktree] [--no-branch] [--issue N] [--request "..."] [--run-id <id>]
senrail flow run dispatch --expect-binding <token> [--approve <approvalToken>]
senrail flow run gate [--phase <draft|spec|task-spec|task-impl|integration>] [--agent-work-dir <path>]
senrail flow run review [--phase <draft|spec|test|impl>] [--agent-work-dir <path>]
senrail flow get runtime-log [--format json] [--sequence <n>] [--run-id <runId[#sequence]>]
senrail flow run scenario-validity
senrail flow run test-execute
senrail flow run test-result-review
senrail flow run impl-confirm --mode <overview|detail>
senrail flow run retro [--force] [--dry-run]
senrail flow run final-regression
senrail flow run finalize-commit [--message "<msg>"]
senrail flow run finalize-merge
senrail flow run finalize-sync
senrail flow run finalize-cleanup
senrail flow run reopen-draft [--reason "<text>"]
senrail flow run report [--dry-run]
senrail snapshot check
```
