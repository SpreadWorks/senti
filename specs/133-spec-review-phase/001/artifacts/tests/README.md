# Tests: 133-spec-review-phase

## What was tested
- AC1: `--phase spec` routing in review.js
- AC5: test review functions still exported after loop refactor
- AC6: get-context.js exports `loadAnalysisEntries` and `contextSearch`
- AC7: registry.js review help mentions `--phase spec`

## Location
`specs/133-spec-review-phase/tests/spec-review.test.js`

## How to run
```bash
node --test specs/133-spec-review-phase/tests/spec-review.test.js
```

## Expected results
All tests should pass after implementation is complete.
Tests for AC1 and AC7 will fail before implementation (expected).
