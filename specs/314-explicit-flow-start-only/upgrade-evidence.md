# Upgrade Evidence

Command: `senti upgrade`

Result artifact: `specs/314-explicit-flow-start-only/upgrade-result.json`

Summary:
- exitCode: 0
- result: success-updated
- skills.updated: 1
- presets.copied: 2

Checked source paths:
- `src/skills/senti.flow/SKILL.md`
- `src/presets/base/templates/en/AGENTS.senti.md`
- `src/presets/base/templates/ja/AGENTS.senti.md`

Generated outputs verified by spec-local R5:
- `.agents/skills/senti.flow/SKILL.md`
- `.claude/skills/senti.flow/SKILL.md`
- `.senti/presets/base/guardrail.json`
- `.senti/presets/base/guardrail-rewrite-rubric.md`
