# Code Review Results

### [x] 1. Avoid Double JSON Parse/Serialize in Gate Evaluation
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `filterPendingSpecPlaceholder()` parses and re-serializes `spec.json`, then the result is parsed again later (`JSON.parse(targetText)` path). This adds redundant work and can unintentionally normalize formatting/key order before evaluation.  
**Suggestion:** Parse once and reuse the parsed object. For example, read raw text, parse into object, remove `T-pending-spec`, then only stringify when a text payload is explicitly needed for AI input.

**Verdict:** APPROVED
**Reason:** This is a real quality improvement (less redundant work, fewer unintended text-shape changes) and can preserve behavior if the same parsed object is reused for evaluation and only stringified when needed.

### [x] 2. Reduce Unnecessary Public API Surface
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `filterPendingSpecPlaceholder` is exported even though the diff shows only local usage in the same file. Extra exports increase coupling and maintenance cost.  
**Suggestion:** Make the function module-private (remove `export`) unless there is a confirmed external import. If it is only needed for tests, prefer testing through the command behavior rather than exporting internals.

**Verdict:** APPROVED
**Reason:** Making `filterPendingSpecPlaceholder` private is appropriate if there are no external imports; it reduces coupling without changing runtime behavior. The safety condition is explicit in the proposal.

### [ ] 3. Improve Helper Naming for Reuse and Intent
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `filterPendingSpecPlaceholder` encodes one specific task ID in the function name, which makes the helper less reusable and less aligned with behavior-based naming.  
**Suggestion:** Rename to something intent-driven like `removeTaskByIdFromSpecJsonText` (or `sanitizeSpecTasksForGate`) and pass the task ID as an argument (`"T-pending-spec"`), keeping policy at call site.

**Verdict:** REJECTED
**Reason:** This is mostly naming/generalization for a currently single-purpose helper. It adds abstraction without clear need and carries avoidable churn/risk for minimal functional gain.

### [ ] 4. Keep Guardrail Text ASCII-Consistent and Style-Consistent
**File:** `src/presets/base/guardrail.json`  
**Issue:** The updated text introduces a typographic em dash (`—`) and slightly awkward phrasing (`number more than three items`), which reduces style consistency and may conflict with ASCII-first conventions used elsewhere.  
**Suggestion:** Replace with plain ASCII punctuation and cleaner wording, e.g. `"... is not required - evaluate ..."` and `When requirements exceed three items...` to keep preset text consistent and easier to maintain.

**Verdict:** REJECTED
**Reason:** The suggested edits are largely editorial. In prompt/guardrail text, even small wording changes can shift model behavior, so this is not a safe refactor unless driven by a concrete defect.
