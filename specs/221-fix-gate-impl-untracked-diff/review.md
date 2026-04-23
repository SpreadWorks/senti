# Code Review Results

### [ ] 1. Extract Repeated Async Git Error Handling
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `collectUntrackedDiff()` repeats similar `execFileAsync` try/catch wrapping for both listing and per-file diff generation, which increases maintenance overhead.  
**Suggestion:** Introduce a small helper like `runGitAsync(args, cwd, contextLabel)` that standardizes command execution and error wrapping, and reuse it for both `ls-files` and `diff --no-index` paths.

**Verdict:** REJECTED
**Reason:** The two call sites have different exit-code semantics (`ls-files` vs `diff --no-index` where code `1` is expected). A shared helper risks subtly changing behavior unless it models those differences explicitly.

### [x] 2. Centralize Gate Phase Normalization
**File:** `src/flow/registry.js`  
**Issue:** Phase fallback behavior is split across command execution and hooks (`ctx.phase` in hooks vs fallback in command), which risks drift in step-status behavior.  
**Suggestion:** Add one normalization helper (for example, `resolveGatePhase(ctx)`) and use it consistently in `pre`, `post`, and `RunGateCommand.execute` so all paths resolve phase the same way.

**Verdict:** APPROVED
**Reason:** This addresses real drift risk between hooks and command execution; one resolver for phase normalization improves correctness and consistency without inherently changing intended behavior.

### [ ] 3. Replace Branching Mapping With Table Lookup
**File:** `src/flow/lib/gate-step.js`  
**Issue:** `resolveGateStepId()` uses chained conditionals, which is harder to extend and less consistent with “single source of truth” mapping style.  
**Suggestion:** Use a frozen mapping object (e.g., `{ draft: "gate-draft", "task-impl": "gate-impl", integration: "gate-impl" }`) with `"gate"` fallback to simplify logic and make future additions safer.

**Verdict:** REJECTED
**Reason:** This is mostly stylistic in a small, clear function; quality gain is marginal, and map-based fallback mistakes can introduce behavior regressions.

### [x] 4. Remove Ambiguous Test Helper API
**File:** `tests/unit/specs/commands/guardrail.test.js`  
**Issue:** `runGate(dir, extraArgs)` makes phase behavior implicit and allows accidental contradictory argument construction by callers.  
**Suggestion:** Switch to an options object (e.g., `runGate(dir, { phase, extraArgs })`) and build the phase flag in one place to improve naming clarity and prevent conflicting invocation patterns.

**Verdict:** APPROVED
**Reason:** It improves test correctness by preventing contradictory argument construction in one place, and it only affects test helper wiring (not production behavior).

### [ ] 5. Reduce Spec-Specific Inline Commentary in Core Logic
**File:** `src/flow/lib/run-gate.js`  
**Issue:** Inline comments in production code reference specific spec IDs and process history, which can become stale and add noise.  
**Suggestion:** Keep comments behavior-focused (what/why at runtime) and move spec-traceability notes to commit messages or design docs; this simplifies the module and improves long-term readability.

**Verdict:** REJECTED
**Reason:** Primarily cosmetic. It may improve readability, but it does not materially improve behavior or structure enough to justify churn under a conservative standard.
