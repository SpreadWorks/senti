---
name: sdd-forge.flow-impl
description: Run the SDD implementation workflow. Use for coding, review iteration, and finalization after planning is complete.
---

# SDD Flow Impl

Run this workflow after the planning phase (flow-plan) is complete. This skill covers implementation, review iteration, and finalization.

## Core Principle

<!-- include("@templates/partials/core-principle.md") -->

## Flow Progress Tracking

<!-- include("@templates/partials/flow-tracking.md") -->

Available step IDs (this skill): `implement`, `gate-impl`, `review`, `finalize`
Available status values: `pending`, `in_progress`, `done`, `skipped`

## Context Recording (Compaction Resilience)

<!-- include("@templates/partials/context-recording.md") -->

## Metric Recording (Read Tool)

**MUST: When reading files directly with the Read tool (not via `sdd-forge flow get context`), record the metric:**
- After reading `docs/` files: `sdd-forge flow set metric impl docsRead`
- After reading `src/` files: `sdd-forge flow set metric impl srcRead`

Note: `sdd-forge flow get context` automatically records these metrics via hooks — manual recording is only needed for direct Read tool usage.

## Choice Format

<!-- include("@templates/partials/choice-format.md") -->

<!-- include("@templates/partials/ai-question-style.md") -->

## Prerequisites

Before starting, run `sdd-forge flow get check impl` to verify prerequisites.
- If PASS, proceed to step 1.
- If FAIL, inform the user which steps are incomplete and stop.

## Addition task draft (tool-driven)

When an addition task is inserted, draft generation is handled entirely by
`sdd-forge flow run draft-task --task-id <id>` (see Required Sequence step 0).
Do not generate the addition task's draft inside the skill or by free-form AI
prompt — the tool path collects parent spec / sibling tasks / request context,
calls the agent, runs the task-spec gate, injects any FAIL reasons into the
next retry prompt, and retries up to `config.flow.retry.max` before escalating.
Gate PASS is the trust point; an AI-side "I think this is good" is not.

## Task write-tests step (test-first determinism)

When a task enters its `write-tests` step, the AI is writing tests against the spec
*before* implementation. To preserve test-first determinism:

- **MUST: Do not reference implementation diffs or implementation target files while
  the task is in `write-tests`.** Writing tests from the implementation shape leaks
  the implementation's assumptions into the tests and breaks test-first.
- The `flow get context` tool enforces this as a hard wall: files listed in the
  spec's `implementationTargets` are blocked in path mode and silently excluded
  from list / search results while `write-tests` is in progress. This skill
  policy is the redundant textual reinforcement of that tool-side block.
- Derive tests from spec requirements and acceptance criteria alone; if the spec
  is ambiguous, resolve ambiguity in the spec (plan phase), not by peeking at
  the intended implementation.

## Required Sequence

0. Addition task detection.
   - Before step 1, inspect `flow.json` for addition tasks awaiting draft.
     Run `sdd-forge flow get status` and look for entries in `tasks[]` with
     `origin === "addition"` whose `draft` step is not `done`.
   - For each such task, invoke:
     `sdd-forge flow run draft-task --task-id <id>`
     The command generates the draft via the registered agent, evaluates it
     with the `task-spec` full gate (guardrail AI included), feeds any FAIL
     reasons into the next retry prompt, and marks the task's `draft` step
     `done` on gate PASS.
   - Do not write addition task drafts directly from this skill — the tool
     owns the draft → gate → retry loop. Wait for PASS before proceeding
     to step 1 for that task.
   - If no addition tasks are pending, skip this step.

1. Implement changes.
<!-- include("/flow/prompts/impl/implement.md") -->

2. Run gate impl (after implementation, BEFORE review).
<!-- include("/flow/prompts/impl/gate-impl.md") -->

3. Review implementation.
<!-- include("/flow/prompts/impl/review.md") -->

3b. Re-run gate impl (after review, BEFORE finalize).
   - Run `sdd-forge flow run gate --phase task-impl` to re-validate that review's auto-corrections have not broken spec requirements or guardrail compliance.
   - If FAIL (`data.result === "fail"`): show ALL failures from `data.artifacts.reasons`. Fix using only the failure reasons and `git diff baseBranch...HEAD` — do NOT re-read the full spec, context, or guardrail. Re-run gate.
   - **Retry limit: 5 attempts.** If gate does not PASS after 5 fix-and-rerun cycles, STOP and return control to the user.
   - If review was skipped (step 3 chose option 3), skip this step as well.

4. Final confirmation before finalize.
   - Present:
     ```
     ──────────────────────────────────────────────────────────
       実装とレビューが完了しました。次の操作を選択してください。
     ──────────────────────────────────────────────────────────

       [1] 承認する
       [2] 実装内容の概要を確認する
       [3] 実装内容を詳細に確認する
       [4] その他

     ```
   - **Option 1 (approve):** Immediately invoke `/sdd-forge.flow-finalize` using the Skill tool.
   - **autoApprove transition:** If `autoApprove: true`, treat [1] as selected and invoke `/sdd-forge.flow-finalize` using the Skill tool.
   - **Option 2 (overview):** Run `sdd-forge flow run impl-confirm --mode overview`. Display:
     - Changed files list
     - Summary of major changes
     - Whether any changes are outside spec scope
     - Test/verification results
     Then return to this choice prompt.
   - **Option 3 (detail):** Run `sdd-forge flow run impl-confirm --mode detail`. Present requirement-by-requirement:
     - Which spec requirement it addresses
     - Changed files
     - Implementation summary
     - Whether any changes are outside spec scope
     Then return to this choice prompt.
   - **Option 4 (other):** Ask what the user wants to do.
   - Step status for finalize is automatically managed by `sdd-forge flow run impl-confirm` / `sdd-forge flow run finalize` hooks.

## Worktree Mode

<!-- include("@templates/partials/worktree-mode.md") -->
- Before merge, consider running `git rebase <baseBranch>` in the worktree to incorporate upstream changes and avoid post-merge test failures.

## Hard Stops

- Do not implement before gate PASS and test phase completion.
- Do not write any code before the approach plan is approved by the user.
- Do not finalize without asking the user.
- Do not proceed to next step without user confirmation.

**autoApprove exception:** When `autoApprove: true`, the rules "do not finalize without asking the user" and "do not proceed to next step without user confirmation" do NOT apply. All other hard stops remain in effect.

## Issue Log Recording

<!-- include("@templates/partials/issue-log-recording.md") -->

## Commands

```bash
sdd-forge flow get guardrail <draft|spec|impl|lint>
sdd-forge flow get status
sdd-forge flow get check impl
sdd-forge flow set step <id> <val>
sdd-forge flow set req <index> <val>
sdd-forge flow set note "<text>"
sdd-forge flow set issue-log --step <id> --reason "<text>" [--trigger "<text>"] [--resolution "<text>"] [--guardrail-candidate "<text>"]
sdd-forge flow set metric <phase> <counter>
sdd-forge flow run review
sdd-forge flow run impl-confirm --mode <overview|detail>
sdd-forge snapshot check
```
