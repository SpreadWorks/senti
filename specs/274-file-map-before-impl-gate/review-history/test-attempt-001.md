# Test Review Results

## Verdict: ADVISORY

Coverage artifact: `specs/274-file-map-before-impl-gate/test-coverage.json`

## Blocking Findings

No blocking findings.

## Advisory Findings

### 1. Duplicate alternative in testable-requirement regex
**Target:** specs/274-file-map-before-impl-gate/tests/file-map-instructions.test.js (assertFileMapGuidance / R3)
**Improvement:** The alternation `(testable requirement|testable requirement|テスト可能な requirement|テスト可能な要件)` lists "testable requirement" twice. Drop the redundant alternative for clarity.
**Why non-blocking:** Pure redundancy; the regex still matches correctly and exercises the required content, so it does not affect executability or coverage.

### 2. R4 enforces full file-map guidance on impl-gate.md, broader than R1/R3 minimal scope
**Target:** specs/274-file-map-before-impl-gate/tests/file-map-instructions.test.js (R4: assertFileMapGuidance on impl.impl-gate)
**Improvement:** R1/R3 only require the pre-gate (implement) instruction to carry timing, reqId/path semantics, and the CLI example. Requiring identical full guidance inside impl-gate.md — whose instructions are read at the gate, not before it — is stricter than the requirements demand and slightly awkward phrasing-wise. Consider scoping the impl-gate assertion to a reminder/back-reference rather than the complete semantics block.
**Why non-blocking:** R4 reasonably reads as covering the flow-level implementation path broadly; the extra assertion does not contradict any requirement and remains satisfiable, so it is a design preference, not a blocker.

### 3. R5 is a static string-presence tripwire rather than a behavioral check
**Target:** specs/274-file-map-before-impl-gate/tests/file-map-instructions.test.js (R5)
**Improvement:** R5 asserts literal substrings in set-files.js/req-map.js/test-artifacts.js. This guards the contract surface but would also pass independently of this spec's changes. A behavioral assertion (e.g., invoking appendFiles and checking the dedup result/INVALID_REQ_ID path) would more strongly anchor 'no behavior change.'
**Why non-blocking:** A string tripwire is an acceptable proxy for a 'shall not change' negative requirement and still exercises real production source; strengthening it is an optional improvement.
