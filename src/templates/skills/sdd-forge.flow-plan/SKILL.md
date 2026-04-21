---
name: sdd-forge.flow-plan
description: Run the SDD planning workflow. Use for spec creation, gate check, and test writing. Covers draft through test phases.
---

# SDD Flow Plan

Run this workflow for any feature or fix request. This skill covers the planning phase: from requirements gathering through test writing.

## Core Principle

<!-- include("@templates/partials/core-principle.md") -->

## Flow Progress Tracking

<!-- include("@templates/partials/flow-tracking.md") -->

Available step IDs (this skill): `branch`, `prepare-spec`, `draft`, `gate-draft`, `spec`, `gate`, `approval`, `test`
Available status values: `pending`, `in_progress`, `done`, `skipped`

## Context Recording (Compaction Resilience)

<!-- include("@templates/partials/context-recording.md") -->
- After flow.json is created (step 3), record the request: `sdd-forge flow set request "<user's original request>"`

## Metric Recording (Read Tool)

**MUST: When reading files directly with the Read tool (not via `sdd-forge flow get context`), record the metric:**
- After reading `docs/` files: `sdd-forge flow set metric <current-phase> docsRead`
- After reading `src/` files: `sdd-forge flow set metric <current-phase> srcRead`

The current phase can be determined from the step you are working on (e.g. `draft`, `spec`, `gate`, `test`).
Note: `sdd-forge flow get context` automatically records these metrics via hooks — manual recording is only needed for direct Read tool usage.

## Choice Format

<!-- include("@templates/partials/choice-format.md") -->

## Required Sequence

0. Initialize flow state.
   - **Input parsing rules** — apply these rules to the user's raw input before running `set init`:
     - `#<number>` → always interpret as a GitHub Issue. Capture the number for `--issue`.
     - `issue <number>` or similar explicit forms → treat as a GitHub Issue.
     - `spec <number>` or `specs/<number>-...` → treat as a local spec reference (do not pass as `--issue`).
     - A bare number (e.g., `133`) → ambiguous input. Do not pass as `--issue`; include in the request text so draft Q1 can disambiguate.
   - Run `sdd-forge flow set init [--issue N] [--request "<user raw text>"]` to create a preparing state file (`.active-flow.<runId>`).
   - Save the returned `runId` from `data.runId` for use in step 4.
   - Issue number and request text are stored in the preparing file and will be inherited by `flow prepare --run-id <runId>` in step 4.
   - Do NOT run `sdd-forge flow set` commands that require `flow.json` (step/metric/note/summary/req) until after step 4.

1. Choose work environment.
   - **Auto-detect**: Check if `.git` is a file (not directory) in the project root.
     - If yes → already in a worktree. Skip choice, use `--no-branch` automatically.
   - **User choice** (if not in a worktree):
     - Run `sdd-forge flow get prompt plan.work-environment` and present the choices.

2. Choose base branch.
   - For work-environment options 1 (worktree) and 2 (branch):
     - Run `sdd-forge flow get prompt plan.base-branch` and present the choices. Append `` (`<current-branch>`) `` to the description.
     - 1 → use `--base <current-branch>`.
     - 2 → ask which branch and use `--base <user-specified-branch>`.

3. Draft Q1 — intent confirmation (first user-facing content question).
   - **autoApprove skip**: If `autoApprove: true`, skip this interactive step. Use the Issue content / request text directly as the draft source.
   - If an Issue number was captured in step 0, run `sdd-forge flow get issue <number>` to fetch the title and body.
   - Present a concise summary of the AI's interpretation (from Issue content and/or request text).
   - Ask the user with the Choice Format: `[1] はい [2] 修正する [3] その他`.
   - **Retry limit: 1 round.** If `[3] その他` is selected, ask once more for clarification. If `[3]` is selected again, STOP and return control to the user.
   - If `[2] 修正する`: incorporate the user's correction and re-ask with the Choice Format until `[1]` is selected (within the retry limit).
   - Derive the spec `--title` from the confirmed intent: short, max 30 characters, lowercase English, hyphen-separated (e.g. "fix-scan-parser-bugs").

