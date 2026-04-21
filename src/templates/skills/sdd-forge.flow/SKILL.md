---
name: sdd-forge.flow
description: Run the SDD flow end-to-end — planning (draft → spec → approval → test), implementation (code → gate → review), and finalization (commit → merge → cleanup → docs sync). Thin dispatcher over the CLI's next-action facility; use this for any feature or fix request.
---

# SDD Flow

This skill drives a full Spec-Driven Development flow from a feature / fix request all the way through finalization. It is a **thin dispatcher**: per-step procedures live in the CLI's data-driven next-action facility (`sdd-forge flow get next-action`), not in this file.

## Core Principle

<!-- include("@templates/partials/core-principle.md") -->

## Flow Progress Tracking

<!-- include("@templates/partials/flow-tracking.md") -->

All flow step IDs are defined in the CLI schema. The dispatcher obtains the current step and instructions from `sdd-forge flow get next-action` — the skill itself does not encode per-step sequencing.

## Context Recording (Compaction Resilience)

<!-- include("@templates/partials/context-recording.md") -->
- After flow.json is created (prelude step), record the request: `sdd-forge flow set request "<user's original request>"`

## Metric Recording (Read Tool)

**MUST: When reading files directly with the Read tool (not via `sdd-forge flow get context`), record the metric:**
- After reading `docs/` files: `sdd-forge flow set metric <current-phase> docsRead`
- After reading `src/` files: `sdd-forge flow set metric <current-phase> srcRead`

The current phase can be determined from the current step (e.g. `draft`, `spec`, `gate`, `test`, `implement`, `review`, `finalize`).

Note: `sdd-forge flow get context` automatically records these metrics via hooks — manual recording is only needed for direct Read tool usage.

## Choice Format

<!-- include("@templates/partials/choice-format.md") -->

<!-- include("@templates/partials/ai-question-style.md") -->

## Required Sequence

### A. Entry — branch on flow state

Run `sdd-forge flow get status`.

- If `active: false` → go to **B. Prelude**.
- If `active: true` → go to **C. Dispatcher loop**.

### B. Prelude (pre-flow setup)

Use this path when no active flow exists. The prelude creates a fresh flow state; after it completes, proceed to the dispatcher loop.

B.0. **Initialize flow state**
   - **Input parsing rules** — apply these rules to the user's raw input before running `set init`:
     - `#<number>` → always interpret as a GitHub Issue. Capture the number for `--issue`.
     - `issue <number>` or similar explicit forms → treat as a GitHub Issue.
     - `spec <number>` or `specs/<number>-...` → treat as a local spec reference (do not pass as `--issue`).
     - A bare number (e.g., `133`) → ambiguous input. Do not pass as `--issue`; include in the request text so prelude Q1 can disambiguate.
   - Run `sdd-forge flow set init [--issue N] [--request "<user raw text>"]` to create a preparing state file (`.active-flow.<runId>`).
   - Save the returned `runId` from `data.runId` for use in B.4.

B.0.5. **Auto-mode eligibility check** (spec 208)
   - Build the input text: combine `--request` and, if an Issue is linked, the fetched Issue body (`sdd-forge flow get issue <n>`).
   - Run `sdd-forge flow run auto-check --input "<text>"` and read `data.eligible`.
   - **If `eligible: true`**: present the auto-mode prompt using the Choice Format. The prompt asks ONLY whether to enable auto mode — do not bundle a "is this summary correct?" question into the same choice (the summary is confirmed in B.3).
     - Question (above choices): `Auto モードを有効にしますか？` (single line).
     - Choices: `[1] はい — AI が確認なしで進めます` `[2] いいえ — 通常通り各ステップで確認します`.
     - Note below choices: "後から `/sdd-forge.flow-auto on` で切り替え可能".
     - If user picks `[1]`:
       - Run `sdd-forge flow set auto on` (the CLI re-verifies auto-check; rejection here means STOP).
       - **Skip B.1 and B.2.** Use work-environment = worktree and base-branch = current branch by default.
       - Proceed to B.3 (Draft Q1 is also auto-approved under autoApprove).
     - If user picks `[2]`: continue with the normal B.1 → B.2 → B.3 flow.
   - **If `eligible: false`**: do NOT display the auto-mode prompt. Continue with the normal B.1 → B.2 → B.3 flow. The result is still stored in flow.json `autoCheck` for audit.

