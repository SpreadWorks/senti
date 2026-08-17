# Code Review Results

### [x] 1. Consolidate skill content into a single source of truth
**File:** `.claude/skills/sdd-forge.flow-impl/SKILL.md`
**Issue:** The same wording changes are duplicated across both deployed skill files under `.claude/skills/...` and template files under `src/templates/skills/...`. This creates parallel copies that can drift, and the diff already shows the same edits repeated in multiple places.
**Suggestion:** Keep the canonical content only in `src/templates/skills/` and generate or sync `.claude/skills/` from those templates during setup/build. If the checked-in deployed copies must remain, add a generation step or verification test to prevent divergence.

**Verdict:** APPROVED
**Reason:** The diff clearly shows identical edits applied to both `.claude/skills/` and `src/templates/skills/` for every skill file (flow-impl, flow-merge, flow-plan, flow-resume). This is exactly the kind of duplication that leads to divergence — and proposal #3 already caught an instance of it. A generation/sync step from templates to deployed copies is a sound architectural improvement that eliminates a real maintenance hazard.

### [ ] 2. Extract repeated “Language” and “Choice Format” sections
**File:** `src/templates/skills/sdd-forge.flow-plan/SKILL.md`
**Issue:** The new `## Language` block and the full choice-format guidance are repeated verbatim across multiple skill files. This increases maintenance cost and makes future wording updates error-prone.
**Suggestion:** Move these shared instructions into a reusable include/template fragment, or define them once in a common base skill document and reference them from each workflow-specific skill.

**Verdict:** REJECTED
**Reason:** While the duplication is real, these are AI skill prompt files consumed as standalone documents by the Claude runtime. Skill files must be self-contained — there is no include/import mechanism in SKILL.md. Introducing a build-time template composition step for ~10 lines of shared text adds tooling complexity disproportionate to the maintenance cost. The duplication here is deliberate: each skill file needs to carry its full instructions. If the wording drifts, a simple grep-and-replace suffices.

### [x] 3. Align deployed skill updates with template updates
**File:** `src/templates/skills/sdd-forge.flow-status/SKILL.md`
**Issue:** `sdd-forge.flow-status` was updated only in `src/templates/skills/...`, while the diff does not show the corresponding deployed `.claude/skills/...` file being updated. Other skills in this change update both locations, so this is inconsistent and risks different behavior depending on which copy is used.
**Suggestion:** Update the deployed `/.claude/skills/sdd-forge.flow-status/SKILL.md` as part of the same change, or stop committing deployed copies entirely and regenerate them from templates.

**Verdict:** APPROVED
**Reason:** The diff updates `src/templates/skills/sdd-forge.flow-status/SKILL.md` (adding the Language section and changing example text) but the corresponding `.claude/skills/sdd-forge.flow-status/SKILL.md` is not touched. Every other skill in this change updates both locations. This is a concrete bug — users running from the deployed copy will get stale behavior. Should be fixed in this change.

### [ ] 4. Replace hardcoded example language with locale-aware placeholders
**File:** `src/templates/skills/sdd-forge.flow-merge/SKILL.md`
**Issue:** The new language rule says user-facing text must follow `.sdd-forge/config.json`, but the examples and prescribed prompts are now hardcoded in English. That creates a design inconsistency: the instruction requires localization, while the concrete content implicitly biases one language.
**Suggestion:** Use symbolic placeholders or locale keys in the skill docs for prompts and options, and document that the runtime should resolve them from the configured language instead of embedding English literals in every skill file.

**Verdict:** REJECTED
**Reason:** The entire point of this diff is to move from hardcoded Japanese to English defaults + a `## Language` directive that tells the AI to follow `config.json`'s `lang` field at runtime. English is the correct neutral default for an npm package (per the project's own Skill Language Policy in MEMORY.md). The AI agent interprets the Language instruction and translates its output dynamically — the examples serve as structural templates showing format, not as final user-facing strings. Adding symbolic placeholders would make the skill files unreadable to the AI and solve a problem that the Language section already addresses.
