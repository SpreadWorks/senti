# Code Review Results

### [ ] 1. Consolidate Early-Fail Guard Pattern in Gate Execution
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `RunGateCommand.execute()` now has multiple sequential `const x = check...; if (x) return x;` blocks, which repeats control-flow structure and will keep growing as new guards are added.  
**Suggestion:** Introduce a small guard pipeline (array of guard functions returning `Envelope|null`) and iterate until first failure. This removes duplication and keeps pre-AI gate checks consistent and easier to extend.

**Verdict:** REJECTED
**Reason:** Guard checks are order-sensitive and not purely uniform; introducing a pipeline adds abstraction risk for little functional gain and could subtly change behavior as guards evolve.

### [ ] 2. Extract `NO_HEAD_TEST_EVIDENCE` Metadata to a Reusable Constant
**File:** `src/flow/lib/run-gate.js`  
**Issue:** The `NO_HEAD_TEST_EVIDENCE` code and message text are embedded inline in `checkMissingHeadTestEvidence`, increasing drift risk if wording/code is referenced elsewhere (prompts/tests).  
**Suggestion:** Move the error code and message template to top-level constants (or a small helper) and compose the envelope from those constants. This improves naming clarity and keeps behavior/documentation updates synchronized.

**Verdict:** REJECTED
**Reason:** This is mostly naming/cosmetic unless the same code/message is actually reused in multiple places; current single-site inline usage is clearer and lower risk.

### [ ] 3. Factor Shared Preparing-File Scan Logic
**File:** `src/lib/preparing-flow-store.js`  
**Issue:** `cleanStale()` contains directory scan/filter boilerplate that is likely mirrored by other store methods (e.g., listing preparing flows), creating duplication and divergence risk.  
**Suggestion:** Extract a private helper that returns normalized preparing-flow entries (filename/path/runId/stat metadata), and reuse it in `cleanStale()` and list-style methods. This keeps stale pruning and listing behavior structurally consistent.

**Verdict:** REJECTED
**Reason:** The proposal is speculative (“likely mirrored”) without confirmed duplication; extracting early can create premature indirection and potential divergence in semantics.

### [ ] 4. Improve Intent-Revealing Naming in Init Warning Path
**File:** `src/flow/lib/set-init.js`  
**Issue:** The variable `existing` is generic and does not communicate what is stored (run IDs), which weakens readability in warning logic.  
**Suggestion:** Rename to `existingPreparingRunIds` (or similar) and keep warning composition based on that explicit name.

**Verdict:** REJECTED
**Reason:** Pure variable rename only; readability gain is minor and does not materially improve quality or behavior.

### [ ] 5. Reduce Brittle Full-Schema Key Equality in Schema Test
**File:** `tests/unit/spec/schema.test.js`  
**Issue:** The test asserts exact top-level property equality; every additive schema change forces unrelated test churn, even when contract intent is unchanged.  
**Suggestion:** Split assertions into (a) required invariant keys and (b) optional/known extension keys, or assert inclusion for required keys plus explicit constraints (`additionalProperties`, specific field schemas). This keeps contract checks strong while reducing maintenance noise.

**Verdict:** REJECTED
**Reason:** Relaxing strict top-level key equality weakens schema-surface regression detection and can allow unintended contract expansion to slip through.
