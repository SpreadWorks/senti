# Test execution map

| Legacy grouping | Current suite | Boundary |
| --- | --- | --- |
| helper modules | `tests/runner/`, `tests/support/{builders,fakes,infrastructure}/` | discovery policy / fixture support |
| CLI smoke coverage | `tests/e2e/cli-smoke.test.js` | public CLI entrypoints |
| stub pipeline coverage | `tests/acceptance/stub-pipeline.test.js` | deterministic pipeline result |
| `tests/unit/flow/**`, Flow fixtures, Git scenarios | `tests/integration/**` | filesystem, Git and Flow boundaries |
| preset acceptance | `src/presets/*/tests/acceptance/*.acceptance.test.js` | deterministic preset pipeline |
| real provider/CLI evaluation | `tests/agent/**` | opt-in authenticated execution |

The runner discovers every product-suite `*.test.js` under `tests/` and
`src/presets/*/tests/acceptance/`, rejects duplicate or unclassified paths,
and presents the selected set with `--list --json`.
Without `--jobs`, each suite uses its explicit Node file-concurrency policy:
unit 4, integration/E2E 2, acceptance/agent 1. `--jobs 1` or `--jobs 2`
overrides that per-file concurrency for every selected suite. `jobs=1` means
that Node runs at most one test file at a time inside the current suite;
`jobs=2` means at most two files. It does not run two copies of a test and it
does not run the unit, integration, E2E, acceptance, or agent suite processes
in parallel. Those suite processes run in that order.

Before executing a selected suite, the runner checks `/dev/shm`. When it is a
writable Linux tmpfs with at least 1 GiB available, the runner creates a unique
`sennel-test-*` root there and exports it as `TMPDIR` to every suite process.
Otherwise it creates the same scoped root under the system temporary directory.
The selected storage and exact root are printed before execution. The complete
root is removed after a pass, a test failure, or SIGHUP/SIGINT/SIGTERM, so an
individual fixture cleanup omission does not accumulate across runner calls.
SIGKILL and host power loss cannot run process cleanup; tmpfs contents disappear
when the tmpfs is unmounted or the host restarts.

## Reorganisation measurements

| Measurement | Before | Current recorded observation |
| --- | ---: | ---: |
| Product test roots | `unit`, `e2e`, `ci`, `agent` | `unit`, `integration`, `e2e`, `acceptance`, `agent` |
| Deterministic command | `node tests/run.js` | `npm test` (agent excluded) |
| Pre-optimization full deterministic wall time | not measured on the base branch | `jobs=1`: 6,272.283 s; `jobs=2`: 4,014.966 s |
| Optimized default-policy wall time | not measured on the base branch | 858.314 s on tmpfs (`unit=4`, `integration/E2E=2`, `acceptance=1`) |
| Deterministic result | not recorded under this topology | 3,405 pass (unit 655, integration 2,699, E2E 43, acceptance 8); 0 fail/cancelled/skipped/todo in the optimized full run |
| Fixed-cohort repeated wall time | not recorded | `jobs=1`: 8.289 / 8.557 s; `jobs=2`: 7.646 / 7.708 s; 23 pass per run |
| Setup/cleanup measurement | not separately aggregated | acceptance cleanup subtests in the repeated cohort: 1.118–5.816 ms; complete per-test timings are retained in TAP |
| Agent (opt-in) | mixed with non-provider tests | 3 pass, 0 fail/cancelled/skipped/todo; real provider calls occur only in `tests/agent/` |
| Setup/cleanup policy | mixed shared helpers | `SeedWorkRoot` clones one immutable seed into a unique root; teardown removes only that root |

The fixed cohort is `test-runner-execution-policy`, `test-runner-file-filter`,
`acceptance/report`, and `acceptance/stub-pipeline`. The successful evidence is
stored in `.tmp/full-j{1,2}-r1-final.{log,time}`,
`.tmp/cohort-j{1,2}-r{1,2}.{log,time}`, and `.tmp/final-agent-r4.log`.
The optimized full-run evidence is
`.tmp/final-full-optimized-default.{log,time}`. Its `TMPDIR` was an in-memory
filesystem because the host root filesystem had only 79 MB free. It therefore
proves the current result and absolute wall time in that environment, but it
is not a like-for-like storage benchmark against the earlier 4,014.966 s
disk-backed run.
The 331.8 s / 198.9 s values copied into the planning issue had no associated
command, revision, test count, or raw result, so they are not treated as a
baseline here.
The earlier 6,363.106 s run had failing stale assertions and is discarded; it
is not used as a final measurement. An exploratory integration concurrency-4
run also failed 18 tests under resource pressure (process-owned lock writes and
`ENOSPC`), so integration defaults to the successful concurrency 2 result
rather than treating 4 as a performance target. The JSON manifest remains the
authoritative exact membership record.

## Flow runtime hot-path measurement

The reorganisation itself was checked against the base branch with the same
four canonical Flow runtime cases: base was 44.394 s and the reorganised branch
before product optimization was 44.225 s. This rules out the suite move as the
cause of those cases' absolute runtime.

Profiling found repeated work in canonical artifact matching, immutable Flow
definition traversal, state/journal replay, catalog parsing, and nested
directory-authority validation. The retained optimizations are all owned by
the immutable or authority-checking object that can prove reuse is safe:

- compiled canonical-path expressions, static-prefix candidate indexes, and
  successful path classifications are reused by the artifact registry;
- current-flow definitions and immutable State instances retain exact node
  and leaf indexes;
- a canonical runtime reuses its Version Store until the Version root is
  deliberately deleted and recreated;
- state, journal, Activity-index, and artifact-catalog typed values are reused
  only after their exact bytes or exact confirmed prefix have been read and
  matched again;
- a child directory authority reuses its already validated direct parent's
  canonical ancestry while retaining child `lstat`, non-symlink, and inode
  checks.

No state, journal, catalog, lock, or directory `fsync` was removed. External
byte changes, journal-prefix changes, directory replacement, direct-writer
contention, crash windows, and atomic rollback remain on their full validation
paths.

On disk, the same four canonical runtime cases moved from 44.225 s before
product optimization to 26.156/26.206 s after the first immutable path and
definition indexes, then from 26.153 s to 19.626/19.226 s after validated
state/journal parsing and replay caches. In the later same-tmpfs sequence, the
fixed cases moved from 7.660 s to 6.151/6.104 s (four pass each), about 20%
lower. The final default-policy full run completed all 367 files in 858.314 s
with 3,405 passes and no failures.

Focused evidence includes 99/99 State/Runtime cases, 44/44 atomic JSON and
Version catalog cases, 93/93 directory/lock consumers, and 24/24 artifact
contract cases. A larger 16-case dispatch cohort passed in 53.013 s.

The raw measurements include `.tmp/current-selected.log`,
`.tmp/perf-path-value-cohort-r{1,2}.log`,
`.tmp/current-flow-{validation,parse}-cache-cohort-r{1,2}.log`,
`.tmp/state-node-index-cohort-r{1,2}.log`,
`.tmp/optimized-dispatch-cohort-r1.log`, and
`.tmp/final-full-optimized-default.{log,time}`.
