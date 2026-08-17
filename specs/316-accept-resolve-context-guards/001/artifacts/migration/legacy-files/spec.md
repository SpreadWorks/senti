# Feature Specification: 316-accept-resolve-context-guards

**Feature Branch**: `feature/316-accept-resolve-context-guards`
**Created**: 2026-07-11
**Status**: Draft
**Input**: GitHub Issue #429

## Goal
Allow `senti flow get resolve-context` to accept the standard run ID, Issue, and spec target guards, using the existing shared flow target validation while preserving unguarded behavior.

## Background
`senti flow get resolve-context` is used to recover the exact active-flow context, including during guarded finalize operations. The command currently rejects the standard target guard options during dispatcher parsing because its registry definition exposes no options. Shared flow-context selection and `ACTIVE_FLOW_MISMATCH` validation already exist, so the defect is a registry/help metadata gap rather than missing target comparison logic.

## Scope
- Register the existing `FLOW_TARGET_GUARD_OPTIONS` on the `get.resolve-context` command definition.
- Display `--expect-run-id`, `--expect-issue`, and `--expect-spec` in resolve-context help and verify help/dispatcher parity.
- Verify matching guards, individual run ID / Issue / spec mismatches, and existing calls without guards through CLI dispatch.

## Out of Scope
- Changes to `finalize-commit` or other Issues from #410 through #428.
- Resolve-context-specific target validation, `targetGuard: false`, or any branch that bypasses shared guards.
- External dependencies or product/test changes outside the three Issue target files.

## Constraints
- Use only Node.js built-in modules; add no external dependency.
- Product and shared-test changes are limited to `src/flow/registry.js`, `tests/unit/flow/ctx-dispatch.test.js`, and `tests/unit/flow/resolve-context-extended.test.js`.
- Reuse `FLOW_TARGET_GUARD_OPTIONS`, `FlowCommand`, flow-context target selection, and `targetMismatchEnvelopeForInput` without duplicated validation.
- Preserve the successful payload and behavior of `senti flow get resolve-context` when no target guard is supplied.

## Design Principles
- Keep command metadata as the single source for both option dispatch and help output.
- Expose standard guard inputs at the registry boundary and let the existing shared flow command path own target selection and mismatch envelopes.
- Test the public CLI contract rather than introducing a resolve-context-only test seam.

## Overview
### Modules
- `src/flow/registry.js` declares flow command options and help consumed by the dispatcher and help system.
- `src/flow/lib/base-command.js` and `src/flow/lib/flow-context.js` resolve the target flow and apply the shared mismatch contract before command execution.
- The two target unit-test files cover registry/help parity and behavior through `src/flow.js` CLI dispatch.

### Data Flow
- The dispatcher parses the three `--expect-*` options from the resolve-context registry definition and passes them to the command input.
- `FlowCommand.run()` gives the parsed input to flow-context selection, then calls `targetMismatchEnvelopeForInput` before executing resolve-context.
- Matching or absent guards reach the existing resolved-context builder; a mismatching guard returns the existing `ACTIVE_FLOW_MISMATCH` envelope.

### Decisions
- [VERIFY] checked the resolve-context registry metadata; result=match: the shared guard constant exists, but this command has neither `args.options` nor guarded help.
- [VERIFY] checked shared target validation; result=match: default `FlowCommand` behavior resolves guard inputs and emits mismatch envelopes before command execution.
- [VERIFY] checked current test ownership; result=match: dispatcher guard parity belongs in ctx-dispatch and CLI behavior belongs in resolve-context-extended.
- Compatibility impact: guarded calls begin reaching shared validation; matching and unguarded calls keep the existing resolved-context payload; only mismatches return the established error envelope.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Add resolve-context-specific guard parsing or comparison. — Rejected because `FlowCommand` and flow-context already implement the standard guard contract; duplicating it would create divergent behavior.
- Set `targetGuard: false` and handle guarded selection inside resolve-context. — Rejected because it would bypass the shared validation path and contradict the Issue requirement.
- Change finalize-commit to call resolve-context without guards. — Rejected because it removes target safety and is explicitly outside Issue #429.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-11T20:16:43.390Z
- Notes: Parent pre-approved the gate-passed refined Issue #429 specification, including the bounded spec-local test target repair.

## Requirements
- R1 [must]: The `get.resolve-context` registry definition shall accept `--expect-run-id`, `--expect-issue`, and `--expect-spec` through the existing `FLOW_TARGET_GUARD_OPTIONS`, and its command help shall display the same three options with unit-tested help/dispatcher parity.
- R2 [must]: CLI-dispatched resolve-context shall return the existing successful resolved-context payload when all supplied run ID, Issue, and spec guards match, and shall return an envelope with error code `ACTIVE_FLOW_MISMATCH` when any one of those guards differs from the selected active flow.
- R3 [must]: Resolve-context calls without target guards shall continue to succeed, and the implementation shall add no resolve-context-specific comparison, `targetGuard` exception, or other bypass of the existing `FlowCommand` and flow-context validation path.

## Acceptance Criteria
- AC1: Registry inspection proves that `FLOW_COMMANDS.get["resolve-context"].args.options` contains `--expect-run-id`, `--expect-issue`, and `--expect-spec`.
- AC2: Unit coverage proves resolve-context help contains the same three target guard options accepted by dispatcher metadata.
- AC3: A CLI-dispatched resolve-context call with matching run ID, Issue, and spec guards returns `ok: true` and the resolved context fields.
- AC4: Separate CLI-dispatched calls with a mismatching run ID, Issue, and spec each return `ok: false` with error code `ACTIVE_FLOW_MISMATCH`, not an unknown-option error or normal success.
- AC5: The existing guard-free resolve-context test continues to return `ok: true` and its resolved fields.
- AC6: The production diff is limited to registry metadata/help and contains no duplicate target comparison or guard bypass logic.

## Implementation Targets
- src/flow/registry.js
- tests/unit/flow/ctx-dispatch.test.js
- tests/unit/flow/resolve-context-extended.test.js
- specs/316-accept-resolve-context-guards/tests/resolve-context-target-guards.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Enable guarded resolve-context dispatch
  - Expose the standard target guard metadata for resolve-context and verify the public CLI contract without changing shared validation ownership.
  - see `tasks/T-1.md` for full spec
