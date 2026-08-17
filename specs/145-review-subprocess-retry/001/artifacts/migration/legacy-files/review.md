# Code Review Results

### [x] 1. Extract shared retry policy instead of duplicating it
**File:** `src/flow/lib/run-review.js`
**Issue:** The new `runCmdWithRetry` hardcodes retry defaults, retry loop structure, and the non-retry condition for `killed|signal`. The spec explicitly references `src/lib/agent.js` as the existing pattern, so this adds a second implementation of the same policy and creates drift risk.
**Suggestion:** Extract the retry loop and retryability check into a small shared helper, then have both `callAgentAsyncWithRetry` and `runCmdWithRetry` use it. At minimum, centralize the `killed/signal` classification in one predicate so the two call sites stay consistent.

**Verdict:** APPROVED
**Reason:** This is a legitimate DRY concern with real drift risk. The two implementations differ in how they detect killed/signal (`err.killed || err.signal` vs `/killed|signal/i.test(stderr)`) — this inconsistency already exists and will diverge further. The project's CLAUDE.md explicitly mandates extracting shared helpers at 2 occurrences. A shared `isNonRetryable` predicate at minimum would keep the two call sites consistent. The core retry loop structure (attempt counter, delay, bail-on-signal) is identical in shape.

### [x] 2. Avoid widening the module API just for tests
**File:** `src/flow/lib/run-review.js`
**Issue:** `runCmdWithRetry` is exported from a command module whose main responsibility is `RunReviewCommand`. That makes the module surface less cohesive and suggests the helper is part of the public contract when it is really an internal implementation detail.
**Suggestion:** Move `runCmdWithRetry` into a dedicated internal helper module such as `src/flow/lib/retry.js` and test that module directly. If it should stay local, keep it non-exported and test through a narrower seam.

**Verdict:** APPROVED
**Reason:** `runCmdWithRetry` is a generic retry utility with no dependency on review-specific logic — it accepts an arbitrary `cmdFn` and returns its result. Exporting it from a command module that owns `RunReviewCommand` weakens cohesion. Moving it to `src/flow/lib/retry.js` (or `src/lib/retry.js` if proposal #1 is also adopted) gives it a natural home, makes the test import cleaner, and follows the project's "deep module" design principle. This also aligns well with proposal #1.

### [ ] 3. Remove repeated test scaffolding with small helpers
**File:** `specs/145-review-subprocess-retry/tests/retry-logic.test.js`
**Issue:** Each test repeats the same `callCount` bookkeeping, similar `mockRunCmd` definitions, and the same retry options object. That makes the test file longer than necessary and harder to scan.
**Suggestion:** Introduce helpers like `createMockRunCmd(sequence)` and a shared `const retryOpts = { retryCount: 2, retryDelayMs: 10 }`. This will eliminate duplication and make each test focus only on the scenario being verified.

**Verdict:** REJECTED
**Reason:** The test file is 89 lines with 6 straightforward test cases. Each test is self-contained and immediately readable. Introducing `createMockRunCmd(sequence)` adds indirection that makes individual test cases harder to understand in isolation — you'd need to look up the helper to understand what `[fail, fail, success]` actually returns. The current repetition is the kind that aids readability in tests. This is a cosmetic preference, not a quality improvement.

### [x] 4. Remove stale placeholder comments and empty spec content
**File:** `specs/145-review-subprocess-retry/tests/retry-logic.test.js`
**Issue:** The comments saying “For now, define the expected behavior as tests that will fail” and “should be exported” are stale after the implementation exists. `specs/145-review-subprocess-retry/qa.md` also contains an empty Q/A placeholder that adds no information.
**Suggestion:** Delete the obsolete comments and either fill or remove the empty Q/A placeholder so the spec artifacts only contain current, meaningful content.

**Verdict:** APPROVED
**Reason:** The comment "For now, define the expected behavior as tests that will fail" is factually wrong post-implementation and misleads future readers. The empty Q/A in `qa.md` adds zero information. Removing stale comments is low-risk cleanup that improves signal-to-noise. However, the spec artifacts in `specs/` are workflow files that may be auto-generated — verify that manual edits won't be overwritten before applying.

### [ ] 5. Tighten naming around command result state
**File:** `src/flow/lib/run-review.js`
**Issue:** Names like `cmdFn`, `opts`, and `lastRes` are generic and make the retry helper read more mechanically than the rest of the file. In a small function, these names hide intent more than they help.
**Suggestion:** Rename them to intent-revealing terms such as `runCommand`, `options`, and `lastResult`. That keeps the helper aligned with the more descriptive naming style already used elsewhere in the module.

**Verdict:** REJECTED
**Reason:** In a 20-line function, `cmdFn`, `opts`, and `lastRes` are conventional and immediately understood. Renaming to `runCommand`, `options`, `lastResult` is pure cosmetic churn with no behavioral or clarity improvement — `cmdFn` already signals "callable function", `opts` is a universal abbreviation for options in this codebase. This risks unnecessary diff noise and merge conflicts for zero functional gain.
