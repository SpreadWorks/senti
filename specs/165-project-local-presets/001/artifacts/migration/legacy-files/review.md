# Code Review Results

### [x] 1. Monorepo path matching regression in preset `match()` methods
**File:** `src/presets/laravel/data/commands.js`, `src/presets/laravel/data/controllers.js`, `src/presets/laravel/data/routes.js`, `src/presets/laravel/data/models.js`, `src/presets/laravel/data/tables.js`, `src/presets/laravel/data/config.js`, `src/presets/symfony/data/*.js`, `src/presets/cakephp2/data/config.js`, `src/presets/nextjs/data/components.js`
**Issue:** `path-match.js` was deleted and all `match()` methods reverted from `hasPathPrefix()` / `hasSegmentPath()` to `relPath.startsWith(...)` or root-anchored `^` regex. This reintroduces the monorepo regression fixed in issue #128: when a project root is `apps/api/`, files like `apps/api/app/Models/User.php` arrive as full relative paths, so `relPath.startsWith("app/Models/")` silently misses them.
**Suggestion:** Restore `path-match.js` (or inline the boundary-safe pattern as a shared helper in `src/presets/lib/`) and re-apply `hasPathPrefix()` in all affected `match()` methods. The deleted test file `tests/unit/presets/monorepo-match-regression.test.js` should also be restored to prevent future regressions.

---

**Verdict:** APPROVED
**Reason:** This is a genuine correctness regression, not a style concern. The diff conclusively shows `src/presets/lib/path-match.js` deleted and every `hasPathPrefix()` / `hasSegmentPath()` call reverted to `startsWith()` or `^`-anchored regex. These only match root-level paths; a file like `apps/api/app/Http/Controllers/User.php` will silently produce no documentation in a monorepo layout. Issue #128 and spec `165-fix-datasource-match-monorepo` were specifically written to fix this — the retro confirms 100% requirement satisfaction — and this diff wipes it out entirely, including the regression test suite. Restoring the `(^|/)` boundary-safe pattern (either via the shared helper or inlined) is required to preserve the previously guaranteed behavior.

### [x] 2. Duplicate imports from the same module in preset files
**File:** `src/presets/laravel/data/commands.js`, `src/presets/laravel/data/controllers.js`, `src/presets/laravel/data/routes.js`, `src/presets/symfony/data/commands.js`
**Issue:** Each file imports both the default export and a named export from the same module as two separate `import` statements, e.g.:
```js
import CommandsSource from "../../webapp/data/commands.js";
import { CommandEntry } from "../../webapp/data/commands.js";
```
This is redundant — both can be combined into a single import declaration.
**Suggestion:** Merge each pair into one statement:
```js
import CommandsSource, { CommandEntry } from "../../webapp/data/commands.js";
```
Apply consistently to all four files (`commands.js` ×2, `controllers.js`, `routes.js`).

---

**Verdict:** APPROVED
**Reason:** Merging two `import` statements that reference the same specifier into one declaration is idiomatic ES module style and carries zero behavioral risk — the module cache deduplicates regardless. The four affected files (`laravel/commands.js`, `laravel/controllers.js`, `laravel/routes.js`, `symfony/commands.js`) all show the pattern clearly in the diff. This eliminates the maintenance footgun where the two lines could drift to different paths in a future refactor.

### [ ] 3. Deprecation warning bypasses the module logger
**File:** `src/docs/lib/resolver-factory.js`
**Issue:** The deprecation warning for `.sdd-forge/data/` is emitted via `process.stderr.write(...)` directly, while the module already defines `const logger = createLogger("resolver")` at the top level. This is inconsistent with every other warning/log call in the file and across the codebase, and loses structured logging benefits (verbosity filtering, prefix consistency).
**Suggestion:** Replace the raw write with `logger.warn(...)`:
```js
// before
process.stderr.write(`[sdd-forge] WARN: .sdd-forge/data/ is deprecated. Move DataSources to .sdd-forge/presets/<type>/data/ instead.\n`);

// after
logger.warn(".sdd-forge/data/ is deprecated. Move DataSources to .sdd-forge/presets/<type>/data/ instead.");
```

---

**Verdict:** REJECTED
**Reason:** The `createLogger` utility in `src/lib/progress.js` is documented as providing "info and error variants" — there is no evidence of a `.warn()` method. Calling `logger.warn()` if undefined would throw, replacing a functioning deprecation warning with an unhandled exception. The current `process.stderr.write` is explicit and correct. The consistency benefit does not justify the risk of a runtime failure on the deprecation code path.

### [ ] 4. Inconsistent `match()` pattern styles across preset files
**File:** `src/presets/cakephp2/data/config.js`, `src/presets/nextjs/data/components.js` (vs. laravel/symfony preset files)
**Issue:** Different preset files use three different matching styles: `relPath.startsWith(prefix)` (laravel/symfony), inline `RegExp` construction with `^`-anchored pattern (cakephp2: `/^app\/Config\//.test(relPath)`), and module-level compiled `RegExp` constants (nextjs: `const COMPONENT_DIRS = /^(app|components|...)\//`). There is no single convention.
**Suggestion:** Establish one pattern (preferably the boundary-safe helper from Proposal 1) and apply it uniformly. If path-match helpers are restored, replace all three variants. If `startsWith` is deliberately chosen for simplicity, consolidate cakephp2 and nextjs to match — remove the inline regex construction in cakephp2 and the module-level constant in nextjs in favor of the same `startsWith` calls used by the other presets.

---

**Verdict:** REJECTED
**Reason:** This is cosmetic-only and is directly blocked by Proposal 1. All three current style variants (`startsWith`, `^`-anchored regex, named regex constants) are variations of the *wrong* pattern after the monorepo regression — none of them correctly handle nested paths. Any style consolidation must wait until Proposal 1 is resolved; the correct style to standardize on is `(?:^|\/)`, not any of the three currently present. Consolidating incorrect patterns into a single incorrect pattern is not an improvement.

### [x] 5. `resolveChainSafe` error fallback ignores project-local presets
**File:** `src/lib/presets.js`
**Issue:** When `resolveChain(presetKey, projectRoot)` throws, the `catch` block falls back using only `PRESETS.find(p => p.key === presetKey)` — the built-in preset list. If the failing preset was a project-local-only preset (exists in `.sdd-forge/presets/` but not in `PRESETS`), the fallback returns `null` or an empty array, silently dropping the preset instead of returning what `resolveProjectPreset` would have resolved.
**Suggestion:** In the catch block, also attempt `resolveProjectPreset(presetKey, projectRoot)` when `projectRoot` is provided, and use its result as the fallback before giving up:
```js
} catch (err) {
  logger.verbose(`resolveChain failed for "${presetKey}": ${err.message}`);
  if (projectRoot) {
    const local = resolveProjectPreset(presetKey, projectRoot);
    if (local) return [local];
  }
  const preset = PRESETS.find((p) => p.key === presetKey);
  if (preset) return [preset];
  ...
}
```

**Verdict:** APPROVED
**Reason:** This is a real correctness gap in the new project-local preset feature introduced in this diff. `resolveChain` is extended to check `.sdd-forge/presets/<key>/` first, but the `catch` block in `resolveChainSafe` only searches `PRESETS` (the built-in list). A project-local-only preset that causes a chain resolution error (e.g., a misconfigured `parent` field) will silently drop to `null` or `[]` rather than returning what it can resolve. The proposed fix adds `resolveProjectPreset(presetKey, projectRoot)` as an intermediate fallback before giving up, which is consistent with how the rest of `presets.js` handles project-local overrides and carries minimal risk since it is in the error-recovery path only.
