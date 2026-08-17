# Draft Review Results

8 issue(s) detected.

### 1. 1. Instance locations are still optional
**QA:** Q3  
**Issue:** Exhaustive enumeration is meant to make each required edit actionable, but `where` is optional even for repeated identical phrases. Multiple entries with the same `target` and no location would still be ambiguous.  
**Suggestion:** Require `where` for instance-level violations, or require each violation to be uniquely actionable by `target + where`. Add parser or test coverage for duplicate indistinguishable entries.

### 2. 2. Provider schema permissiveness is under-specified
**QA:** Q2  
**Issue:** The provider-facing schema allows `reason` and `violations` to both be absent, relying on parser rejection. The QA does not specify how malformed model output is surfaced, retried, or rendered to avoid confusing gate failures.  
**Suggestion:** Add a QA entry or expand Q2 to cover validation-error behavior, retry path, and error messages when FAIL lacks `violations` or PASS/SKIP lacks `reason`.

### 3. 3. Document-level violations may be over-collapsed
**QA:** Q3  
**Issue:** “Exactly one entry” for document-level guardrails could hide multiple independent document-level gaps, recreating the partial-fix loop for non-quote-based failures.  
**Suggestion:** Clarify whether document-level guardrails can emit multiple distinct gap descriptors. If only one is allowed, justify why that cannot mask multiple actionable gaps.

### 4. 4. Author-side scan scope is vague
**QA:** Q4  
**Issue:** “All relevant fields in draft.json/spec.json” is too imprecise to drive implementation or tests. It does not define which fields are relevant, which are excluded, or how task-scoped specs should be handled.  
**Suggestion:** Specify the scan boundary per artifact: e.g. requirement text, acceptance criteria, tasks, notes, overview, and explicitly excluded generated metadata.

### 5. 5. `reasonsFromEvaluations` behavior is not fully specified
**QA:** Q2/Q6  
**Issue:** The draft says `data.artifacts.reasons` holds rendered rows and that mocked-agent tests expect “two FAIL rows,” but it does not define whether one failed guardrail with two violations renders as one row with a joined reason or two separate rows.  
**Suggestion:** Add exact expected rendering shape for multi-violation FAILs, including whether rows are per guardrail or per violation.

### 6. 6. Issue-log decision may lose useful evidence
**QA:** Q5  
**Issue:** The answer chooses not to persist `violations[]` to issue-log, but the issue is about avoiding repeated partial fixes. Keeping only joined reason text may make cross-iteration comparison and debugging less precise.  
**Suggestion:** Either justify why structured violations are unnecessary across iterations, or propose persisting them in a backward-incompatible alpha-safe shape.

### 7. 7. Tests mention exports before proving they are desirable
**QA:** Q6  
**Issue:** The QA proposes exporting many internals, including prompt builders and schema constants, but does not assess whether this enlarges public/module surface unnecessarily.  
**Suggestion:** Separate “must export” from “can test indirectly.” Prefer testing through existing command seams unless direct export is needed for stable pure-function coverage.

### 8. 8. Review exclusion may miss related gate-like behavior
**QA:** Q9  
**Issue:** The answer says `review.js` is out of scope because it produces markdown, but the codebase context also includes `run-review.js` and test-result review flows. The QA does not check whether any review path has structured retry behavior similar to gate.  
**Suggestion:** Expand Q9 to explicitly cover `run-review.js` and `run-test-result-review.js`, or add a missing-coverage QA confirming only `run-gate.js` uses the affected JSON schema loop.
