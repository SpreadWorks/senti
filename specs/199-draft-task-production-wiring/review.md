# Code Review Results

### [x] 1. Reuse a Shared PASS Draft Fixture Across Tests
**File:** `tests/unit/flow/flow-run-draft-task-reasons-feedback.test.js`  
**Issue:** A full task-spec-compatible draft string is duplicated here while a very similar `PASS_DRAFT` fixture already exists in `flow-run-draft-task.test.js`. This increases maintenance cost when gate-required sections change.  
**Suggestion:** Move the PASS draft text into a shared test fixture module (for example `tests/unit/flow/fixtures/drafts.js`) and import it from both test files.

**Verdict:** APPROVED
**Reason:** Reduces duplicated high-maintenance fixture text across tests with negligible behavior risk if both tests consume the same canonical draft string.

### [ ] 2. Clarify Retry Loop Boundaries
**File:** `src/flow/lib/run-draft-task.js`  
**Issue:** `while (attempts <= retryMax) { attempts += 1; ... }` is harder to reason about and can be misread as allowing `retryMax + 1` attempts.  
**Suggestion:** Replace with an explicit bounded `for` loop (`for (let attempt = 1; attempt <= retryMax; attempt += 1)`) and use that variable directly in response payload/error text.

**Verdict:** REJECTED
**Reason:** This is likely a behavior change, not a pure refactor (`while (attempts <= retryMax)` currently permits `retryMax + 1` tries). Tightening to `<= retryMax` may break existing retry semantics.

### [ ] 3. Align Gate Command Construction With Container Pattern
**File:** `src/flow/lib/run-draft-task.js`  
**Issue:** `new RunGateCommand()` directly constructs the command, while surrounding flow code typically resolves dependencies through the container pattern. This creates inconsistency and makes mocking/substitution harder in tests.  
**Suggestion:** Resolve gate command via container (or a small factory function) to match existing command wiring style and improve testability.

**Verdict:** REJECTED
**Reason:** Consistency/testability benefit is plausible, but dependency-resolution wiring changes can alter runtime behavior and failure modes; too risky for a refactor-only change.

### [ ] 4. Improve Naming for Feedback Payload Semantics
**File:** `src/flow/lib/run-draft-task.js`  
**Issue:** Names like `reasons` / `priorReasons` are broad, but the payload actually mixes guardrail FAIL reasons and synthesized text-check issues.  
**Suggestion:** Rename to something explicit like `retryFeedback` / `previousGateFailures`, and rename `collectGateFeedback` to `collectRetryFeedback` to better reflect intent.

**Verdict:** REJECTED
**Reason:** Primarily a naming cleanup (cosmetic). It does not materially improve behavior or architecture enough to justify churn under a conservative review bar.

### [x] 5. Avoid Silent Failure Paths in Agent Resolution
**File:** `src/flow/lib/run-draft-task.js`  
**Issue:** The empty `catch {}` around `container.get("agent")` silently drops dependency-resolution errors, making misconfiguration harder to detect.  
**Suggestion:** Keep fallback behavior, but record a structured warning (or attach context to escalation) when container resolution fails so failures are diagnosable without changing CLI contract.

**Verdict:** APPROVED
**Reason:** Silent dependency-resolution failures are diagnosability hazards; adding non-breaking structured warning/context improves operability without changing success/failure contract.
