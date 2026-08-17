# Code Review Results

### [x] 1. Reuse the Shared `gh` Availability Helper
**File:** `src/flow/commands/merge.js`  
**Issue:** This file reintroduces a local `isGhAvailable()` even though `src/lib/git-state.js` already exposes the same capability check. That duplicates behavior and can drift over time.  
**Suggestion:** Remove the local helper and import `isGhAvailable` from `src/lib/git-state.js` so all `gh` detection uses one implementation.

**Verdict:** APPROVED
**Reason:** The diff clearly shows `merge.js` removed the import of `isGhAvailable` from `src/lib/git-state.js` and reintroduced a local implementation that lacks the `timeout: 5000` protection present in the shared version (it uses bare `stdio: "ignore"` instead). Meanwhile `git-state.js` still exports `isGhAvailable()` using `tryExec` with a 5-second timeout. This is genuine behavioral drift — the shared version is more robust, and having two implementations creates a real maintenance risk. Consolidating back to the shared import is correct and low-risk.

### [ ] 2. Centralize Argument Parsing Instead of Reimplementing It
**File:** `src/flow.js`  
**Issue:** `parseEntryArgs()` manually splits positional arguments from flags/options, duplicating parsing logic that already belongs in `parseArgs()`. It also creates inconsistent behavior across command shapes, especially for positional-only commands and help handling.  
**Suggestion:** Move positional support into `parseArgs()` or add a small shared wrapper around it, then have `runEntry()` use that single path for all commands.

**Verdict:** REJECTED
**Reason:** The new `parseEntryArgs()` in `flow.js` is purpose-built to bridge registry-declared `args` definitions (positional, flags, options) with `parseArgs()`. It's not duplicating `parseArgs()` — it's an orchestration layer that separates positional values from flag/option values before delegating to `parseArgs()`. Merging this into `parseArgs()` itself would bloat a general-purpose utility with flow-specific concerns (registry `args` shape, positional mapping). The current separation is appropriate. The proposal conflates "uses parseArgs internally" with "duplicates parseArgs."

### [ ] 3. Standardize `redo` Terminology in Code-Level Names
**File:** `src/flow/commands/report.js`  
**Issue:** The rename back to `redo` is only partially reflected in naming: the command is `redo`, the file is `redolog.json`, and the code uses identifiers like `redolog` and `redo`. That mixes command naming with data-model naming and makes the intent harder to scan.  
**Suggestion:** Pick one internal convention, such as `redoLog` / `RedoLog`, and use it consistently for variables, data keys, and rendered labels while keeping the CLI command name `redo`.

**Verdict:** REJECTED
**Reason:** This diff is *reverting* the `issue-log` rename back to `redo` (undoing spec #129). The naming is already consistent within this revert: CLI command is `redo`, file is `redolog.json`, variables use `redolog`/`RedoLog`. The proposal claims naming is "partially reflected" but the diff shows complete consistency — `redo` throughout. Renaming to `redoLog` (camelCase) would be cosmetic churn with no functional benefit and would create inconsistency with the kebab-case file naming convention used elsewhere in the project.

### [ ] 4. Reduce Registry Boilerplate With Command Definition Helpers
**File:** `src/flow/registry.js`  
**Issue:** The new registry structure repeats the same metadata pattern many times across `get`, `set`, and `run` entries: `helpKey`, `command`, `args`, and `help`. The file is becoming a large block of near-ceremonial configuration.  
**Suggestion:** Extract small builders such as `definePositionalCommand()` or `defineFlagCommand()` to generate common entry shapes, keeping the registry declarative while reducing duplication and improving consistency.

**Verdict:** REJECTED
**Reason:** The registry entries are not actually duplicative in a harmful way — each entry has a unique combination of `helpKey`, `command`, `args` (varying positional/flags/options), `help` text, and optional hooks (`pre`, `post`, `onError`, `finally`). Builder functions like `definePositionalCommand()` would need so many parameters they'd be no simpler than the current object literals. The registry is declarative and scannable as-is. Adding abstraction here would obscure what each entry does and make it harder to add entries with custom hooks. This is premature abstraction over configuration that is already clear.
