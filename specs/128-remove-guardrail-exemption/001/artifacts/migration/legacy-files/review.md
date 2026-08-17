# Code Review Results

### [x] 1. Remove unused `translate` import
**File:** `src/flow/run/gate.js`
**Issue:** `translate` is imported but not used anywhere in the module. It is now dead code and makes the file look like it still depends on localized prompt/message generation.
**Suggestion:** Remove `translate` from the import list to keep dependencies accurate and reduce noise.

**Verdict:** APPROVED
**Reason:** Removing a genuinely unused import is a clear improvement — it eliminates a false dependency signal and reduces reader confusion. Zero risk of behavior change. However, note that this change is **not shown in the provided diff**, so the reviewer should verify the import is actually unused before merging.

### [ ] 2. Centralize guardrail prompt text
**File:** `src/flow/run/gate.js`
**Issue:** `buildGuardrailPrompt()` embeds multiple hardcoded instruction strings directly in the command module. Elsewhere in the codebase, prompt construction is more intentionally separated or backed by prompt/i18n helpers, so this is drifting from the existing pattern.
**Suggestion:** Move the prompt template into a dedicated prompt builder or prompt catalog entry, and keep `buildGuardrailPrompt()` focused on injecting dynamic data like the article list and spec text.

**Verdict:** REJECTED
**Reason:** This is a speculative architectural refactoring with no concrete benefit demonstrated. The prompt in `buildGuardrailPrompt()` is tightly coupled to the guardrail check logic (it formats the article list, injects spec text, defines the output format). Extracting it into a "prompt catalog" adds indirection without reducing complexity. The claim that this "drifts from existing patterns" is not substantiated by the diff — the function is already well-scoped. This risks over-engineering for a single call site.

### [ ] 3. Deduplicate repeated guardrail/spec fixtures in tests
**File:** `tests/unit/specs/commands/guardrail.test.js`
**Issue:** The test file repeats the same guardrail object shape and similar spec snippets across multiple cases. That duplication increases maintenance cost when the prompt format or required spec sections change again.
**Suggestion:** Introduce small local helpers such as `makeSpec()`, `makeSpecGuardrail(title)`, or shared fixture constants so test intent is clearer and future updates touch fewer lines.

**Verdict:** REJECTED
**Reason:** The test file shown in the diff has only **two test cases** in the new `describe` block, with a single shared `guardrails` array already extracted. The duplication is minimal. Introducing `makeSpec()` / `makeSpecGuardrail()` helpers for two tests adds abstraction that obscures test intent — each test should clearly show its input. This is cosmetic refactoring that trades readability for DRY dogma at this scale.

### [x] 4. Rename the new test block to match actual behavior
**File:** `tests/unit/specs/commands/guardrail.test.js`
**Issue:** The suite name `buildGuardrailPrompt without exemptions` is misleading because the spec fixture still contains a `## Guardrail Exemptions` section; the real behavior under test is that exemptions are ignored rather than absent.
**Suggestion:** Rename the suite and test case to something like `buildGuardrailPrompt ignores exemption sections` so the behavior change is explicit and easier to understand from test output.

**Verdict:** APPROVED
**Reason:** The current suite name `buildGuardrailPrompt without exemptions` is genuinely misleading — the first test case explicitly includes a `## Guardrail Exemptions` section in the spec fixture and asserts that Rule B is **not** filtered out. The behavior under test is "exemptions are ignored," not "exemptions are absent." Renaming to something like `buildGuardrailPrompt ignores exemption sections` accurately describes the behavioral contract and makes test output more useful for future developers. Zero risk of breaking behavior.
