# Code Review Results

### [x] 1. ### 1. Re-Centralize Metric Counter Definitions
**File:** `src/flow/registry.js`  
**Issue:** Counter names are hardcoded in help text (`question, redo, docsRead, srcRead`) while the canonical list already exists in constants. This reintroduces drift risk.  
**Suggestion:** Import `VALID_METRIC_COUNTERS` and generate help text from it (e.g., `VALID_METRIC_COUNTERS.join(", ")`) so validation and help stay in sync.

2. ### 2. Remove Reintroduced `redo` Dead Metric Path
**File:** `src/lib/constants.js`  
**Issue:** `redo` was re-added to `VALID_METRIC_COUNTERS`, but the feature scope here is command-ID renaming. Reintroducing `redo` revives a previously removed/dead metric path.  
**Suggestion:** Remove `redo` from `VALID_METRIC_COUNTERS` again unless there is a complete, intentional redesign for redo metrics in this same change.

3. ### 3. Keep Difficulty Model Consistent With Flow State Schema
**File:** `src/metrics/commands/token.js`  
**Issue:** `redoCount` is required for difficulty computation again, which can force `null` difficulty when `flowState.redoCount` is absent and creates schema inconsistency.  
**Suggestion:** Remove `redoCount` from baselines/required inputs and scoring, or fully reintroduce it across flow-state write/read paths in a dedicated change (not mixed into command-ID rename).

4. ### 4. Avoid Misleading Command Documentation
**File:** `src/flow/lib/set-metric.js`  
**Issue:** JSDoc now hardcodes counters (`question, redo, docsRead, srcRead`), duplicating knowledge and potentially drifting from actual allowed counters.  
**Suggestion:** Update comment to reference `VALID_METRIC_COUNTERS` only (without enumerating values) to keep docs aligned with runtime validation.

5. ### 5. Eliminate Test Setup Duplication
**File:** `tests/unit/specs/commands/guardrail.test.js`  
**Issue:** Fixture setup (git init, flow setup, config/spec/guardrail writes, command invocation) is duplicated across tests after helper removal, reducing readability and increasing maintenance cost.  
**Suggestion:** Reintroduce small helpers like `createGateFixture()` and `runGate()` to centralize setup and execution boilerplate.

6. ### 6. Clarify Test Naming for Path Scope
**File:** `specs/172-rename-agent-command-ids/tests/verify-rename.test.js`  
**Issue:** `srcRoot` and `readSrc()` are used for both `src/*` and `templates/*`, which is semantically confusing.  
**Suggestion:** Rename to broader names like `repoRoot` / `readProjectFile()` or split into `readSrcFile()` and `readTemplateFile()` for clearer intent.

**Verdict:** APPROVED
**Reason:** Using `VALID_METRIC_COUNTERS` as the single source of truth reduces drift risk and is a documentation/help-text change with no runtime behavior impact.
