# Feature Specification: 121-integrate-test-review-into-review-command-phase-

**Feature Branch**: `feature/121-integrate-test-review-into-review-command-phase-`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #62

## Goal

Add a `--phase test` option to `sdd-forge flow run review` that validates test sufficiency before entering the impl phase. The command generates a test design from spec requirements, compares it against existing test code, identifies gaps, and auto-fixes tests in a retry loop (max 3 attempts).

## Scope

- `src/flow/commands/review.js` — Add `--phase test` branch with test-review pipeline
- `src/flow/run/review.js` — Pass `--phase test` option through to the subprocess and parse test-review output
- Agent config key `flow.review.test` (fallback to `flow.review` via existing `resolveCommandSettings` parent lookup)
- Output: `test-review.md` in the spec directory

## Out of Scope

- Changes to the existing code review flow (`--phase` unset or `--phase code`)
- Test design document as a separate user-facing artifact
- `--plan` option for multi-step test design (future consideration)
- Changes to the `flow/registry.js` hooks (existing `run.review` entry handles both phases)

## Clarifications (Q&A)

- Q: Should test review be a separate command or integrated into existing review?
  - A: Integrated into `flow run review` with `--phase test` option. CLI consistency is maintained.

- Q: What data does the test review consume?
  - A: spec.md Requirements + test file contents (full text, not diff). Test design is generated internally by AI as an intermediate step.

- Q: How does the retry loop work?
  - A: 1 command invocation. Internally: generate test design → compare with test code → if gaps exist, AI fixes tests → re-compare. Max 3 retry iterations. If still failing after 3, return result to user.

- Q: Where is the output written?
  - A: `test-review.md` in the spec directory. Coexists with `review.md` (code review).

- Q: What agent config key is used?
  - A: `flow.review.test`. Falls back to `flow.review` (parent lookup in `resolveCommandSettings`), then to `agent.default`.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: Approved after gate PASS. All requirements and acceptance criteria confirmed.

## Requirements

Priority order (highest first): REQ-1 > REQ-3 > REQ-2 > REQ-4 > REQ-5 > REQ-6 > REQ-7

1. **REQ-1: `--phase test` option** [P1] — When `sdd-forge flow run review --phase test` is invoked, execute the test review pipeline instead of the code review pipeline. When `--phase` is omitted, execute the existing code review (no behavioral change).

2. **REQ-2: Test design generation** [P2] — Read Requirements from `spec.md` and generate a test design (list of what should be tested: happy paths, edge cases, error paths, test type balance). This is an internal intermediate artifact, not exposed to the user as a separate step.

3. **REQ-3: Test code comparison** [P1] — Locate test files by searching `specs/<spec>/tests/` first, then `tests/` as fallback. If both directories contain test files, merge them (spec-local tests take precedence for files with the same name). Compare the generated test design against actual test code to identify gaps (missing edge cases, missing error paths, redundant tests).

4. **REQ-4: Auto-fix retry loop (max 3)** [P2] — When gaps are identified, AI generates fixes for the test code. After applying fixes, re-run comparison. Repeat up to 3 times. If gaps remain after 3 iterations, stop and report remaining gaps to the user. The command exits with a non-zero exit code when the final verdict is FAIL (gaps remain after all retries).

5. **REQ-5: Output `test-review.md`** [P3] — Write review results to `specs/<spec>/test-review.md`. Include: test design summary, gap analysis, fix history (if retries occurred), final verdict (PASS / FAIL with remaining gaps).

6. **REQ-6: Agent config `flow.review.test`** [P3] — Use `loadAgentConfig(config, "flow.review.test")` for AI calls. Falls back to `flow.review` then `agent.default` via existing `resolveCommandSettings` parent lookup. No config changes required for default behavior.

7. **REQ-7: Backward compatibility** [P3] — Existing `sdd-forge flow run review` (without `--phase`) behavior is unchanged. No changes to `flow/registry.js` hooks. The `run.review` registry entry handles both phases.

## Acceptance Criteria

- AC-1: `sdd-forge flow run review --phase test` generates `test-review.md` in the spec directory.
- AC-2: `sdd-forge flow run review` (no `--phase`) executes the existing code review unchanged.
- AC-3: When test gaps are found, the retry loop fixes tests and re-evaluates, up to 3 iterations.
- AC-4: When `flow.review.test` is not configured in config.json, the command falls back to `flow.review` or `agent.default`.
- AC-5: `test-review.md` contains: test design summary, gap analysis, final verdict (PASS/FAIL).
- AC-6: After 3 failed retry iterations, the command returns a FAIL result with remaining gaps listed and exits with a non-zero exit code.

## Open Questions
- None
