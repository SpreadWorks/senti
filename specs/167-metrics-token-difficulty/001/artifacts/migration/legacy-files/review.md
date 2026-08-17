# Code Review Results

### [x] 1. Avoid Mass Backfill of Static Defaults
**File:** `specs/*/flow.json`  
**Issue:** The change adds the same default structure (`reviewCount: {spec:0,test:0,impl:0}`, `redoCount: 0`) to a very large number of historical files. This creates high-maintenance duplication and noisy diffs for future updates.  
**Suggestion:** Keep legacy `flow.json` untouched and apply defaults at read time in metrics logic (e.g., treat missing `reviewCount`/`redoCount` as `null` or default by policy). Use the backfill script only when explicitly needed, not as a blanket repo rewrite.

**Verdict:** APPROVED
**Reason:** This improves data quality and repo maintainability. Bulk-writing `0` defaults into historical `flow.json` is noisy and can distort metrics; read-time defaulting/backfill-on-demand is safer and cleaner.

### [ ] 2. Consolidate Formatting Logic
**File:** `src/metrics/commands/token.js`  
**Issue:** `asDisplayValue` and `asCsvValue` now duplicate difficulty/cost branching logic. This invites drift when adding new metric kinds.  
**Suggestion:** Extract a shared formatter (e.g., `formatMetricValue(value, { kind, mode })`) and keep only mode-specific wrappers for escaping/CSV concerns.

**Verdict:** REJECTED
**Reason:** This is mostly a style refactor right now. Duplication is small and stable; extracting a shared formatter adds abstraction without clear behavior or quality gain.

### [ ] 3. Remove Temporary Internal Fields From Row Shape
**File:** `src/metrics/commands/token.js`  
**Issue:** `_difficultySum` and `_difficultyCount` are injected into row objects and later stripped. This mixes transient aggregation state with output model, reducing design clarity.  
**Suggestion:** Keep accumulator state in a separate map keyed by `date+phase`, or introduce a dedicated row accumulator type and a final `toRow()` conversion function.

**Verdict:** REJECTED
**Reason:** The current `_difficultySum/_difficultyCount` approach is straightforward and local. Reworking to maps/accumulator types increases refactor surface and regression risk for limited benefit.

### [ ] 4. Improve Review Count Summation Readability
**File:** `specs/167-metrics-token-difficulty/fill-flow-counts.js`  
**Issue:** `sumReviewCount` computes `values[0] + values[1] + values[2]` after mapping, which is slightly brittle and less expressive.  
**Suggestion:** Replace with `values.reduce((sum, n) => sum + n, 0)` after validation to align with existing aggregation patterns and reduce index-based code.

**Verdict:** REJECTED
**Reason:** `values[0] + values[1] + values[2]` is explicit for a fixed 3-field schema. This is a cosmetic change with negligible quality impact.

### [x] 5. Remove Template Placeholder Artifact
**File:** `specs/167-metrics-token-difficulty/qa.md`  
**Issue:** The file contains empty placeholder Q/A entries (`Q:` / `A:`) that look like dead/template residue.  
**Suggestion:** Either populate it with actual clarifications or remove the placeholder block to avoid carrying dead documentation scaffolding.

**Verdict:** APPROVED
**Reason:** Empty `Q:`/`A:` placeholders are dead scaffolding and reduce document clarity. Removing or filling them improves maintainability with no runtime behavior risk.
