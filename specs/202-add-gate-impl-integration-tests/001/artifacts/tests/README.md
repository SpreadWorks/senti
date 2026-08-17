# Tests for spec 202 — add-gate-impl-integration-tests

## Test Placement

Per spec 202 decision, tests live in the long-term `tests/e2e/flow/` tree (public CLI contract tests that must remain green after future refactors). No per-spec test files are kept under `specs/202-*/tests/`.

## Files

### `tests/e2e/flow/gate-impl-integration.test.js`
Integration tests for `sdd-forge flow run gate --phase task-impl` wiring, covering spec 202 R1–R5:

- R1: multi-line-only addition in test file → gate PASS (mechanical test-change check admits `+`-only hunks ≥ 2 lines)
- R2: deletion or single-line addition in test file → gate FAIL with file + line number in reason
- R3: retry counter at limit → CLI exits non-zero with retry-history text on stdout/stderr
- R4a: gate PASS resets `metrics["task-impl"].gateRetry` to 0
- R4b: gate FAIL increments `metrics["task-impl"].gateRetry` by +1
- R5: `ESCALATE_RETRY_EXHAUSTED` symbol is used by both `src/flow/lib/run-gate.js` and `src/flow/lib/run-draft-task.js`

### Helpers added

- `tests/helpers/git-repo.js` — init / commit / branch helpers for fixture repos.
- `tests/helpers/stub-agent.js` — generates a stub agent provider (Node.js-only script) that returns a deterministic PASS JSON for the AI evaluation step.

## Running

```bash
node --test tests/e2e/flow/gate-impl-integration.test.js
# or via the full suite
node tests/run.js
```

## Expected Results

All 6 test cases PASS. Typical runtime on the CI machine: ~1.5 s (well under the 30 s ceiling in R7).

## Manual regression verification (reviewer / implementer)

To convince yourself that the tests actually detect wiring breakage, temporarily comment out the `checkTestChanges` call in `src/flow/lib/run-gate.js#executeDiffBasedGate` and re-run the file; R2 (or R4b) must FAIL. Restore the change afterwards. (See report.json for recorded results.)
