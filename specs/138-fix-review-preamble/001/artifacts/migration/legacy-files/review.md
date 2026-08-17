# Code Review Results

### [ ] 1. Consolidate Repeated Module Imports in Tests
**File:** `specs/138-fix-review-preamble/tests/preamble.test.js`  
**Issue:** Almost every test re-imports `../../../src/flow/commands/review.js`, and the top-level `let stripPreamble` is only used by a dedicated “loads stripPreamble” test. This is duplicated setup and leaves an effectively dead variable/test pattern behind.  
**Suggestion:** Import the module once in a `before()` hook, store `{ stripPreamble, buildSpecFixPrompt }`, and remove the separate loader test plus the mutable outer variable.

**Verdict:** REJECTED
**Reason:** The repeated `await import(...)` in each test is intentional and correct for `node:test` — test execution order is not guaranteed, and the `let stripPreamble` + loader test pattern would create an ordering dependency where all subsequent tests silently fail if the loader test doesn't run first. Each test being self-contained with its own import is more robust. The "dead variable" observation is valid but the proposed fix (shared mutable state via `before()`) introduces a worse problem. The improvement is cosmetic and the risk is real.

### [x] 2. Avoid a Silently Non-Verifying Prompt Test
**File:** `specs/138-fix-review-preamble/tests/preamble.test.js`  
**Issue:** The `buildSpecFixPrompt` test passes even when `buildSpecFixPrompt` is not exported, so the requirement can remain unverified while the suite still reports success. That is inconsistent with the rest of the tests, which assert real behavior.  
**Suggestion:** Either export `buildSpecFixPrompt` explicitly and test it directly, or validate the prompt through a public API path. Remove the fallback `assert.ok(true)` branch.

**Verdict:** APPROVED
**Reason:** This is a genuine quality issue. The `assert.ok(true)` fallback on lines 82-84 means the test suite reports green even when `buildSpecFixPrompt` is not exported — and in fact it is NOT exported (it's absent from the export block). The test is currently dead code that provides false confidence. The function should either be exported and tested properly, or the test should be removed. A spec requirement ("buildSpecFixPrompt の出力にプリアンブル抑制の指示が含まれることをテストで確認") is going unverified.

### [ ] 3. Extract Markdown Fence Removal into a Small Helper
**File:** `src/flow/commands/review.js`  
**Issue:** Markdown-fence stripping is embedded inside `stripPreamble`, while the previous implementation already had equivalent fence-removal logic inline in `runSpecReview`. This kind of string-cleaning logic tends to get duplicated again in neighboring review/document flows.  
**Suggestion:** Introduce a narrowly named helper such as `stripMarkdownFences(text)` and have `stripPreamble()` compose it with the spec-header trimming. That keeps the spec-specific logic separate from generic cleanup and improves design consistency.

**Verdict:** REJECTED
**Reason:** Premature abstraction. The fence-removal logic is two simple regex replacements used in exactly one place (`stripPreamble`). The spec explicitly states "既存の `stripResponsePreamble` との共通ユーティリティ抽出（将来課題）" — the team intentionally deferred this. Extracting a helper now adds indirection without a concrete second consumer.

### [ ] 4. Make the Sanitizing Flow More Explicit
**File:** `src/flow/commands/review.js`  
**Issue:** `stripPreamble()` currently performs two distinct transformations: fence removal and pre-header trimming. The name suggests only the latter, so the behavior is broader than the API implies.  
**Suggestion:** Either rename it to something like `sanitizeSpecFixOutput`, or split it into `stripMarkdownFences()` + `stripSpecPreamble()` and call them sequentially in `runSpecReview()`. This makes intent clearer and reduces surprise for future callers.

**Verdict:** REJECTED
**Reason:** The function's JSDoc already documents both behaviors ("Strip AI preamble text... Also removes markdown fences"). The name `stripPreamble` is adequate — markdown fences wrapping AI output ARE part of the preamble problem. Renaming to `sanitizeSpecFixOutput` or splitting into two functions adds complexity for a naming preference. The spec explicitly defines `stripPreamble` by name in its requirements and tests; renaming would create unnecessary churn across spec docs, flow.json, and tests for no behavioral improvement.
