# Code Review Results

### [x] 1. ### 1. Restore Help-Path Isolation
**File:** `src/flow.js`
**Issue:** The `--help` path no longer bypasses `pre`/`post` hooks or flow resolution. That couples help output to normal command execution and can trigger unnecessary side effects or active-flow requirements.
**Suggestion:** Reintroduce a small shared helper such as `isHelpRequest(args)` and use it in both `runEntry()` and `dispatch()` so help remains side-effect-free and does not require flow context.

2. ### 2. Reunify Guardrail Terminology at Module Boundaries
**File:** `src/flow/get/guardrail.js`
**Issue:** The public command is still `guardrail`, but the implementation now imports `loadMergedArticles`, returns `articles`, and drops `id`. That creates inconsistent naming across the flow API and makes the domain model harder to follow.
**Suggestion:** Keep one boundary term for the external API, preferably `guardrail`, and add a thin adapter if internal parsing still uses `article`. Restore a stable payload shape such as `{ id, title, body, meta }` under `guardrails`.

3. ### 3. Remove Split Vocabulary in Lint APIs
**File:** `src/lib/lint.js`
**Issue:** This module now mixes old and new names: `validateLintArticles`, `lintArticleCount`, and failure objects with `article`, while surrounding code and commands still talk about guardrails. That inconsistency increases cognitive load and spreads rename noise into callers and tests.
**Suggestion:** Pick one term and apply it consistently through function names, return fields, and failure payloads. If `guardrail` is the CLI/domain term, rename to `validateLintGuardrails`, `lintGuardrailCount`, and `guardrail`.

4. ### 4. Centralize Guardrail Metadata Parsing/Serialization
**File:** `src/lib/guardrail.js`
**Issue:** Metadata knowledge is duplicated across `parseMetaValue()` and `serializeArticle()`, and lint-pattern parsing is embedded inline. Any future schema change now has to be updated in multiple places.
**Suggestion:** Extract a small codec layer, for example `parseArticleMeta()`, `formatArticleMeta()`, and `parseLintPattern()`, and reuse it from both parser and serializer paths.

5. ### 5. Extract Repeated “Safe Git Capture” Logic
**File:** `src/flow/run/finalize.js`
**Issue:** The new report step repeats the same `try/catch + execFileSync + trim` pattern several times for git stats, filenames, logs, and redo-log loading. That makes the finalize flow longer and harder to scan.
**Suggestion:** Introduce a helper such as `tryExecText(cmd, args, cwd)` and reuse it for optional git captures. Do the same for optional file/state loaders to reduce noise and keep the step logic focused on orchestration.

6. ### 6. Consolidate Duplicate Parser Tests
**File:** `tests/unit/specs/commands/guardrail-metadata.test.js`
**Issue:** `parseGuardrailArticles` coverage is now split across this file and `tests/unit/specs/commands/guardrail.test.js`, with overlapping fixture styles and repeated lazy imports. That duplicates test setup and blurs each test file’s responsibility.
**Suggestion:** Keep parser-focused tests in one file, import the helpers once at module scope, and leave the other file focused on gate/prompt behavior. This removes duplication and makes failures easier to localize.

**Verdict:** APPROVED
**Reason:** The diff confirms `isHelpRequest` checks were removed from both `runEntry()` and `dispatch()` in `src/flow.js`. Now `--help` triggers pre/post hooks and requires flow context resolution (`requiresFlow` no longer checks for help). This is a real behavioral regression — help should be side-effect-free and not fail when no active flow exists.
