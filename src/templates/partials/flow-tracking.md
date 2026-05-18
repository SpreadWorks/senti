**MUST: Run `sdd-forge flow set step <id> <val>` upon completion of each step to record flow progress.**

Post-hook-managed exceptions:

| Step | Command | Auto-advance condition |
|---|---|---|
| `scenario-validity` | `sdd-forge flow run scenario-validity` | every testable requirement is `expected_fail`; any other classification keeps the step active |
| `test-execute` | `sdd-forge flow run test-execute` | valid v2 artifact is written |
| `test-result-review` | `sdd-forge flow run test-result-review` | review verdict is `pass` |
| `retro` | `sdd-forge flow run retro` | command succeeds |
| `finalize-*` leaves | `sdd-forge flow run finalize-commit`, `finalize-merge`, `finalize-sync`, `finalize-cleanup` | each command succeeds for its own leaf |

Do not advance these manually. Manual completion must not mask blocked scenario-validity classifications, prerequisite failures, invalid v2 test artifacts, or failed project regression evidence.
