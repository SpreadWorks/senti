# Feature Specification: 122-save-structured-test-design-data-as-tests-spec-j

**Feature Branch**: `feature/122-save-structured-test-design-data-as-tests-spec-j`
**Created**: 2026-04-02
**Status**: Draft
**Input**: User request

## Goal

Add `sdd-forge flow set test-summary` command that saves test type counts into flow.json under `test.summary`. This enables structured tracking of test composition (unit, integration, acceptance) without requiring language-specific test file parsers.

## Scope

- `src/flow/set/test-summary.js` — New set handler
- `src/flow/registry.js` — Register `test-summary` under `set`
- `src/lib/flow-state.js` — Add `setTestSummary()` helper

## Out of Scope

- Test file static analysis / parsing
- AI-based test design generation changes
- Changes to `tests/spec.md` or `tests/spec.json` file output

## Clarifications (Q&A)

- Q: How is the data generated?
  - A: The skill (AI) calls the command after writing tests, self-reporting test counts. No parsing of test files.

- Q: Why not store in a separate file?
  - A: The data is just `{ type: count }` pairs — too small for a separate file. flow.json is already read by retro and status.

- Q: What is the flow.json structure?
  - A: `test.summary` nested under the existing `test` namespace: `{ "test": { "summary": { "unit": 5 } } }`

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: Approved after gate PASS.

## Requirements

Priority order: REQ-1 > REQ-2 > REQ-3

1. **REQ-1: `flow set test-summary` command** [P1] — When `sdd-forge flow set test-summary --unit N --integration N --acceptance N` is invoked, save the provided counts to `flow.json` under `test.summary`. All type flags are optional; only provided types are saved. If no flags are provided, return an error with usage instructions.

2. **REQ-2: flow.json `test.summary` field** [P1] — Store test counts as `{ "test": { "summary": { "<type>": <count> } } }` in flow.json. The `test` object is created if absent. Existing `test.summary` is replaced entirely on each invocation (not merged).

3. **REQ-3: Registry and dispatcher integration** [P2] — Register `test-summary` in `FLOW_COMMANDS.set` in `registry.js` so it is routable via `sdd-forge flow set test-summary`. The command does not require pre/post hooks.

## Acceptance Criteria

- AC-1: `sdd-forge flow set test-summary --unit 3 --integration 2` writes `{ "test": { "summary": { "unit": 3, "integration": 2 } } }` to flow.json.
- AC-2: `sdd-forge flow set test-summary` with no flags returns an error envelope and exits with a non-zero exit code.
- AC-3: `sdd-forge flow set test-summary --unit 5` overwrites any previous `test.summary`.
- AC-4: Existing flow.json fields (steps, requirements, etc.) are not affected.
- AC-5: `sdd-forge flow get status` includes `test.summary` in its output when present.

## Open Questions
- None
