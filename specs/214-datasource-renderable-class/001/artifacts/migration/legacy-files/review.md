# Code Review Results

### [x] 1. Preserve Machine-Readable Error Contract for Auto/Gating Decisions
**File:** `src/flow/lib/set-auto.js`  
**Issue:** Several failure paths now throw plain `Error` without `err.code`/`err.data`, and `AUTO_CHECK_INELIGIBLE` stores details in `err.autoCheck` instead of a standard field. This makes dispatcher output less consistent and harder for callers/tests to branch on.  
**Suggestion:** Set `err.code` and `err.data` on all expected/recoverable failures (`NO_FLOW`, `MULTIPLE_PREPARING_FLOWS`, `INVALID_USAGE`, `AUTO_CHECK_INELIGIBLE`), and move `autoCheck` payload into `err.data`.

**Verdict:** APPROVED
**Reason:** Real regression risk exists: plain `Error` without `code/data` degrades caller branching and test determinism. Restoring `err.code`/`err.data` (including `AUTO_CHECK_INELIGIBLE`) improves contract consistency with low behavior risk.

### [x] 2. Keep Retro Failures Structured Instead of Generic
**File:** `src/flow/lib/run-retro.js`  
**Issue:** `RETRO_EXISTS` and `NO_CHANGES` were converted from structured failures to generic throws, losing machine-readable codes and actionable hint semantics.  
**Suggestion:** Throw typed errors with `err.code` (`RETRO_EXISTS`, `NO_CHANGES`) and include hint text in message (or `err.data.hint`) so behavior stays predictable and script-friendly.

**Verdict:** APPROVED
**Reason:** `RETRO_EXISTS` / `NO_CHANGES` are expected, recoverable outcomes; converting them to generic throws loses machine-readable semantics. Reintroducing structured codes/hints improves reliability for scripts and tests without changing core control flow.

### [x] 3. Extract Repeated “Throw With Code/Data” Pattern
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `assertRetryBelowMax` and `assertNoProgressSinceLastFail` duplicate the same pattern: build multiline message, create `Error`, attach `code`/`data`, throw.  
**Suggestion:** Introduce a small local helper (e.g., `throwGateFailure(code, messageLines, data)`) to eliminate duplication and keep error-shape construction consistent.

**Verdict:** APPROVED
**Reason:** This removes real duplication in `run-gate` and reduces drift risk in error-shape construction. If implemented as a small local helper with identical message/code/data outputs, behavior should remain unchanged.

### [x] 4. Avoid Breaking `Envelope.fail` Capability for Structured Data
**File:** `src/lib/flow-envelope.js`  
**Issue:** `Envelope.fail` no longer accepts `data`, forcing `data: null` always. This can silently degrade existing call sites that relied on structured failure context.  
**Suggestion:** Restore optional `data` parameter (or explicitly deprecate with migration guard). Keeping it preserves design consistency with `err.data`-based throw paths.

**Verdict:** APPROVED
**Reason:** Removing `data` from `Envelope.fail` is an API contract regression and can silently drop structured context. Restoring optional `data` preserves existing behavior and interoperability.

### [x] 5. Reintroduce Explicit Handling for Returned Envelopes
**File:** `src/lib/dispatcher.js`  
**Issue:** Dispatcher now always wraps non-throw results with `Envelope.ok` and always runs post hooks. If any command still returns `Envelope` (especially `ok:false`), semantics can be wrong.  
**Suggestion:** Restore `result instanceof Envelope` branch and skip post hooks for `ok:false`, or enforce a strict “commands must throw on failure” contract with a runtime assertion to prevent accidental mixed styles.

**Verdict:** APPROVED
**Reason:** Always wrapping results with `Envelope.ok` and always running post hooks can mis-handle explicit `ok:false` envelopes and trigger incorrect side effects. Restoring explicit handling (or enforcing one strict contract) is a correctness fix.

### [ ] 6. Reduce Repetitive `.toMarkdown()` Assertions in Tests
**File:** `tests/unit/docs/lib/resolver-factory.test.js`  
**Issue:** The same `resolver.resolve(...).toMarkdown()` pattern is repeated many times, increasing noise and maintenance cost.  
**Suggestion:** Add a tiny local helper (e.g., `const md = (x) => x.toMarkdown();`) and use `md(resolver.resolve(...))` across assertions.

**Verdict:** REJECTED
**Reason:** Primarily cosmetic refactoring in test code; minimal quality gain and no behavior/correctness improvement. Conservative review should not prioritize this change.
