# Code Review Results

### 1. 1. Preserve Field Rendering Semantics
**File:** `src/flow/commands/review.js`  
**Issue:** `formatDraftQaResponseFieldLine()` trims string values before rendering. This subtly changes existing output for `Answer`, `Evidence`, `Why`, and `Dropped reason`, while R7 says parser-visible fields should remain unchanged except for adding `**Considered:**`.  
**Suggestion:** Use trimming only to decide fallback emptiness, but render the original string value when non-empty:

```js
const text = trimmed !== "" ? value : fallback;
```

### 2. 2. Narrow Helper Naming To Markdown QA Lines
**File:** `src/flow/commands/review.js`  
**Issue:** `formatDraftQaResponseFieldLine` is somewhat broad and implies response-specific behavior, but it actually formats a markdown field line with fallback handling.  
**Suggestion:** Rename it to something like `formatDraftQaMarkdownFieldLine` or `formatDraftQaFallbackFieldLine` to match its concrete behavior and keep naming consistent with nearby `formatDraft*ReviewEntry` helpers.

### 3. I’ll inspect the touched file around the changed validation paths so the proposals are grounded in the surrounding design, not just the patch fragment.The workspace path here does not contain the touched file, so I’m using the supplied diff as the source of truth for the review. The patch is small enough to assess the quality concerns directly.### 1. Derive Overlapping QA Field Sets
**File:** `src/flow/lib/draft-lifecycle.js`
**Issue:** `answer`, `evidence`, and `why` are repeated across multiple QA field constants, which creates drift risk when the field contract changes again.
**Suggestion:** Define a base constant such as `DRAFT_QA_ANSWER_FIELDS = Object.freeze(["answer", "evidence", "why"])`, then derive `DRAFT_QA_RESPONSE_FIELDS`, `DRAFT_QA_ANSWER_REQUIRED_FIELDS`, and possibly `DRAFT_QA_FIELDS` from it.

### 4. 2. Extract Empty-Field Validation Loop
**File:** `src/flow/lib/draft-lifecycle.js`
**Issue:** The same “field must be empty when status is X” loop appears for pending/approved and dropped entries.
**Suggestion:** Add a small helper in this file, for example `pushEmptyFieldIssues(issues, index, status, raw, fields)`, and reuse it in both branches. This keeps the lifecycle rules focused on state-specific field sets rather than repeated issue-building mechanics.

### 5. I’ll inspect the touched file plus the imported helpers so the review is grounded in the repo’s current patterns, while keeping proposals scoped to the diff file only.The provided working directory is a `.tmp` subdirectory and doesn’t contain `src/` directly, so I’m checking the surrounding worktree layout before drawing conclusions from the diff.The repo root is the parent worktree directory, so the diff paths are available there. I’m reading from inside that worktree boundary.The include helper already enforces the stated depth and count bounds, so the guardrail looks satisfied by this change. I’m checking whether the new call shape is duplicated elsewhere or creates a local design consistency issue.### 1. Preserve the loader error contract for include failures
**File:** `src/flow/lib/get-step-instructions.js`  
**Issue:** The file comment says failures include the offending `instructionsKey`, but `resolveIncludes()` errors will currently surface without that key.  
**Suggestion:** Wrap the `resolveIncludes()` call and rethrow with an `INSTRUCTIONS_INCLUDE_RESOLVE_FAILED` message that includes `instructionsKey`, `filePath`, and the original error as `cause`.

### 6. 2. Clarify raw vs resolved prompt content
**File:** `src/flow/lib/get-step-instructions.js`  
**Issue:** `content` now means “raw file content before include expansion,” but the function returns expanded content.  
**Suggestion:** Rename `content` to `rawContent` so the read/resolve flow is explicit:

```js
let rawContent;
// ...
rawContent = readFileSync(filePath, "utf8");
// ...
return resolveIncludes(rawContent, { ... });
```

