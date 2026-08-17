# Code Review Results

### [x] Based on my analysis of the diff and the actual source files, here are my proposals:
---

**Verdict:** APPROVED
**Reason:** The analysis shows `src/api.js` and `src/loader.js` are new files, both referencing the `sdd-forge/api` specifier. Without an `exports` map, Node.js will not resolve `sdd-forge/api` to `src/api.js` because the `files` field publishes only `src/`, placing `api.js` one directory deeper than the package root. Any external preset author importing `from 'sdd-forge/api'` will get `ERR_PACKAGE_PATH_NOT_EXPORTED`. This is a real runtime failure on install, not a hypothetical.

### [x] 1. `package.json` missing `exports` field — `sdd-forge/api` specifier is unresolvable
**File:** `package.json`
**Issue:** `src/api.js` is documented and intended to be imported as `sdd-forge/api`, but `package.json` has no `exports` map. Without it, Node.js resolves `sdd-forge/api` by looking for `api.js` at the package root — which doesn't exist — and throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. The feature's core use-case (external preset files doing `import { DataSource } from 'sdd-forge/api'`) silently fails on install.
**Suggestion:** Add an `exports` field:
```json
"exports": {
  ".": "./src/sdd-forge.js",
  "./api": "./src/api.js",
  "./loader": "./src/loader.js"
}
```
This is the standard Node.js mechanism and removes the dependency on the loader hook being active.

---

**Verdict:** APPROVED
**Reason:** The analysis.json entry for `src/sdd-forge.js` lists its imports as `["node:path", "node:url", "src/lib/cli.js", "src/lib/exit-codes.js", "src/lib/log.js", "src/lib/process.js"]` — `node:module` and `./loader.js` are absent. The loader's JSDoc documents registration that never happens, making it dead code. If the loader is the fallback resolution path for `sdd-forge/api` (when the `exports` map from proposal 1 is absent), this compounds that failure. Either the `register()` call needs adding to `src/sdd-forge.js`, or the JSDoc comment needs correcting to reflect that the `exports` map (proposal 1) is the intended mechanism.

### [x] 2. ESM loader hook defined but never registered
**File:** `src/loader.js` / `src/sdd-forge.js`
**Issue:** `src/loader.js` has a JSDoc comment saying *"Registered at sdd-forge startup via module.register()"*, but `src/sdd-forge.js` contains no such call. The loader is therefore inert: any `.sdd-forge/data/` file or external preset that imports `sdd-forge/api` will fail with a module-not-found error unless fix #1 (exports map) is also applied.
**Suggestion:** Register the loader early in `src/sdd-forge.js`, before any dynamic imports of user data files:
```js
import { register } from "node:module";
register("./loader.js", import.meta.url);
```
Alternatively, document that the exports map (proposal 1) is the primary resolution mechanism and narrow the loader's responsibility to only the dynamic-import case inside `data-source-loader.js`.

---

**Verdict:** APPROVED
**Reason:** The analysis confirms that after this diff `laravel/commands.js` still lists `"../../webapp/data/commands.js"` twice in its imports array (likewise for the three other files). The review.md for the prior spec explicitly APPROVED this consolidation but it was never applied. Merging `import Default from "…"` and `import { Named } from "…"` into a single declaration is idiomatic ESM, eliminates a maintenance footgun where the two lines can drift to different paths, and carries zero behavioral risk.

