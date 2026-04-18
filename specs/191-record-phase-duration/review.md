# Code Review Results

### [ ] 1. Reuse `buildRowsFromMetrics` to eliminate duplicated extraction logic
**File:** `src/metrics/commands/token.js`  
**Issue:** `buildRowsFromMetrics()` and `buildRows()` both manually map `phaseData` fields (`tokens`, `callCount`, `cost`, `durationMs`, difficulty accumulation). This creates duplicate logic and drift risk.  
**Suggestion:** Refactor `buildRows()` to call `buildRowsFromMetrics(date, metrics, specDifficulty)` per flow entry, then merge rows by `(date, phase)` only where needed. Also update the comment ("Used by both `buildRows` and unit tests") to match reality.

**Verdict:** REJECTED
**Reason:** Directionally good, but risky as proposed: `buildRows()` currently aggregates with internal `_difficultySum/_difficultyCount` and additive metrics before finalization. Reusing `buildRowsFromMetrics()` (which finalizes per-flow rows) can subtly change merge/averaging behavior unless redesigned to preserve intermediate accumulators.

### [x] 2. Extract a shared duration formatter
**File:** `src/flow/commands/report.js`  
**Issue:** Duration formatting (`(durationMs / 1000).toFixed(1) + "s"`) is duplicated here and in `src/metrics/commands/token.js`, which risks inconsistent formatting changes later.  
**Suggestion:** Add a small shared helper (for example in `src/lib/formatter.js`) like `formatDurationSeconds(ms)` and use it in both report and token metrics output.

**Verdict:** APPROVED
**Reason:** This removes real duplication and reduces drift risk with minimal behavioral risk, as long as the helper preserves the exact current output format (`x.y`s).

### [ ] 3. Improve naming for mixed-scope aggregate structure
**File:** `src/flow/commands/report.js`  
**Issue:** `aggregateTokenMetrics()` now aggregates non-token fields (`durationMs`, `phaseDurations`), so the name no longer reflects its responsibility.  
**Suggestion:** Rename to something broader like `aggregateUsageMetrics()` (or split into token vs duration aggregators) to keep design intent clear and consistent.

**Verdict:** REJECTED
**Reason:** This is mostly cosmetic renaming. It may improve readability slightly, but by itself does not materially improve quality or correctness.

### [x] 4. Replace positional metrics parameters with an options object
**File:** `src/lib/flow-manager.js`  
**Issue:** `accumulateAgentMetrics(phase, usage, responseChars, model, durationMs)` is now a long positional signature and easy to misuse at call sites as fields evolve.  
**Suggestion:** Change to `accumulateAgentMetrics(phase, { usage, responseChars, model, durationMs })` and propagate to `flow-store`. This improves readability and prevents argument-order bugs.

**Verdict:** APPROVED
**Reason:** This is a meaningful maintainability improvement that reduces argument-order mistakes as fields evolve. Behavior should remain unchanged if all call sites are updated consistently.

### [x] 5. Guard duration display against invalid numeric values
**File:** `src/metrics/commands/token.js`  
**Issue:** `asDisplayValue(value, "duration")` converts with `Number(value)` and may render `NaNs` for unexpected data instead of a safe display value.  
**Suggestion:** Treat non-finite values as missing (`N/A`) before formatting, e.g. `const n = Number(value); if (!Number.isFinite(n)) return "N/A";`.

**Verdict:** APPROVED
**Reason:** Preventing non-finite values from rendering as `NaN` is a real correctness/UX improvement and is low risk to existing behavior.
