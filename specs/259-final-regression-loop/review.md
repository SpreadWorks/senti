# Code Review Results

### 1. 1. Compact duplicated gate summaries
**File:** `specs/259-final-regression-loop/issue-log.json`  
**Issue:** The two new `"step": "gate"` entries store very long semicolon-delimited `reason` strings that duplicate information already represented by `failedEvaluations` and `passedGuardrails`. This makes the log noisy and harder to review.  
**Suggestion:** Keep `reason` as a concise summary of the failed guardrail, and rely on `failedEvaluations` / `passedGuardrails` for structured detail.

### 2. 2. Standardize step naming
**File:** `specs/259-final-regression-loop/issue-log.json`  
**Issue:** Added entries use mixed step naming styles: `review-test`, `task.impl`, `gate-impl`, `review`. The mix of hyphen and dot notation makes filtering and analysis less consistent.  
**Suggestion:** Use one existing convention consistently for added entries, preferably the convention already expected by the flow tooling, such as `task-impl` or `task.impl`.

### 3. 3. Remove redundant “fix:” prefixes from reasons
**File:** `specs/259-final-regression-loop/issue-log.json`  
**Issue:** The `gate-impl` entries include `reason` values starting with `fix:`, while the `step` already identifies the entry as an implementation fix.  
**Suggestion:** Make `reason` a plain problem statement, e.g. `"added final-regression exit-code contract clarification"`, and keep the fix details in `resolution`.

### 4. 1. Bound raw output processing
**File:** `specs/259-final-regression-loop/spec.json`
**Issue:** The new requirements describe reading full raw logs and combining stdout/stderr/spawn/discovery output as failure evidence, but do not define byte, line, or entry limits. This risks violating `bounded-resource-usage`.
**Suggestion:** Add explicit caps for raw log input, captured process output, combined failure evidence size, and `rawOutputLines`, plus truncation behavior.

### 5. 2. Reduce duplicated final-regression wording
**File:** `specs/259-final-regression-loop/spec.json`
**Issue:** The same final-regression routing concepts are repeated across `context`, `data_flow`, `decisions`, and requirements, especially around changed-file matching and regression-repair routing.
**Suggestion:** Keep the normative behavior in the requirements, and make the contextual entries shorter references to those requirement IDs to reduce drift.

### 6. 3. Normalize implementation status metadata
**File:** `specs/259-final-regression-loop/spec.json`
**Issue:** Every requirement now repeats `"status": "done"`, while other added entries use `"added_by_task"`. The metadata style is inconsistent and increases noise in the spec.
**Suggestion:** Prefer one completion-tracking mechanism. If requirement completion is needed, use a single top-level implementation/progress section or consistently tag task-derived entries.

### 7. 1. Consolidate duplicated rawOutputText explanation
**File:** `specs/259-final-regression-loop/spec.md`
**Issue:** The new `rawOutputText` behavior is described in Context, Data Flow, and Decisions with slightly different wording.
**Suggestion:** Keep the contract-level statement in Data Flow and shorten the Context/Decisions bullets to references, reducing drift risk.

### 8. 2. Add an explicit raw log size bound
**File:** `specs/259-final-regression-loop/spec.md`
**Issue:** The spec says `test-result-review` reads `tests/.raw/test-execution.log` and passes the text through, but it does not state any maximum size. This conflicts with `bounded-resource-usage` for bulk data loading.
**Suggestion:** Add a concrete bound, such as max bytes read from raw logs or max characters passed as `rawOutputText`, and define the failure behavior when exceeded.

### 9. 3. Simplify the exit-code-contract clarification
**File:** `specs/259-final-regression-loop/spec.md`
**Issue:** The clarification lists many failure modes inline, making the contract harder to scan and easier to duplicate elsewhere.
**Suggestion:** Replace the long enumeration with a named category like “failed envelopes” and define that category once nearby, or split it into a compact bullet list.

