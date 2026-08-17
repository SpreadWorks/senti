# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Full upgrade has a second write path for existing creating_presets.md
**Target:** Constraints / R2 / implementationTargets
**Issue:** The spec says existing project-local `.senti/templates/*/docs/creating_presets.md` files are user-owned and `upgrade` must not overwrite, append to, delete, or otherwise manage them, but the observable requirement only covers `deployPresetCopies()`. In existing code, `src/upgrade.js` runs `RenameMigration` before `deployPresetCopies()`, and `RenameMigration.listTextTargets()` does not exclude `.senti/templates/*/docs/creating_presets.md`; it can rewrite text in those files when legacy rename tokens are present.
**Required change:** Either narrow the user-owned invariant to the `deployPresetCopies()` path, or add a requirement and implementation target covering `src/upgrade.js`/`RenameMigration` so full `senti upgrade` leaves `.senti/templates/*/docs/creating_presets.md` unchanged.
**Why blocking:** An implementation that only removes the `deployPresetCopies()` language loop can satisfy R1/R2 while `senti upgrade` still modifies an existing user-owned `creating_presets.md` through `RenameMigration`, making the stated upgrade-level safety requirement untestable and potentially false.


## Non-blocking Improvements

### 1. Mention dead-code cleanup target
**Target:** T-1 / src/lib/preset-deploy.js
**Improvement:** The spec could explicitly note that removing the language loop likely makes `CREATING_PRESETS_RUBRIC_NOTE` and `upsertText()` unused and eligible for removal in the same file.
**Why non-blocking:** The implementation target is already clear, and a normal edit can discover the dead code locally.

### 2. Clarify result path shape
**Target:** AC2
**Improvement:** AC2 could state whether assertions should treat `deployPresetCopies()` results as absolute paths and normalize with `path.relative()` or suffix checks.
**Why non-blocking:** Current code returns destination path strings, and the acceptance wording is still testable with path normalization.
