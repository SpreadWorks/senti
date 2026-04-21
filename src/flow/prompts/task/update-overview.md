Use this guidance for the per-task overview-update step. After a task's implementation and review are complete, update the parent spec's overview / summary to reflect the integrated state.

- Read the context provided by `flow get next-action`: `task_summary` (this task's outcome) and `overview` (parent spec's current overview).
- Update the parent overview document (typically `specs/<parent-spec>/overview.md` or the parent spec's relevant section) with:
  - Which task completed.
  - One-line summary of what changed.
  - Any cross-task implications (new contract, new dependency, behavior change visible to other tasks).
- Keep the update concise — the overview is meant to be skimmed by future readers, not reread in full.
- Do NOT modify per-task spec files from this step (each task spec is its own source of truth for that task).
- On complete, the next-action CLI either advances to the next task in the queue or transitions back to a flow-level step.
