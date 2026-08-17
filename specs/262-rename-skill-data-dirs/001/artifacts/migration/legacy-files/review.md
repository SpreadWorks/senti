# Code Review Results

### 1. 1. Align duplicated workflow guidance
**File:** `CLAUDE.md`  
**Issue:** The two updated `開発ワークフロー` bullets are nearly identical but differ slightly: one says `src/presets/`, the other says `src/presets/ 等`. This creates minor drift risk for future edits.  
**Suggestion:** Either consolidate the duplicated workflow guidance into one section, or make the two bullets use identical wording unless the `等` distinction is intentional.

### 2. 1. Preserve the data source during the move
**File:** `src/docs/data/docs.js`
**Issue:** The diff deletes the docs data source, but R3 says files under `src/docs/data/` must move to `src/data/`, not be removed. As shown, consumers of the common `docs` data source would lose `langSwitcher`, `chapters`, `nav`, and title extraction behavior.
**Suggestion:** Make this a true rename/move in the change set, preserving the implementation at the new data directory path and updating imports/path constants accordingly.

### 3. 2. Add bounds around chapter bulk loading
**File:** `src/docs/data/docs.js`
**Issue:** `chapters()` iterates over every file returned by `getChapterFiles()` and reads each whole file into memory. There is no explicit cap on file count or file size, which violates the `bounded-resource-usage` guardrail for bulk data loading.
**Suggestion:** When preserving/moving this implementation, add explicit limits such as a maximum chapter count and maximum bytes per chapter before reading/parsing content, with a clear failure or truncation behavior.

### 4. 1. Deletion appears incomplete
**File:** `src/docs/data/skills.js`  
**Issue:** The file is deleted, but the diff does not show an equivalent moved implementation under the new `src/data/` location required by R3. This may remove the `skills` DataSource adapter entirely.  
**Suggestion:** Ensure this deletion is part of an actual move by including the replacement file in the change set, preserving the adapter behavior and updating imports/path constants accordingly.

### 5. I’ll check the touched file context so the proposals are scoped to the actual implementation, not just the visible hunk.The provided cwd appears to be a temp worktree subdirectory without `src/lib/include.js` at that relative path, so I’ll base this review on the supplied diff only.### 1. Keep root-relative path handling explicit
**File:** `src/lib/include.js`
**Issue:** `resolvePrefixedPath()` is now used for both alias-style prefixes like `@skills/` and root-relative paths like `/`. The `/` case has different semantics because it falls back from `pkgDir` to `baseDir`, so routing it through the same helper makes the code slightly less clear and gives `optionName: "pkgDir"` even when `baseDir` is the effective root.
**Suggestion:** Use `resolvePrefixedPath()` only for named aliases, and restore a small explicit branch for `/`:

```js
if (includePath.startsWith("/")) {
  const rel = includePath.slice(1);
  return path.join(opts.pkgDir || opts.baseDir, rel);
}
```

### 6. 2. Rename helper to reflect alias resolution
**File:** `src/lib/include.js`
**Issue:** `resolvePrefixedPath()` is very generic, but the meaningful behavior here is resolving include aliases such as `@skills/` and `@presets/`.
**Suggestion:** Rename it to something more domain-specific, such as `resolveAliasedIncludePath()`, or keep the generic name only if the `/` case remains handled by it.

### 7. 1. Add an explicit bound when listing skill directories
**File:** `src/lib/skills.js`  
**Issue:** `listSkillDirNames()` bulk-loads every directory entry with `fs.readdirSync()` and has no explicit size/count cap. That violates the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Define a reasonable `MAX_SKILL_DIRS` limit and fail clearly if a source or deployed skills directory exceeds it.

### 8. 2. Sort skill directory names for deterministic output
**File:** `src/lib/skills.js`  
**Issue:** `listSkillDirNames()` returns filesystem order, so deploy and cleanup result ordering can vary by platform/filesystem.  
**Suggestion:** Add `.sort()` before returning names from `listSkillDirNames()`.

