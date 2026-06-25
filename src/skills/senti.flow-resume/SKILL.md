---
name: senti.flow-resume
description: Resume Spec-Driven Development flow after context compaction. Outputs a context summary and guides to the appropriate flow skill.
---

# Spec-Driven Development Flow Resume

Use this skill when context has been lost (e.g. after compaction) and you need recovery context for an in-progress Spec-Driven Development flow.

## Procedure

1. Run `senti flow resume` and read the output.
   - Read `data.recoveryCandidates`.
   - If no candidates are listed, tell the user there is no recoverable flow candidate and stop.
   - If one candidate is clearly intended and has `continuable: true`, re-run with `senti flow resume --spec <specId>`.
   - If multiple candidates are listed, ask the user which spec to recover and re-run with `senti flow resume --spec <specId>`.

2. Display the resume summary to the user in a concise format:
   - Candidate `specId`
   - Candidate state (`active`, `stale`, `finalized`, `orphan-worktree`, or `branch-only`)
   - `runId` presence
   - `execution root` / `worktreePath` presence
   - Current progress and notes when the selected candidate envelope includes them

3. If `senti flow resume --spec <specId>` returns `ok: false`, stop safely.
   - `RESUME_TARGET_NOT_CONTINUABLE` means the candidate is display-only.
   - Do not continue with only spec + worktreePath when `runId` is missing.
   - Do not continue finalized, stale, or branch-only candidates.

4. If the selected candidate is continuable, use the guarded continuation contract.
   - Change to the selected `execution root` before continuing.
   - Run `senti flow get status --expect-run-id <runId>` from that root.
   - If status returns `ACTIVE_FLOW_MISMATCH`, stop. Do not run next-action or any flow run command.
   - Otherwise continue dispatcher work from the same root and include `--expect-run-id <runId>` on target-aware commands such as:
     - `senti flow get next-action --expect-run-id <runId>`
     - `senti flow run <step> --expect-run-id <runId>`

5. Read `spec.json` from the selected execution root to understand full requirements. Treat `spec.md` as a generated human-readable view only.

## Notes

- This skill is read-only. It does not modify any files or state.
- The resume command performs recovery discovery. It does not register display-only candidates as active flows.
- Normal continuation is valid only after `runId` and execution root are both known and the target guard passes.