4. Prepare spec (`prepare-spec`) — internal execution after Q1 approval.
   - This step is not a user prompt; run it silently once Q1 is approved.
   - Commands (based on step 1 choice). The `--run-id <runId>` from step 0 inherits `--issue` and `--request` from the preparing file:
     - Worktree: `sdd-forge flow prepare --title "..." --base <branch> --worktree --run-id <runId>`
     - Branch: `sdd-forge flow prepare --title "..." --base <branch> --run-id <runId>`
     - No branch: `sdd-forge flow prepare --title "..." --no-branch --run-id <runId>`
   - If it returns `{ok: false, code: "DIRTY_WORKTREE"}`, run `sdd-forge flow get prompt plan.dirty-worktree` and present the choices. Do not retry until the worktree is clean. The preparing file is preserved on failure so Q1 state is retained.
   - This creates the branch, `specs/NNN-xxx/` directory, `spec.md` skeleton, and `specs/NNN-xxx/flow.json`.
   - Steps branch/prepare-spec are automatically set to done by prepare-spec.

5. Draft phase (remaining Q&A after Q1).
<!-- include("/flow/prompts/plan/draft.md") -->

6. Run gate draft (after draft approval, BEFORE spec).
<!-- include("/flow/prompts/plan/gate-draft.md") -->

7. Fill spec (`spec`).
<!-- include("/flow/prompts/plan/spec.md") -->

8. Run gate spec (BEFORE approval).
<!-- include("/flow/prompts/plan/gate.md") -->

9. Get explicit user approval (AFTER gate PASS).
<!-- include("/flow/prompts/plan/approval.md") -->

## CRITICAL: Test Phase — Present Options FIRST

**STOP. Do NOT write tests, choose a test framework, or decide on test strategy. You MUST run `sdd-forge flow get prompt plan.test-mode`, present the choices to the user, and wait for their response before doing anything else in the test phase.**

10. Test phase (after approval).
<!-- include("/flow/prompts/plan/test.md") -->

## Worktree Mode

<!-- include("@templates/partials/worktree-mode.md") -->
- Before merge, consider running `git rebase <baseBranch>` in the worktree to incorporate upstream changes and avoid post-merge test failures.

## Hard Stops

- Do not implement before user approval.
- Do not implement when gate FAIL.
- Do not advance to approval before gate PASS.
- Do not skip implementation verification when code changes exist.
- In draft phase, do not end a turn without a question.
- Do not proceed to next step without user confirmation.

**autoApprove exception:** When `autoApprove: true`, the rules "do not end a turn without a question" and "do not proceed to next step without user confirmation" do NOT apply. All other hard stops remain in effect.

## Issue Log Recording

<!-- include("@templates/partials/issue-log-recording.md") -->

## Clarification Rule

When requirements are ambiguous, ask concise Q&A before step 7.
Record clarifications in `spec.md` under `## Clarifications (Q&A)` and `## Open Questions`.

## Test Maintenance

- If new tests break existing tests, inform the user and ask how to proceed.
- Do not modify or delete existing tests without user approval.
- If past tests become irrelevant due to feature changes, flag them to the user.

## Prompts referenced by the plan phase

The numbered steps above resolve their interactive choices via `sdd-forge flow get prompt`:
- step 1: `flow get prompt plan.work-environment`
- step 2: `flow get prompt plan.base-branch`
- step 4 dirty-worktree branch: `flow get prompt plan.dirty-worktree`
- step 9 approval: `flow get prompt plan.approval`
- step 10 test-mode entry: `flow get prompt plan.test-mode`
- step 10 completion: `flow get prompt plan.complete`

## Commands

```bash
sdd-forge flow get status
sdd-forge flow get check <target>
sdd-forge flow get guardrail <phase>
sdd-forge flow get prompt <kind>
sdd-forge flow get qa-count
sdd-forge flow set step <id> <status>
sdd-forge flow set summary '<JSON array>'
sdd-forge flow set req <index> <status>
sdd-forge flow set request "<text>"
sdd-forge flow set note "<text>"
sdd-forge flow set issue <number>
sdd-forge flow set metric <phase> <counter>
sdd-forge flow set issue-log --step <id> --reason "<text>" [--trigger "<text>"] [--resolution "<text>"] [--guardrail-candidate "<text>"]
sdd-forge flow prepare --title "..." [--base branch] [--worktree] [--no-branch] [--issue N] [--request "..."]
sdd-forge flow run gate
sdd-forge snapshot check
```
