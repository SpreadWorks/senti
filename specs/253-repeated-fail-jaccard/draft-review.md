# Draft Review Results

7 issue(s) detected.

### 1. I’ll verify the draft’s codebase claims enough to judge whether the QA entries are specific, supported, and complete. I’m only reviewing the draft, not changing code.The worktree path provided in the prompt does not appear to contain `src/`, `tests/`, or `specs/` at this level. I’ll inspect the directory shape so I can distinguish missing workspace context from draft problems.### 1. Fixture Scope Contradicts Same-Phase Rule
**QA:** Q8  
**Issue:** Several fixture groups intentionally combine different phases, but Q1/Q2/Q10 define escalation as comparing only prior FAILs from the same phase. Cases like “spec 2 + task-impl 1” would not exercise production escalation as described.  
**Suggestion:** Split calibration fixtures from production behavior tests. For escalation tests, use only same-phase prior/current entries, or explicitly label cross-phase fixtures as threshold calibration only.

### 2. 2. Empty-Set Behavior Conflicts With Issue Pseudocode
**QA:** Q6  
**Issue:** The answer overrides the issue pseudocode’s `union === 0 ? 1` behavior, but the evidence depends on an external conversation log not present in the request/issue context. This makes the spec decision look unsupported.  
**Suggestion:** Either align with the issue pseudocode, or add an explicit “confirmed deviation” requirement with a durable source and acceptance tests for both-empty, one-empty, and disjoint cases.

### 3. 3. Stopword List Is Over-Specified Without Evidence
**QA:** Q4  
**Issue:** The exact 30-word STOPWORDS set is treated as fixed, but the evidence only cites the normalization regex and filter shape. The draft does not show why this list is correct or how it preserves the stated A/B threshold separation.  
**Suggestion:** Add measured max-similarity results for the fixture groups using this exact list, or reframe the stopword list as a design decision needing confirmation.

### 4. 4. Jaccard Formula Is Only Implied
**QA:** NEW  
**Issue:** The draft says “Jaccard” and mentions sets, but no QA entry explicitly fixes the formula: `intersection.size / union.size`, duplicate-token handling, symmetry, and numeric precision.  
**Suggestion:** Add a QA entry that defines `jaccard(a, b)` exactly, including set semantics, denominator behavior, and expected examples.

### 5. 5. Internal Exports Are Treated As Product Contract
**QA:** Q7  
**Issue:** Exporting `normalize` and `jaccard` solely for tests over-specifies the module API and may expose implementation details as stable surface area. The rationale is test convenience, not product behavior.  
**Suggestion:** Clarify whether these are intended public/internal test exports. Prefer behavior-level tests through `assertNoRepeatedFail`, or explicitly mark helper exports as internal testable utilities.

### 6. 6. Tie-Breaking Choice Is Arbitrary
**QA:** Q2  
**Issue:** Choosing the oldest prior entry on equal similarity is deterministic, but the evidence does not support why oldest is more useful than latest or all tied matches.  
**Suggestion:** Either justify oldest with a concrete workflow need, or choose latest prior as more actionable for retry context, or report all tied max matches.

### 7. 7. Q1 And Q2 Partially Duplicate Scope Decisions
**QA:** Q1, Q2  
**Issue:** Both entries define the expansion from one prior FAIL to all prior same-phase FAILs and flattening behavior. This makes the draft longer without adding much distinct decision value.  
**Suggestion:** Merge Q1’s scope decision into Q2, or narrow Q1 to only the product requirement while Q2 covers deterministic implementation details.
