**MUST: When a rule in this skill conflicts with a memory entry (e.g. `feedback_*.md` referenced from `MEMORY.md`), the skill rule takes precedence.** Memory entries that contradict skill rules should be considered stale; update or delete them.

**Use the CLI's `requires_approval` field to decide whether user confirmation is required before a step.**
Do not ask the user to confirm routine step execution when `requires_approval: false`.

**autoApprove check (MANDATORY):**
Before presenting any choice to the user, you MUST run `senti flow get status` and display the `autoApprove` field value. This is not optional — skipping this check is a protocol violation.
- If the current flow `runId` is known, prefer `senti flow get status <runId>` so the check reads the target flow instead of an unrelated current context.
- `active: true` is not by itself a reason to stop a new flow start. Parallel flows are allowed when the new target is addressed by an explicit preparing `runId` and verified with target-aware status.
- When starting a new flow while another flow is active, record the `runId` returned by `senti flow set init`; before and after `senti flow prepare --run-id <runId>`, verify the target with `senti flow get status <runId> --expect-run-id <runId>` plus every known `--expect-issue` and `--expect-spec` guard.
- After a dispatcher target `runId` is known, all target-sensitive dispatcher continuation commands for that flow must carry `--expect-run-id <runId>` plus every known `--expect-issue` and `--expect-spec` guard. This applies to `senti flow get next-action`, target-bound `senti flow get context` reads, target-bound `senti flow get prompt ...` reads such as `plan.approval`, `senti flow run ...`, and active-flow-mutating `senti flow set ...` commands.
- If the user explicitly continues an existing flow and the target Issue is known, run `senti flow get status <runId> --expect-run-id <runId> --expect-issue <n>` when `runId` is known. Without a target `runId`, use bare status for display and do not treat another active flow as authorization to continue it.
- If the user explicitly continues an existing spec target, run `senti flow get status --expect-spec <spec>` before dispatcher actions.
- If the user explicitly continues an existing runId target for dispatcher continuation, run `senti flow get status <runId> --expect-run-id <runId>` before dispatcher actions.
- Treat `ACTIVE_FLOW_MISMATCH` as a no-mutation boundary, then distinguish a
  locally generated runId transcription error from a true target mismatch:
  - A transcription error is recoverable only for the same read-only
    `senti flow get status <selectedRunId> ...` command when all of the
    following hold: `<selectedRunId>` equals the exact `targetRunId` previously
    returned by a successful CLI response; `data.activeRunId` also equals that
    value; the only unequal expected/active identity pair is
    `expectedRunId`/`activeRunId`; and every supplied Issue/spec guard pair
    matches.
  - For that case, rebuild both the positional selector and
    `--expect-run-id` from the stored `targetRunId`, preserve the matching
    Issue/spec guards, and retry the same read-only status command once in the
    same turn. Do not ask the user or run any mutating
    command before this retry passes.
  - If the corrected status passes, continue the existing Flow in the same
    turn. If it fails again, or any Issue/spec/selected-run identity differs,
    STOP before `next-action`, `repair`, `run`, `finalize`, `cleanup`, or file
    edits. `autoApprove` and `requires_approval` never bypass a true mismatch.
- Store runId values returned by the CLI as opaque tokens. Build
  `targetGuardArgs` once from those stored tokens and reuse them verbatim;
  never retype, shorten, reconstruct, or infer a runId from a branch, path, or
  prose.
- A preparing flow still reports `autoApprove: false` in status; use the `senti flow set auto on --run-id <runId>` response and `senti flow prepare --run-id <runId>` inheritance for prelude auto mode.
- Bare `senti flow get status` remains valid for current-context display and for detecting whether any active flow exists before a runId is known.
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
- When a flow command needs an agent/tmp/log base directory for the current invocation, pass `--agent-work-dir <path>` to `senti flow run ...`.
- Flow commands automatically append stdout/stderr to `.tmp/logs/<flowId>.log`, or `.tmp/logs/no-flow.log` when no flow is active.
- Use `senti flow get runtime-log` to inspect the latest flow command output after failures.
- Do not wrap flow commands with environment-variable prefixes or shell redirection just to capture logs; keep the command prefix as `senti flow ...` so approval-prefix rules can match it.
