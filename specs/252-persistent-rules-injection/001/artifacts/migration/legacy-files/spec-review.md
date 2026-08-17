# Spec Review Results

## Proposals

### 1. I’ll inspect the modules named in the spec plus nearby template, package, and test wiring so the proposals are grounded in the current repo rather than just the summary.The current directory itself is a `.tmp` folder and doesn’t contain `src/` or `docs/`; the active worktree contents appear to be one level up. I’m going to read paths by explicit relative names while keeping the shell anchored here.The parser already preserves directive params on parsed nodes, but `resolveDataDirectives` currently drops them when calling `resolveFn`. I’m checking the resolver call sites now because that is where broad compatibility and tests can be overlooked.### 1. Rule Inventory Is Not Concrete
**File:** `src/templates/skills/rules.json`  
**Issue:** The spec references “10 rule bodies” and a “curated drift-prone set” but does not enumerate rule IDs, source locations, or how the loader identifies drift-prone rules for MUST/why/how validation.  
**Suggestion:** Add a table listing each rule id, origin file/section, phase array, state array, and whether drift-prone validation applies.

### 2. 2. Inline Skill Rules Are Not Accounted For
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** This file still contains rule-like bodies outside partials, such as hard stops, command discipline, autoApprove behavior, and worktree constraints. The spec only says partials are migrated, so SSOT duplication may remain.  
**Suggestion:** Explicitly audit inline `SKILL.md` rules: migrate overlapping rule bodies to `rules.json`, or list the remaining inline sections as intentionally out of scope.

### 3. 3. Generated AGENTS Templates Are Omitted
**File:** `src/presets/base/templates/en/AGENTS.sdd.md`  
**Issue:** `setup.js`/`agents-md.js` load this template raw into `AGENTS.md`/`CLAUDE.md`; it is related to the same SDD/worktree rules but is not mentioned. Adding `{{data("base.skills.rule")}}` here would not be expanded.  
**Suggestion:** Add explicit requirements for both `en` and `ja` `AGENTS.sdd.md`: either keep them independent and forbid skill-rule directives there, or update their prose separately.

### 4. 4. Params Plumbing Misses Command Call Sites
**File:** `src/docs/commands/agents.js`  
**Issue:** The spec mentions resolver params plumbing generally, but current `resolveDataDirectives` call sites in `agents.js`, `data.js`, and `readme.js` wrap resolver calls and would each need signature updates. The test plan does not explicitly cover command-level regressions.  
**Suggestion:** Enumerate all `resolveDataDirectives` call sites and require tests proving `params` reaches the resolver without breaking existing DataSources.

### 5. 5. Preset Author Docs Conflict With Params Change
**File:** `.sdd-forge/templates/en/docs/creating_presets.md`  
**Issue:** Project rules require updating preset-creation docs when DataSource invocation contracts change. This file documents `method(analysis, labels)`, but the spec introduces option params. R38 only excludes regenerated `docs/`, not these source templates.  
**Suggestion:** Add a requirement to update both English/Japanese `creating_presets.md` templates, or explicitly justify an exception.

### 6. 6. Deployment Target Freshness Is Underspecified
**File:** `src/lib/skills.js`  
**Issue:** `deploySkillsFromDir` currently decides `needsUpdate` by comparing only the `.agents` copy, then skips `.claude` if `.agents` is unchanged. The spec requires both deployed copies to contain expanded rule bodies but does not require per-target freshness checks.  
**Suggestion:** Add a requirement and test where `.agents` is current but `.claude` is stale/missing, and `upgrade` repairs `.claude`.

### 7. 7. Next-Action Requirement Is Conflated And Ambiguous
**File:** `src/flow/lib/get-next-action.js`  
**Issue:** The exact rule-block rendering requirement appears mixed into the deployed `SKILL.md` requirement, the referenced regex is empty, and “every response” conflicts with inactive/completed responses where `instructions` is `null`.  
**Suggestion:** Split next-action injection into its own numbered requirement: define inactive/completed behavior, exact heading/separator shape, active phase derivation, and marker regex separately from deploy-time marker stripping.
