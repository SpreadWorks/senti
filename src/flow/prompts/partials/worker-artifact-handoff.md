**Dispatcher worker artifact handoff:**

- When the parent dispatcher supplies a worker artifact handoff contract, use its immutable input snapshots and exact payload paths.
- In handoff mode, the contract overrides every output path and completion command below. Do not write canonical Flow artifacts and do not mark the step done.
- After all declared payloads are complete, run the contract's exact seal command once. Only the parent dispatcher may validate, publish, record revisions, and complete the step.
- Without a dispatcher-supplied handoff contract, follow the ordinary output and completion instructions below.
