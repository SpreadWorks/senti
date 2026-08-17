# Code Review Results

### [ ] 1. Consolidate duplicated task-management docs
**File:** `AGENTS.md`, `CLAUDE.md`  
**Issue:** The same table and explanatory text were copied into both files, which creates a maintenance hotspot and risks drift.  
**Suggestion:** Keep a single canonical block (for example in one markdown partial or skill doc) and include/reference it from both files to eliminate duplication.

**Verdict:** REJECTED
**Reason:** The project's own memory explicitly states "CLAUDE.md はそのシンボリックリンク" — CLAUDE.md is a symlink to AGENTS.md by design. The diff shows identical changes in both files, which is the expected outcome of that architecture. There is no maintenance hotspot: updating AGENTS.md propagates automatically. The proposal misidentifies the problem; introducing a "markdown partial" would break the symlink model without fixing anything.

### [x] 2. Extract shared skill deployment flow
**File:** `src/lib/skills.js`  
**Issue:** `deployProjectSkills()` appears to reimplement much of `deploySkills()` behavior (scan skill dirs, resolve includes, compare existing content, write to `.agents`/`.claude`).  
**Suggestion:** Introduce a shared internal helper like `deploySkillsFromDir({ templatesDir, workRoot, lang, dryRun })` and have both functions call it. This improves consistency and reduces future bugs.

**Verdict:** APPROVED
**Reason:** The new `deployProjectSkills()` function reproduces the core per-skill loop from `deploySkills()` nearly verbatim (read template dir, `resolveSkillFile`, `resolveIncludes`, symlink-aware compare, write to `.agents` and `.claude`). The project's own coding standard explicitly requires: *"同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出すること"*. Extracting a shared `deploySkillsFromDir({ templatesDir, workRoot, lang, dryRun })` would reduce future divergence bugs and is consistent with the "deep module" design principle. No behavior change is expected.

### [ ] 3. Simplify nested config validation logic
**File:** `src/lib/types.js`  
**Issue:** The new `experimental.workflow` validation block is deeply nested and pattern-repeats checks already used elsewhere (optional object + optional typed fields).  
**Suggestion:** Refactor with small helpers (for example `assertOptionalObject`, `assertOptionalString`, `assertOptionalBoolean`) to flatten control flow and align style with other validators.

**Verdict:** REJECTED
**Reason:** Introducing `assertOptionalObject` / `assertOptionalString` / `assertOptionalBoolean` helpers would create thin wrapper abstractions — exactly what the project guideline *"薄いラッパーより深いモジュールを作る"* discourages. If these helpers don't already exist elsewhere in `types.js`, adding them only for this section creates inconsistency rather than alignment. The nesting depth (four levels) is readable and mirrors the config schema shape directly. The proposal is cosmetic for this codebase style.

### [x] 4. Remove or complete placeholder spec artifact
**File:** `specs/150-redesign-exp-workflow/qa.md`  
**Issue:** The file currently contains empty Q/A placeholders and no actual decisions, which functions as dead documentation.  
**Suggestion:** Either delete the file until it is used, or replace placeholders with concrete Q/A entries tied to implemented behavior.

**Verdict:** APPROVED
**Reason:** `specs/150-redesign-exp-workflow/qa.md` contains only unfilled template scaffolding (`Q: ` / `A: ` with no content). The actual clarifications were recorded in `draft.md` and summarised in `spec.md`. Keeping an empty placeholder risks misleading future contributors into thinking decisions were deferred when they were actually resolved elsewhere. Deleting it reduces noise without any behavioral impact.

### [ ] 5. Improve variable naming clarity in upgrade path
**File:** `src/upgrade.js`  
**Issue:** Names like `expDir` and `expResults` are generic and can become ambiguous as more experimental features are added.  
**Suggestion:** Rename to explicit terms such as `workflowSkillTemplatesDir` and `workflowSkillDeployResults` for clearer intent and long-term consistency.

**Verdict:** REJECTED
**Reason:** `expDir` and `expResults` are declared and consumed within a five-line `if` block that is already guarded by `config.experimental?.workflow?.enable === true` and preceded by a comment `// Experimental skills (opt-in via config flags)`. The context is unambiguous at this scale. Renaming to `workflowSkillTemplatesDir` / `workflowSkillDeployResults` is purely cosmetic in this scope and adds verbosity without meaningfully improving comprehension or maintainability.
