# Code Review Results

### [x] 1. Centralize `deploySkills` error handling
**File:** `src/setup.js`
**Issue:** `setupSkills()` now wraps `deploySkills()` in a `try/catch`, and `src/upgrade.js` adds the same pattern. This duplicates CLI error-handling logic and mixes process termination into helper-level code.
**Suggestion:** Extract a shared wrapper such as `runDeploySkillsOrExit()` for CLI entrypoints, or let `deploySkills()` throw and handle termination only in top-level `main()` functions. Keep `setupSkills()` as a pure helper.

**Verdict:** APPROVED
**Reason:** The diff shows identical `try/catch → console.error → process.exit(1)` blocks added in both `setup.js` and `upgrade.js`. This is textbook duplication of CLI-level error handling pushed into helper functions. Extracting a shared wrapper or letting `deploySkills()` throw with termination only in `main()` would eliminate the duplication and keep helper functions composable (e.g., testable without mocking `process.exit`). Low risk — the control flow is simple and the refactoring is mechanical.

### [x] 2. Remove or rename the now-misleading language-based API
**File:** `src/lib/skills.js`
**Issue:** `resolveSkillFile()` no longer resolves by language, but `deploySkills(workRoot, lang, opts)` still accepts `lang`, and callers still pass it as if template selection were localized. That makes the API misleading and leaves dead intent in the interface.
**Suggestion:** If skill selection is now always `SKILL.md`, remove `lang` from `resolveSkillFile()` callers and consider removing it from `deploySkills()` as well unless it is strictly needed for include resolution. If it must stay, rename variables/comments to make it clear that `lang` affects include expansion only, not template file selection.

**Verdict:** APPROVED
**Reason:** The diff clearly shows `resolveSkillFile()` no longer accepts or uses `lang` — it always resolves `SKILL.md`. Yet `deploySkills(workRoot, lang, opts)` still accepts `lang` and callers still pass `config.lang`. The `lang` parameter now only feeds into `resolveIncludes()` for include expansion, not template selection. Cleaning up the signature (or at minimum documenting the actual purpose of `lang`) removes a genuine source of confusion. This aligns with the project's alpha-period policy of not maintaining backward-compatible dead code.

### [ ] 3. Preserve design consistency around localization
**File:** `src/templates/skills/sdd-forge.flow-plan/SKILL.md`
**Issue:** The change deletes `SKILL.ja.md` files and always deploys `SKILL.md`, but the setup/upgrade flow still appears language-aware. That creates a design mismatch: the public API suggests localized skill deployment, while the templates are now effectively English-only with embedded Japanese fragments removed.
**Suggestion:** Choose one model and make it explicit. Either fully adopt a single-source template model and remove language-oriented deployment semantics, or keep separate localized outputs and generate them consistently from shared partials.

**Verdict:** REJECTED
**Reason:** This is an architectural observation, not a concrete refactoring proposal. The diff already *is* the decision: `SKILL.ja.md` files are deleted, `SKILL.en.md` is renamed to `SKILL.md`, and `resolveIncludes` handles any language-dependent expansion via the `lang` option. The "choose one model" suggestion is already implemented by the diff — it chose the single-source template model with include-time localization. The proposal doesn't identify a concrete code change that would improve quality beyond what's already done.

### [ ] 4. Improve naming around raw vs resolved template content
**File:** `src/lib/skills.js`
**Issue:** `rawContent` and `srcContent` are serviceable, but `srcContent` is no longer the source file content; it is the post-processed, include-resolved content. That makes the transformation step less clear.
**Suggestion:** Rename `srcContent` to `resolvedContent` and `srcPath` to `templatePath` for clearer intent: read template, resolve includes, write deployed result.

**Verdict:** REJECTED
**Reason:** Cosmetic-only rename. `rawContent` and `srcContent` are local variables within a single loop body (~15 lines of scope). The transformation from raw→resolved is immediately obvious from the adjacent `resolveIncludes()` call. Renaming `srcPath` to `templatePath` would also diverge from the existing naming pattern used elsewhere in the codebase. The cognitive load improvement is negligible for variables with such narrow scope, and the churn adds noise to git history without meaningful quality gain.
