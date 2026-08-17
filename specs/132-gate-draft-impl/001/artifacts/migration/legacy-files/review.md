# Code Review Results

### [x] 1. Remove the unused phase-step mapping
**File:** `src/flow/lib/run-gate.js`
**Issue:** `PHASE_STEP` is introduced but never read anywhere in this file. It adds noise and suggests an intended abstraction that is not actually used.
**Suggestion:** Delete `PHASE_STEP` entirely, or move step-ID resolution into a shared helper and make both `run-gate.js` and `src/flow/registry.js` use it consistently.

**Verdict:** APPROVED
**Reason:** `PHASE_STEP` is defined in `run-gate.js` but never referenced anywhere in that file — no function reads it. The step-ID resolution actually happens in `registry.js` via inline ternaries. Dead code adds confusion about where the source of truth is. Removing it or moving it to a shared location is a clear improvement.

### [x] 2. Consolidate duplicated step ID selection logic
**File:** `src/flow/registry.js`
**Issue:** The same phase-to-step-ID branching is duplicated in both `pre(ctx)` and `post(ctx, result)` via `phase === "draft" ? "gate-draft" : phase === "impl" ? "gate-impl" : "gate"`. This is easy to drift out of sync.
**Suggestion:** Extract a small helper such as `resolveGateStepId(phase)` and reuse it in both hooks. If `PHASE_STEP` from `run-gate.js` was intended for this, move that mapping to a shared module instead of duplicating the conditional.

**Verdict:** APPROVED
**Reason:** The identical ternary `phase === "draft" ? "gate-draft" : phase === "impl" ? "gate-impl" : "gate"` appears in both `pre(ctx)` and `post(ctx, result)` in `registry.js`. This is a real drift risk — if a new phase is added, both sites must be updated in lockstep. Extracting a `resolveGateStepId(phase)` helper is low-risk, improves maintainability, and aligns with the project's stated rule of extracting shared patterns at 2+ occurrences.

### [ ] 3. Extract common gate result/reason handling
**File:** `src/flow/lib/run-gate.js`
**Issue:** `executeDraft`, `executeSpec`, and `executeImpl` all repeat the same patterns for collecting AI results into `reasons`, checking pass/fail, and returning `gateFail(...)`. The duplication makes the command longer and harder to evolve.
**Suggestion:** Introduce helpers such as `toGateReasons(results)` and `appendAndCheckResults(reasons, result)` or a single `runAiGateCheck(...)` wrapper that returns normalized `{ passed, reasons }`. This will reduce repeated loops and keep phase-specific methods focused on phase-specific inputs.

**Verdict:** REJECTED
**Reason:** While the three `execute*` methods share a similar shape (collect reasons, check pass/fail, return `gateFail`/`gatePass`), the actual logic in each phase differs meaningfully: `executeDraft` checks draft-specific text, `executeSpec` does spec text checks, and `executeImpl` runs a separate AI requirements check against a git diff before the guardrail check. The "duplication" is structural similarity, not true copy-paste. Forcing a shared `runAiGateCheck(...)` wrapper would either be so generic it adds indirection without clarity, or would need phase-specific parameters that recreate the current branching. The current code is readable and each method is self-contained. This is premature abstraction.

### [x] 4. Simplify pass/fail next-step routing
**File:** `src/flow/lib/run-gate.js`
**Issue:** `gatePass()` computes `next` with `PHASE_NEXT[phase] === "spec" ? "approval" : "spec"`, while `gateFail()` uses `PHASE_NEXT[phase]` directly. This makes control flow hard to read, partially bypasses the mapping, and leaves `PHASE_NEXT` carrying values whose meaning changes depending on pass/fail.
**Suggestion:** Replace this with explicit maps such as `PASS_NEXT` and `FAIL_NEXT`, or compute `next` directly per phase in one helper. That makes the workflow intent obvious and removes the current indirect logic.

**Verdict:** APPROVED
**Reason:** The current logic is genuinely confusing: `gatePass()` overrides `PHASE_NEXT[phase]` with a conditional (`=== "spec" ? "approval" : "spec"`), meaning the map's values have different semantics depending on pass vs. fail. Splitting into `PASS_NEXT` and `FAIL_NEXT` (or computing directly) would make the workflow routing explicit and eliminate a class of bugs where someone updates `PHASE_NEXT` thinking it applies uniformly. This is a real readability and correctness improvement.

### [ ] 5. Extract repeated file resolution and loading logic
**File:** `src/flow/lib/run-gate.js`
**Issue:** `executeDraft`, `executeSpec`, and `executeImpl` each resolve a target path, check existence, read text, and derive a relative path/result path slightly differently. The repetition increases surface area for inconsistent behavior.
**Suggestion:** Add a helper like `loadGateTarget(root, flowState, { kind, explicitPath })` that returns `{ absPath, relPath, text }`. That would make the phase methods shorter and align path handling across draft/spec/impl gates.

**Verdict:** REJECTED
**Reason:** The three methods resolve files differently enough that a shared helper would need significant parameterization: `executeDraft` derives the path from `specDir + "draft.md"`, `executeSpec` accepts an explicit `ctx.spec` or falls back to `flowState.spec`, and `executeImpl` reads `flowState.spec` plus runs `git diff`. A `loadGateTarget()` helper would need `kind`, `explicitPath`, optional diff fetching, and different error messages — essentially reimplementing the branching with more indirection. The current approach, where each phase method handles its own I/O in ~10 lines, is clearer and easier to modify independently.
