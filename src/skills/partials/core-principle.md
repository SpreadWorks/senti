**MUST: When a rule in this skill conflicts with a memory entry (e.g. `feedback_*.md` referenced from `MEMORY.md`), the skill rule takes precedence.** Memory entries that contradict skill rules should be considered stale; update or delete them.

**Use the CLI's `requires_approval` field to decide whether user confirmation is required before a step.**
Do not ask the user to confirm routine step execution when `requires_approval: false`.

**autoApprove check (MANDATORY):**
Before presenting any choice to the user, you MUST run `sdd-forge flow get status` and display the `autoApprove` field value. This is not optional — skipping this check is a protocol violation.
- Run the command exactly as `sdd-forge flow get status` (no extra options).
- If the next-action envelope has `requires_approval: false`, execute the step without a "run this step?" confirmation. This applies even when `autoApprove: false`.
- If `requires_approval: true` and `autoApprove: false` (or field is missing): present the choice to the user and wait for input.
- If `requires_approval: true` and `autoApprove: true`: treat choice id=1 as selected and proceed immediately. Display progress briefly (e.g. "auto: approval → [1] 承認").
- Continue without waiting when the step does not require approval, or when `autoApprove: true` satisfies a required approval.
- If a step fails (command error, gate FAIL, test failure), apply the retry limits defined in each skill. If the retry limit is reached, STOP and return control to the user.

**autoApprove exceptions (MUST present to user even when `autoApprove: true`):**
The following user-facing choices are explicit exceptions to the auto-select rule because silently picking `[1]` would risk irreversible loss:
- `finalize-cleanup` orphan-commit recovery prompt (`ORPHAN_COMMITS_DETECTED`): always present the cherry-pick / abort / force-continue choice to the user. Do not auto-select. See `flow.run.finalize-cleanup` for details.
- Any choice whose envelope error code begins with `SQUASH_BASELINE_` or `FORCED_ORPHAN_`: surface the recovery guidance verbatim and let the user decide.

<!-- {{data("base.skills.rule", {id: "no-auto-mode-override-skill"})}} -->
<!-- {{/data}} -->

<!-- {{data("base.skills.rule", {id: "wait-for-instruction-skill"})}} -->
<!-- {{/data}} -->

<!-- {{data("base.skills.rule", {id: "thoroughness"})}} -->
<!-- {{/data}} -->

<!-- {{data("base.skills.rule", {id: "no-shortcuts"})}} -->
<!-- {{/data}} -->

<!-- {{data("base.skills.rule", {id: "no-scope-splitting"})}} -->
<!-- {{/data}} -->

<!-- {{data("base.skills.rule", {id: "commit-split-strategy"})}} -->
<!-- {{/data}} -->

<!-- {{data("base.skills.rule", {id: "no-chain-sddforge"})}} -->
<!-- {{/data}} -->

**Flow runtime log rule (MANDATORY):**
- Never hardcode `/tmp/...` for flow-related logs or temporary files.
- When a flow command needs an agent/tmp/log base directory for the current invocation, pass `--agent-work-dir <path>` to `sdd-forge flow run ...`.
- Flow commands automatically append stdout/stderr to `.tmp/logs/<flowId>.log`, or `.tmp/logs/no-flow.log` when no flow is active.
- Use `sdd-forge flow get runtime-log` to inspect the latest flow command output after failures.
- Do not wrap flow commands with environment-variable prefixes or shell redirection just to capture logs; keep the command prefix as `sdd-forge flow ...` so approval-prefix rules can match it.
