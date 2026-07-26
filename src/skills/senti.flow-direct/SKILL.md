---
name: senti.flow-direct
description: Inspect and continue an interrupted Spec-Driven Development flow through the CLI-authored direct-fix, direct-reconcile, suspension, abort, verification, and limited-completion actions. Use when the user explicitly invokes direct Flow recovery or when a Flow command yields a typed actionPrompt that offers a direct path.
---

# Direct Flow Recovery

Use this skill as a thin dispatcher over the CLI's durable direct-resolution state machine. The CLI is the sole source of truth for eligibility, actions, target guards, impacts, verification, and completion.

## Inspect the Exact Target

1. Bind the intended Flow using every known target field:
   - `--expect-run-id <runId>`
   - `--expect-issue <issue>` or `--expect-no-issue`
   - `--expect-spec <spec>`
2. Run `senti flow get direct` with those guards.
3. If the CLI returns `ACTIVE_FLOW_MISMATCH`, an ambiguous target, or no Flow, stop without mutating Flow or Git state. Report the CLI result.

Never infer a target from the current directory, branch name, parked pointer, or an unguarded active-flow lookup.

## Relay CLI Choices Verbatim

When the result has `yieldsControl: true`:

1. Render `actionPrompt.question`, every choice, each choice's `actionId`, label, impact, reason, state transition, and `recommendationReason` exactly as returned.
2. Do not omit, reword, replace, reorder, merge, or invent choices.
3. Wait for the user's explicit selection.
4. Execute only the selected choice's exact `nextAction`.
5. Substitute a placeholder such as `<resolution>`, `<reason>`, or `<path>` only with the value explicitly supplied by the user. If a required value is missing, ask for that value and do not execute the command.
6. Re-run guarded `senti flow get direct` after every command, including a failed command. Never reuse a stale prompt.

Treat a missing or invalid `actionPrompt` on an incomplete result as a CLI contract failure. Stop instead of generating recovery guidance.

## Preserve Manual Authority

Never auto-select any of these actions, including when `autoApprove` is enabled:

- transition into direct mode;
- adopt or reconcile an already-merged result;
- accept test risk;
- delete a worktree, branch, artifact, or receipt;
- continue through orphan commits;
- force cleanup or force completion.

Only an explicit user selection can authorize these actions. A recommendation is advisory and is not permission.

## Respect Direct Session Boundaries

- Allow direct mode only when the CLI reports the target eligible.
- Keep direct progress in `DirectFlowSession`; do not mark normal Flow leaves done or skipped.
- Do not edit source, tests, spec files, or issue-log entries before the CLI has persisted the direct plan and returned the direct-fix phase.
- During direct fix, stay within the persisted scope and record newly discovered findings through the CLI-provided action.
- Use only CLI-provided verification actions. Do not replace a failed non-overrideable safety check with a risk-acceptance command.
- Use only the limited direct finalization or reconcile action returned by the CLI. Do not run normal review, gate, retro, report, final-regression, or documentation synchronization as substitutes.
- After suspension, resume the saved phase and target. After abort, retain the abort receipt and do not clean up unless a later CLI prompt explicitly offers and the user selects cleanup.

## Complete or Stop

Continue the guarded inspect → explicit choice → exact command → guarded re-inspect loop until the CLI reports one of:

- `COMPLETED_DIRECT`: report the completion receipt and any external-hook warnings;
- `DIRECT_ABORTED`: report the durable abort receipt and retained resources;
- an unsupported, mismatched, ambiguous, or corrupt target: stop without mutation;
- another typed action prompt: relay it verbatim and wait.

Do not run integration-specific issue or board commands from this skill. Completion hooks consume the receipt's idempotency metadata.
