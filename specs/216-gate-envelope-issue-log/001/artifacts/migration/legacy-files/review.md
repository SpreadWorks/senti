# Code Review Results

### [x] 1. Extract duplicated escalation logging block
**File:** `src/flow/lib/run-gate.js`  
**Issue:** Both `checkRetryBelowMax` and `checkNoProgressSinceLastFail` duplicate the same pattern: build `messages`, `messages.join("\n")`, guard on context availability, then call `appendIssueLogFromGateError(...)` before returning `Envelope.fail`.  
**Suggestion:** Introduce a small helper (e.g. `appendGateEscalationIssueLog(ctx, phase, messages)`) and call it from both branches. This removes duplication and keeps escalation logging behavior consistent.

**Verdict:** APPROVED
**Reason:** This removes real duplication in two failure paths and can preserve behavior if the helper only wraps the existing `messages.join("\n")` + guarded `appendIssueLogFromGateError(...)` call.

### [x] 2. Make context guard consistent
**File:** `src/flow/lib/run-gate.js`  
**Issue:** One branch uses `if (ctx.flowState?.spec)` while the other uses `if (ctx)`. This inconsistency can cause divergent behavior (e.g., second branch may call writer without spec).  
**Suggestion:** Use a single guard condition in both paths (preferably `if (ctx?.flowState?.spec)`) so escalation logging has identical preconditions.

**Verdict:** APPROVED
**Reason:** Unifying to `if (ctx?.flowState?.spec)` reduces divergence and avoids attempting issue-log writes without required spec context; this is a safety improvement with low behavior risk.

### [ ] 3. Reduce parameter redundancy in `checkNoProgressSinceLastFail`
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkNoProgressSinceLastFail` now accepts both `{ flowState, phase, ... }` and `ctx`, which can drift and create ambiguous source-of-truth.  
**Suggestion:** Normalize to one source: either pass only `ctx` (and derive needed fields inside) or pass only explicit fields and avoid `ctx`. This simplifies the function contract and improves design consistency.

**Verdict:** REJECTED
**Reason:** The proposal is directionally good but underspecified; changing to “ctx-only” or “fields-only” can alter side-effect behavior and caller contracts, so it’s risky without a precise migration plan.

### [ ] 4. Improve parameter naming clarity for new `ctx` argument
**File:** `src/flow/lib/run-gate.js`  
**Issue:** The newly added `ctx` in `checkNoProgressSinceLastFail` is semantically important (used for issue-log side effects), but its role is implicit and easy to miss.  
**Suggestion:** Rename to a clearer name (e.g. `gateCtx` or `commandCtx`) and document it in the function JSDoc/signature comments as required for escalation logging side effects.

**Verdict:** REJECTED
**Reason:** Primarily cosmetic (rename/docs) and does not materially improve quality or behavior safety on its own.
