# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/269-unify-flow-step-names/test-coverage.json`

## Blocking Findings

### 1. R3 instructionsKey-resolution test fails for metadata-only leaves (branch, prepare-spec)
**Target:** specs/269-unify-flow-step-names/tests/definition-and-prompts.test.js — test "R3: every leaf instructionsKey resolves to an existing prompt file"
**Issue:** The test iterates collectLeafIds() and, for every leaf whose node has an instructionsKey, asserts that prompts/<branch>/<step>.md exists. But src/flow/definition.js intentionally gives automated steps an instructionsKey for metadata only with no backing prompt file: `branch` (instructionsKey "plan.branch") and `prepare-spec` (instructionsKey "plan.prepare-spec") have no outputSchemaRef and no prompts/plan/branch.md or prompts/plan/prepare-spec.md. These are kept (unchanged) steps per R1. The authoritative tests/unit/flow/instructions-coverage.test.js excludes exactly these via `node.instructionsKey && node.outputSchemaRef`. As written, this spec-local test fails even on a correct implementation of the rename.
**Required change:** Add the same exclusion the existing coverage test uses: only assert prompt-file existence for leaves that also have outputSchemaRef (AI-prompt steps), e.g. `if (!node || !node.instructionsKey || !node.outputSchemaRef) continue;`.
**Why blocking:** The test contradicts the target API/definition invariant and will fail on a correct implementation, forcing the implementer to either create out-of-scope prompt files or null out metadata instructionsKeys — both incorrect. Per project rule, test code must not be edited to pass, so this design flaw must be fixed before implementation.

### 2. R7/R8 report.json/retro.json/review.md selective replacement has no test coverage
**Target:** specs/269-unify-flow-step-names/tests/migration-tool.test.js (fixtures makeFixture/flowJson/issueLogJson)
**Issue:** R7 (must) requires the migration tool to replace old step names inside report.json/retro.json/review.md but ONLY within code blocks / path strings (not prose), and R8 (must) verifies these files are converted in specs/. There are 761 such files in the repo. The test fixture only writes flow.json and issue-log.json, so the code-block/path-string-only replacement behavior is never exercised. A no-op implementation (touching only flow.json/issue-log.json) or an over-broad implementation (rewriting prose) both pass every spec-local test. The coverage artifact marks R7/R8 "covered" by this file, which contradicts what the test actually exercises.
**Required change:** Add fixture files (report.json, retro.json, review.md) containing old step names in both code-block/path-string positions and in prose, and assert after --apply that code-block/path-string occurrences are renamed while prose occurrences are left untouched.
**Why blocking:** A must-level, distinct, error-prone behavior has zero executable coverage, and the requirement coverage artifact overclaims it as covered — an incorrect implementation would pass review undetected.


## Advisory Findings

### 1. R2/R5 grep checks only the 7 unambiguous old tokens, not all 10 rename targets
**Target:** specs/269-unify-flow-step-names/tests/code-references.test.js and tests/test-and-skill-refs.test.js — UNAMBIGUOUS_OLD_IDS
**Improvement:** The collision tokens (review, impl, gate) are excluded from the bare-literal grep, so R2's '10種 grep 0件' completion criterion is only partially enforced statically. Consider adding scope-aware assertions (or contextual checks) that the flow-scope review/impl/gate sites resolve to impl-*/spec-gate and task-scope sites to task-*, to close the residual gap.
**Why non-blocking:** review/impl/gate collide with kept ids, branch names, and command names, so a safe bare-literal grep is not possible; the renamed behaviors are already verified behaviorally via BROAD_STEPS and resolveGateStepId assertions, giving meaningful coverage.

### 2. R4 grep does not confirm the unit suite actually passes
**Target:** specs/269-unify-flow-step-names/tests/test-and-skill-refs.test.js — test "R4: tests/unit/flow has no unambiguous old step-id literals"
**Improvement:** R4 also requires that npm test's unit suite passes after the rename; the spec-local test only asserts absence of old literals in tests/unit/flow, not that the updated assertions are correct against new ids.
**Why non-blocking:** Runtime pass/fail of the unit suite is owned by test-execute/test-result-review; the static literal-absence check is a reasonable proxy for the static portion of R4.

### 3. R8 verified only against synthetic fixtures, not the real repo specs/ deliverable
**Target:** specs/269-unify-flow-step-names/tests/migration-tool.test.js — test "R8: --apply converts flow.json by scope..."
**Improvement:** R8's deliverable is the actual conversion of this repo's specs/ (with active flow 269 left untouched). The test exercises the tool logic on a tmp fixture rather than asserting on the repo's converted files.
**Why non-blocking:** Asserting against live repo files during a unit test would be order-dependent and mutate the working tree; the tool's scope-distinction and active-flow exclusion logic are covered by the fixture, and the one-time repo migration is verifiable by diff at implementation time.
