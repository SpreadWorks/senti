# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Test headers cannot cover requirements marked non-testable
**Target:** Requirements R1-R3 and Acceptance Criteria
**Issue:** R1, R2, and R3 are marked testable=false, but the acceptance criteria require spec-local tests under specs/278-shared-regression-placement-guardrail/tests/ to verify R1 through R4 with // spec: R<N> headers. Existing test-header validation excludes testable=false requirements from coverage and reports an error when a non-testable requirement appears in a test header.
**Required change:** Make R1, R2, and R3 testable by removing testable=false, or change the acceptance criteria so spec-local test headers do not claim R1-R3.
**Why blocking:** If left unchanged, implementers cannot satisfy both the spec acceptance criteria and the existing test-header contract: including R1-R3 in headers fails validation, while omitting them fails the stated acceptance basis.


## Non-blocking Improvements

### 1. Mention generated skill target paths
**Target:** Overview / T-2
**Improvement:** The spec could name the generated deployment targets .agents/skills/sdd-forge.flow/SKILL.md and .claude/skills/sdd-forge.flow/SKILL.md, because src/lib/skills.js deploys bundled skills to both locations during upgrade.
**Why non-blocking:** The current spec already requires running sdd-forge upgrade and including generated diffs, so implementation remains possible without this extra path detail.
