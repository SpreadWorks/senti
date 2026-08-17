# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/269-unify-flow-step-names/test-coverage.json`

## Blocking Findings

### 1. R3 test encodes the old task-gate prompt premise
**Target:** specs/269-unify-flow-step-names/tests/definition-and-prompts.test.js
**Issue:** The test expects task-gate to keep instructionsKey "impl.impl-gate" and does not require src/flow/prompts/task/task-gate.md. R3 requires instructionsKey values and prompt filenames to move to the new step id while preserving the branch directory structure.
**Required change:** Assert that task-gate uses a task-scoped new prompt key/file, e.g. task.task-gate with prompts/task/task-gate.md, and assert the old task gate prompt filename is absent, unless the requirement is explicitly amended to allow shared impl prompts.
**Why blocking:** As written, the tests would reject a requirement-compliant task prompt rename and allow the old cross-branch prompt premise to remain.

### 2. R7 issue-log collision preservation is incomplete
**Target:** specs/269-unify-flow-step-names/tests/migration-tool.test.js
**Issue:** The fixture verifies issue-log.json preserves only the gate-impl collision. It does not include or assert preservation of the other required collision ids, review and impl.
**Required change:** Add issue-log.json fixture entries for step "review" and step "impl" and assert they remain unchanged after --apply.
**Why blocking:** An implementation that incorrectly migrates issue-log review or impl would pass while violating R7's required collision handling.

### 3. R5 authored prompt contents are not scanned
**Target:** specs/269-unify-flow-step-names/tests/test-and-skill-refs.test.js
**Issue:** R5 requires old step names to be absent from authored sources including src code, skills, and prompts, but the R5 scan only checks src/skills plus installed skill copies. src/flow/prompts contents are skipped elsewhere and old step names inside renamed prompt files would pass.
**Required change:** Include src/flow/prompts markdown files in the old-step-id scan, or add a dedicated prompt-content grep test for the rename target ids.
**Why blocking:** The requirement coverage artifact marks R5 covered, but a required grep target has no executable coverage.


## Advisory Findings

### 1. R9 changelog precondition assertion is weak
**Target:** specs/269-unify-flow-step-names/tests/docs.test.js
**Improvement:** Strengthen the CHANGELOG assertion from merely containing "active flow" to checking the stated merge precondition that there must be no other active flow.
**Why non-blocking:** The current test still covers the main breaking-change notice, migration tool reference, alias removal, and re-run guidance; this is a precision improvement for wording coverage.
