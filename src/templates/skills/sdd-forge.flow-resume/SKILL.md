---
name: sdd-forge.flow-resume
description: Resume SDD flow after context compaction. Outputs a context summary and guides to the appropriate flow skill.
---

# SDD Flow Resume

Use this skill when context has been lost (e.g. after compaction) and you need to resume an in-progress SDD flow.

## Procedure

1. Run `sdd-forge flow resume` and read the output.
   - If it reports "no active flow", tell the user there is no flow to resume and stop.
   - If it reports "multiple active flows", ask the user which spec to resume and re-run with `sdd-forge flow resume --spec <specId>`.

2. Display the resume summary to the user in a concise format:
   - What was being worked on (Request)
   - Current progress (phase, step, completed steps)
   - Key notes/decisions made so far

3. Read `spec.json` (path shown in the summary) to understand full requirements. Treat `spec.md` as a generated human-readable view only.

4. Tell the user the exact step to resume from, and the skill to invoke:
   - Mainline phases (`plan` / `impl` / `finalize`) → run `/sdd-forge.flow` (the consolidated skill inspects state and resumes from the correct step automatically).
   - `sync` → run `/sdd-forge.flow-sync`.

## Notes

- This skill is read-only. It does not modify any files or state.
- The resume command reads flow.json and spec.json to reconstruct context; draft.json may be used for draft-phase context.
- After running this skill, the user should invoke the appropriate flow skill to continue.
