---
name: sdd-forge.flow-finalize
description: Finalize the SDD workflow after implementation is complete. Use for commit, merge or PR creation, and cleanup.
---

# SDD Flow Finalize

Use this skill when implementation is complete and the user approved finalization.

## Flow Progress Tracking

<!-- include("@templates/partials/flow-tracking.md") -->

Available step IDs (this skill): `commit`, `push`, `merge`, `pr-create`, `branch-cleanup`
Available status values: `pending`, `in_progress`, `done`, `skipped`

## Context Recording (Compaction Resilience)

<!-- include("@templates/partials/context-recording.md") -->

## Choice Format

<!-- include("@templates/partials/choice-format.md") -->

<!-- include("@templates/partials/ai-question-style.md") -->

## CRITICAL: Step 0 — Present Options FIRST

**STOP. Do NOT proceed to any other step. You MUST present the prompt below and wait for the user's response before doing anything else. Do NOT read files, run commands, or take any action until the user selects an option.**

- Run `sdd-forge flow get prompt finalize.mode` and present the `description` and `choices` using the Choice Format. Each choice has a `description` field — display it below the label.

**After presenting this choice, output NOTHING else. Wait for the user to reply with their selection number.**

<!-- include("/flow/prompts/impl/finalize.md") -->

## Worktree Mode

<!-- include("@templates/partials/worktree-mode.md") -->
- Before merge, consider running `git rebase <baseBranch>` in the worktree to incorporate upstream changes and avoid merge conflicts.
- `sdd-forge flow run finalize` handles worktree detection, merge, and cleanup internally.
- Docs sync (step 3) runs on the main repository after merge, before worktree cleanup (step 4).
- **MUST: Do NOT run `sdd-forge flow run finalize` in background.** Run it in the foreground and wait for it to complete before proceeding.
- **MUST: After `sdd-forge flow run finalize` completes in worktree mode**, the worktree directory is deleted by cleanup, invalidating the shell's cwd. Immediately run `cd <mainRepoPath>` to restore a valid working directory. Get `mainRepoPath` from `sdd-forge flow get resolve-context` (run this BEFORE finalize).

## Hard Stops

- Do not run `sdd-forge flow run finalize` if resolve-context reports `dirty: true` and commit step is not included.
- Do not proceed to next step without user confirmation.
- **NEVER chain or background `sdd-forge` commands.** Each `sdd-forge` command must be run as a separate, foreground Bash invocation. Do not use `&&`, `||`, `;`, pipes, or `run_in_background`. If a command nevertheless ends up in the background (e.g., due to tool behavior), wait for its completion notification before proceeding — do not treat it as complete or advance to the next step until the command's result has been received and read.

**autoApprove exception:** When `autoApprove: true`, the rule "do not proceed to next step without user confirmation" does NOT apply. All other hard stops remain in effect.

## Issue Log Recording

<!-- include("@templates/partials/issue-log-recording.md") -->

**MUST: If worktree, merge, or commit operations fail**, record the issue in issue-log (`sdd-forge flow set issue-log --step finalize --reason "..."`) before applying a workaround or retrying with different options.

## Commands

```bash
sdd-forge flow get status
sdd-forge flow get resolve-context
sdd-forge flow get prompt <kind>
sdd-forge flow set step <id> <val>
sdd-forge flow set note "<text>"
sdd-forge flow run finalize --mode all|select [--steps 1,2,3,4] [--merge-strategy squash|pr]
sdd-forge flow run retro [--force] [--dry-run]
sdd-forge flow run report [--dry-run]
```
