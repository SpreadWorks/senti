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

B.0.5. **Auto-mode eligibility check** (spec 208, phase-aware input per spec 220)
   - If an Issue is linked, ensure its body is reflected into `--request` at `flow set init` (fetch with `sdd-forge flow get issue <n>` if needed). The CLI derives the input statically from the preparing flow state (`issue + request`) — `--input` is no longer accepted.
   - Run `sdd-forge flow run auto-check --run-id <runId>` and read `data.eligible`. `--run-id` is required in preparing mode (spec 220 removed the single-preparing auto-select).
   - **If `eligible: true`**: present the auto-mode prompt using the Choice Format. The prompt asks ONLY whether to enable auto mode — do not bundle a "is this summary correct?" question into the same choice (the summary is confirmed in B.3).
     - Question (above choices): `Auto モードを有効にしますか？` (single line).
     - Choices: `[1] はい — AI が確認なしで進めます` `[2] いいえ — 通常通り各ステップで確認します`.
     - Note below choices: "後から `/sdd-forge.flow-auto on` で切り替え可能".
     - If user picks `[1]`:
       - Run `sdd-forge flow set auto on --run-id <runId>` (the CLI trusts the verdict already persisted by `run auto-check` above and writes `autoApprove: true` to the preparing flow so `flow prepare` will inherit it; no second AI call. Rejection here means STOP).
       - **Skip B.1 and B.2.** Use work-environment = worktree and base-branch = current branch by default.
       - Proceed to B.3 (Draft Q1 is also auto-approved under autoApprove).
     - If user picks `[2]`: continue with the normal B.1 → B.2 → B.3 flow.
   - **If `eligible: false`**: do NOT display the auto-mode prompt. Continue with the normal B.1 → B.2 → B.3 flow. The result is still persisted in the flow state `autoCheck` for audit.

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

Note: Baseline test capture is handled lazily by `flow run tests` (head mode) — when `test.baseline` is not yet recorded, the CLI automatically captures it via a detached worktree before running head tests. This capture is best-effort: if it fails, head tests proceed normally and gate-impl falls back to head-only evaluation. No explicit baseline step is needed here.

### C. Dispatcher loop

Repeat until the loop exit condition is met:

C.1. **Ask the CLI for the next action**
   - Run `sdd-forge flow get next-action`.
   - The CLI auto-promotes the next pending step on `done` transitions via the definition hierarchy. Do not manually `flow set step <id> in_progress` to advance the flow.
   - If all mainline steps are `done` or `skipped` → loop exit (CLI returns `NO_IN_PROGRESS_STEP`).
   - Otherwise, consume the returned envelope: `action`, `instructions.content`, `context`, `output_schema`, `requires_approval`.

C.1.5. **Auto-upgrade check (spec 232)**
   - If the envelope contains `autoUpgrade` with `available === true`, present the following choice **before** executing step instructions:
     ```
     ──────────────────────────────────────────────────────────
       Auto モードに昇格可能です。切り替えますか？
     ──────────────────────────────────────────────────────────

       [1] auto に切り替え — 以降は確認なしで進めます
       [2] 手動のまま — 通常通り各ステップで確認します

     ```
   - If `[1]`: run `sdd-forge flow set auto on`. On success, update `autoApprove` to `true` for subsequent steps.
   - If `[2]`: run `sdd-forge flow set auto off`. The `autoDesired` flag is cleared and no further upgrade prompts will appear.
   - This check runs at most once per flow (the CLI clears `autoUpgrade` after `set auto on/off` via the trust path).

C.2. **Execute instructions**
   - Treat `instructions.content` as the authoritative procedure for this step. Follow it exactly.
   - Fetch any additional context the instructions request via `sdd-forge flow get context ...` / `sdd-forge flow get guardrail <phase>`.
   - Retry limits: each step has a `maxAttempts` defined in the flow definition. When a limit is reached, STOP and return control to the user.
   - When the current step's work is finished, advance step status:
     - If the instructions run a CLI command whose post-hook advances step (`flow run gate`, `flow run impl-confirm`, `flow run finalize-commit`, `flow run finalize-merge`, `flow run finalize-sync`, `flow run finalize-cleanup`, `flow run sync`) — the hook handles the transition; do nothing further.
     - **`flow run review`**: plan review phases (review-draft, review-spec, review-test) do NOT auto-done via post hook — the prompt instructions manage step status based on verdict. Impl/task review still auto-dones via post hook.
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
- The finalize phase is decomposed into 4 independent leaf steps driven by the dispatcher: `finalize-commit` → `finalize-merge` → `finalize-sync` → `finalize-cleanup`. Each step has its own CLI command (`sdd-forge flow run finalize-commit`, etc.) and prompt.
- **MUST: Do NOT run `sdd-forge flow run finalize-cleanup` in background.** Run it in the foreground and wait for it to complete before proceeding.
- **MUST: After `sdd-forge flow run finalize-cleanup` completes in worktree mode**, the worktree directory is deleted by cleanup, invalidating the shell's cwd. Immediately run `cd <mainRepoPath>` to restore a valid working directory. Get `mainRepoPath` from `sdd-forge flow get resolve-context` (run this BEFORE finalize-cleanup).
- **MUST: After `sdd-forge flow run finalize-cleanup` completes successfully (and the cwd has been restored to `mainRepoPath`)**, run `sdd-forge flow report show` and place the command's stdout verbatim inside a fenced code block so the user sees the finalize Report. The command reads the authoritative `report.json` via the `.sdd-forge/last-finalized-spec` pointer that finalize cleanup wrote. If `sdd-forge flow report show` exits non-zero, surface stderr to the user instead of fabricating report contents.

### Draft-return for mid-implementation task additions

When implementation reveals that the spec needs additional tasks:
- **MUST: Do not add tasks dynamically via any CLI during impl.** The only legitimate path is to return to the draft phase, append new tasks to `spec.json.tasks[]`, and re-approve.
- Use `sdd-forge flow run reopen-draft [--reason "<text>"]` to rewind the draft step. Preconditions: at least one done task exists and the flow lifecycle is still `active`.
- After `reopen-draft` succeeds: edit `spec.json.tasks[]` to append new tasks (new entries must have `added_round = max(existing) + 1`). Existing tasks' `id` / `origin` / `added_round` are invariant — the spec gate rejects any changes to those fields. `title` / `description` of existing tasks may be corrected.
- Re-run `sdd-forge spec render` to refresh `spec.md`, then proceed through `gate-draft → spec → gate → approval` again. The approval post-hook reflects only the new tasks into `flow.json.tasks[]`; existing tasks keep their status and steps.

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
sdd-forge flow run finalize-commit [--message "<msg>"]
sdd-forge flow run finalize-merge
sdd-forge flow run finalize-sync
sdd-forge flow run finalize-cleanup
sdd-forge flow run reopen-draft [--reason "<text>"]
sdd-forge flow run retro [--force] [--dry-run]
sdd-forge flow run report [--dry-run]
sdd-forge snapshot check
```
