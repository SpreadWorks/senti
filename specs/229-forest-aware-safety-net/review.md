# Code Review Results

### [x] 1. Fallback Promotion Order Is Not Actually Sequential
**File:** `src/flow/lib/get-next-action.js`  
**Issue:** The new safety-net logic uses `if (task) { ... } else if (...) { ... } else { ... }`, which skips flow-level promotion when `currentTask` exists but has no pending steps. That contradicts the documented order (`task -> flow -> forest`) and can leave promotable flow steps untouched.  
**Suggestion:** Make the checks sequential and gated by `!promoted`, e.g.:
- Try current task promotion first (if task exists)
- If not promoted, try `promoteFirstPending(state.steps)`
- If still not promoted, run forest-level `promoteNextPending(state)`

**Verdict:** APPROVED
**Reason:** This is a real behavioral bug, not cosmetic. The current `if / else if / else` shape can skip flow-level promotion when `currentTask` exists but cannot promote, violating the intended `task -> flow -> forest` order and potentially leaving pending flow steps untouched.

### [ ] 2. Remove Unused Intermediate `taskId` Variable
**File:** `src/flow/lib/get-next-action.js`  
**Issue:** `const taskId = promoteNextPending(state);` is only used as a truthy check and never otherwise consumed. This is minor dead code/noise.  
**Suggestion:** Inline the condition (`if (promoteNextPending(state)) { ... }`) or rename to clarify intent if ID usage is planned later. If no ID semantics are needed now, prefer inlining for simpler control flow.

**Verdict:** REJECTED
**Reason:** This is mostly cosmetic cleanup. The variable currently documents intent (whether a task was promoted) and removing it provides negligible quality gain while offering no behavior improvement.

### [ ] 3. Replace Magic Numbers in Grep-Based Callsite Test
**File:** `tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js`  
**Issue:** The test hardcodes `4` invocation lines and `3` logical sites directly in title/comments/assertion, which increases maintenance friction when callsites change again.  
**Suggestion:** Introduce named constants (e.g. `EXPECTED_INVOCATION_LINES`, `EXPECTED_SITE_FILES`) and assert from those values. This keeps intent clear and reduces brittle edits across title/comment/assert text.

**Verdict:** REJECTED
**Reason:** This is test-style refactoring only. It does not materially improve production code quality or safety, and it can reduce readability when exact expected values are already small and clear in context.
