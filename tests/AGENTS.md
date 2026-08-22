# Test suite rules

`tests/runner/` owns discovery, selection, suite invariants and Node's test
process invocation. `tests/support/` contains fixture builders, stubs and
assertion support; it contains no runner policy.

Every `*.test.js` belongs to exactly one directory suite: `unit`,
`integration`, `e2e`, `acceptance`, or `agent`. Preset-local acceptance tests
live at `src/presets/<preset>/tests/acceptance/*.acceptance.test.js`.

Unit tests do not spawn child processes, initialise Git repositories, or run
Flow scenarios. Integration tests own cross-module, filesystem, Git and Flow
fixtures. E2E tests are a small set of public CLI entrypoint scenarios.
Acceptance tests are deterministic and use stubs. Tests which execute an AI
provider or agent CLI live only in `tests/agent/` and are excluded from `npm
test`.

Fixtures are immutable seeds. Each test creates a unique temporary work root,
sets only test-local environment, and removes it in teardown. Never write to
the repository's `.sennel`, Git state, or a shared lock.

## Test design

- **MUST: Every test must prove an observable contract.** Assert the returned
  value, persisted state, emitted artifact, error type/code, or another outcome
  that would change if the behavior regressed. A test must not pass only because
  execution did not throw, an exception was caught, or a command exited zero
  when a more specific result is part of the contract. Never leave an empty
  `catch` in a test.
- Give each test one behavioral reason to fail and name that behavior. Prefer
  exact values, types, error codes, and state transitions over broad truthiness
  or message-only matching. When failure atomicity matters, also assert that the
  protected state remains unchanged.
- Exercise the narrowest stable public interface that proves the contract. Do
  not assert private implementation steps, incidental log wording, ordering, or
  file layout unless that detail is itself an external or durability contract.
- Build valid scenarios through production APIs. Do not manufacture impossible
  internal state to shorten setup. Hand-written malformed state is allowed only
  when rejection of that system-boundary input is the behavior under test.
- A regression test must reproduce the externally observable failure and fail
  before the product fix. Do not encode the chosen implementation as the
  expected behavior.

## Coverage without duplication

- Search existing tests before adding a case. One rule belongs to one primary
  layer: unit tests own isolated decisions, integration tests own component and
  persistence composition, E2E tests own representative executable wiring, and
  acceptance tests own user-visible outcomes. A higher layer may repeat a lower
  layer input only to assert behavior unique to the higher boundary.
- Do not copy the same success/failure matrix across layers or representations.
  Keep one normal path, meaningful invariant boundaries, and materially distinct
  failure or recovery paths. Use table-driven cases when inputs vary under the
  same contract; do not add permutations without a distinct failure risk.
- Test count is not a quality goal. Delete superseded tests when an API, format,
  compatibility path, or scenario is removed. During alpha, do not retain tests
  whose only purpose is preserving retired behavior.
- CLI subprocesses are reserved for process behavior such as argument routing,
  exit status, signals, environment, stdout/stderr, and cross-process locking.
  Call the underlying class or function for behavior that does not depend on a
  process boundary. Keep only representative CLI paths in E2E.

## Determinism, setup cost, and cleanup

- Use deterministic fakes for clocks, randomness, network, providers, and agent
  responses. Do not use arbitrary sleeps to coordinate concurrency; synchronize
  on an observable event, lock, file, or injected barrier.
- Reuse an expensive common precondition as an immutable seed and clone it into
  a unique work root per test. Never share mutable Flow, filesystem, Git,
  environment, process-global, or lock state between tests merely to save time.
- Keep expensive end-to-end scenarios only when they protect a distinct public,
  durability, security, concurrency, or recovery boundary. Prefer a lower-layer
  deterministic test for the rest. Do not improve runtime by removing required
  assertions or bypassing production durability and authority checks.
- Register cleanup before performing the mutation that may fail. Restore
  environment and process globals and remove every owned root in `afterEach`,
  `t.after()`, or `finally`. Cleanup is teardown, never a test case. The runner's
  scoped `TMPDIR` cleanup is a final safety net, not a substitute for fixture
  cleanup when a test is run directly.
