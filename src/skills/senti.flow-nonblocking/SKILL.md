---
name: senti.flow-nonblocking
description: Enable advisory handling for eligible post-implementation Flow checks and continue the normal Flow.
---

# Flow Nonblocking

Use this skill only when the user explicitly requests advisory continuation of a normal active Flow. It does not start a Flow, bypass prerequisites, or invoke `flow-direct`.

1. Read the guarded `senti flow get status` and `senti flow get next-action`.
2. Enable once with `senti flow set policy nonblocking --reason "<bounded reason>"` and the same target guards. The command is valid only after implementation starts and at `impl-review`, `impl-gate`, `acceptance-review`, or `final-regression`.
3. Run the returned normal check action. Never alter, delete, or rewrite its evidence.
4. Re-read guarded `next-action`. If `nonblockingDecision` is present, inspect the named evidence reference and decide without asking the user:
   - `repair` only for quality evidence, then perform the repair and rerun the same check;
   - `retry` only for tooling/unavailable evidence, then rerun the same check;
   - `continue` only when the remaining risk is concrete and bounded.
5. Record exactly one guarded decision:

   `senti flow set nonblocking-decision --choice <repair|retry|continue> --reason "<reason>" --expect-evidence-digest <sha256> [--remaining-risk "<risk>"]`

   Do not provide a step, attempt, or evidence path. A stale digest requires a fresh `next-action`; it must not be retried with stale authority.
6. For `continue`, re-fetch `next-action` and execute the returned normal Flow action. Finalization, merge, reporting, Issue/board completion, and cleanup stay on the standard Flow route.

Do not offer or start `flow-direct` once nonblocking is enabled. If a target, lock, persistence, Git, authentication, merge, or cleanup failure occurs, follow its guarded continuation; those failures are never advisory.
