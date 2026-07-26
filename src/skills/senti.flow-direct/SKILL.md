---
name: senti.flow-direct
description: Inspect and continue an interrupted Spec-Driven Development flow through direct repair, verification, reconciliation, suspension, abort, and limited completion. Use when the user explicitly invokes direct Flow recovery or when a Flow command reports that normal progress cannot continue.
---

# Direct Flow Recovery

Use the CLI as the durable source of Flow state and safety checks. Treat the user's
explicit invocation of this skill as authorization to continue the current eligible
Flow through direct repair. It is not authorization to target a different Flow,
accept failed tests, discard work, or perform cleanup that the user's request did
not already include.

## Choice Format

<!-- include("@skills/partials/choice-format.md") -->

<!-- include("@skills/partials/ai-question-style.md") -->

## Inspect the Exact Target

1. Bind the intended Flow using every known target field:
   - `--expect-run-id <runId>`
   - `--expect-issue <issue>` or `--expect-no-issue`
   - `--expect-spec <spec>`
2. Run `senti flow get direct` with those guards.
3. If the CLI reports a target mismatch, ambiguity, no Flow, or an unavailable
   managed worktree, stop without changing Flow or Git state. Explain the concrete
   mismatch in the user's language.

Never select a target from the current directory, branch name, parked pointer, or
an unguarded active-flow lookup.

## Enter Direct Repair Without an Entry Menu

When the user explicitly invokes this skill and the inspected result offers
`SELECT_DIRECT_FIX`:

1. Do not show the entry choices.
2. Execute the guarded `SELECT_DIRECT_FIX` action immediately. Do not add
   `--scope`; the CLI derives the initial repair scope from the current feature
   changes, worktree changes, and recorded findings.
3. Re-run the guarded `senti flow get direct`.
4. Continue only after the CLI has persisted the repair plan and reports the
   direct-fix phase.

The explicit skill invocation is the user's direct-repair choice. `autoApprove`
does not provide this authority, but no second confirmation is required from the
same user request.

Never auto-select `SELECT_DIRECT_RECONCILE` merely because ancestry or an
integration receipt exists. Direct reconciliation changes completion records and
may delete the managed worktree during finalization. Use it only when the user's
request explicitly asks to adopt an already-integrated implementation, or when
direct repair is unavailable and the user selects reconciliation through the
decision format below.

## Continue Known Mechanical Actions

Do not ask the user to supply information already recorded by the Flow or project:

- Repair scope comes from the persisted direct plan. Ask for paths only when the
  CLI reports a concrete out-of-scope conflict that cannot be resolved from the
  changed files and findings.
- Verification command comes from the previous direct verification,
  `final-regression-result.json`, a single command in
  `test-execute-result.json`, or the project test configuration. Execute the
  CLI-provided verification action without asking the user to repeat it.
- Exact target guards come from the inspected Flow state. Preserve them on every
  command.

Automatically execute safe, deterministic continuation actions when their inputs
are complete, including repair-plan preflight, recorded project verification, and
readback. If verification fails, explain the failing check in plain language,
continue the bounded repair, and re-run verification within the CLI attempt limit.

Only edit source, tests, spec files, or issue-log entries after the CLI has
persisted the direct plan and entered direct fix. Stay inside the persisted scope.
Record newly discovered findings through the CLI action before expanding the plan.

## Ask Only for a Real Decision

Ask the user only when direct repair cannot proceed safely without new authority,
for example:

- the target is ambiguous or differs from the requested run/Issue/spec;
- a recorded product decision has no safe deterministic resolution;
- integration evidence conflicts with uncommitted implementation changes;
- passing requires explicit acceptance of test risk;
- the requested next step would merge, delete, abort, or discard state and the
  user's request did not already authorize that effect;
- no unique verification command can be derived from Flow artifacts or project
  configuration.

For such a decision:

1. Explain the situation without internal state-machine names. Define any
   unavoidable technical term in one short sentence.
2. Explain what each option keeps, changes, or deletes in ordinary language.
3. Present every viable option in the standard numbered Choice Format, translated
   into the user's language. Put the recommendation at `[1]`.
4. Keep CLI action IDs, raw transition names, plan class names, receipt class
   names, and exact commands internal unless the user asks for diagnostics.
5. Map the user's number or label to the exact current CLI action, execute it, and
   immediately perform guarded readback. Never reuse a stale prompt.

Do not ask a free-form question and do not present raw `actionPrompt` JSON as the
user explanation.

## Completion Boundary

Use only the limited direct finalization or reconciliation action returned by the
CLI. Do not run normal review, gate, retro, report, final-regression, or
documentation synchronization as substitutes.

Continue the guarded inspect → mechanical action → guarded readback loop until:

- direct completion succeeds: report the completion result, merge disposition,
  cleanup result, and external-hook warnings in plain language;
- direct handling is aborted: report what was retained;
- a real decision described above is required: present the numbered choice and
  wait;
- the target is unsupported, mismatched, ambiguous, or corrupt: stop without
  mutation and state the exact recovery requirement.

Do not run integration-specific issue or board commands from this skill.
Completion hooks consume the receipt's idempotency metadata.
