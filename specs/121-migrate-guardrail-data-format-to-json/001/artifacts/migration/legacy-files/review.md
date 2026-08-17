# Code Review Results

### [x] 1. Restore help-path bypass for flow hooks
**File:** `src/flow.js`
**Issue:** `runEntry()` and `dispatch()` now always execute `entry.pre`/`entry.post` and always require flow context unless `requiresFlow === false`. That removes the previous special-case for `--help`, so help output is now coupled to normal execution hooks and flow-state requirements. This is inconsistent with CLI design and makes the help path less isolated.
**Suggestion:** Reintroduce a dedicated help-path bypass so `--help` skips hook execution and flow resolution. A small helper such as `isHelpRequest(args)` reused in both places would keep the logic explicit and avoid duplication.

**Verdict:** APPROVED
**Reason:** The diff shows `runEntry()` and `dispatch()` both had `isHelpRequest` checks removed, meaning `--help` now triggers `entry.pre`/`entry.post` hooks and requires flow context resolution. This is a real behavioral regression — help output should be side-effect-free and not require an active flow state. The suggested `isHelpRequest(args)` helper is a clean, low-risk fix that restores correct CLI semantics.

### [x] 2. Finish the “articles” → “guardrails” rename consistently
**File:** `src/lib/lint.js`
**Issue:** The diff renames the domain concept from “articles” to “guardrails”, but several public names and payload fields still use the old terminology: `validateLintArticles`, `lintArticleCount`, and failure objects with `article`. That leaves the API internally inconsistent and makes the refactor harder to follow.
**Suggestion:** Rename the remaining API surface to match the new model, for example `validateLintGuardrails`, `lintGuardrailCount`, and `guardrail` in failure records. Apply the same terminology consistently across callers and tests.

**Verdict:** APPROVED
**Reason:** The diff clearly shows an incomplete rename. `loadMergedArticles` → `loadMergedGuardrails` was done, and internal variable names were updated (e.g., `articles` → `guardrails`), but `lint.js` retains `validateLintArticles`, `lintArticleCount`, and failure objects with `article` as the key. This inconsistency is not cosmetic — it creates a split API where some consumers use the old terminology and others use the new, making the codebase harder to maintain. The rename should be completed.

### [x] 3. Remove stale unused imports in guardrail tests
**File:** `tests/unit/specs/commands/guardrail-metadata.test.js`
**Issue:** `loadMergedGuardrails` is imported but not used. That is dead test code and adds noise right after a large terminology/data-format refactor.
**Suggestion:** Remove the unused import, or add a focused test that actually exercises `loadMergedGuardrails()` if coverage for JSON loading/merging is intended.

**Verdict:** APPROVED
**Reason:** The diff shows `guardrail-metadata.test.js` imports `loadMergedGuardrails` but no test in the file uses it. This is dead code introduced by the refactor — `loadMergedGuardrails` requires filesystem setup (preset chain, config, etc.) that these unit tests don't provide, so it's not a missing-coverage gap that needs a new test. Removing the unused import is the correct action.

### [ ] 4. Add a single normalization layer for guardrail result shapes
**File:** `src/flow/get/guardrail.js`
**Issue:** The response mapper now hand-builds a `{ id, title, body, meta }` object inline, while other modules still consume raw guardrail objects directly. That creates multiple result shapes for the same concept and makes future changes to the guardrail schema more error-prone.
**Suggestion:** Extract a small shared serializer such as `toGuardrailPayload(guardrail)` in `src/lib/guardrail.js` and reuse it anywhere guardrails are emitted externally. That keeps the transport shape centralized and consistent.

**Verdict:** REJECTED
**Reason:** The diff shows exactly one place where the `{ id, title, body, meta }` response shape is constructed (`src/flow/get/guardrail.js`). There is no evidence of "other modules" consuming raw guardrail objects and emitting them externally in a different shape — internal consumption (filtering, prompt building) legitimately uses the full object. Extracting a shared serializer for a single call site is premature abstraction with no concrete duplication to eliminate.

### [ ] 5. Rename `buildGuardrailPrompt` inputs to reflect filtered semantics
**File:** `src/flow/run/gate.js`
**Issue:** `buildGuardrailPrompt(specText, guardrails)` immediately narrows to spec-phase guardrails and then stores them in `filtered`. The function name and parameter are fine, but the local names do not communicate whether they are raw inputs, filtered inputs, or exemption-filtered results.
**Suggestion:** Use more specific names such as `allGuardrails`, `specPhaseGuardrails`, and `effectiveGuardrails`. That makes the filtering pipeline self-documenting and reduces the cognitive load of the prompt builder.

**Verdict:** REJECTED
**Reason:** This is a cosmetic local-variable rename (`guardrails` → `allGuardrails`, `specGuardrails` → `specPhaseGuardrails`, `filtered` → `effectiveGuardrails`). The current names in the diff (`guardrails`, `specGuardrails`, `filtered`) are already clear enough — the function is short, the filtering pipeline is obvious from context, and no behavioral improvement results from longer names. The risk is minimal but so is the benefit.

### [ ] 6. Keep exported review helpers intentionally minimal in tests too
**File:** `tests/unit/flow/commands/review.test.js`
**Issue:** The test cleanup removed `--phase test` coverage, but the file still mixes CLI behavior checks with agent-resolution tests. After the review-command simplification, that broad scope makes the test module less cohesive.
**Suggestion:** Split agent-resolution assertions into a dedicated test file for `resolveAgent` behavior, and keep `review.test.js` focused on the review command’s CLI contract. That matches the production simplification and improves test organization.

**Verdict:** REJECTED
**Reason:** The proposal suggests splitting `review.test.js` into separate files for agent-resolution tests vs. CLI behavior tests. After the `--phase test` removal, the remaining test file is small and coherent — it tests the review command's CLI contract and verifies that `resolveAgent` works correctly for the review command's agent keys, which is directly relevant to review behavior. Splitting a small, focused test file into two adds organizational overhead without meaningful cohesion improvement.
