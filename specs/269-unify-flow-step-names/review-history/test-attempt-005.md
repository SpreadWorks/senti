# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/269-unify-flow-step-names/test-coverage.json`

## Blocking Findings

### 1. R2 collision and registry references are not covered
**Target:** specs/269-unify-flow-step-names/tests/code-references.test.js
**Issue:** The tests cover BROAD_STEPS, resolveGateStepId fallback, and unambiguous old literals, but they do not assert src/flow/registry.js REVIEW_RUNTIME_STEP_BY_PHASE or the review post-hook mapping. They also intentionally avoid bare collision ids such as review/gate/impl, so a wrong cross-scope resolution in registry or routes could pass.
**Required change:** Add focused assertions for REVIEW_RUNTIME_STEP_BY_PHASE/post-hook behavior and any collision-id sites that must resolve to impl-review/spec-review/test-review or task-* names.
**Why blocking:** R2 explicitly requires these cross-scope sites to be renamed correctly, and the current coverage artifact marks R2 covered while leaving required behavior untested.

### 2. R3 omits task-gate prompt rename coverage
**Target:** specs/269-unify-flow-step-names/tests/definition-and-prompts.test.js
**Issue:** The prompt existence/removal lists include task-impl and task-review, but not the task gate rename gate-impl[task]→task-gate. The old task/gate-impl.md file is also not asserted absent.
**Required change:** Add task/task-gate.md to expected prompt files and task/gate-impl.md to expected removed prompt files, if task-gate has prompt-backed instructions.
**Why blocking:** R3 requires prompt filenames and instructionsKey values to be updated for renamed step ids, including the task gate mapping.

### 3. R7 migration tool coverage does not exercise all required rename classes
**Target:** specs/269-unify-flow-step-names/tests/migration-tool.test.js
**Issue:** The fixture only exercises gate-draft plus the three collision ids. It does not test the other 1:1 rename entries such as review-draft-questions, review-draft-coverage, review-spec, review-test, or spec-review-triage. It also does not assert that dry-run prints a diff or that --apply refuses a dirty git worktree.
**Required change:** Expand the fixture/assertions to cover every 1:1 rename entry and add assertions for dry-run diff output plus dirty-git --apply refusal.
**Why blocking:** R7 requires exact migration behavior and exit-code behavior; the current tests could pass with a partial migration tool that misses several required step ids or skips clean-tree enforcement.

### 4. R8 is marked covered but tests only a synthetic fixture
**Target:** specs/269-unify-flow-step-names/tests/migration-tool.test.js
**Issue:** R8 requires the migration tool to be applied to this repository's specs/ and to preserve active flow 269's flow.json. The test creates temp specs alpha/active-spec instead, so it does not verify repository specs, active flow 269, or applied-file diffs.
**Required change:** Add a spec-local verification that inspects the real repository specs after migration, including active flow 269 flow.json remaining unchanged and migrated files showing new names where required.
**Why blocking:** The coverage artifact contradicts the actual test files: R8's repository-specific acceptance condition has no corresponding executable coverage.

### 5. R9 changelog test misses required breaking-change details
**Target:** specs/269-unify-flow-step-names/tests/docs.test.js
**Issue:** The test only checks for broad words like breaking, rename-phase-steps, active flow, and re-run. It does not require the changelog to state that old step names were removed without aliases, or that existing PRs/branches containing flow.json need the tool after merge.
**Required change:** Add assertions for alias/no-alias removal wording and for existing PR/branch plus flow.json migration guidance.
**Why blocking:** R9 requires those specific user-facing migration warnings, and the current test can pass while omitting them.


## Advisory Findings

### 1. R6 documentation assertion is very broad
**Target:** specs/269-unify-flow-step-names/tests/docs.test.js
**Improvement:** Strengthen the test to require an example and explicit phase-prefix requirement, not just the format token and the words phase/concern/action.
**Why non-blocking:** R6 is a should requirement, and the current test at least anchors the naming-convention section.
