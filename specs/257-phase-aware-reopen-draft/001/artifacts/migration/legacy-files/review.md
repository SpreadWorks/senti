# Code Review Results

### 1. 1. Derive Overlapping Step Lists
**File:** `src/flow/lib/run-reopen-draft.js`  
**Issue:** `PLAN_REOPEN_ACTIVE_STEPS` duplicates most of `PLAN_REOPEN_RESET_STEPS`, creating a maintenance risk when the plan phase sequence changes.  
**Suggestion:** Define the draft-review reset prefix separately, then derive the reset list from that prefix plus `PLAN_REOPEN_ACTIVE_STEPS`, or introduce one ordered plan-phase constant and slice/filter from it.

### 2. 2. Rename Timestamp-Clearing Helper
**File:** `src/flow/lib/run-reopen-draft.js`  
**Issue:** `setStepStatus` also clears `startedAt` and `finishedAt`, but the name only communicates status assignment.  
**Suggestion:** Rename it to something like `resetStepStatus` or `setStepStatusAndClearTimestamps`, so callers make the side effect obvious.

### 3. 3. Capture Active Step Once
**File:** `src/flow/lib/run-reopen-draft.js`  
**Issue:** `activeFlowStepId(state)` is called inside `isPreImplementationPlanReopen(state)` and again in the success response. The response also reads from the pre-mutation `state`, which is easy to misread as the post-reopen active step.  
**Suggestion:** Capture `const activeStep = activeFlowStepId(state);` before the branch, pass it into the predicate, and return that captured value under a clearer field name such as `previousActiveStep`.

### 4. 4. Align Draft-Return Terminology
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The new section uses both “Phase-aware draft return” and “Draft-return for implementation task additions,” while `spec.md` uses “Draft-return when user judgment is missing.” The behavior is related, but the naming differs across touched guidance files.  
**Suggestion:** Use one consistent term, for example “draft return,” and qualify it with “pre-implementation” or “implementation-phase” where needed. This reduces ambiguity for agents following both files.
