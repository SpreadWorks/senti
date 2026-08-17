# Code Review Results

### [x] 1. Isolate `--reset` argument handling
**File:** `src/docs/commands/scan.js`
**Issue:** `main()` now contains a separate pre-parse path for `--reset`, including manual argument scanning, help handling, argument removal, and a second `parseArgs` call. This duplicates CLI flow logic and makes `--reset` behave differently from the other options.
**Suggestion:** Extract argument normalization into a dedicated helper such as `parseScanCliArgs()` or extend `parseArgs` to support optional values. Then keep `main()` on a single execution path that resolves context once and dispatches either scan or reset mode.

**Verdict:** APPROVED
**Reason:** The current implementation manually pre-scans `rawArgs`, splices elements, and then calls `parseArgs` on a filtered array — creating two completely separate CLI parsing paths in `main()`. This is genuinely harder to maintain and diverges from the established command pattern (visible in AGENTS.md and every other `commands/*.js` file). Extracting argument normalization into a helper or extending `parseArgs` with optional-value support would eliminate the duplicated flow and keep `main()` on a single path. This is a real structural improvement.

### [ ] 2. Improve naming around reset targets
**File:** `src/docs/commands/scan.js`
**Issue:** Names like `resetValue`, `cat`, and `targets` are functional but vague. They make the new branch harder to read than the surrounding command code.
**Suggestion:** Rename them to intention-revealing names such as `categoryListArg`, `categoryName`, and `targetCategories`. This would make the reset logic easier to follow without reading the comments.

**Verdict:** REJECTED
**Reason:** The names `resetValue`, `cat`, and `targets` are reasonably clear in context — `resetValue` is the raw CLI value for `--reset`, `cat` iterates categories, and `targets` is the list of categories to reset. Renaming these to longer alternatives like `categoryListArg` and `categoryName` is cosmetic and adds no meaningful clarity. The surrounding code (comments, log messages) already provides sufficient context.

### [ ] 3. Extract category-entry lookup to remove repetition
**File:** `src/docs/commands/scan.js`
**Issue:** Category validity is checked in two places with similar structure: once when building `allCategories`, and again when iterating reset targets with `analysis[cat]` and `Array.isArray(analysis[cat].entries)`. This repeats the same shape knowledge of `analysis.json`.
**Suggestion:** Introduce a small helper like `getCategoryEntries(analysis, categoryName)` that returns the entries array or `null`. Use it both for collecting resettable categories and for validating requested categories.

**Verdict:** REJECTED
**Reason:** The two "similar" lookups serve different purposes. The `allCategories` filter (line 118–120) collects keys that have an `entries` property (truthy check via `?.entries`). The loop validation (line 130) checks a user-supplied category name against `analysis[cat]` with `Array.isArray`. These share only surface-level shape — extracting a helper like `getCategoryEntries()` would save ~2 lines while adding indirection. The repetition is trivial and the code is a single function of ~45 lines. Not worth the abstraction cost.

### [x] 4. Keep command behavior aligned with the existing command pattern
**File:** `src/docs/commands/scan.js`
**Issue:** `resetCategories()` performs file-system mutation directly and bypasses the normal command flow used by the scan path. That creates a second command mode inside `scan.js`, which weakens design consistency.
**Suggestion:** Treat reset as an explicit sub-operation within the command structure, for example by routing through a `runScanCommand(ctx, options)` dispatcher or by splitting reset behavior into its own command module if it is expected to grow. This keeps responsibilities clearer and avoids `main()` accumulating multiple unrelated workflows.

**Verdict:** APPROVED
**Reason:** The AGENTS.md explicitly documents a standard command file structure where `main(ctx)` resolves context once and proceeds to the command's core logic. The current implementation puts two independent workflows (scan and reset) into a single `main()` with an early-return branch, and `resetCategories()` performs direct FS mutation without going through the normal output path. If `--reset` is expected to coexist with other flags in the future (e.g., `--dry-run`, `--stdout`), the current structure won't support that without further branching. Routing through a dispatcher or splitting into a separate module would align with the project's established patterns and prevent `main()` from growing into a multi-mode function.