### 7. 1. Avoid Adding a Placeholder QA Entry Unless Required
**File:** `src/flow/lib/run-prepare-spec.js`
**Issue:** The draft template now initializes `qa` with a synthetic pending entry (`q1`) instead of preserving an empty QA array. R4 requires `qa[].considered` for entries, but does not require a draft skeleton to create an initial pending question. This may introduce a meaningless empty QA item into new specs.
**Suggestion:** Keep `qa: []` unless another requirement explicitly mandates a starter QA entry. If a starter entry is required, add a clear local comment or test tying that behavior to the requirement.

### 8. 2. Inline Single-Use Template Helper
**File:** `src/flow/lib/run-prepare-spec.js`
**Issue:** `buildPendingQaTemplateEntry()` is currently a single-use helper that only returns a static object. This adds indirection without reducing duplication.
**Suggestion:** Inline the QA entry object inside `buildDraftTemplateObject()`, or keep the helper only if other draft-building paths will reuse it soon.

### 9. 1. Extract repeated regex assertion loops
**File:** `tests/unit/flow/commands/review.test.js`  
**Issue:** The added tests repeat the same pattern: define regex arrays, then loop through `assert.match` or `assert.doesNotMatch`.  
**Suggestion:** Add small local helpers such as `assertAllMatch(prompt, patterns)` and `assertAllDoesNotMatch(prompt, patterns)` in the describe block to reduce duplication and make failures easier to scan.

### 10. 2. Rename regex arrays to reflect their type
**File:** `tests/unit/flow/commands/review.test.js`  
**Issue:** Names like `coverageOnlyContent` and `omittedQuestionStageContent` sound like text content, but they are regex patterns.  
**Suggestion:** Rename them to `coverageOnlyPatterns`, `omittedQuestionStagePatterns`, `leakedAnswerFieldPatterns`, and `renderedResponseFieldPatterns`.

### 11. 3. Split empty `considered` fallback into its own test
**File:** `tests/unit/flow/commands/review.test.js`  
**Issue:** The `(none)` fallback assertion is embedded inside the broader “limits review-draft-coverage input” test, mixing projection filtering with formatting behavior.  
**Suggestion:** Move the `emptyConsideredPrompt` assertion into a separate `it("renders empty considered as (none) in coverage review", ...)` test for clearer intent and easier failure diagnosis.

### 12. 1. Align QA Field Contract Constants With Rendering
**File:** `src/flow/lib/draft-lifecycle.js`
**Issue:** QA fields such as `answer`, `evidence`, `why`, and `considered` appear to be handled independently across lifecycle validation, draft template generation, and review prompt rendering. This creates drift risk in the parser-visible QA contract.
**Suggestion:** Centralize the QA field definitions/order in one lifecycle or model module, then have `review.js` and `run-prepare-spec.js` consume that contract where practical.

### 13. 2. Avoid Inconsistent Starter QA Semantics
**File:** `src/flow/lib/run-prepare-spec.js`
**Issue:** `run-prepare-spec.js` may create a synthetic pending QA entry, while `draft-lifecycle.js` appears to validate status-specific QA fields and `review.js` renders existing QA entries. This can make an empty draft look like it already has a real pending question.
**Suggestion:** Keep new drafts at `qa: []`, or explicitly define starter-entry semantics in the shared QA lifecycle contract and ensure validation/rendering/tests all expect it.

### 14. 3. Normalize QA Naming Across Files
**File:** `src/flow/commands/review.js`
**Issue:** Names like `formatDraftQaResponseFieldLine`, lifecycle constants such as `DRAFT_QA_RESPONSE_FIELDS`, and test names around rendered response fields may use “response” inconsistently for markdown field rendering, answer fields, and QA entry data.
**Suggestion:** Pick one vocabulary: for example, use `QaField`/`QaMarkdownFieldLine` for rendering and reserve `QaResponse` only for actual answered QA state. Rename helpers/tests accordingly.
