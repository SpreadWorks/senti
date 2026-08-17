# Code Review Results

### [ ] 1. Avoid Recomputing Preset Names
**File:** `tests/run.js`  
**Issue:** `getRealPresetNames()` is called multiple times (`getPresetNames()` and again when building `searchDirs`), which duplicates filesystem work and can lead to inconsistent snapshots if directory contents change mid-run.  
**Suggestion:** Compute `const realPresetNames = getRealPresetNames();` once, then reuse it in both `getPresetNames()` and `buildSearchDirs(...)`.

**Verdict:** REJECTED
**Reason:** No verdict provided

### [x] 2. Reduce Repeated Mutation Boilerplate
**File:** `src/flow/lib/set-auto.js`  
**Issue:** `ctx.flowManager.mutate(...)` is repeated in several branches with near-identical shape (`autoApprove`/`autoCheck` updates), which makes the command noisier and slightly harder to maintain.  
**Suggestion:** Introduce small local helpers (for example `setAutoApprove(value)` and `setAutoCheck(check)`) to centralize mutation and keep `execute()` focused on control flow.

**Verdict:** APPROVED
**Reason:** Extracting tiny local helpers around `ctx.flowManager.mutate(...)` improves readability without changing command semantics, as long as the helpers only wrap the current mutations (`autoCheck`/`autoApprove`) and keep call order unchanged.

### [x] 3. Align Skill Step With Command Preconditions
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The updated instruction says to run `sdd-forge flow set auto on` in step B.0.5, but `flow set auto` now operates only on `flow.json` (active flow). This can be inconsistent if B.0.5 is still before `flow prepare`.  
**Suggestion:** Explicitly state the required timing/precondition (for example, “run this after `flow prepare` creates `flow.json`”), or adjust the step ordering text so users cannot invoke it in pre-prepare state.

**Verdict:** APPROVED
**Reason:** This addresses a real functional mismatch: the skill step currently suggests a command in a phase where its prerequisite may not hold. Clarifying preconditions/order reduces workflow failure risk and does not alter product runtime behavior.

### [x] 4. Make CLI Help Explicit About Active-Flow Requirement
**File:** `src/flow/registry.js`  
**Issue:** Help text now says it toggles auto mode in `flow.json`, but it does not explicitly mention that an active flow is required, which may cause avoidable trial-and-error.  
**Suggestion:** Update help text to include a direct prerequisite line (for example, “Requires an active flow (`flow.json`)”).

**Verdict:** APPROVED
**Reason:** Not cosmetic-only; it documents an actual runtime precondition (`flow.json` required), which improves operability and reduces user error. Help-text-only change is behavior-safe.
