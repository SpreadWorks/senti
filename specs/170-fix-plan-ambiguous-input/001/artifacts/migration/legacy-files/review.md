# Code Review Results

### [x] 1. Re-centralize WorkDir Resolution Logic
**File:** `src/lib/config.js`  
**Issue:** `resolveWorkDir` was removed from config and equivalent logic was reimplemented in both `agent.js` and `log.js`, creating duplication and behavior drift.  
**Suggestion:** Restore a single shared resolver in `config.js` (with precedence `SDD_FORGE_WORK_DIR > config.agent.workDir > .tmp`) and make both `src/lib/agent.js` and `src/lib/log.js` call that helper.

**Verdict:** APPROVED
**Reason:** This is a real quality and correctness improvement: current duplication already caused drift (`agent.js` and `log.js` now resolve differently). Reintroducing one shared resolver with `env > config > .tmp` preserves intended behavior and reduces future regression risk.

### [x] 2. Fix Behavior Regression for Env Override and Absolute Paths
**File:** `src/lib/log.js`  
**Issue:** `resolveLogDir` now ignores `SDD_FORGE_WORK_DIR` and uses `path.join(repoRoot, workDir, "logs")`, which can mis-handle absolute `workDir` values and diverges from agent behavior.  
**Suggestion:** Derive log dir from a normalized absolute work dir (`resolveWorkDir(repoRoot, cfg)`) and then append `"logs"`.

**Verdict:** APPROVED
**Reason:** This addresses an actual behavior regression. Current `log.js` ignores `SDD_FORGE_WORK_DIR` and can mishandle absolute `workDir` semantics. Building log path from normalized absolute `resolveWorkDir(...)` is the safer, behavior-consistent fix.

### [x] 3. Restore Lost Regression Test Coverage
**File:** `tests/unit/docs/enrich-dump-path.test.js`  
**Issue:** The test that verified env var precedence (`SDD_FORGE_WORK_DIR` over config) was deleted, so a critical rule now lacks protection.  
**Suggestion:** Re-add the env-priority test (preferably with a small env helper to reduce setup/teardown duplication).

**Verdict:** APPROVED
**Reason:** The removed env-precedence test guarded a critical rule and its loss weakens safety. Re-adding it improves protection without changing runtime behavior; a helper for env setup/teardown also reduces test fragility.

### [x] 4. Tighten Negative Prompt-Kind Test Assertions
**File:** `tests/unit/flow/get-prompt.test.js`  
**Issue:** The new `plan.approach` negative test only checks `fatal` level, which may pass for unrelated failures.  
**Suggestion:** Assert the specific error code/message for unknown prompt kind to ensure the test validates intentional API behavior, not just any fatal error.

**Verdict:** APPROVED
**Reason:** Asserting only `fatal` is too weak and can mask unrelated failures. Checking specific unknown-kind error semantics improves test precision and confidence without affecting product behavior.
