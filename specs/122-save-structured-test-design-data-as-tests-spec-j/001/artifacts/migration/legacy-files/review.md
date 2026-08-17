# Code Review Results

### [x] 1. Unify Guardrail vs. Article Terminology at Module Boundaries
**File:** `src/flow/get/guardrail.js`
**Issue:** The command surface is still `guardrail`, but this change reintroduces `loadMergedArticles`, returns an `articles` payload, and drops `id`. Other files still use a mix of `guardrail`, `article`, `lintArticleCount`, and `no guardrail articles found`. That split vocabulary makes the public API and internal model harder to follow.
**Suggestion:** Pick one boundary term and use it consistently. A pragmatic split is: keep `guardrail` for CLI/output/API names, and use `article` only as an internal parser detail. Rename payload keys and result fields accordingly, or add a thin adapter so the CLI contract stays guardrail-oriented even if the parser internals use articles.

**Verdict:** APPROVED
**Reason:** The diff reintroduces a genuine terminology split: CLI commands are named `guardrail`, the function is `loadMergedArticles`, the output payload key is `articles`, and lint failure objects use `article`. Meanwhile `lint.js` still has messages like `"no guardrail articles found"` — a hybrid term. This isn't cosmetic; it creates a confusing public API where consumers must mentally translate between `guardrail` (command/concept) and `article` (data/payload). Picking one boundary term and applying it consistently would reduce cognitive load and prevent future misuse.

### [x] 2. Centralize Metadata Parsing and Serialization
**File:** `src/lib/guardrail.js`
**Issue:** `parseMetaValue()` and `serializeArticle()` now encode the same metadata schema in opposite directions, while lint regex parsing is duplicated inline again. This increases maintenance cost and makes future metadata changes easy to miss in one direction.
**Suggestion:** Extract a single metadata codec layer, for example `parseArticleMeta()` and `formatArticleMeta()`, plus a small `parseLintPattern()` helper reused by both. That removes duplicated schema knowledge and keeps the markdown format logic consistent.

**Verdict:** APPROVED
**Reason:** The diff shows `parseMetaValue()` (lines parsing `phase`, `scope`, `lint` from markdown) and `serializeArticle()` (reconstructing the same fields back to markdown) encode the same schema in opposite directions with independently written regex/logic. The lint regex parsing in `parseMetaValue` (`/lint:\s*(\/(?:[^/\\]|\\.)+\/[gimsuy]*)/`) has no shared extraction with `serializeArticle`'s `a.meta.lint.toString()`. A metadata codec would eliminate this duplicated schema knowledge and reduce the risk of format drift.

### [x] 3. Remove Repeated Dynamic Imports and Shared Test Setup Noise
**File:** `tests/unit/specs/commands/guardrail-metadata.test.js`
**Issue:** The file repeatedly performs `await import("../../../../src/lib/guardrail.js")` inside individual tests for `filterByPhase` and `matchScope`, while `parseGuardrailArticles` is already imported at module scope. This is unnecessary duplication and makes the test intent harder to scan.
**Suggestion:** Import the tested helpers once at the top of the file, or use a single shared lazy import in a setup block. Keep the tests focused on behavior rather than repeated module-loading boilerplate.

**Verdict:** APPROVED
**Reason:** In `guardrail-metadata.test.js`, `parseGuardrailArticles` is imported at module scope (line 3-5), but `filterByPhase` and `matchScope` use per-test `await import(...)` calls despite being pure functions with no side effects requiring re-import. This is unnecessary duplication that obscures test intent. Consolidating to a single top-level import is safe and improves readability.

### [ ] 4. Extract a Shared Helper for Markdown Guardrail Fixtures
**File:** `tests/unit/specs/commands/guardrail.test.js`
**Issue:** Multiple tests manually build the same `guardrail.md` structure with repeated block markers, headings, and bodies. That duplicates fixture logic and makes the tests verbose for what they are actually validating.
**Suggestion:** Add a small helper in `tests/helpers/` such as `buildGuardrailMd([{ phase, title, body }])` and reuse it across guardrail-related tests. That will reduce duplication, make the fixture format consistent, and make each test’s intent clearer.

**Verdict:** REJECTED
**Reason:** While there is some repetition in building `guardrail.md` strings across tests, the fixture construction is simple (join an array of strings) and each test's specific structure is immediately visible inline. Extracting a `buildGuardrailMd` helper would add indirection for a modest reduction in verbosity, and the tests are not numerous enough to justify a shared fixture factory. The current inline approach makes each test self-contained and easy to understand.

### [ ] 5. Isolate Legacy Markdown-Specific Logic from General Guardrail Utilities
**File:** `src/lib/guardrail.js`
**Issue:** This module now mixes parsing, matching, merging, template generation, and serialization in one place. Reintroducing `parseGuardrailArticles`, `serializeArticle`, `loadGuardrailTemplate`, and markdown regex constants broadens the module again and makes it harder to see which pieces are core runtime behavior versus format-specific helpers.
**Suggestion:** Split markdown-format concerns into a dedicated helper module, for example `src/lib/guardrail-markdown.js`, and keep `src/lib/guardrail.js` focused on loading, filtering, and matching. That improves design consistency and makes dead code easier to spot later.

**Verdict:** REJECTED
**Reason:** The diff restores `parseGuardrailArticles`, `serializeArticle`, `loadGuardrailTemplate`, and markdown regex constants into `guardrail.js` — but these are not "legacy" helpers coexisting with a newer approach. They **are** the primary implementation now. Splitting them into `guardrail-markdown.js` would fragment a single coherent module into two files for a format that is the only supported format. The module's responsibilities (load, parse, filter, serialize) are cohesive around the guardrail concept. This split would be premature and add navigation overhead without eliminating any actual dead code or clarifying any ambiguity.
