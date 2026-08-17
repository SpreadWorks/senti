# Code Review Results

### [x] 1. Centralize Agent Command IDs
**File:** `src/flow/commands/review.js` (also `src/flow/lib/get-context.js`, `src/flow/lib/run-gate.js`, `src/flow/lib/run-retro.js`, `src/templates/config.example.json`)
**Issue:** Command ID strings are duplicated across runtime code and template config, which makes renames error-prone and can easily drift.
**Suggestion:** Define a single `COMMAND_IDS` constant module (e.g., `src/flow/lib/command-ids.js`) and reference it everywhere (`loadAgentConfig`, `resolveAgent`, error messages, and template generation).

**Verdict:** APPROVED
**Reason:** This removes real duplication across multiple runtime paths and config template mapping, lowering rename/drift risk. If constants preserve current values, behavior should stay unchanged.

### [x] 2. Remove Repeated Agent Setup Boilerplate
**File:** `src/flow/commands/review.js`
**Issue:** The pattern `loadAgentConfig(...)` + `ensureAgentWorkDir(...)` is repeated for draft/final/spec/test paths.
**Suggestion:** Extract a small helper like `loadReviewAgent(config, commandId, root)` to reduce duplication and keep behavior consistent.

**Verdict:** APPROVED
**Reason:** The repeated `loadAgentConfig(...)` + `ensureAgentWorkDir(...)` pattern is mechanical duplication. A small helper improves consistency without changing logic if call sites keep the same command IDs and error paths.

### [x] 3. Unify `spec.gate` Agent Resolution Logic
**File:** `src/flow/lib/run-gate.js`
**Issue:** `resolveAgent(config, "spec.gate")` appears in multiple places with separate fallback/error handling, increasing maintenance risk.
**Suggestion:** Introduce a shared helper (e.g., `resolveSpecGateAgent(config, { required: true|false })`) used by both guardrail check and requirement check paths.

**Verdict:** APPROVED
**Reason:** Duplicate resolution/fallback logic is a maintenance risk. A shared helper with explicit `required` semantics can preserve current behavior while reducing divergence risk.

### [x] 4. Avoid Path Fragility for Experimental Skills
**File:** `src/upgrade.js`
**Issue:** `path.join(PKG_DIR, "..", "experimental", ...)` relies on parent traversal and is brittle if package layout changes.
**Suggestion:** Add a named root helper/constant for package root (or `EXPERIMENTAL_WORKFLOW_SKILLS_DIR`) and compute this path once in a single place.

**Verdict:** APPROVED
**Reason:** Centralizing the experimental skills root calculation is a concrete robustness improvement and avoids scattered path assumptions. Behavior remains the same if the resolved directory is unchanged.

### [ ] 5. Reduce Generated-Artifact Churn
**File:** `.sdd-forge/output/analysis.json`
**Issue:** The diff is mostly timestamp/hash/enrichment churn, which adds noise and obscures functional changes.
**Suggestion:** Either stop committing this generated file, or make generation deterministic (exclude timestamps/volatile fields) so code reviews stay focused on behavioral changes.

**Verdict:** REJECTED
**Reason:** As proposed, this is process/cosmetic-focused and ambiguous (`stop committing` vs `make deterministic`). It may affect existing tooling/workflows, and no safe behavior-preserving approach is specified.
