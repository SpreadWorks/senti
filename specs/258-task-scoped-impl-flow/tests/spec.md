# Test Design

### Test Design

- **TC-1: Auto-promote pending leaf when dispatcher is taskless**
  - Type: integration
  - Input: `currentTaskId=null`, no `in_progress` task/status/step, at least one pending leaf task, request `get-next-action implement`
  - Expected: Dispatcher promotes one pending leaf to current/in_progress before returning implementation actions.

- **TC-2: Auto-promotion selects only leaf tasks**
  - Type: unit
  - Input: Pending parent task with pending children, plus pending leaf task
  - Expected: Only the pending leaf is eligible for promotion; parent task is not promoted.

- **TC-3: No auto-promotion when a task is already in progress**
  - Type: integration
  - Input: `currentTaskId=null`, one task has status `in_progress`, pending leaf tasks exist
  - Expected: Dispatcher does not promote another task; action resolution uses the existing in-progress state or fails according to existing flow rules.

- **TC-4: No auto-promotion when a task step is already in progress**
  - Type: integration
  - Input: `currentTaskId=null`, no task status `in_progress`, but one task step is `in_progress`
  - Expected: Dispatcher does not promote a pending leaf; avoids creating conflicting task execution.

- **TC-5: No task promotion when no pending leaf exists**
  - Type: unit
  - Input: `currentTaskId=null`, all leaf tasks completed/failed/skipped
  - Expected: Dispatcher returns completion/finalization behavior, not implementation actions for a new task.

- **TC-6: Flow-level implement fails when task work remains and safe predicate is false**
  - Type: integration
  - Input: `currentTaskId=null`, task work remains, safe promotion predicate false, broad mode inactive, attempted step `implement`
  - Expected: Command fails with actionable error explaining task-scoped work remains or broad mode is required.

- **TC-7: Flow-level review fails under unsafe taskless state**
  - Type: integration
  - Input: `currentTaskId=null`, task work remains, safe promotion predicate false, broad mode inactive, attempted step `review`
  - Expected: Review does not run; command exits failure.

- **TC-8: Flow-level gate-impl fails under unsafe taskless state**
  - Type: integration
  - Input: `currentTaskId=null`, task work remains, safe promotion predicate false, broad mode inactive, attempted step `gate-impl`
  - Expected: Gate does not run; command exits failure.

- **TC-9: Explicit broad implement succeeds with valid reason**
  - Type: acceptance
  - Input: Unsafe taskless state, attempted `implement`, broad mode active with non-empty reason
  - Expected: Broad implementation action is returned; flow state records step, reason, timestamp, and task cursor state.

- **TC-10: Broad implement rejected with empty reason**
  - Type: integration
  - Input: Broad mode requested for `implement` with empty, missing, or whitespace-only reason
  - Expected: Command fails before returning broad action; no broad-mode state record is written.

- **TC-11: Broad review rejected with empty reason**
  - Type: integration
  - Input: Broad mode requested for `review` with empty, missing, or whitespace-only reason
  - Expected: Review does not run; error requires a non-empty reason.

- **TC-12: Broad gate-impl rejected with empty reason**
  - Type: integration
  - Input: Broad mode requested for `gate-impl` with empty, missing, or whitespace-only reason
  - Expected: Gate does not run; error requires a non-empty reason.

- **TC-13: Broad mode records cursor state before execution**
  - Type: unit
  - Input: Broad mode active with `currentTaskId=null`, remaining task queue, valid reason
  - Expected: Persisted state includes attempted step, reason, timestamp, and task cursor snapshot matching pre-execution task state.

- **TC-14: Broad mode appears in status output**
  - Type: acceptance
  - Input: Flow state contains broad-mode execution record
  - Expected: `status` output visibly includes broad step, reason, timestamp, and task cursor state.

- **TC-15: Broad mode appears in report output**
  - Type: acceptance
  - Input: Flow state contains one or more broad-mode records
  - Expected: Report includes broad-mode history with enough detail to audit why broad execution occurred.

- **TC-16: Task-level review uses current task rendered markdown**
  - Type: integration
  - Input: `currentTaskId=task-A`, task-A has rendered current task spec markdown, parent requirement IDs also exist
  - Expected: Review input source is task-A rendered markdown; parent requirement IDs are not used to scope review.

- **TC-17: Task-level gate-impl uses current task rendered markdown**
  - Type: integration
  - Input: `currentTaskId=task-A`, task-A has rendered current task spec markdown, file-map data exists
  - Expected: Gate input source is task-A rendered markdown; file-map filtering is not applied for task gate.

- **TC-18: Task review fails when current task markdown cannot be loaded**
  - Type: integration
  - Input: `currentTaskId` points to a task whose rendered spec markdown is missing or unreadable
  - Expected: Review fails clearly; it does not fall back to parent requirement IDs or broad flow input.

- **TC-19: Task gate fails when current task markdown cannot be loaded**
  - Type: integration
  - Input: `currentTaskId` points to a task whose rendered spec markdown is missing or unreadable
  - Expected: Gate fails clearly; it does not fall back to file-map filtering or parent requirement IDs.

- **TC-20: Passing task gate reports completed task and next task start**
  - Type: acceptance
  - Input: Task gate passes, completion side effects run, another pending task exists
  - Expected: CLI output shows completed task id and identifies the next task that starts or is ready to start.

- **TC-21: Passing final task gate reports completion state**
  - Type: acceptance
  - Input: Task gate passes, completion side effects run, no pending tasks remain
  - Expected: CLI output shows completed task id and flow/task completion state.

- **TC-22: Failed task gate does not show task completion**
  - Type: integration
  - Input: Task gate fails
  - Expected: Completion side effects do not run; CLI output does not claim task completion or next task start.

- **TC-23: Final report includes one section per task**
  - Type: acceptance
  - Input: Multiple tasks with mixed statuses and artifacts
  - Expected: Report contains one row or section for each task with task id and task status.

- **TC-24: Final report includes available artifact results**
  - Type: acceptance
  - Input: Tasks have some combination of implementation summary, test-execute result, review result, and gate-impl result
  - Expected: Each task section includes only the artifact statuses/results that exist, without inventing missing data.

- **TC-25: Final report handles missing artifacts**
  - Type: unit
  - Input: Task has no implementation summary and no gate/review artifacts
  - Expected: Report still includes the task id and status, marking artifact availability as absent or omitting unavailable fields consistently.

- **TC-26: Promotion and broad-mode decisions are step-specific**
  - Type: unit
  - Input: Broad mode enabled for one attempted step only, then another step is attempted
  - Expected: Only the explicitly authorized step can proceed broadly; other steps still fail unless separately authorized with a reason.
