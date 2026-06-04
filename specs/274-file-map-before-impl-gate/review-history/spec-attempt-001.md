# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Instruction scope is narrower than the gate's file-map requirement
**Target:** R3 / Acceptance Criteria ("every testable requirement with implementation or test diff coverage")
**Issue:** validateFileMap() in src/flow/lib/test-artifacts.js (lines 803, 825-826) hard-requires a file-map.json entry for EVERY testable requirement: `expected = requirements.filter(r => r.testable !== false)`, then throws `file-map.json missing requirement entries` for any expected id without a non-empty entry. There is no 'only those with diff coverage' condition in the gate. R3 and the acceptance criteria instruct the agent to record entries only for testable requirements 'that has implementation or test diff coverage', which is strictly narrower than what the gate enforces. A testable requirement the agent judges to lack diff coverage (e.g. a constraint/'shall not change' requirement, or one satisfied by pre-existing code/tests) would be skipped per the instruction but still rejected by the gate — reproducing exactly the impl-gate stop this spec exists to prevent. Issue #353's own workaround recorded files for all of R1-R6, not a diff-covered subset.
**Required change:** Change R3 and the corresponding acceptance criterion so the instruction tells the agent to record a file-map entry for every testable requirement (matching validateFileMap's unconditional requirement), removing the 'with implementation or test diff coverage' qualifier as the gating condition.
**Why blocking:** If left unchanged, the instruction under-specifies the requirement set relative to the gate's trust validation. An agent following it literally can omit an entry for a testable requirement with no diff, causing validateIntegrationArtifactTrust to fail with ARTIFACT_PLACEHOLDER / 'missing requirement entries' — recreating the recurrence the spec targets, so the fix fails its stated goal.


## Non-blocking Improvements

### 1. Instruction host file left ambiguous between implement.md and impl-gate.md
**Target:** Overview > Modules / R1 / R4
**Improvement:** The spec lists both src/flow/prompts/impl/implement.md (instructionsKey impl.implement) and src/flow/prompts/impl/impl-gate.md (impl.impl-gate) as candidate locations but does not commit to one. Since the R4 spec-local test asserts on 'next-action instruction content for the flow-level implementation path', naming which instructionsKey the test loads (impl.implement vs impl.impl-gate) would prevent a mismatch where guidance lands in one file but the test reads the other.
**Why non-blocking:** Both prompts are flow-level-specific (task-impl uses the separate task.task-impl key), so either is a valid, implementable target; the implementer can keep the prompt edit and the test assertion consistent without a spec change.

### 2. Path-existence constraint of file-map validation not surfaced in instruction
**Target:** R2 / Acceptance Criteria (repo-relative changed file paths)
**Improvement:** validateFileMap resolves each recorded path with resolveRepoRelativePathInside(mustExist=true), so a deleted-file path or a path outside the repo root is rejected. Noting that paths must be existing repo-relative files would make the instruction match gate behavior more precisely.
**Why non-blocking:** The common case (changed/added files) satisfies this; it refines wording rather than blocking implementation or test design.