B.1. **Choose work environment**
   - **Auto-detect:** if `.git` is a file (not directory) in the project root, you are already inside a worktree — skip the choice and use `--no-branch` automatically.
   - Otherwise: run `sdd-forge flow get prompt plan.work-environment` and present the choices.

B.2. **Choose base branch**
   - For work-environment options 1 (worktree) and 2 (branch): run `sdd-forge flow get prompt plan.base-branch` and present the choices. Append `` (`<current-branch>`) `` to the description.
     - `[1]` → use `--base <current-branch>`.
     - `[2]` → ask which branch and use `--base <user-specified-branch>`.

B.3. **Draft Q1 — intent confirmation**
   - **autoApprove skip:** if `autoApprove: true`, skip this interactive step and use the Issue / request text directly as the draft source.
   - If an Issue number was captured, run `sdd-forge flow get issue <number>` to fetch the title and body.
   - Present a concise summary using the unified Goal + Scope + 1–3 line description format (same shape the auto-check prompt uses in B.0.5).
   - Ask with the Choice Format: `[1] はい [2] 修正する [3] その他`. **Retry limit: 1 round.** If `[3]` is selected twice, STOP.
   - Derive the spec `--title`: short, max 30 characters, lowercase English, hyphen-separated.

B.4. **Prepare spec (silent)**
   - Commands (based on B.1). `--run-id <runId>` from B.0 inherits `--issue` and `--request`:
     - Worktree: `sdd-forge flow prepare --title "..." --base <branch> --worktree --run-id <runId>`
     - Branch: `sdd-forge flow prepare --title "..." --base <branch> --run-id <runId>`
     - No branch: `sdd-forge flow prepare --title "..." --no-branch --run-id <runId>`
   - On `{ok: false, code: "DIRTY_WORKTREE"}` → run `sdd-forge flow get prompt plan.dirty-worktree` and present the choices; do not retry until clean.

Proceed to **C. Dispatcher loop**.

### C. Dispatcher loop

Repeat until the loop exit condition is met:

C.1. **Ask the CLI for the next action**
   - Run `sdd-forge flow get next-action`.
   - On `NO_IN_PROGRESS_STEP`: inspect `sdd-forge flow get status`. If any step is `pending`, set the first pending step to `in_progress` (`sdd-forge flow set step <id> in_progress`) and retry C.1.
   - If all mainline steps are `done` or `skipped` → loop exit.
   - Otherwise, consume the returned envelope: `action`, `instructions.content`, `context`, `output_schema`, `requires_approval`.

C.2. **Execute instructions**
   - Treat `instructions.content` as the authoritative procedure for this step. Follow it exactly.
   - Fetch any additional context the instructions request via `sdd-forge flow get context ...` / `sdd-forge flow get guardrail <phase>`.
   - Retry limits: the instructions may cite `config.flow.retry.max` (default 3) for gate retries and other bounded loops. Respect them. When a limit is reached, STOP and return control to the user.
   - When the current step's work is finished, advance step status:
     - If the instructions run a CLI command whose post-hook advances step (`flow run gate`, `flow run review`, `flow run impl-confirm`, `flow run finalize`, `flow run sync`) — the hook handles the transition; do nothing further.
     - Otherwise, manually record completion: `sdd-forge flow set step <current-step> done`.

C.3. **Loop**
   - Return to C.1.

### Loop exit condition

The loop exits when `sdd-forge flow get status` reports all steps either `done` or `skipped`, or when a retry budget is exhausted. On budget exhaustion, STOP and return control to the user.

## Universal Guardrails

These apply to every step executed by the dispatcher. They are enforced here because they are cross-cutting — the per-step instructions assume them.

### Approval-gated transitions

- Do not advance past any step whose `requires_approval` is `true` without explicit user approval.
- **autoApprove exception:** when `autoApprove: true`, `requires_approval: true` is satisfied by auto-selecting `[1]`.

### No-auto-promote

