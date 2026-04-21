# Feature Specification: 209-flow-gate-retry-reset

**Feature Branch**: `feature/209-flow-gate-retry-reset`
**Created**: 2026-04-21
**Status**: Draft
**Input**: GitHub Issue #208

## Goal
- Provide a CLI-driven reset path for `metrics.<phase>.gateRetry` so users can legitimately resume gate retries after fixing the root cause, without hand-editing `flow.json`.
- Surface remaining gate retry budget before `sdd-forge flow run gate` executes so users notice exhaustion proactively.

## Background
`src/flow/lib/run-gate.js` tracks `gateRetry` for phases `task-impl` and `integration` via `countGateRetry()` (reset-aware replay of append-only metrics) and raises `ESCALATE_RETRY_EXHAUSTED` once the count reaches `config.flow.retry.max` (default 3). Today the only recovery is to manually append a `{ phase, counter: "gateRetry", delta: 0, reset: true }` entry to `flow.json` — encountered during spec 207 implementation.

## Scope
- Add `sdd-forge flow set gate-retry reset <phase>` subcommand that appends the reset metric on behalf of the user.
- Require `--yes` to perform the reset (no implicit confirmation via stdin; CLI is non-interactive).
- Display remaining retry budget at the start of `executeDiffBasedGate` in `run-gate.js`.
- Register the new command in `src/flow/registry.js`.

## Out of Scope
- Generalizing the reset command to other counters.
- Interactive prompts / `readline` confirmation.
- UI / dashboard integration.
- Changes to `countGateRetry` semantics (already supports reset).

## Constraints
- Node.js built-ins only. No npm additions.
- alpha policy: no backward-compatibility shims.
- Must reuse the existing `flowManager.appendMetric()` path; do not touch `flow.json` directly.
- `src/` content must remain project-agnostic.

## Design Principles
- Single-purpose append: the command's only side effect is one metric entry.
- Explicit opt-in via `--yes`; missing flag prints current count and fails non-zero.
- Keep `run-gate.js` warning a pure stderr side effect — no behavior change.

## Overview
### Modules
- New: `src/flow/lib/set-gate-retry.js` — `SetGateRetryCommand` (extends `FlowCommand`).
- Modified: `src/flow/lib/run-gate.js` — emit remaining-budget warning at `executeDiffBasedGate` entry.
- Modified: `src/flow/registry.js` — register `set.gate-retry` with args `positional: ["action", "phase"]`, flags `["--yes"]`.

### Data Flow
1. User runs `sdd-forge flow set gate-retry reset task-impl --yes`.
2. Dispatcher loads flow state, validates `action === "reset"`, validates `phase ∈ RETRY_TRACKED_PHASES`, validates `--yes` presence.
3. Command appends `{ phase, counter: "gateRetry", delta: 0, reset: true }` via `flowManager.appendMetric()`.
4. Subsequent `countGateRetry()` returns 0 for that phase.

### Decisions
- Subcommand shape: `set gate-retry <action> <phase>` rather than `set gate-retry-reset <phase>` to leave space for future actions (`show`, etc.) without a new top-level command.
- `--yes` is a hard requirement; no environment-variable override.
- Warning goes to stderr (human-readable) and is not part of the JSON envelope, mirroring existing sdd-forge diagnostic output patterns.

## Clarifications (Q&A)
- Q: Should the warning appear on every gate phase or only diff-based phases?
  - A: Only `task-impl` / `integration` (phases tracked by `RETRY_TRACKED_PHASES`) — consistent with where exhaustion can occur.
- Q: Should `--yes` be replaceable by an interactive confirmation?
  - A: No. sdd-forge commands are invoked from AI/skill chains where stdin is not interactive.

## Alternatives Considered
- Auto-reset on the next manual invocation: rejected — loses the audit trail of reset intent.
- Direct `flow.json` edit (status quo): rejected — error-prone, undocumented, no audit log.
- Lazy reset on PASS only: already in place; does not solve the exhaustion case.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-21
- Notes: Approved via skill dispatcher Q1/Q2 during draft phase.

## Requirements
- **REQ-1**: `sdd-forge flow set gate-retry reset <phase> --yes` SHALL append exactly one metric entry `{ phase, counter: "gateRetry", delta: 0, reset: true }` via `flowManager.appendMetric`.
- **REQ-2**: The command SHALL reject `phase` values not in `RETRY_TRACKED_PHASES` (`task-impl`, `integration`) with a clear error listing valid phases.
- **REQ-3**: The command SHALL reject invocations without `--yes`, print the current `gateRetry` count for the requested phase to stderr, and exit non-zero.
- **REQ-4**: The command SHALL reject unknown `action` values (anything other than `reset`) with a clear error.
- **REQ-5**: After a successful reset, `countGateRetry(state.metrics, phase)` SHALL return `0` for the reset phase until a subsequent FAIL increments it.
- **REQ-6**: `executeDiffBasedGate` in `run-gate.js` SHALL write a one-line warning to stderr in the form `[sdd-forge] gate retry: <used>/<max> used (<remaining> remaining) for phase "<phase>"` before `assertRetryBelowMax` runs. The line SHALL NOT affect the JSON envelope or gate result.
- **REQ-7**: `src/flow/registry.js` SHALL expose the new command under `set.gate-retry` with `args.positional: ["action", "phase"]`, `args.flags: ["--yes"]`, a `help` string, and `requiresFlow: true`.

## Acceptance Criteria
- Unit test: successful reset appends the expected metric entry.
- Unit test: missing `--yes` throws and the current count is reported.
- Unit test: non-tracked phase throws.
- Unit test: unknown action throws.
- Unit test: after reset, `countGateRetry` returns 0.
- Unit test or integration check: registry lookup for `set.gate-retry` returns the expected shape.
- Manual verification (documented in PR description): running `sdd-forge flow run gate --phase task-impl` on a flow with non-zero `gateRetry` prints the warning line to stderr.

## Implementation Targets
- `src/flow/lib/set-gate-retry.js`
- `src/flow/lib/run-gate.js`
- `src/flow/registry.js`
- `tests/unit/flow/lib/set-gate-retry.test.js`

## Open Questions
- (none)
