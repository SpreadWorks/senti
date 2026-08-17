# Code Review Results

### [x] 1. Re-centralize WorkDir Resolution
**File:** `src/lib/agent.js`  
**Issue:** `resolveWorkDir` logic was duplicated in `agent.js`, and `log.js` now has a separate variant. This creates behavior drift (e.g., `SDD_FORGE_WORK_DIR` precedence and absolute-path handling were effectively dropped).  
**Suggestion:** Restore a single shared resolver in `src/lib/config.js` (env > config > `.tmp`) and make both `agent.js` and `log.js` call it.

**Verdict:** APPROVED
**Reason:** Current duplication already caused drift (`SDD_FORGE_WORK_DIR` precedence removed, semantics split across modules). A shared resolver in `config.js` improves correctness and consistency with low risk.

### [x] 2. Align Log Path Resolution with Agent Resolution
**File:** `src/lib/log.js`  
**Issue:** `resolveLogDir` now builds `path.join(repoRoot, workDir, "logs")` directly, which can diverge from agent path semantics and may mis-handle absolute `workDir`.  
**Suggestion:** Resolve an absolute work dir via the shared resolver first, then append `"logs"` (`path.join(resolveWorkDir(...), "logs")`).

**Verdict:** APPROVED
**Reason:** `resolveLogDir` currently diverges from agent behavior and can mis-handle absolute/custom work dirs. Resolving an absolute work dir first, then appending `logs`, restores consistent behavior.

### [x] 3. Restore Lost Regression Test for Env Override
**File:** `tests/unit/docs/enrich-dump-path.test.js`  
**Issue:** The test verifying `SDD_FORGE_WORK_DIR` precedence was removed, so a key config contract is no longer protected.  
**Suggestion:** Re-add the env-priority test and keep it alongside config/fallback tests to lock precedence behavior.

**Verdict:** APPROVED
**Reason:** The removed env-precedence test protected a real config contract. Re-adding it improves regression safety without changing runtime behavior.

### [ ] 4. Remove Dead Test Code
**File:** `specs/170-flow-runid-state-mgmt/tests/flow-init-prepare.test.js`  
**Issue:** Unused imports/variables (`execFileSync`, `FLOW_CMD`, `loadActiveFlows`) add noise and reduce readability.  
**Suggestion:** Delete unused imports/constants and keep only the dependencies actually used by assertions.

**Verdict:** REJECTED
**Reason:** This is mostly cosmetic cleanup (unused imports/vars). Low impact on quality and no behavioral protection; not strong enough under a conservative bar.

### [x] 5. Eliminate Repeated Preparing-State Fixture Construction
**File:** `tests/unit/lib/flow-state-runid.test.js`  
**Issue:** The same `.active-flow.<runId>` object shape is duplicated across multiple tests.  
**Suggestion:** Extract a small helper (e.g., `makePreparingState(runId, overrides)`) to centralize schema setup and reduce duplication/errors.

**Verdict:** APPROVED
**Reason:** Repeated fixture shape in multiple tests is a real maintenance risk. A small helper can reduce copy/paste errors while preserving behavior if assertions remain explicit.

### [x] 6. Avoid Side Effects in Read-Only RunId Lookup
**File:** `src/lib/flow-state.js`  
**Issue:** `resolveByRunId()` calls `loadFlowState()` for each candidate, which can trigger transparent migration writes during what should be a read-only status lookup.  
**Suggestion:** Add a read-only loader (no migration/writeback) for resolution paths, and keep migration in explicit load/prepare flows only.

**Verdict:** APPROVED
**Reason:** `resolveByRunId()` currently calls a loader that can write migrated `runId`s, creating side effects in status/read paths. A read-only loader is a correctness and safety improvement.
