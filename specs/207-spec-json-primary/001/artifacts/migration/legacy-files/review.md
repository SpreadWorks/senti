# Code Review Results

### [ ] 1. Remove Legacy Authorized-Test Parser
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `parseAuthorizedTestModifications(specText)` remains alongside the new JSON-based parser but is no longer used in the gate execution path, which increases maintenance surface and invites drift between two parsing rules.  
**Suggestion:** Delete the Markdown parser and keep only `parseAuthorizedTestModificationsFromJson`, or explicitly route both through one shared normalization function if backward compatibility is still required.

**Verdict:** REJECTED
**Reason:** Quality intent is good, but deleting `parseAuthorizedTestModifications` is only safe if you confirm zero remaining callers (including tests/imports). With current evidence, behavior-break risk is non-trivial.

### [ ] 2. Consolidate Metric Aggregation Logic
**File:** `src/flow/commands/report.js`  
**Issue:** `aggregateActivityMetrics` and `aggregateTokenMetrics` both iterate `metrics` phase-by-phase with partially duplicated traversal logic.  
**Suggestion:** Extract a single internal reducer (for example `reduceMetrics(metrics, handlers)`) and implement activity/token accumulation via handlers to reduce duplication and keep aggregation behavior consistent.

**Verdict:** REJECTED
**Reason:** This is mostly structural churn. Current duplication is limited and explicit; introducing handler-based generic reduction increases abstraction and can hide subtle aggregation differences.

### [x] 3. Split Data Extraction From Markdown Formatting
**File:** `src/flow/commands/merge.js`  
**Issue:** `parseSpec()` now both extracts fields from `spec.json` and formats markdown-like sections (`- ...`, `### Out of Scope`) in one function, mixing responsibilities.  
**Suggestion:** Return structured data from `parseSpec()` (arrays/strings), then render markdown in `buildPrBody()` (or a dedicated formatter helper). This keeps parsing and presentation consistent with single-responsibility design.

**Verdict:** APPROVED
**Reason:** This is a real SRP improvement: parsing and rendering are currently coupled in `parseSpec()`. Separating structured extraction from formatting can improve maintainability without changing behavior if outputs stay identical.

### [x] 4. Remove Repeated ENOENT Boilerplate
**File:** `src/docs/commands/changelog.js`  
**Issue:** `statIfExists` and `readIfExists` duplicate the same try/catch ENOENT pattern.  
**Suggestion:** Introduce one generic helper (for example `withOptionalFile(op)`) to centralize “return null on ENOENT” behavior and reduce repetitive error-handling code.

**Verdict:** APPROVED
**Reason:** Clear duplication exists (`statIfExists` / `readIfExists`). A shared helper centralizes identical error policy (`ENOENT -> null`) with low behavioral risk.

### [ ] 5. Normalize Metrics Shape at the Status Boundary
**File:** `src/flow/lib/get-status.js`  
**Issue:** `buildStatusOutput()` returns `metrics: state.metrics || null`, while other consumers now treat metrics as an object map and must repeatedly null-check.  
**Suggestion:** Normalize once in status output (for example `metrics: state.metrics || {}`) to simplify downstream code and improve design consistency across commands.

**Verdict:** REJECTED
**Reason:** Returning `{}` instead of `null` changes API semantics and can break consumers that distinguish “missing” from “empty.” This is behavior-affecting, not a safe refactor by default.
