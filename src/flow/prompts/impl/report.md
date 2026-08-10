Generate the durable finalization report before committing.

1. Run `sennel flow run report` with the active target guards.
2. The command writes `report.json`, posts the linked Issue comment idempotently when GitHub is available, and confirms the `report` outbox entry before the registry advances the step.
3. On failure, leave the step open. Re-run the same guarded command; the stable outbox identity makes the operation resumable.
