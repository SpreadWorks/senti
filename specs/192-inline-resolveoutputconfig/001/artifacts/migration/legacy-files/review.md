# Code Review Results

### [x] 1. Restore `finalize` Retro Invocation Contract
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `RetroCommand.run(...)` was changed from `run(container, ...)` to `run({ ...ctx, ... })`, which reintroduces the exact interface mismatch that previously caused `container.get is not a function`.  
**Suggestion:** Revert to container-based invocation (or align `RetroCommand.run` signature explicitly across flow commands), and add/restore a behavior-level regression test that executes `executeCommitPost` and asserts no container-shape error.

**Verdict:** APPROVED
**Reason:** The diff shows a real contract regression (`run(container, ...)` → `run({ ...ctx, ... })`) at the exact call site tied to `container.get is not a function`; reverting/alignment plus a regression test directly improves correctness and protects behavior.

### [x] 2. Reintroduce Regression Coverage for Retro Invocation
**File:** `tests/unit/flow/run-finalize-retro-invocation.test.js`  
**Issue:** The dedicated regression test was deleted while the risky call site was modified, removing safety for a known failure mode.  
**Suggestion:** Restore the test (prefer behavior assertions over source-regex matching), so future signature drift in `run-finalize` fails in CI.

**Verdict:** APPROVED
**Reason:** The dedicated regression test was removed while the risky invocation changed; restoring behavior-level coverage is a clear quality gain and reduces recurrence risk without changing product behavior.

### [ ] 3. Avoid Repeating Output-Config Derivation Logic
**File:** `src/docs/commands/build.js`  
**Issue:** `docsCfg`, `docsMode`, `isMultiLang`, and non-default language derivation are now duplicated across `build.js`, `translate.js`, `review.js`, and `forge.js`.  
**Suggestion:** Extract a single shared helper/value object (e.g., `createDocsOutputView(cfg.docs)`) and reuse it in all 4 commands to keep naming, fallback behavior, and multi-language rules consistent.

**Verdict:** REJECTED
**Reason:** While duplication exists, reintroducing a shared helper here risks subtle behavior drift across four commands and partially reverses the current refactor’s “inline/remove abstraction” direction; not clearly safe under a conservative bar.

### [x] 4. Remove Unrelated Security Regression From This Refactor
**File:** `src/lib/log.js`  
**Issue:** Masking integration was removed (`maskSensitive` usage deleted), and `src/lib/log-masking.js` plus masking tests were also deleted, which is unrelated to `resolveOutputConfig` inlining and risks sensitive-data leakage.  
**Suggestion:** Keep this PR scoped: either restore masking-related code/tests, or move all logging-masking removals to a separate, explicitly justified change with dedicated review.

**Verdict:** APPROVED
**Reason:** Deleting masking code/tests is unrelated to `resolveOutputConfig` inlining and materially increases leakage risk; restoring or isolating this change improves quality and preserves expected security behavior.

### [ ] 5. Remove Placeholder/Dead Spec Content
**File:** `specs/192-inline-resolveoutputconfig/qa.md`  
**Issue:** The file contains unresolved template placeholders (`Q:` / `A:`) and generic instructions, which is effectively dead documentation.  
**Suggestion:** Either fill it with actual decisions for this spec or delete it to avoid stale, non-informative artifacts.

**Verdict:** REJECTED
**Reason:** This is mostly documentation hygiene and the proposal is ambiguous (“fill or delete”); it does not clearly improve runtime quality, and deletion could conflict with expected spec artifact conventions.
