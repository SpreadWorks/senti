# Spec Review Results

## Proposals

### 1. I’ll scan the flow/review/draft-related code and template/test references to find dependencies the spec may have missed. I’m only reviewing; no file edits.The current directory only contains review logs, so I’m checking the containing worktree for the actual source tree while staying inside the provided worktree boundary.I found many stale references in generated docs/spec history, but I’m narrowing to current runtime/source, templates, config, and tests so proposals stay actionable rather than flagging historical artifacts unnecessarily.The spec already covers the primary runtime modules. The remaining gaps I’m checking are second-order: docs/template assets, command help plumbing, and tests that still encode the old draft-review assumptions.### 1. AGENTS.md still points to obsolete flow skills
**File:** `AGENTS.md`
**Issue:** The spec removes/reworks `flow-plan`, `flow-impl`, and `flow-finalize` guidance, but the active root `AGENTS.md` still instructs agents to use `/sdd-forge.flow-plan` and `/sdd-forge.flow-finalize`.
**Suggestion:** Add a requirement that upgrade/final verification refreshes `AGENTS.md` SDD content from `AGENTS.sdd.md`, and add tests around `src/docs/commands/agents.js` / `src/lib/agents-md.js` so deployed instructions reference consolidated `/sdd-forge.flow`.

### 2. 2. Project-local README templates can regenerate stale workflow docs
**File:** `.sdd-forge/templates/en/docs/README.md`
**Issue:** The spec mentions `README.md`, but `docs readme` prioritizes project-local templates under `.sdd-forge/templates/<lang>/docs`. These templates still advertise `/sdd-forge.flow-plan`, `/sdd-forge.flow-impl`, and `/sdd-forge.flow-finalize`, so README regeneration can reintroduce obsolete guidance.
**Suggestion:** Add `.sdd-forge/templates/en/docs/README.md` and `.sdd-forge/templates/ja/docs/README.md` to the spec’s affected artifacts, or explicitly require `docs readme` verification to prove project-local templates do not override the consolidated flow wording.

### 3. 3. Next-action context gap for draft and gate-draft nodes
**File:** `src/flow/lib/get-next-action.js`
**Issue:** The spec requires draft review stages to expose `draft.json`, issue/request source, and lifecycle counts, but `buildContextDescriptor()` currently only materializes `spec` and `task_spec` paths. The same gap affects `draft` and `gate-draft`, whose definition context includes `draft`; their next-action context can still omit the actual draft artifact and QA counts.
**Suggestion:** Broaden the requirement so every step with draft context (`draft`, `review-draft-questions`, `review-draft-coverage`, `gate-draft`, and pre-spec `spec`) gets explicit `draft.json` path/content metadata and lifecycle counts from `draft-lifecycle.js`.

### 4. 4. New JSON schemas may exceed the local validator’s supported subset
**File:** `src/lib/schema-validate.js`
**Issue:** The spec adds stricter draft/review next-action schemas, but the local validator only supports a JSON Schema subset. If the implementation uses common keywords such as `pattern`, `const`, `maxLength`, conditional schemas, or stricter `oneOf` semantics for `q<N>` ids and action-specific report objects, validation may silently miss invalid outputs.
**Suggestion:** Add a requirement either to keep new schemas within the supported validator subset or to extend `schema-validate.js` and its tests for every keyword used by the new draft lifecycle and split review schemas.
