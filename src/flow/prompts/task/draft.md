Use this guidance when a task (per-task workflow within the impl phase) needs its draft generated. Addition tasks (origin: "addition") are tool-driven — the AI does not generate the draft directly.

## Tool-driven draft (addition tasks)

When an addition task is inserted, draft generation is handled entirely by `sdd-forge flow run draft-task --task-id <id>`. Do not generate the addition task's draft inside the skill or by free-form AI prompt — the tool path collects parent spec / sibling tasks / request context, calls the agent, runs the task-spec gate, injects any FAIL reasons into the next retry prompt, and retries up to `config.flow.retry.max` before escalating. Gate PASS is the trust point; an AI-side "I think this is good" is not.

## Plan-origin task draft

For plan-origin tasks (origin: "plan"), the draft was already produced during the parent spec's plan phase. Re-use the existing task draft; do not regenerate.

## Required actions

- Run `sdd-forge flow get status` and look for entries in `tasks[]` with `origin === "addition"` whose `draft` step is not `done`.
- For each such task, invoke `sdd-forge flow run draft-task --task-id <id>` and wait for gate PASS.
- Do not write addition task drafts manually.
- If the gate retry budget is exhausted (FAIL persists), STOP and return control to the user.