### 9. 3. Rename `obsoleteByBase` to reflect stored values
**File:** `src/lib/skills.js`  
**Issue:** `obsoleteByBase` stores arrays of obsolete skill names by target base, but the name does not communicate that the map values are names.  
**Suggestion:** Rename it to `obsoleteNamesByBase` for clearer intent.

### 10. 4. Remove stale write-phase comment
**File:** `src/lib/skills.js`  
**Issue:** The comment says “no further failure expected here,” but `isCurrentSkillFile()`, `removeIfSymlink()`, `mkdirSync()`, and `writeFileSync()` can all throw.  
**Suggestion:** Reword the comment to simply describe the phase, or remove the parenthetical entirely.

### 11. I’ll inspect the touched file around the changed helper and the `deploySkills` import/signature so the proposal is grounded in the current code rather than the small diff alone.The provided `cwd` is a temporary worktree subdirectory and doesn’t contain `src/`; I’ll locate the repo root from here and read the same touched file there if available.I found the repo one level up. I’m checking whether `setupSkills` still carries useful behavior or has become an unnecessary wrapper.### 1. Inline the Thin Skills Wrapper
**File:** `src/setup.js`  
**Issue:** `setupSkills()` now only calls `deploySkills(workRoot)` and logs one message. Since it no longer adapts arguments or returns useful data, it adds indirection without much design value.  
**Suggestion:** Remove `setupSkills()` and inline the two statements in the existing `try` block:

```js
deploySkills(workRoot);
console.log(t("setup.messages.skillsDeployed"));
```

### 12. 1. Preserve the partial during the move
**File:** `src/templates/partials/choice-format.md`  
**Issue:** The diff deletes this partial, but requirement R2 says files under `src/templates/partials/` must move to `src/skills/partials/`, not be removed. If no matching relocated file exists in the full change set, this drops the shared choice-format instructions.  
**Suggestion:** Treat this as a rename/move rather than a deletion: preserve the file content at the new `src/skills/partials/choice-format.md` location and update skill includes to use `@skills/partials/choice-format.md`.

### 13. 1. Preserve the Partial During Rename
**File:** `src/templates/partials/issue-log-recording.md`  
**Issue:** The diff deletes the partial outright, but the related requirement says partials must move from `src/templates/partials/` to `src/skills/partials/`. As shown, this removes the issue-log recording guidance instead of preserving it under the new include location.  
**Suggestion:** Treat this as a rename/move rather than a deletion: preserve the file contents in the new partial location and update skill includes to use `@skills/partials/issue-log-recording.md`.

### 14. 1. Preserve partial content during directory migration
**File:** `src/templates/partials/placeholder-artifact-permission.md`
**Issue:** The diff deletes the partial content, but the requirement says partials must move from `src/templates/partials/` to `src/skills/partials/`. A delete-only change risks losing the shared placeholder-artifact permission text unless the moved file exists elsewhere in the same change set.
**Suggestion:** Ensure this content is carried forward into the corresponding `src/skills/partials/placeholder-artifact-permission.md` partial and update skill includes to use `@skills/partials/placeholder-artifact-permission.md`.

### 15. 1. Verify the move target is included
**File:** `src/templates/skills/rules.json`
**Issue:** This diff deletes `src/templates/skills/rules.json`, but the shown change set does not include the required replacement under `src/skills/`. R1 requires a move with preserved contents, not just removal.
**Suggestion:** Ensure this deletion is paired in the same change set with `src/skills/rules.json` containing the same rule data, adjusted only for required path/include directive updates.

### 16. 1. Simplify skill source construction
**File:** `src/upgrade.js`  
**Issue:** `bundledSkillSource(dir, deployFromDir)` suggests every deploy function consumes `dir`, but the `MAIN_SKILLS_DIR` call ignores that argument. That makes the helper slightly misleading.  
**Suggestion:** Remove the helper and define the source objects inline, or rename it to something neutral like `skillSource(dir, deploy)` and pass a zero-arg deploy callback consistently.