### [x] 3. Duplicate imports from the same module in four preset files
**File:** `src/presets/laravel/data/commands.js`, `src/presets/laravel/data/controllers.js`, `src/presets/laravel/data/routes.js`, `src/presets/symfony/data/commands.js`
**Issue:** Each file imports a default export and a named export from the same specifier on two separate lines, e.g.:
```js
import CommandsSource from "../../webapp/data/commands.js";
import { CommandEntry } from "../../webapp/data/commands.js";
```
This was flagged as **APPROVED** in `specs/165-fix-datasource-match-monorepo/review.md` (proposal #3) but was not implemented.
**Suggestion:** Merge into a single import per module:
```js
import CommandsSource, { CommandEntry } from "../../webapp/data/commands.js";
```
Apply the same to `ControllersSource`/`ControllerEntry` and `RoutesSource`/`RouteEntry`.

---

**Verdict:** APPROVED
**Reason:** This is the most serious finding in the set. The diff unambiguously deletes `src/presets/lib/path-match.js`, deletes `tests/unit/presets/monorepo-match-regression.test.js`, and replaces every `hasPathPrefix()` / `hasSegmentPath()` call with `startsWith()` or a `^`-anchored regex — the exact patterns that Issue #128 and spec `165-fix-datasource-match-monorepo` were written to fix. For example, `"packages/shop/app/Config/bootstrap.php".startsWith("app/Config/")` is `false`, so a CakePHP2 project nested under `packages/shop/` will now produce no documentation output. The retro.json for the prior spec confirms 100% requirement satisfaction and this regression wipes it out entirely. The fix must restore the `(^|/)` boundary-safe pattern — either by restoring `path-match.js` with its test suite, or inlining the pattern as described in the proposal.

### [ ] 4. Monorepo path regression: `startsWith()` / root-anchored regex reverts Issue #128 fix
**File:** `src/presets/laravel/data/*.js`, `src/presets/symfony/data/*.js`, `src/presets/cakephp2/data/*.js`, `src/presets/nextjs/data/*.js`
**Issue:** This diff deletes `src/presets/lib/path-match.js` and reverts all preset `match()` methods from the boundary-safe `(^|/)` regex pattern back to `startsWith()` and `^`-anchored regex. Both approaches only match root-level paths. A file at `packages/shop/app/View/Users/index.ctp` (nested monorepo) returns `false` for `cakephp2/views`, and `apps/api/app/Http/Controllers/User.php` returns `false` for `laravel/controllers`. This re-introduces the exact regression that GitHub Issue #128 and spec `165-fix-datasource-match-monorepo` were written to fix, and removes the regression test suite `tests/unit/presets/monorepo-match-regression.test.js` along with it.
**Suggestion:** Restore the `(^|/)` segment-boundary pattern. The simplest self-contained fix that doesn't require the shared helper file is to use it inline:
```js
// laravel/controllers.js
match(relPath) {
  return /(?:^|\/)app\/Http\/Controllers\//.test(relPath)
    && relPath.endsWith(".php")
    && !relPath.endsWith("/Controller.php");
}
```
Alternatively, restore `src/presets/lib/path-match.js` and its tests.

---

**Verdict:** REJECTED
**Reason:** This is a style-only proposal with no behavioral impact. All three current styles — inline anchored regex, `startsWith()`, and named regex constants — produce identical results for their inputs. Standardizing on named constants would be a cosmetic improvement, but the value is marginal and the risk of introducing subtle differences during mechanical transformation is non-zero. More importantly, proposal 4 (which is a correctness fix, not a style fix) must be addressed first; the correct pattern to standardize on is `(?:^|\/)`, not `^`, which means any style consolidation is blocked on the regression fix anyway.

### [ ] 5. Inconsistent `match()` pattern style across presets
**File:** `src/presets/cakephp2/data/*.js`, `src/presets/laravel/data/*.js`, `src/presets/symfony/data/*.js`, `src/presets/nextjs/data/components.js`, `src/presets/nextjs/data/routes.js`
**Issue:** Three different styles coexist for the same purpose (path prefix checking):
- `cakephp2` — inline anchored regex per condition: `/^app\/Config\//.test(relPath)`
- `laravel` / `symfony` — string method: `relPath.startsWith("app/Console/Commands/")`
- `nextjs` — named regex constant: `const COMPONENT_DIRS = /^(app|...)\//`

The `nextjs` approach (extracting to a named constant) is the most readable and is consistent with how `COMPONENT_EXT` and `ROUTE_EXT` are already defined in those files. The mixed use of `startsWith` vs inline regex vs named regex in the same codebase makes match conditions harder to audit.
**Suggestion:** Standardise on named regex constants for all multi-condition `match()` bodies. At minimum, consolidate the eight inline regexes in `cakephp2/config.js` into named constants following the pattern nextjs already uses:
```js
const CONFIG_PATHS = /(?:^|\/)app\/Config\//;
const WEBROOT_PATHS = /(?:^|\/)app\/webroot\/(?:js|css)\//;
```

**Verdict:** REJECTED
**Reason:** No verdict provided
