**MUST: For an ordinary worker-owned step, run `senti flow set step <id> <val>` upon completion to record Flow progress.**

Worker-artifact-handoff-managed exceptions:

- When `next-action.context.workerArtifactHandoff.required` is true, the worker MUST NOT run `flow set step` or write canonical Flow artifacts.
- The worker writes every declared payload to its exact handoff `payloadPath` and runs the exact `sealCommand` once.
- The parent dispatcher validates and publishes the sealed payload, records its revision and receipt, and completes the step. This applies to the managed draft, draft triage/repair/refine, spec, spec triage/repair, and spec-test authoring steps.

Post-hook-managed exceptions:

| Step | Command | Auto-advance condition |
|---|---|---|
| `scenario-validity` | `senti flow run scenario-validity` | every testable requirement is `expected_fail`; any other classification keeps the step active |
| `test-execute` | `senti flow run test-execute` | valid v2 artifact is written |
| `test-result-review` | `senti flow run test-result-review` | review verdict is `pass` |
| `retro` | `senti flow run retro` | command succeeds |
| `final-regression` | `senti flow run final-regression` | final project regression passes |
| `finalize-*` leaves | `senti flow run finalize-commit`, `finalize-merge`, `finalize-sync`, `finalize-cleanup` | each command succeeds for its own leaf |

Do not advance these manually. Manual completion must not mask blocked scenario-validity classifications, prerequisite failures, invalid v2 test artifacts, deferred full regression, or failed final-regression evidence.
