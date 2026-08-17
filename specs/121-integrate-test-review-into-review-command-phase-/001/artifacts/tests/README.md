# Tests for Spec #121: Integrate test review into review command (--phase test)

## What was tested

### Formal tests (`tests/unit/flow/commands/review.test.js`)
- `--phase test` option appears in help output
- `--phase test` with no active flow returns error
- `flow.review.test` agent config resolution (explicit, fallback to `flow.review`, fallback to default)

### Spec-local tests (`specs/121-*/tests/test-review.test.js`)
- `parseProposals` correctly parses numbered markdown proposals
- `test-review.md` and `review.md` coexist in the spec directory
- Retry loop upper bound constant is 3

## How to run

```bash
# Formal tests (included in npm test)
node --test tests/unit/flow/commands/review.test.js

# Spec-local tests
node --test specs/121-integrate-test-review-into-review-command-phase-/tests/test-review.test.js
```

## Expected results

- Formal tests: 1 failure (--phase test not yet in help output) until implementation is complete, then all pass.
- Spec-local tests: all pass.
