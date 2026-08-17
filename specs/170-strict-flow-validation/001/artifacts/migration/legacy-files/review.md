# Code Review Results

### [x] 1. Re-centralize Work Directory Resolution
**File:** `src/lib/config.js`  
**Issue:** `resolveWorkDir` was removed from config and equivalent logic is now duplicated in `src/lib/agent.js` and `src/lib/log.js`, causing behavior drift (env override removed, absolute path handling risk).  
**Suggestion:** Restore a single `resolveWorkDir(root, cfg)` in `config.js` (priority: `SDD_FORGE_WORK_DIR` > `config.agent.workDir` > `.tmp`) and make both agent/log modules depend on it.

**Verdict:** APPROVED
**Reason:** This fixes a real regression and duplication: current logic drifted across `agent.js`/`log.js` (including lost env override), so restoring a single resolver improves correctness and maintainability with low risk.

### [x] 2. Fix Log Path Construction for Absolute `workDir`
**File:** `src/lib/log.js`  
**Issue:** `resolveLogDir` uses `path.join(repoRoot, workDir, "logs")`, which can produce incorrect paths when `workDir` is absolute and no longer follows shared resolver semantics.  
**Suggestion:** Build log path from normalized absolute work dir (`const wd = resolveWorkDir(repoRoot, cfg); return path.join(wd, "logs");`) to keep behavior consistent and correct.

**Verdict:** APPROVED
**Reason:** Building log paths from a normalized absolute work dir is behaviorally safer and consistent with shared resolution rules; it reduces path-construction edge-case risk.

### [x] 3. Restore Lost Regression Coverage for Env Priority
**File:** `tests/unit/docs/enrich-dump-path.test.js`  
**Issue:** The test verifying `SDD_FORGE_WORK_DIR` precedence over `config.agent.workDir` was removed, so a critical configuration rule is no longer protected.  
**Suggestion:** Re-add the env-priority test and keep config/fallback cases together to enforce the full precedence contract.

**Verdict:** APPROVED
**Reason:** Re-adding the `SDD_FORGE_WORK_DIR` precedence test protects a critical contract and does not alter runtime behavior.

### [x] 4. Unify Integer Parsing/Validation Logic
**File:** `src/flow/lib/set-req.js`  
**Issue:** `set-req` uses `parseInt`-style validation while `set-issue` now uses stricter digit-only checks; this is inconsistent and can accept unintended input (e.g. `1abc`).  
**Suggestion:** Extract a shared numeric parser helper (e.g., `parseStrictInt(raw, { min })`) and reuse it in both commands for consistent validation and error messages.

**Verdict:** APPROVED
**Reason:** The current inconsistency (`parseInt`-style vs strict digits) can admit unintended inputs; a shared strict parser improves correctness and consistency without changing intended valid cases.

### [x] 5. Remove or Isolate Volatile Generated Metadata from Functional Diffs
**File:** `.sdd-forge/output/analysis.json`  
**Issue:** The diff contains large timestamp/enrichment churn unrelated to functional behavior, which adds review noise and hides real code changes.  
**Suggestion:** Exclude volatile generated fields from commits (or regenerate deterministically in a separate commit) so functional and generated changes are reviewed independently.

**Verdict:** APPROVED
**Reason:** This is a meaningful review-quality improvement (less noise, clearer functional diffs) and should not affect product behavior if done as exclusion or isolated deterministic generation.