### 17. 2. Make exit-on-failure behavior explicit
**File:** `src/upgrade.js`  
**Issue:** `deploySkillSource()` sounds like a plain deploy wrapper, but it can terminate the process via `process.exit(EXIT_ERROR)`.  
**Suggestion:** Rename it to something like `deploySkillSourceOrExit()` or keep the `try/catch` inline in the deployment loop so the control flow is obvious.

### 18. 1. Reuse namespace assertion helper
**File:** `tests/e2e/051-skill-namespace.test.js`
**Issue:** The first naming test repeats the same `startsWith("sdd-forge.")` loop that `assertSkillNamesUseNamespace` already centralizes.
**Suggestion:** Replace the inline loop with `assertSkillNamesUseNamespace(skillSourceNames, "src/skills")` to keep namespace assertion wording and behavior consistent.

### 19. 2. Add explicit deployed-skill count bound
**File:** `tests/e2e/051-skill-namespace.test.js`
**Issue:** `assertDeployedSkillFiles()` bulk-iterates `fs.readdirSync(skillsDir)` without an explicit count bound. This is inconsistent with the new `MAX_SKILL_SOURCES` guardrail handling in `listSkillSourceNames()`.
**Suggestion:** Capture deployed names into an array, assert `length <= MAX_SKILL_SOURCES`, then iterate that bounded array.

### 20. 3. Avoid repeated source discovery work
**File:** `tests/e2e/051-skill-namespace.test.js`
**Issue:** `listSkillSourceNames()` is called independently in multiple tests and repeatedly performs directory scans plus `existsSync` checks.
**Suggestion:** Add a small helper such as `listSkillSources()` returning `{ name, file }`, then use it in both naming/content tests. This removes repeated path resolution and makes the canonical `SKILL.md` contract clearer.

### 21. 1. Table-Drive Repeated Nav Assertions
**File:** `tests/unit/docs/lib/layout-and-nav.test.js`  
**Issue:** The three multi-chapter tests repeat the same setup and `markdown.includes(...)` assertion pattern with only path and expected links changing.  
**Suggestion:** Collapse these into a small table of cases, e.g. `{ name, currentPath, present, absent }`, and loop with `it(name, ...)`. This keeps the behavior matrix explicit while reducing duplicated assertion structure.

### 22. 2. Make Fixture Helper Name More Specific
**File:** `tests/unit/docs/lib/layout-and-nav.test.js`  
**Issue:** `setupDocsSource` does more than setup: it creates temp files, initializes the shared container, registers the data source, initializes the instance, and schedules cleanup. The broad name hides those side effects.  
**Suggestion:** Rename it to something like `createInitializedDocsSourceFixture` or split it into `createDocsFixture` plus `createInitializedDocsSource` so the temp filesystem and container initialization responsibilities are clearer.

### 23. 1. Avoid unbounded directory reads
**File:** `tests/unit/flow/ctx-dispatch.test.js`  
**Issue:** `fs.readdirSync(dir, { withFileTypes: true })` loads the entire directory before `MAX_SKILL_SCAN_ENTRIES` can be enforced. That weakens the `bounded-resource-usage` guardrail for very large directories.  
**Suggestion:** Use `fs.opendirSync()` with iterative `readSync()`/`closeSync()` so the scan can stop as soon as the entry limit is exceeded, without materializing all entries first.

### 24. 2. Clarify scan state naming
**File:** `tests/unit/flow/ctx-dispatch.test.js`  
**Issue:** `state.count` is vague; it specifically tracks markdown files, while `state.entries` tracks all directory entries.  
**Suggestion:** Rename `count` to `markdownFileCount` or `fileCount` to make the limit checks self-documenting.

### 25. 1. Clarify helper parameter naming
**File:** `tests/unit/flow/prompt-i18n.test.js`  
**Issue:** `getPromptEnvelope(tmp, promptId)` uses `tmp`, but the value is specifically passed as `SDD_FORGE_WORK_ROOT`. The generic name makes the helper’s contract less obvious.  
**Suggestion:** Rename the parameter to `workRoot` or `flowRoot`, and use that in the env assignment: `SDD_FORGE_WORK_ROOT: workRoot`.

