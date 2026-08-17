# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/277-post-flow-board-candidates/test-coverage.json`

## Blocking Findings

### 1. Missing coverage for dispatcher-loop placement
**Target:** specs/277-post-flow-board-candidates/tests/post-flow-board-candidates.test.js R2
**Issue:** R2 requires the optional post-flow board candidate guidance to be described after the dispatcher loop exit, but the test only checks that a post-flow section exists and contains completion/optional wording. It does not verify placement after the dispatcher loop exit or any loop-exit marker.
**Required change:** Add a spec-local assertion that the post-flow guidance appears after the dispatcher loop exit/completion handling in src/skills/sdd-forge.flow/SKILL.md, and ideally in generated skill artifacts if their placement matters.
**Why blocking:** An implementation could place the guidance before or inside the dispatcher loop while still satisfying the current regex checks, contradicting an explicit acceptance requirement.


## Advisory Findings

No advisory findings.