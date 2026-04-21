Use this guidance for the per-task overview-update step. After a task's implementation and review are complete, emit the additions this task contributes to the parent spec's overview.

- Read the context provided by `flow get next-action`: `task_summary` (this task's outcome) and `overview` (parent spec's current overview).
- Emit JSON conforming to `next-action/update-overview.schema.json` — additions-only, three categories:
  - `additions.modules`: new modules (files, components) introduced or significantly touched by this task.
  - `additions.data_flow`: new data flows or control paths introduced by this task.
  - `additions.decisions`: new design decisions made by this task that future readers should see.
- Emit only additions. Remove / modify operations are not supported — the payload is constrained to additions-only and any unknown field will fail validation.
- Each entry must be a concise plain string. Do NOT include any origin-task marker in the string; the CLI stamps `added_by_task` automatically using the current task identifier.
- Leave categories empty (`[]`) when this task contributes nothing there. Set `updated: false` with all categories empty when this task makes no meaningful overview contribution.
- Do NOT modify per-task spec files from this step (each task spec is its own source of truth for that task).
- The CLI merges the emitted additions into the parent `spec.json` and regenerates `spec.md` deterministically.
- On complete, the next-action CLI either advances to the next task in the queue or transitions back to a flow-level step.
