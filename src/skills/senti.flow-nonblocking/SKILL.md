---
name: senti.flow-nonblocking
description: Enable advisory handling for eligible acceptance-backed Flow checks and continue the normal Flow.
---

# Flow Nonblocking

Use this skill only when the user explicitly requests advisory continuation of a normal active Flow. It does not start a Flow, bypass prerequisites, or invoke `flow-direct`.

1. Read the guarded `senti flow get status` and `senti flow get next-action`.
2. If the policy is not enabled, enable it once with `senti flow set policy nonblocking --reason "<bounded reason>"` and the same target guards, but only after the active checkpoint has persisted an eligible non-pass artifact. Eligible checkpoints are the draft/spec/test/implementation reviews and gates, scenario validity, test-result review, task review/gate, retro, acceptance review, and final regression. Re-read guarded `next-action`.
3. If `nonblockingDecision` is absent, run the returned normal check action. Never alter, delete, or rewrite its evidence, then re-read guarded `next-action`.
4. If `nonblockingDecision` is present, inspect the named evidence reference and decide without asking the user:
   - `repair` only for quality evidence, then perform the repair and rerun the same check;
   - `retry` only for tooling/unavailable evidence, then rerun the same check;
   - `continue` only when the remaining risk is concrete and bounded. Before acceptance, it creates a durable handoff that acceptance must disposition: semantic review/gate findings retain their original source; verification/tooling stops receive a typed `nonblocking-handoffs.json` source instead.
5. Record exactly one guarded decision:

   `senti flow set nonblocking-decision --choice <repair|retry|continue> --reason "<reason>" --expect-evidence-digest <sha256> [--remaining-risk "<risk>"]`

   Do not provide a step, attempt, or evidence path. A stale digest requires a fresh `next-action`; it must not be retried with stale authority.
6. Re-fetch `next-action` after recording the decision. For `repair` / `retry`, execute the returned normal check action once; the next non-pass permits only `continue`. For `continue`, execute the returned normal Flow action. Finalization, merge, reporting, Issue/board completion, and cleanup stay on the standard Flow route.

Do not offer or start `flow-direct` once nonblocking is enabled. If a target, lock, persistence, Git, authentication, merge, or cleanup failure occurs, follow its guarded continuation; those failures are never advisory. For one identical `step + operation + error code`, perform at most one agent-recoverable guarded recovery/re-run; if it repeats, return the supplied continuation or valid user prompt instead of looping.
