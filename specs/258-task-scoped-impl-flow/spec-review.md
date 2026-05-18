# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Task-scoped requirement/file source is undefined
**Target:** R3 / Scope In / T-3
**Issue:** The spec requires task-level review/gate-impl to limit requirement lists and files to the current task, but the verified task schema only has goal, acceptance, implementation_notes, and test_strategy; syncSpecTasksToFlow currently creates flow task requirements as an empty array, and run-gate derives requirement IDs/files from parent spec.requirements plus file-map.json. There is no defined source or mapping for task-specific requirement IDs or task-specific file sets.
**Required change:** Define the exact task-scoped source for gate/review inputs: either add/sync task requirement IDs and file mappings, or state that task gates use only the current task spec markdown and do not use parent requirement/file-map filtering.
**Why blocking:** Without this correction, implementers cannot know which requirements or files to include/exclude, and tests cannot assert that gate-impl is actually task-scoped instead of accidentally evaluating the parent spec or whole diff.

### 2. Broad implementation opt-in has no CLI integration point
**Target:** Goal / R2 / R4 / Acceptance Criteria
**Issue:** The spec applies strict currentTaskId enforcement and explicit broad mode to implement, review, and gate-impl, but the codebase has run-review and run-gate commands while implementation is exposed as the next-action action run-impl rather than a flow run implement command. The spec only gives broad-mode acceptance cases for review and gate, so broad implementation cannot be enabled or audited through a defined CLI path.
**Required change:** Specify the implementation entrypoint for broad mode, such as a get next-action broad-mode option, a new run command, or explicitly narrow broad mode to review/gate and state how run-impl is prevented when currentTaskId is null.
**Why blocking:** The CLI cannot enforce or audit the implement part of the invariant; a broad implementation can still proceed through the dispatcher/manual run-impl path without the required reason or audit record.

### 3. Null cursor recovery predicate conflicts with mid-implementation failure policy
**Target:** R1 / R2 / Clarifications
**Issue:** R1 says the dispatcher promotes the next pending task when any non-terminal task exists, while R2 and the clarification say currentTaskId null with task work remaining must fail except at dispatcher-owned cursor boundaries. Existing task state distinguishes pending and in_progress tasks, but the spec does not define the exact safe boundary predicate.
**Required change:** Define when auto-promotion is allowed, for example: currentTaskId is null, no task is already in_progress, no task step is in_progress, and a pending leaf exists; otherwise fail with recovery guidance unless explicit broad mode is active.
**Why blocking:** An implementation could promote a new pending task over an orphaned in-progress task or reject a legitimate post-completion boundary, producing unsafe task ordering and untestable cursor behavior.


## Non-blocking Improvements

### 1. Report target can name the report generator
**Target:** Overview Modules / R6
**Improvement:** Mention src/flow/lib/run-report.js and src/flow/commands/report.js as the primary final-report rendering targets; run-finalize-cleanup mainly embeds the already generated report in its envelope.
**Why non-blocking:** The current codebase context already includes report.js and the requirement is clear enough to implement by following existing report generation paths.

### 2. Status visibility target can be explicit
**Target:** R4
**Improvement:** If broad audit visibility through status is desired, name src/flow/lib/get-status.js and the expected field shape; otherwise state that report visibility alone satisfies R4.
**Why non-blocking:** The spec allows either status or report output, so implementers can choose report-only visibility without blocking the core behavior.
