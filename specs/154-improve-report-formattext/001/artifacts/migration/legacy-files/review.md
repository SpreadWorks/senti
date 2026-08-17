# Code Review Results

### [x] 1. Reintroduce explicit missing-file error classification
**File:** `src/lib/config.js`  
**Issue:** `loadJsonFile()` now throws a plain `Error("Missing file: ...")`, while callers in `guardrail.js` rely on broad catch behavior. This weakens design consistency and makes control flow depend on generic exceptions.  
**Suggestion:** Restore a stable discriminator (for example `err.code = "ERR_MISSING_FILE"` or a dedicated error class) and let callers branch on that instead of swallowing all errors.

**Verdict:** APPROVED
**Reason:** The diff confirms `err.code = "ERR_MISSING_FILE"` was removed from `loadJsonFile()`, leaving callers with no safe discriminator. Without it, Proposal 2 cannot be implemented correctly — any guard in `resolveGuardrailContext` would have to rely on brittle message-string matching. Restoring the code property is a minimal, targeted change with genuine impact on error-handling robustness.

### [x] 2. Avoid swallowing non-missing config errors
**File:** `src/lib/guardrail.js`  
**Issue:** `resolveGuardrailContext()` uses `catch (_) {}` and silently ignores all config failures (including malformed JSON), which is effectively dead-error handling and can hide real defects.  
**Suggestion:** Catch only the expected “missing config” case and rethrow everything else. This keeps defaults behavior while preserving diagnosability.

**Verdict:** APPROVED
**Reason:** The diff shows the current code uses `catch (_) {}` — a silent catch-all that masks malformed JSON, permission errors, and any other unexpected failure from `loadConfig`. This is an active bug: it collapses two very different situations (expected absence of config, and unexpected I/O failure) into the same silent default. Narrowing the catch to `err.code === "ERR_MISSING_FILE"` (once Proposal 1 is applied) preserves the intended defaults behavior while restoring diagnosability. These two proposals are co-dependent and should be applied together.

### [ ] 3. Reduce naming ambiguity between file path lookup and JSON loading
**File:** `src/lib/guardrail.js`  
**Issue:** `readWithFallback()` and `loadGuardrailFile()` are close in meaning but represent different abstraction levels (path resolution vs parsing). This increases cognitive load.  
**Suggestion:** Rename to explicit intent, e.g. `resolveGuardrailPathWithFallback()` and `parseGuardrailFile()` (or similar), and keep the naming pattern consistent with responsibility.

**Verdict:** REJECTED
**Reason:** `readWithFallback(dir, lang)` and `loadGuardrailFile(filePath)` are already differentiated by their parameter signatures — one receives a directory and a locale, the other a resolved file path. The proposed rename (`resolveGuardrailPathWithFallback`, `parseGuardrailFile`) adds no semantic precision beyond what the current names and signatures already convey. Both are private functions. This is cosmetic churn. Notably, the existing code review record for this codebase (`specs/154-guardrail-english-only/review.md`, item #3) explicitly rejected the same suggestion with identical reasoning.

### [x] 4. Extract repeated section-rendering boilerplate
**File:** `src/flow/commands/report.js`  
**Issue:** Section formatting repeatedly does `lines.push("")`, title line, and divider line. This duplication makes small format changes error-prone.  
**Suggestion:** Add a tiny helper like `pushSection(lines, title, thin)` and reuse it for `Implementation`, `Retro`, `Metrics`, `Tests`, and `Issue Log`.

**Verdict:** APPROVED
**Reason:** The `formatText()` function in `report.js` repeats the `lines.push(""); lines.push(" Title"); lines.push(` ${thin}`)` triple at least five times (Implementation, Retro, Metrics, Tests, Issue Log). This is genuine duplication: a format change (e.g., different padding or divider character) currently requires five coordinated edits. A `pushSection(lines, title)` helper eliminates that fragility. The project's own coding rules require extraction once a pattern appears two or more times — this exceeds that threshold. Zero behavioral risk.

### [x] 5. Remove placeholder-only QA content
**File:** `specs/154-improve-report-formattext/qa.md`  
**Issue:** The empty `Q:` / `A:` entry is dead documentation and adds noise.  
**Suggestion:** Delete the placeholder block or replace it with a real clarified question; keep only meaningful QA records.

**Verdict:** APPROVED
**Reason:** The diff shows `specs/154-improve-report-formattext/qa.md` was created with an empty `- Q: / - A:` block copied from a template. This is not minimal documentation — it is actively misleading: it implies a clarification question was raised and answered with nothing. The prior review record for this project (`specs/154-guardrail-english-only/review.md`, item #5) approved the identical fix with the same rationale. Removing the empty stub carries no behavioral risk and eliminates noise for anyone reading the spec artifacts.
