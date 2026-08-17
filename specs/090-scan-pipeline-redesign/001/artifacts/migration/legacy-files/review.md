# Code Review Results

### [x] 1. Extract shared parser helpers instead of duplicating scan and parse logic
**File:** `src/presets/laravel/data/controllers.js`
**Issue:** The new entry-based pipeline keeps both `parse()` logic and a second directory-level analyzer (`analyzeControllers` / `parseControllerScan`) in the same file. The same duplication appears in many presets (`laravel`, `symfony`, `nextjs`, `workers`, `drizzle`, `graphql`, `cakephp`). This increases drift risk when one path changes and the other is forgotten.
**Suggestion:** Move the actual extraction logic into shared pure helpers such as `parseControllerContent()` / `parseRouteFile()` / `parseMigrationContent()`, then call those from both `parse(absPath)` and the test-oriented `analyze*()` wrappers. Keep `data/*.js` focused on DataSource behavior and reuse the same parser implementation everywhere.

**Verdict:** APPROVED
**Reason:** The diff confirms massive code duplication — every `data/*.js` file now contains both `parse()` methods and directory-level `analyze*()` functions with near-identical parsing logic (e.g., `parseConstants` appears twice in `config.js`, `parseBlueprint` is duplicated between Laravel's `tables.js` parse and directory-level analyzer). Extracting shared pure helpers would reduce drift risk without changing behavior.

### [ ] 2. Remove the now-dead `scan()` marker method from `Scannable`
**File:** `src/docs/lib/scan-source.js`
**Issue:** `Scannable` still defines an empty `scan()` method only as a marker, but `loadScanSources()` now detects scannable sources via `typeof instance.parse === "function"`. That makes the `scan()` method dead code and the comments around it misleading.
**Suggestion:** Delete the dummy `scan()` method and update the class comment to describe `match(relPath)` + `parse(absPath)` as the only contract. If a marker is still needed, use an explicit static flag instead of an unused method name that suggests runtime behavior.

**Verdict:** REJECTED
**Reason:** The diff in `scan-source.js` shows that `scan()` was intentionally kept as a marker method with a comment: "Marker method for Scannable detection. ... external code can identify scannable DataSources via `typeof ds.scan === 'function'`." Meanwhile `loadScanSources` in `scan.js` was changed to use `typeof instance.parse === "function"`. The marker method is intentionally retained for backward compatibility with external code — removing it could break detection logic elsewhere. The proposal's premise that detection moved entirely to `parse` is only partially true.

### [x] 3. Centralize repeated analysis metadata constants
**File:** `src/docs/commands/scan.js`
**Issue:** `ANALYSIS_META_KEYS` / `META_KEYS` are redefined in many files (`scan.js`, `review.js`, `text.js`, `forge-prompts.js`, `text-prompts.js`, `structure.js`, `monorepo.js`, `enrich.js`). Even after cleanup, this is still duplicated knowledge that can drift again.
**Suggestion:** Export a single shared constant such as `ANALYSIS_META_KEYS` from a docs utility module and import it everywhere. That removes repetition and makes future schema changes safe.

**Verdict:** APPROVED
**Reason:** The diff shows `ANALYSIS_META_KEYS` redefined in `scan.js`, `review.js`, `text.js`, `forge-prompts.js`, `text-prompts.js`, `structure.js`, `monorepo.js`, and `enrich.js` — all with the same value `new Set(["analyzedAt", "enrichedAt", "generatedAt"])`. This is textbook duplicated knowledge that will drift when new meta keys are added. A single shared export eliminates this class of bug with zero behavioral risk.

### [x] 4. Split oversized multi-responsibility DataSource modules
**File:** `src/presets/cakephp2/data/config.js`
**Issue:** This file now contains DataSource wiring, many per-file parsers, field aggregation helpers, resolver methods, and legacy directory-level analyzers. It mixes several responsibilities and is much harder to read or review than the old layout.
**Suggestion:** Keep `ConfigSource` small and move parsing helpers into focused modules like `config-parsers.js`, `config-aggregators.js`, and `config-analyzers.js`. This preserves the new entry-based design without turning `data/*.js` into monoliths.

**Verdict:** APPROVED
**Reason:** `config.js` for CakePHP2 grew from ~55 lines to ~830 lines in this diff, inlining 11 separate parsers (`parseConstants`, `parseBootstrap`, `parseAppController`, `parseAppModel`, `parseAssets`, `parseAcl`, `parsePermissionComponent`, `parseLogicClasses`, `parseTitlesGraphMapping`, `parseComposerDeps`, `parseCommandDetails`) plus directory-level analyzers. This is objectively harder to review and maintain. Splitting parsing helpers into focused modules preserves the entry-based design while restoring readability.

### [x] 5. Remove unused imports left behind by the refactor
**File:** `src/presets/cakephp2/data/commands.js`
**Issue:** `extractArrayBody` and `extractQuotedStrings` are imported but not used. Similar cleanup is likely needed in other refactored files that inlined old scan modules.
**Suggestion:** Remove unused imports and run a repo-wide pass for the same pattern. This reduces noise and makes the actual parsing dependencies clearer.

**Verdict:** APPROVED
**Reason:** The diff in `commands.js` imports `extractArrayBody` and `extractQuotedStrings` from `php-array-parser.js` but the `parse()` method doesn't use them (it uses inline regex patterns instead). Unused imports are concrete dead code that obscures actual dependencies. This is a safe cleanup with zero behavioral risk.

### [ ] 6. Use clearer discriminator names for entry kinds
**File:** `src/presets/nextjs/data/routes.js`
**Issue:** The file uses both `routeType` and `fileType`, where `routeType` means entry category (`app` / `page` / `handler`) and `fileType` means Next.js file role (`page` / `layout` / `route-handler`). Those names are easy to confuse.
**Suggestion:** Rename them to something less ambiguous, for example `entryKind` and `routeFileKind`, or `routerCategory` and `specialFileType`. The same principle applies to generic names like `kind`, `configType`, and `libType` across presets.

**Verdict:** REJECTED
**Reason:** This is a cosmetic rename (`routeType` → `entryKind`, `fileType` → `routeFileKind`) that touches multiple files across presets, test assertions, and resolve methods. The current names are adequate — `routeType` discriminates app/page/handler categories and `fileType` discriminates Next.js file roles. The rename introduces churn and migration risk (serialized `analysis.json` files, template references) for negligible clarity gain.
