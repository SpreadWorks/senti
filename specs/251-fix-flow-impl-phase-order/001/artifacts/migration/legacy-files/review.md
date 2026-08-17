# Code Review Results

### 1. I’ll read the touched file around this mapping so the review is grounded in the local patterns, then I’ll keep proposals strictly to that file.The provided cwd is a `.tmp` directory and the source path is not directly under it, so I’m locating the repo root without leaving the worktree boundary.### 1. Bound recursive gate step flattening
**File:** `src/flow/lib/gate-step.js`  
**Issue:** `flattenForGate()` recursively walks `state.steps` without an explicit depth or node-count bound, which violates the bounded-resource-usage guardrail and can overflow the call stack on malformed or unexpectedly deep state.  
**Suggestion:** Replace it with an iterative traversal that enforces a maximum depth or maximum visited node count, then fail clearly if the bound is exceeded. This keeps gate phase resolution predictable even when state data is bad.

### 2. 1. Split Dense Gate Resolution Text
**File:** `src/flow/prompts/impl/gate-impl.md`  
**Issue:** The new parenthetical packs command usage, hook behavior, and phase resolution rules into one long line, making the prompt harder to scan and easier to mis-edit later.  
**Suggestion:** Keep the command bullet short, then add a small nested “Phase resolution” explanation or table for `integration` vs `task-impl`. Also consider wording hook behavior as “the active `gate-impl` step” to avoid repeating level-specific details inline.

### 3. 1. Clarify the conditional transition
**File:** `src/flow/prompts/task/review.md`  
**Issue:** The prompt now says the per-task review step always advances to `gate-impl`. Because this file describes a task-level review step, that unconditional wording can be misleading if `gate-impl` should only run after all task work is complete.  
**Suggestion:** Reword the line to make the condition explicit, for example: “On complete, the next-action CLI advances to `gate-impl` when implementation tasks are complete.”

### 4. 1. Make phase-order intent executable
**File:** `tests/e2e/227-forest-e2e.test.js`  
**Issue:** The diff reorders `"review"` and `"gate-impl"` inside an array used only with `.includes()`, so the change has no behavioral effect. If the goal is to validate implementation phase ordering, this assertion will not catch regressions.  
**Suggestion:** Either keep the array order unchanged and treat it as a membership check, or add a separate assertion that verifies the actual transition order. If it is only membership, consider extracting a named `FLOW_SCOPE_STEPS` `Set` to make that intent explicit.

### 5. 1. Extract duplicated flow-scope step list
**File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Issue:** The same allowed-step array is duplicated in both flat-task and parent-child lifecycle assertions. Future changes to flow ordering or eligible steps must be updated in multiple places.  
**Suggestion:** Define a shared constant such as `FLOW_SCOPE_STEPS` near the top of the test file, or add a small helper like `assertFlowScopeStep(na)`, and reuse it in both assertions.

### 6. I’ll inspect the touched test around this change so the review is grounded in the local pattern, while keeping proposals scoped to that single file.The diff path is not present relative to `.tmp`, so I’m checking the worktree layout before deciding whether the diff alone is enough.### 1. Make “through gate-impl” executable instead of comment-only
**File:** `tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js`  
**Issue:** The array order now mirrors phase order, but the code only uses `doneStepIds.includes(s.id)`, so the “through gate-impl” intent is not enforced by the implementation. Future edits can silently desync the comment and list.  
**Suggestion:** Either rename to `doneStepIdSet` and treat it explicitly as unordered membership, or derive the done IDs from `flattenSteps(steps)` up to `"gate-impl"` so the test setup directly encodes “all steps through gate-impl.”

### 7. 1. Extract Repeated Flow State Builders
**File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Issue:** The tests repeatedly inline similar `state` objects with `steps`, `tasks`, `currentTaskId`, and gate step status combinations. This makes phase expectation changes easy to miss across cases.  
**Suggestion:** Add small local helpers such as `flowStateWithSteps(...)` and `activeTaskStateWithSteps(...)` to centralize the repeated state shape while keeping each test focused on the meaningful gate statuses.

### 8. 2. Clarify Task-Level Gate Naming
**File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Issue:** The new test name uses `gate-impl` without clearly distinguishing task-level `gate-impl` from flow-level `gate-impl`, which now resolve to different phases.  
**Suggestion:** Rename it to something like `picks task-impl when active task-level gate-impl is in_progress` so the level-specific behavior is explicit.

### 9. I’ll inspect the touched test file around this change so the proposals are grounded in the surrounding pattern, while keeping the scope strictly to that file.The provided cwd is a `.tmp` directory and the relative test path is not present there. I’ll locate the repository root inside the allowed workspace and read only the touched file if it’s available.The surrounding test already imports flow-step metadata, so I’m checking whether this hand-written sequence duplicates source-of-truth ordering inside this same touched test.### 1. Derive non-approval steps from the flow definition
**File:** `tests/unit/flow/get-next-action.test.js`  
**Issue:** `falsyFlowSteps` manually duplicates flow-step ordering, which is exactly what this diff had to fix. The name is also vague, and the existing `FLOW_STEPS` import is otherwise unused.  
**Suggestion:** Replace the hardcoded list with a derived list, e.g. `const nonApprovalFlowSteps = FLOW_STEPS.filter((id) => !approvalFlowSteps.has(id));`, using `new Set(["approval", "finalize-commit"])`. This removes ordering drift and improves naming.

### 10. 2. Deduplicate approval-point tests
**File:** `tests/unit/flow/get-next-action.test.js`  
**Issue:** The two `requires_approval: true` tests for `approval` and `finalize-commit` repeat the same setup and assertion structure.  
**Suggestion:** Use a small data-driven loop such as `for (const stepId of ["approval", "finalize-commit"])` inside one test, or generate subtests if the local test style supports it. This keeps the approval-step list in one place and mirrors the derived non-approval-step test.

### 11. 1. Centralize Flow Step Membership And Ordering
**File:** `tests/unit/flow/get-next-action.test.js`  
**Issue:** Multiple tests introduce or maintain hardcoded step lists around `review`, `gate-impl`, and approval/non-approval flow steps (`227-forest`, `231-task-e2e`, `t5-auto-promote`, and `get-next-action`). Some use the lists as unordered membership while others imply ordering, creating drift risk across files.  
**Suggestion:** Derive ordered lists from the flow definition where possible, and add a shared test helper or constant for unordered “flow-scope” membership checks.

### 12. 2. Normalize Task-Level Vs Flow-Level Gate Naming
**File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Issue:** The summaries show `gate-impl` now means different things depending on context: task-level resolves to `task-impl`, while flow-level resolves to `integration`. Prompt and test wording do not consistently make that distinction.  
**Suggestion:** Use explicit wording everywhere: “task-level `gate-impl`” and “flow-level `gate-impl`”. Apply this in `gate-phase-inference.test.js`, `gate-impl.md`, and `task/review.md`.

### 13. 3. Align Task Review Prompt With Gate Resolution Rules
**File:** `src/flow/prompts/task/review.md`  
**Issue:** `task/review.md` reportedly says review always advances to `gate-impl`, while `gate-impl.md` describes phase resolution based on the active gate step. That creates a cross-file contract mismatch between transition wording and gate behavior.  
**Suggestion:** Reword task review to state the conditional transition explicitly, and mirror the same level-aware terminology used by `gate-impl.md`.