### 10. 1. Fix `boundedText` Length Contract
**File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `boundedText()` can return `maxChars + 1` characters when `maxChars` is even because it adds a newline between two equal halves.  
**Suggestion:** Reserve one character for the separator:

```js
const head = Math.floor((maxChars - 1) / 2);
const tail = maxChars - 1 - head;
return `${text.slice(0, head)}\n${text.slice(-tail)}`;
```

### 11. 2. Rename Evidence Constants for Intent
**File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `FAILURE_EVIDENCE_SOURCE_COUNT` and `FAILURE_EVIDENCE_SEPARATOR_CHARS` describe implementation mechanics rather than the classification purpose.  
**Suggestion:** Rename toward intent, e.g. `FAILURE_EVIDENCE_INPUT_COUNT` and `FAILURE_EVIDENCE_JOINER_CHARS`, or inline the separator count if it is only used once.

### 12. 3. Avoid Silent Changed File Truncation Classification
**File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `failureReferencesChangedFile()` truncates to `MAX_CHANGED_FILES_TO_MATCH`, while `classifyFailure()` separately checks the limit. This creates two sources of truth for the same bound.  
**Suggestion:** Move the limit handling into one helper, e.g. `changedFilesWithinMatchLimit(changedFiles)`, and pass only pre-bounded files into the matcher. This makes the guardrail behavior easier to audit.

### 13. 4. Simplify Empty Value Normalization
**File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `String(value || "")` treats `0` and `false` as empty strings. That is probably harmless here, but less precise than the surrounding code implies.  
**Suggestion:** Use nullish handling instead:

```js
const text = String(value ?? "");
```

This preserves non-null scalar values while still handling missing evidence cleanly.

### 14. 1. Extract Shared Evidence Context
**File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** The same context object fields are assembled twice for `validateSummary` and `validateProjectRegression`.  
**Suggestion:** Create one `evidenceContext` object after `requirements` is computed and pass it to both helpers:

```js
const evidenceContext = { root, rawOutputText, rawLines, requirements };

const checked_items = [
  validateSummary(result, evidenceContext),
  validateRegressionRawRange(result, rawLines),
  validateProjectRegression(result, evidenceContext),
];
```

### 15. 2. Add an Explicit Bound for Raw Output Loading
**File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `fs.readFileSync(rawOutputPath, "utf8")` and `rawOutputText.split(/\r?\n/)` load and split the entire raw test log without an explicit size bound, which conflicts with the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Check the file size before reading, using a project-appropriate maximum, and fail deterministically if the raw log exceeds that limit.

### 16. 1. Replace ambiguous “retro” wording
**File:** `src/flow/prompts/plan/scenario-validity.md`
**Issue:** The phrase “after retro” is unclear and inconsistent with the surrounding phase terminology. It could be misread as referring to a retrospective step instead of post-implementation verification.
**Suggestion:** Change it to the existing workflow language, e.g. “Default full project regression remains in `impl/final-regression` after implementation.”

### 17. 1. Clarify failure fixture intent
**File:** `tests/unit/flow/final-regression.test.js`  
**Issue:** `writeFailingFixture` does more than make the fixture fail: it deliberately includes `FIXTURE_PATH` in stderr so the classifier links the failure to a changed file. That behavior is important for R4 but hidden in the generic name.  
**Suggestion:** Rename it to something like `writeChangedFileReferencingFailureFixture` or `writeCurrentChangeFailureFixture` so the test setup makes the classification precondition explicit.

### 18. 2. Extract repeated passing fixture body
**File:** `tests/unit/flow/final-regression.test.js`  
**Issue:** `"console.log('initial pass');\n"` is repeated in multiple test setup calls.  
**Suggestion:** Add a small constant such as `const PASSING_FIXTURE_BODY = "console.log('initial pass');\n";` and use it in the affected tests. This keeps fixture naming consistent with `FIXTURE_PATH` and makes future setup changes less scattered.
