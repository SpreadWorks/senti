---
name: senti.flow-resume
description: Resume Spec-Driven Development flow after context compaction. Outputs a context summary and guides to the appropriate flow skill.
---

# Spec-Driven Development Flow Resume

Use this skill when context has been lost (e.g. after compaction) and you need to resume an active Spec-Driven Development flow.

## Procedure

1. Run `senti flow resume` and read the output.
   - If it reports "no active flow", tell the user there is no flow to resume and stop.
   - If it reports "multiple active flows", ask the user which spec to resume and re-run with `senti flow resume --spec <specId>`.

2. Display the resume summary to the user in a concise format:
   - What was being worked on (Request)
   - Current progress (phase, step, completed steps)
   - Key notes/decisions made so far

3. Read `spec.json` from the selected worktree when `worktreePath` is present, otherwise from `mainRepoPath`. Treat `spec.md` as a generated human-readable view only.

4. Tell the user the exact step to resume from, and the skill to invoke:
   - When `directFlowSession` is present, follow `recommendedSkill` and run `/senti.flow-direct`.
     Direct state takes precedence over the normal `phase`, including `ABORTED`.
   - Mainline phases (`plan` / `impl` / `finalize`) → run `/senti.flow`.
   - `sync` → run `/senti.flow-sync`.

## Notes

- This skill is read-only. It does not modify any files or state.
- Normal resume only reads flows registered in `.senti/.active-flow`.
- Restoring a deliberately parked flow is a separate, exact-identity operation through `senti flow resume --parked`.
- After running this skill, the user should invoke the appropriate flow skill to continue.