### 26. 2. Reduce repeated setup in prompt tests
**File:** `tests/unit/flow/prompt-i18n.test.js`  
**Issue:** Each prompt test repeats the same `tmp = createTmpDir(); setupFlowState(tmp, "<lang>"); const envelope = ...` sequence.  
**Suggestion:** Add a small helper such as `loadPromptForLang(lang, promptId)` that creates the temp dir, sets up flow state, and returns the parsed envelope. This keeps the tests focused on assertions while preserving the existing behavior.

### 27. 1. Remove redundant disallowed git pattern
**File:** `tests/unit/flow/skill-no-external-deps.test.js`
**Issue:** `DISALLOWED_COMMAND_PATTERNS` contains two git regexes where the second is fully covered by the first, since both include `add`, `commit`, `checkout`, `status`, `rev-parse`, `log `, and `push `.
**Suggestion:** Delete the second git regex and keep one git pattern plus the `gh` pattern. This preserves behavior while reducing duplicate matching logic.

### 28. I’ll check the surrounding test file so the proposals stay scoped to the actual local patterns rather than just the snippet.The provided cwd appears to be an empty temporary workspace rather than the repo root, so I’ll base the review on the diff text you supplied.### 1. Make the Legacy Include Assertion More Specific
**File:** `tests/unit/lib/include.test.js`  
**Issue:** The negative test only asserts `/Include not found/`, so it could pass for unrelated resolution failures, such as a missing fixture path or malformed include handling.  
**Suggestion:** Assert that the thrown error references the legacy namespace/path, or otherwise verifies the failure is specifically caused by rejecting `@templates/partials/shared.md`.

### 29. 2. Rename the Fixture Helper for Clarity
**File:** `tests/unit/lib/include.test.js`  
**Issue:** `setupSkillsPartial()` sounds like it sets up one partial, but it also creates a temp base directory, the `skills/partials` hierarchy, and returns resolver options.  
**Suggestion:** Rename it to something like `setupSkillsPartialFixture()` or `createSkillsPartialFixture()` to better match its role in the tests.

### 30. 1. Clarify setup helper side effects
**File:** `tests/unit/lib/skills-include.test.js`
**Issue:** `createConfiguredTmpProject()` both mutates the outer `tmp` variable and returns it. That hidden cleanup side effect is easy to miss because the name sounds like a pure factory.
**Suggestion:** Rename it to something like `setupConfiguredTmpProject()` or assign `tmp` in each test and make the helper accept `projectDir`, so cleanup ownership is explicit.

### 31. 1. Preserve Path-Safety Regression Coverage
**File:** `tests/unit/templates/worktree-mode.test.js`  
**Issue:** Deleting this whole test removes coverage for the Edit/Write absolute-path guard and the existing `cd`, `git stash`, and baseline-comparison requirements. That makes future template regressions easier to miss.  
**Suggestion:** Restore the test file and update only the obsolete path, test name, or assertions that no longer match the renamed template structure. If the template behavior was intentionally removed, keep a narrower test that asserts the replacement behavior instead of dropping coverage entirely.

### 32. 3. Standardize Bounded Directory Loading
**File:** `src/lib/skills.js`
**Issue:** Several files introduce or discuss directory/file bulk loading limits, but the limits appear inconsistent: `src/lib/skills.js`, `tests/e2e/051-skill-namespace.test.js`, and `tests/unit/flow/ctx-dispatch.test.js` each handle scan bounds differently.
**Suggestion:** Define shared naming and limit semantics for skill/source scans, then mirror those expectations in tests so production and test guardrails do not drift.

### 33. 4. Align Include Alias Naming Across Code And Tests
**File:** `src/lib/include.js`
**Issue:** The migration introduces `@skills/...` include paths while tests also assert legacy `@templates/...` rejection. Helper names like `resolvePrefixedPath()` may obscure whether the supported interface is alias resolution, root-relative resolution, or both.
**Suggestion:** Make the include API explicit with a domain name such as `resolveAliasedIncludePath()`, document supported aliases, and ensure tests assert both accepted `@skills/...` and rejected legacy `@templates/...` behavior.
