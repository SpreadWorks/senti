# Code Review Results

### [ ] 1. Extract repeated map-merge logic
**File:** `src/presets/base/data/structure.js`
**Issue:** `buildDirectoryMap()` and `aggregateAtDepth()` both repeat the same `Map` accumulation pattern: initialize `{ count, roles }`, increment `count`, and union `roles`. This duplicates behavior and makes future changes to directory aggregation easy to miss in one of the two places.
**Suggestion:** Introduce a small helper such as `mergeDirectoryInfo(map, key, count, roles)` or `upsertDirectoryStats(...)` and reuse it from both functions.

**Verdict:** REJECTED
**Reason:** The duplication is shallow (3 lines) and the two sites differ in semantics: `buildDirectoryMap` increments by 1 per item and reads `item.role`, while `aggregateAtDepth` sums existing counts and unions existing role sets. Forcing them through a shared helper obscures this difference and couples two functions that evolve independently. The maintenance cost of the current duplication is negligible for a ~100-line file.

### [ ] 2. Replace the arbitrary depth cap with data-driven termination
**File:** `src/presets/base/data/structure.js`
**Issue:** `MAX_EXPAND_DEPTH = 5` is a magic limit and can still cause unnecessary recomputation when the directory depth is shallower, or truncate meaningful expansion when the structure is deeper than five segments.
**Suggestion:** Compute the maximum available directory depth from `dirs.keys()` and stop when either the aggregation splits into multiple rows or the requested depth no longer changes the keys. That removes the hard-coded limit and simplifies the behavior.

**Verdict:** REJECTED
**Reason:** `MAX_EXPAND_DEPTH = 5` is a safety bound, not a tuning knob. Computing the actual max depth and stopping when "keys stop changing" introduces new edge cases (e.g., a single deeply nested directory that never fans out would loop to the bottom of the tree). The current cap is simple, correct, and bounded. The suggested change adds complexity with no clear behavioral improvement and risks pathological cases.

### [ ] 3. Improve aggregation naming
**File:** `src/presets/base/data/structure.js`
**Issue:** Names like `agg`, `dirs`, and `aggregateAtDepth()` are technically correct but vague. In `directories()`, the returned rows are not always actual directories anymore; they may be grouped prefixes such as `src/presets`.
**Suggestion:** Rename toward intent, for example `directoryStats`, `groupedDirectoryStats`, and `groupDirectoriesByDepth()`. If the output is intentionally prefix-based, consider renaming the method comment from “Major directories” to “Major directory groups”.

**Verdict:** REJECTED
**Reason:** Cosmetic-only. `agg`, `dirs`, and `aggregateAtDepth` are clear in context and consistent with the file's local style. Renaming them provides no behavioral or structural improvement and churns blame history for a ~100-line internal module with no public API.

### [x] 4. Consolidate repeated analysis-to-directory setup
**File:** `src/presets/base/data/structure.js`
**Issue:** `tree()` and `directories()` both repeat the same sequence: validate `analysis.enrichedAt`, collect items, build the directory map, and return `null` for empty results. This is small but direct duplication, and it makes the class less consistent to evolve.
**Suggestion:** Extract a helper such as `getDirectoryStats(analysis)` that returns `null` or the prepared directory map. Both public methods can then focus only on formatting.

**Verdict:** APPROVED
**Reason:** `tree()` and `directories()` share an identical 4-line preamble (validate `enrichedAt`, call `allItems`, check empty, call `buildDirectoryMap`, check empty). Extracting this into a helper like `getDirectoryMap(analysis)` that returns `Map | null` eliminates genuine duplication, reduces the risk of the two methods drifting out of sync on validation logic, and lets each public method focus purely on formatting. The change is low-risk and improves maintainability.

### [ ] 5. Simplify the expansion loop to avoid full re-aggregation on every iteration
**File:** `src/presets/base/data/structure.js`
**Issue:** The current loop rebuilds the grouped map from the original `dirs` on every depth increment. For deep but narrow structures, that repeats the same split/join work several times before reaching a stable result.
**Suggestion:** Either detect when the grouped keys stop changing and break early, or precompute path segments once and reuse them during grouping. That keeps the fallback-expansion behavior while reducing repeated work.

**Verdict:** REJECTED
**Reason:** The loop runs at most 4 iterations (depth 1→5) over a Map that is at most as large as the number of directories in the project — a trivially small dataset for a CLI tool that already calls AI APIs. The optimization adds implementation complexity (precomputed segments, early-exit diffing) for no user-visible benefit. Premature optimization that risks introducing subtle bugs in the grouping logic.
