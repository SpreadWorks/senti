# Spec 202 verification tests

These tests verify the requirements of spec `202-stabilize-agent-subprocess`
(GitHub Issue #195 — stabilize agent subprocess invocation).

They are spec-local verification tests kept as history; they are **not** run
by `npm test`.

## What is tested

| Test file | Requirements | What it asserts |
|---|---|---|
| `agent-stabilization.test.js` | R1, R3, R4 | Default retryCount is 2; backoff grows per attempt; timeout (SIGTERM) is terminal; empty response is retryable; stdin-fallback EPIPE does not crash the Node process |
| `text-return-shape.test.js` | R2 | `runText` body does not assign `process.exitCode`; exit-code responsibility is moved out of the module |

R5 (acceptance harness classifies `agent-error` distinctly) and R6
(deterministic stub) are verified in place inside the acceptance pipeline
code changes (see `tests/acceptance/lib/pipeline.js`).

## Running

```sh
# Run all spec 202 verification tests
node --test specs/202-stabilize-agent-subprocess/tests/*.test.js
```

## Expected results

All tests pass after the spec implementation lands. Before the
implementation, these tests are expected to fail on:

- default retry count (currently 0)
- backoff growth (currently constant 3000 ms)
- timeout terminality (currently retries if retryCount > 0 and error lacks `killed`)
- stdin-fallback resilience (currently `child.stdin.write` has no error listener)
- `runText` body (currently contains `process.exitCode = EXIT_ERROR`)
