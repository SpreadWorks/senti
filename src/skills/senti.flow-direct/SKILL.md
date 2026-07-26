---
name: senti.flow-direct
description: Inspect and continue an interrupted Spec-Driven Development flow through direct repair, verification, reconciliation, suspension, abort, and limited completion. Use when the user explicitly invokes direct Flow recovery or when a Flow command reports that normal progress cannot continue.
---

# Direct Flow Recovery

Use the CLI as the durable source of Flow state and safety checks. Treat the user's
explicit invocation of this skill as authorization to continue the current eligible
Flow through direct repair, current implementation completion, verification,
limited integration, completion recording, and managed cleanup. It is not
authorization to target a different Flow, accept failed tests, discard
unintegrated work, or override a target/evidence conflict.

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

Never auto-select `SELECT_DIRECT_RECONCILE` merely because ancestry exists while
unintegrated implementation changes remain. If the exact implementation is
already integrated and the CLI reports one unambiguous mechanical reconciliation
continuation for the bound target, continue it under this skill invocation.
Conflicting integration and worktree evidence remains a real decision.

## Resume Durable Completion Without a Menu

Prepared completion evidence and its matching teardown transaction take precedence
over a retained `SUSPENDED` or legacy `ABORTED` phase.

When guarded inspection reports `DIRECT_PREPARED_CLEANUP` or another single
deterministic `FINALIZE_DIRECT` continuation:

1. Do not present retry, suspend, abort, worktree-restoration, or inspection
   choices.
2. Execute the guarded continuation immediately. This resumes the existing
   idempotent completion transaction; it does not authorize or repeat a merge.
3. Re-run guarded inspection and continue any remaining mechanical cleanup phase.
4. Stop only on a concrete identity/evidence conflict, an unsafe unexpected file,
   or another real decision defined below.

Do not recreate a missing worktree binding merely to finish cleanup. The CLI must
use the persisted completion receipt and matching teardown transaction as the
authority for already-completed phases.

## Reopen a Retained Abort Without an Entry Menu

When the user explicitly invokes this skill, no integration or prepared completion
evidence exists, and the inspected result offers `REOPEN_ABORTED_DIRECT`:

1. Do not present the retain/inspect menu.
2. Execute the guarded `REOPEN_ABORTED_DIRECT` action with a concise reason that
   states the user's request to continue the retained target.
3. Re-run the guarded `senti flow get direct`.
4. Continue only after the CLI archives the prior abort receipt, refreshes the
   exact Git safety baseline, resets the bounded verification attempt budget,
   and reports the direct-fix phase.

The explicit skill invocation authorizes reopening the same retained target. It
does not authorize changing target identity, accepting failed tests, discarding
the prior abort receipt, or bypassing the normal verification and limited
finalization checks.

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
are complete, including repair-plan preflight, verification after current
implementation proof, limited finalization after passed verification, durable
cleanup continuation, and guarded readback.

Only edit source, tests, spec files, or issue-log entries after the CLI has
persisted the direct plan and entered direct fix. Stay inside the persisted scope.
Record newly discovered findings through the CLI action before expanding the plan.

## Complete the Implementation Before Verification

`DIRECT_IMPLEMENTATION_REQUIRED` is a work instruction for the agent, not a user
decision and not permission to run tests immediately.

1. Read the spec goal, every requirement, task status, current diff, and the
   affected product code in the retained worktree.
2. Continue the implementation until the whole requested behavior is present.
   A previous passing test result, `done` requirement metadata, or an existing
   verification command is not evidence that implementation work is complete.
3. Inspect the final diff against every requirement. Do not infer completeness
   merely because the bounded tests pass.
4. Only then execute the guarded `CONFIRM_DIRECT_IMPLEMENTATION` action. Supply
   `--summary` with concrete requirement-by-requirement evidence, naming every
   requirement ID returned by the CLI and the implemented product behavior.
5. Re-run guarded inspection. Run `VERIFY_DIRECT` only when the CLI reports that
   the implementation proof matches the exact current change set.

Returning to direct fix, reopening an abort, recording a new finding, or changing
any implementation file invalidates the proof. Re-inspect the implementation and
record a new proof before verification. If verification fails, explain the
failing check in plain language, continue the bounded repair, re-record
implementation completion, and re-run verification within the CLI attempt limit.

## Ask Only for a Real Decision

Ask the user only when direct repair cannot proceed safely without new authority,
for example:

- the target is ambiguous or differs from the requested run/Issue/spec;
- a recorded product decision has no safe deterministic resolution;
- integration evidence conflicts with uncommitted implementation changes;
- passing requires explicit acceptance of test risk;
- the requested next step would affect a different target, discard unintegrated
  work, accept failed verification, or resolve conflicting integration evidence;
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
