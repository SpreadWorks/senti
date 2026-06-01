# Test Review Results

## Verdict: ADVISORY

Coverage artifact: `specs/270-workflow-flow-integration/test-coverage.json`

## Blocking Findings

No blocking findings.

## Advisory Findings

### 1. R2 spec-local coverage is limited to input validation
**Target:** specs/270-workflow-flow-integration/tests/issue-start.test.js
**Improvement:** issue-start.test.js only exercises validateIssueNumber. R2's distinctive contracts — not-found returns ok=true/data.matched=false, already-In-Progress no-op, and board/gh-unavailable returns a non-fatal skipped ok=true result — have no spec-local test. Consider structuring issue-start.js so a board-loader/status mover can be injected, then add unit tests asserting the matched=false envelope and the skipped envelope without a real board.
**Why non-blocking:** These behaviors require board/gh execution and runtime pass/fail is explicitly owned by scenario-validity, test-execute, test-result-review, and final-regression. The pure-logic clause (positive-integer validation) is covered statically, so implementation is not blocked.

### 2. R4/R5 template tests assert string presence, not the gating relationship
**Target:** specs/270-workflow-flow-integration/tests/templates.test.js
**Improvement:** The tests only check that 'flowIntegration', 'issue-start', 'issue-log-import', and 'workflow add' each appear somewhere in the markdown. They would pass even if the directives are mentioned outside the required conditional gate. Consider asserting that the template reads config.json workflow.flowIntegration the same way as the existing config.lang reference, and that the issue-start / issue-log-import calls appear inside the flowIntegration-enable conditional block.
**Why non-blocking:** The deliverable for R4/R5 is prose AI-instruction markdown with no machine-checkable conditional syntax; a presence check still verifies the template was edited to include the gate, and the precise gating behavior is validated downstream rather than statically.

### 3. R7 test verifies commandId declaration only
**Target:** specs/270-workflow-flow-integration/tests/issue-log-import.test.js
**Improvement:** The R7 test checks ISSUE_LOG_IMPORT_COMMAND_IDS equals the three classify/similarity/compose ids but does not assert that the AI calls route through matchProfilePrefix-based provider switching nor that no extra provider config schema was added. A lightweight assertion that these ids are passed to the existing commandId-based agent invocation path would strengthen coverage.
**Why non-blocking:** R7 is a should-level requirement and the declared-commandId check is a reasonable proxy; the matchProfilePrefix wiring and no-extra-schema invariant are better confirmed at runtime/config-validation time.
