# Tests for spec 219-fix-review-envelope-mismatch

## What is tested

Unit tests verifying that `sdd-forge flow run review` (impl-phase) produces
consistent output between its envelope (proposal counts) and its written
review result file, and that the final validation phase operates on the
scope-filtered proposal set.

Mapping to spec requirements:

| Requirement | Test location | What it checks |
|---|---|---|
| R1 (always write review.md) | `tests/unit/flow/commands/review-envelope-consistency.test.js` → "runReviewLoop structure" suite | Static analysis: every `return;` inside `runReviewLoop` is preceded by a `writeReviewMd(...)` call. |
| R2 (0-proposal marker) | same file → "formatReviewMd — empty input" suite and "NO_PROPOSALS_MARKER" suite | `formatReviewMd([])` includes a stable marker string indicating "no proposals"; output is strictly richer than the bare header. |
| R3 (entry count == approved + rejected) | same file → "entry count matches approved + rejected" suite | `formatReviewMd([...])` renders one entry per result and the entry count equals `approved + rejected`. |
| R4 (scope-filtered final prompt, 1:1 index mapping) | same file → "buildFinalValidationPrompt" suite | Final validation prompt contains only the passed (scope-filtered) proposals, numbered 1..N in array order, so verdict index maps 1:1. |
| R5 (no external processes) | entire test file | All tests are pure unit tests — no `execFile`, no AI CLI, no git, no network. |

## Location

`tests/unit/flow/commands/review-envelope-consistency.test.js`

This is in the formal `tests/` tree (not `specs/219-.../tests/`) because
breakage of these tests always indicates a regression of the review
output consistency contract, not just a transient verification of this
spec's introduction.

## How to run

```bash
node --test tests/unit/flow/commands/review-envelope-consistency.test.js
```

Or include in the full run:

```bash
npm test
```

## Expected results

- Before implementation: tests fail because `NO_PROPOSALS_MARKER` and
  `buildFinalValidationPrompt` are not yet exported, and the current
  `runReviewLoop` has at least one `return;` path without preceding
  `writeReviewMd(...)`.
- After implementation: all tests pass.
