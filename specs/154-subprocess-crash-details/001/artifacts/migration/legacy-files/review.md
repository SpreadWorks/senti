# Code Review Results

### [x] 1. Extract Common `runCmd` Failure Guard
**File:** `src/lib/process.js`  
**Issue:** Many callers now repeat the same pattern (`if (!res.ok) throw new Error("<context>: " + formatError(res))`), which duplicates control flow and error-message assembly across files.  
**Suggestion:** Add a shared helper like `assertOk(res, context)` (or `throwIfFailed`) in `process.js` and replace repeated inline checks in flow/lib and lib modules.

**Verdict:** APPROVED
**Reason:** The `if (!res.ok) throw new Error("context: " + formatError(res))` pattern repeats across at least 12 call sites in the diff (merge.js ×4, run-finalize.js ×2, get-issue.js, run-gate.js, run-prepare-spec.js, run-sync.js, cli.js, lint.js). The project's own coding rules explicitly mandate extraction when the same pattern appears in 2+ places. An `assertOk(res, context)` helper in `process.js` would reduce each 3-line guard to a single call with no behavioral change, and the function sits naturally alongside the already-exported `formatError`.

### [ ] 2. Unify Error Normalization Between Sync/Async Execution
**File:** `src/lib/process.js`  
**Issue:** `runCmd` and `runCmdAsync` build failure objects separately, with slightly different status normalization logic. This can drift and produce inconsistent behavior.  
**Suggestion:** Introduce a single internal `normalizeExecError(err, stdout, stderr)` helper used by both functions so `status/signal/killed/stdout/stderr` are computed consistently.

**Verdict:** REJECTED
**Reason:** The divergence in status normalization is intentional and correct: `execFileSync` throws with `e.status` as the exit code, while `execFile`'s callback delivers exit code via `err.code` (which can also be a string errno like `"ENOENT"`). The `runCmdAsync` path correctly guards with `typeof err.code === "number"` before using it, which would be wrong for `runCmd`'s error shape. A shared `normalizeExecError` helper would need to accept both shapes as parameters, adding complexity without reducing either call site — and a naive conflation of `e.status` and `err.code` risks producing incorrect status values.

### [x] 3. Avoid Catch-All in Guardrail Context Resolution
**File:** `src/lib/guardrail.js`  
**Issue:** `resolveGuardrailContext()` currently swallows all errors (`catch (_)`) and silently falls back to defaults, masking malformed config or parsing failures.  
**Suggestion:** Catch only “missing config” cases (via explicit error code/predicate) and rethrow unexpected errors to keep behavior consistent with strict error handling elsewhere.

**Verdict:** APPROVED
**Reason:** The broad `catch (_)` in `resolveGuardrailContext` silently swallows malformed JSON, failed schema validation from `validateConfig`, and permission errors — all masking real bugs as "no config, using defaults." This was already identified and fixed in a prior commit (`fix(guardrail): re-throw unexpected errors from loadConfig`) but was reverted alongside the removal of `err.code = "ERR_MISSING_FILE"` from `loadJsonFile`. The current code is strictly worse than the intermediate state. Restoring discriminated error handling (re-adding `err.code` in `loadJsonFile` or an `isMissingConfigError` predicate) is a genuine correctness improvement consistent with the rest of the codebase's error handling philosophy.

### [ ] 4. Improve Guardrail Loader Naming for Intent Clarity
**File:** `src/lib/guardrail.js`  
**Issue:** `readWithFallback()` is vague and does not communicate that it specifically loads `templates/<lang>/guardrail.json` with English fallback.  
**Suggestion:** Rename to something explicit like `readTemplateGuardrailWithLangFallback` (or split into `resolveGuardrailPath` + `loadGuardrailFile`) to reduce ambiguity and align with existing descriptive function names.

**Verdict:** REJECTED
**Reason:** `readWithFallback(dir, lang)` already communicates the key behavior — it reads with a fallback — and the `lang` parameter makes the language dimension explicit. The project's own code review (in the now-deleted `review.md`) already considered and rejected a structurally identical rename proposal (Item #3): "The rename is purely cosmetic — it adds no semantic precision beyond what the parameter names already convey." The proposed name `readTemplateGuardrailWithLangFallback` is excessively verbose and violates the project's preference for concise, deep-module naming.

### [ ] 5. Reduce Test Duplication in Process Tests
**File:** `tests/unit/lib/process.test.js`  
**Issue:** Several `runCmd` and `runCmdAsync` tests duplicate the same assertions (`signal`, `killed`, non-signal failure semantics) with only invocation differences.  
**Suggestion:** Use a shared table-driven test helper that takes an executor (`runCmd`/`runCmdAsync`) and expected shape, keeping parity while reducing maintenance overhead.

**Verdict:** REJECTED
**Reason:** The apparent duplication — two pairs of tests for `signal`/`killed` between `runCmd` and `runCmdAsync` — exists because the two functions have fundamentally different execution models (sync vs async). A shared table-driven helper would need to normalize both signatures, either by making all tests async or by adding an executor wrapper, both of which obscure intent without meaningful maintenance savings. The duplicated test cases (2 pairs, 4 tests total) are clear and self-contained; the abstraction overhead would exceed the DRY benefit at this scale.
