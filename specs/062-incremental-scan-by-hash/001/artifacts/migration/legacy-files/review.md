# Code Review Results

### [x] 1. Remove unused incremental helper
**File:** `src/docs/commands/scan.js`
**Issue:** `filterDeletedEntries()` is introduced but never called. It adds cognitive overhead and suggests a partially implemented design for category-level reuse that is not actually used.
**Suggestion:** Delete `filterDeletedEntries()` if it is not needed, or integrate it into the incremental scan path so deleted-entry handling is centralized instead of left as dead code.

**Verdict:** APPROVED
**Reason:** `filterDeletedEntries()` is defined but never called anywhere in the codebase—not in scan.js, not in tests, not imported elsewhere. It is dead code that adds cognitive overhead and implies a design that doesn't exist. Removing it is safe and improves clarity. It can be re-added when actually needed.

### [x] 2. Merge duplicate hash-entry traversals
**File:** `src/docs/commands/scan.js`
**Issue:** `buildFileHashMap()` and `buildFileChapterMap()` both iterate over `collectHashEntries(existing)` separately, which duplicates logic and work.
**Suggestion:** Replace them with one pass that builds both maps, for example `buildExistingFileIndex(existing) -> { hashes, chapters }`, or a generic reducer that extracts fields from the same traversal.

**Verdict:** APPROVED
**Reason:** `buildFileHashMap()` and `buildFileChapterMap()` both call `collectHashEntries(existing)` independently, performing the same recursive traversal twice. Merging into a single pass that builds both maps is a straightforward optimization with no behavioral risk, and reduces the chance of the two maps diverging in future maintenance.

### [ ] 3. Clarify changed vs added naming
**File:** `src/docs/commands/scan.js`
**Issue:** `changedInCat` contains both modified files and newly added files. That makes the name misleading and weakens the readability of the incremental logic.
**Suggestion:** Split into `modifiedFiles` and `addedFiles`, or rename the aggregate to `dirtyFiles`/`filesToRescan`. That also simplifies the later stats updates, which currently branch on `existingHashes.has(...)` to recover the distinction.

**Verdict:** REJECTED
**Reason:** While `changedInCat` containing both modified and added files is slightly misleading, the current code correctly distinguishes them for stats purposes via the `existingHashes.has()` check. Splitting into separate arrays would add more variables and branching without meaningfully improving the logic. The stats accounting already handles the distinction correctly. This is a cosmetic naming preference that risks introducing bugs during the split.

### [x] 4. Extract incremental category analysis into a helper
**File:** `src/docs/commands/scan.js`
**Issue:** The per-category incremental block in `main()` mixes file matching, diffing, stats mutation, chapter tracking, and skip decisions in one large inline section.
**Suggestion:** Move that logic into a helper such as `analyzeCategoryDelta(...)` returning `{ shouldSkip, modifiedFiles, addedFiles, deletedFiles, unchangedFiles, previousChapters }`. This makes `main()` easier to follow and keeps the incremental policy consistent.

**Verdict:** APPROVED
**Reason:** The per-category incremental block (lines 276–326) mixes file matching, hash comparison, deletion detection, stats mutation, and chapter tracking in ~50 lines of inline code within the main loop. Extracting this into a dedicated helper with a clear return type would genuinely improve readability of `main()` and make the incremental policy testable in isolation—important given the complexity of the delta logic.

### [x] 5. Eliminate duplicated affected-chapter filtering
**File:** `src/docs/commands/text.js`
**Issue:** Both `textFillFromAnalysis()` and `main()` repeat the same incremental-chapter selection flow: compute `allDocsFiles`, call `getAffectedChapters()`, filter by `.md` basename, and in some cases strip filled content.
**Suggestion:** Extract a shared helper like `resolveTargetDocsFiles(...)` and another helper for `prepareTemplateContent(...)`. That removes duplication and reduces the chance of one path drifting from the other.

**Verdict:** APPROVED
**Reason:** Both `textFillFromAnalysis()` (lines 474–477, 491–495) and `main()` (lines 598–608, 639–642) duplicate the same pattern: call `getAffectedChapters()`, filter docs files by `.md` basename, and conditionally `stripFillContent()`. This is real duplication of non-trivial logic, and if one path is updated without the other, incremental text generation will behave inconsistently between CLI and programmatic invocation. Extracting shared helpers is justified.

### [x] 6. Centralize analysis meta-key handling
**File:** `src/docs/commands/text.js`
**Issue:** `getAffectedChapters()` defines an inline `META_KEYS` set to skip non-category entries. This is fragile because the scan side is now writing `_incrementalMeta`, and future metadata additions can easily be missed here.
**Suggestion:** Introduce a shared predicate/helper for “is analysis category entry” or centralize metadata keys in one constant shared across analysis readers. That keeps the format contract consistent.

**Verdict:** APPROVED
**Reason:** The inline `META_KEYS` set in `getAffectedChapters()` (line 430) must stay synchronized with the metadata keys written by scan.js (e.g., `_incrementalMeta`) and other commands (`enrichedAt`, `generatedAt`). This is a real fragility—`collectHashEntries` in scan.js already has its own skip logic for `analyzedAt`/`enrichedAt` (line 78). A shared constant or predicate would prevent these from drifting apart.

### [ ] 7. Simplify duplicate content-reset logic
**File:** `src/docs/commands/text.js`
**Issue:** `stripFillContent()` is conditionally applied in two different loops with the same `if (affectedChapters)` guard. This is minor duplication, but it spreads the incremental regeneration rule across multiple locations.
**Suggestion:** Wrap the read step in a helper such as `readDocForGeneration(filePath, { forceRefill })` so the reset behavior is defined once and applied consistently.

**Verdict:** REJECTED
**Reason:** The `stripFillContent()` call appears in two locations but within different code paths (`textFillFromAnalysis` and `main`) that are already identified for consolidation in proposal #5. Wrapping just the read+strip into a helper like `readDocForGeneration()` adds abstraction without addressing the root cause. If proposal #5 is implemented, this duplication disappears naturally. As a standalone change, the added indirection is not worth it.

### [x] 8. Reconsider exporting internal helper
**File:** `src/docs/commands/text.js`
**Issue:** `getAffectedChapters` was added to the public export list, but the diff does not show any external use. Exporting internal coordination helpers increases API surface unnecessarily.
**Suggestion:** Keep `getAffectedChapters` private unless it is consumed by tests or another module. If test access is the goal, test through the public behavior or add a clearly named internal-test export convention.

**Verdict:** APPROVED
**Reason:** `getAffectedChapters` is exported and confirmed to be imported by `tests/062-incremental-scan.test.js`. However, the function is an internal coordination detail between scan and text commands. The test directly imports and validates it, which is acceptable, but the export should be clearly marked as test-facing (e.g., via naming convention or grouped with test exports). More importantly, exporting it signals it's a stable API when it's actually tightly coupled to `_incrementalMeta` format internals. Keeping it unexported and testing through `main()` behavior would be more robust, though this requires test refactoring.