- Do not implement code before the spec gate has PASSed, tests are written, and the user has approved the spec (plan-phase gate chain).
- Do not finalize before the impl-phase gate has PASSed (and re-PASSed after review auto-corrections).

### Worktree boundary

<!-- include("@templates/partials/worktree-mode.md") -->
- Before merge, consider running `git rebase <baseBranch>` in the worktree to incorporate upstream changes and avoid post-merge test failures.
- `sdd-forge flow run finalize` handles worktree detection, merge, and cleanup internally.
- **MUST: Do NOT run `sdd-forge flow run finalize` in background.** Run it in the foreground and wait for it to complete before proceeding.
- **MUST: After `sdd-forge flow run finalize` completes in worktree mode**, the worktree directory is deleted by cleanup, invalidating the shell's cwd. Immediately run `cd <mainRepoPath>` to restore a valid working directory. Get `mainRepoPath` from `sdd-forge flow get resolve-context` (run this BEFORE finalize).

### Test-first determinism (task write-tests step)

When a task step `write-tests` is in progress:
- **MUST: Do not reference implementation diffs or implementation target files.** Writing tests from the implementation shape breaks test-first.
- `flow get context` enforces this at the tool level (files listed in the spec's `implementationTargets` are blocked in path mode and silently excluded from list / search results during `write-tests`).

### Addition-task draft ownership

When an addition task's `draft` step is in progress:
- Use `sdd-forge flow run draft-task --task-id <id>` — the CLI owns the draft → gate → retry loop. Do not generate the draft directly from this skill.

### Command execution discipline

- **NEVER chain or background `sdd-forge` commands.** Each `sdd-forge` command must be run as a separate, foreground Bash invocation. Do not use `&&`, `||`, `;`, pipes, or `run_in_background`. If a command ends up in the background, wait for the completion notification before proceeding.
- **NEVER run `sdd-forge flow set auto on` yourself.** Only the user can enable autoApprove mode (via `/sdd-forge.flow-auto` or explicit instruction).

## Hard Stops

- Do not write code before the approach plan is user-approved.
- Do not finalize without user confirmation.
- Do not proceed past a failed gate.
- Do not proceed to the next step without user confirmation.
- Do not `cd` out of the worktree during an active flow (except after finalize cleanup completes).

**autoApprove exception:** when `autoApprove: true`, the rules "do not proceed without user confirmation" and "do not finalize without asking" are satisfied by auto-selecting `[1]`. All other hard stops remain in effect.

## Issue Log Recording

<!-- include("@templates/partials/issue-log-recording.md") -->

## Commands (reference)

```bash
sdd-forge flow get status
sdd-forge flow get next-action
sdd-forge flow get context [<path> | --search "..."] [--raw]
sdd-forge flow get guardrail <draft|spec|impl|test|lint>
sdd-forge flow get prompt <kind>
sdd-forge flow get check <target>
sdd-forge flow get issue <number>
sdd-forge flow get qa-count
sdd-forge flow get resolve-context
sdd-forge flow set init [--issue N] [--request "..."]
sdd-forge flow set step <id> <status>
sdd-forge flow set summary '<JSON array>'
sdd-forge flow set req <index> <status>
sdd-forge flow set request "<text>"
sdd-forge flow set note "<text>"
sdd-forge flow set issue <number>
sdd-forge flow set metric <phase> <counter>
sdd-forge flow set issue-log --step <id> --reason "<text>" [--trigger "<text>"] [--resolution "<text>"] [--guardrail-candidate "<text>"]
sdd-forge flow prepare --title "..." [--base branch] [--worktree] [--no-branch] [--issue N] [--request "..."] [--run-id <id>]
sdd-forge flow run gate [--phase <draft|spec|task-impl>]
sdd-forge flow run review
sdd-forge flow run impl-confirm --mode <overview|detail>
sdd-forge flow run finalize [--mode all|select] [--steps 1,2,3,4] [--merge-strategy squash|pr]
sdd-forge flow run draft-task --task-id <id>
sdd-forge flow run retro [--force] [--dry-run]
sdd-forge flow run report [--dry-run]
sdd-forge snapshot check
```
