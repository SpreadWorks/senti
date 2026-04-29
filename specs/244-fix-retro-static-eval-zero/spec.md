# Feature Specification: 244-fix-retro-static-eval-zero

**Feature Branch**: `feature/244-fix-retro-static-eval-zero`
**Created**: 2026-04-29
**Status**: Draft
**Input**: GitHub Issue #292

## Goal
Fix `evaluateRequirement` always producing `passed = 0` for every requirement, causing every requirement to evaluate to `"not_done"` regardless of actual test results.

## Background
`parseTapOutput` parses TAP output and stores results in a `Map` keyed by bare test descriptions (e.g., `"should create file-map.json"`). It does this by applying the regex `^(ok|not ok)\s+\d+\s+-\s+(.+)` which strips any file-prefix from the test name.

`testMap`, however, stores entries in the `"file.test.js > test description"` convention. When `evaluateRequirement` calls `tapResults.get("file.test.js > test description")`, it always receives `undefined` because the key formats do not match. The `undefined` result falls into the `else { failed++ }` branch of `evaluateRequirement`. As a result, `passed` is always **zero** and `failed === tests.length` for every requirement, making every requirement evaluate to `"not_done"` regardless of real test outcomes.

The fix must normalise key formats so that lookups succeed — either by making `parseTapOutput` emit keys in `"file > test"` format, or by normalising the lookup site in `evaluateRequirement`.

## Scope
- `src/flow/lib/req-map.js` — `parseTapOutput`: fix key format to match `testMap` convention (`"file > test"`), or document the chosen normalisation point clearly.
- `src/flow/lib/req-map.js` — `evaluateRequirement`: ensure lookups against `tapResults` succeed when keys are aligned.
- `src/flow/lib/run-retro.js` — `tryStaticEvaluation`: the sole production caller of both `parseTapOutput` and `evaluateRequirement` in sequence. The `note` field logic must be updated to distinguish the case where tests are mapped but none are found in TAP results (e.g., `"N test(s) mapped but not found in TAP output"`) from the existing `"no tests mapped"` case.
- `specs/241-req-file-test-mapping/tests/241-retro-static.test.js` — a new end-to-end test must be added that exercises `parseTapOutput` → `evaluateRequirement` in sequence using realistic TAP output and `"file > test"` format test names, verifying that requirements are classified as `done`/`not_done`/`partial` correctly rather than always `not_done`.

## Out of Scope
-

## Constraints
-

## Design Principles
-

## Overview
### Modules
- `src/flow/lib/req-map.js` — key normalisation fix in `parseTapOutput` and/or `evaluateRequirement`
- `src/flow/lib/run-retro.js` — `tryStaticEvaluation` `note` field logic

### Data Flow
TAP output → `parseTapOutput` (keys must be in `"file > test"` format) → `tapResults` Map → `evaluateRequirement` lookup → correct `passed`/`failed` counts → correct requirement status → `tryStaticEvaluation` with accurate `note` field.

### Decisions
- Normalisation point (in `parseTapOutput` vs. in the lookup site) to be determined during implementation and documented here.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
-

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
1. `parseTapOutput` must produce Map keys in a format that matches what `evaluateRequirement` uses when looking up entries from `testMap` (`"file > test"` convention).
2. `evaluateRequirement` must return correct `passed`/`failed`/`unverified` counts when given TAP results produced by `parseTapOutput` with real TAP output.
3. `tryStaticEvaluation` must set the `note` field to a distinct message (e.g., `"N test(s) mapped but not found in TAP output"`) when tests are mapped but all TAP lookups miss, separate from the `"no tests mapped"` message for unmapped requirements.
4. A new test must exercise `parseTapOutput` → `evaluateRequirement` end-to-end with realistic TAP output and `"file > test"` format test names, confirming that requirements are not always classified as `not_done`.

## Acceptance Criteria
- [ ] Given TAP output where all mapped tests pass, `evaluateRequirement` returns `status: "done"` (not `"not_done"`).
- [ ] Given TAP output where some mapped tests fail, `evaluateRequirement` returns `status: "partial"` with correct counts.
- [ ] Given TAP output where all mapped tests fail, `evaluateRequirement` returns `status: "not_done"` with correct counts (not due to lookup miss).
- [ ] When tests are mapped but none appear in TAP output, `tryStaticEvaluation` sets `note` to a message distinct from `"no tests mapped"`.
- [ ] A new integration-level test in `241-retro-static.test.js` exercises `parseTapOutput` → `evaluateRequirement` in sequence and passes.
- [ ] Existing tests continue to pass.

## Implementation Targets
- `src/flow/lib/req-map.js`
- `src/flow/lib/run-retro.js`
- `specs/241-req-file-test-mapping/tests/241-retro-static.test.js`

## Open Questions
- [ ] Should normalisation happen in `parseTapOutput` (emit `"file > test"` keys) or at the lookup site in `evaluateRequirement`? To be decided during implementation.
