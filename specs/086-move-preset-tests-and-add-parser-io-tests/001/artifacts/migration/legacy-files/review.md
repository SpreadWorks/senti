# Code Review Results

### [x] 1. Consolidate test discovery into one runner
**File:** `package.json`
**Issue:** `test:unit` and `test:e2e` now duplicate shell-based file discovery logic, while `test` already delegates to `node tests/run.js`. This creates two execution paths for the same concern and makes option handling, filtering, and edge cases (`xargs` with no matches, shell portability) inconsistent.
**Suggestion:** Move unit/e2e discovery into `tests/run.js` as well, and make `test:unit` / `test:e2e` thin wrappers such as `node tests/run.js --scope unit` and `node tests/run.js --scope e2e`.

**Verdict:** APPROVED
**Reason:** The inconsistency is real and material. `test` uses `node tests/run.js` (which already handles both `tests/` and `src/presets/*/tests/` discovery with proper `--preset` filtering), while `test:unit` and `test:e2e` use raw shell `find | xargs` with different discovery logic and no portability guarantees. Unifying through `node tests/run.js --scope unit` would eliminate the dual-path maintenance burden and bring consistent behavior (e.g., `xargs` with zero matches can invoke `node --test` with no files on some systems). `run.js` already has the infrastructure to support this.

### [ ] 2. Tighten the npm exclusion glob for preset tests
**File:** `package.json`
**Issue:** `!src/presets/*/tests/` excludes the directory entry, but it is less explicit than excluding the directory contents. That makes the packaging intent harder to read and easier to misinterpret.
**Suggestion:** Replace it with `!src/presets/*/tests/**` so the exclusion clearly targets all nested test files and matches the stated design more directly.

**Verdict:** REJECTED
**Reason:** This is cosmetic. npm's `files` field with `!src/presets/*/tests/` already correctly excludes the directory and its contents from the package. Changing to `!src/presets/*/tests/**` doesn't change packaging behavior — npm treats directory exclusions by excluding all contents. The "readability" argument is subjective and doesn't justify a change that could introduce doubt about whether the directory entry itself is included.

### [x] 3. Remove duplicated documentation about preset tests
**File:** `src/AGENTS.md`
**Issue:** The new “MUST: プリセットテストの作成” section and the later “プリセット固有テスト” section describe overlapping rules about where preset tests live and how they are run. This duplicates maintenance points in the same document.
**Suggestion:** Keep one normative section for placement/rules and one short cross-reference later, or merge them into a single section with location, purpose, and execution examples together.

**Verdict:** APPROVED
**Reason:** `src/AGENTS.md` now has two sections describing essentially the same rules: "MUST: プリセットテストの作成" (lines added under プリセット作成ルール) and "プリセット固有テスト" (lines added under テスト). Both describe test placement in `tests/unit/` and `tests/e2e/`, what goes where, and how to run per-preset tests. This duplication creates a real maintenance risk — if one section is updated but not the other, the document becomes self-contradictory. Merging into a single normative section is the correct approach.

### [ ] 4. Standardize delegated scan-source design
**File:** `src/presets/hono/data/middleware.js`
**Issue:** `HonoMiddlewareSource` now delegates scanning to `analyzeMiddleware()`, which is a cleaner pattern, but the surrounding class structure still mixes old `Scannable(DataSource)` implementations and newer delegated analyzer-based implementations across presets.
**Suggestion:** Introduce a shared preset scan-data base pattern for “match files -> derive root -> call analyzer -> null on empty result” and migrate similar sources to it. That would remove repeated adapter code and make preset implementations more consistent.

**Verdict:** REJECTED
**Reason:** Premature abstraction. Currently only `HonoMiddlewareSource` uses `WebappDataSource` with the "match → deriveSourceRoot → call analyzer → null check" pattern, while `WorkersBindingsSource` still uses `Scannable(DataSource)` directly with different logic (config-file lookup, `path.dirname`). The two patterns have genuinely different semantics — one scans matched source files, the other finds a specific config file. Forcing both into a shared base would either produce a leaky abstraction or require polymorphism that adds complexity without reducing code. Wait until there are 3+ concrete instances of the same pattern before extracting.

### [x] 5. Clarify root-path naming in bindings scan delegation
**File:** `src/presets/workers/data/bindings.js`
**Issue:** `sourceRoot` is derived from `path.dirname(wranglerFile.absPath)`, which is really the project/config root rather than a source tree root. The current name is slightly misleading, especially next to APIs that genuinely operate on source roots.
**Suggestion:** Rename `sourceRoot` to `projectRoot` or `configRoot`, and align `analyzeBindings()` parameter naming to match. This makes the contract clearer and reduces cognitive overhead when comparing preset analyzers.

**Verdict:** APPROVED
**Reason:** This is a correctness improvement, not cosmetic. In `WorkersBindingsSource`, `sourceRoot` is derived from `path.dirname(wranglerFile.absPath)` — this is the directory containing the wrangler config, which is the project/config root. Meanwhile, `WebappDataSource.deriveSourceRoot()` derives the actual source tree root from file paths. Using the same name `sourceRoot` for semantically different values across the codebase creates a genuine confusion risk when comparing preset implementations. Renaming to `projectRoot` or `configRoot` makes the contract explicit and prevents future misuse in `analyzeBindings()`.
