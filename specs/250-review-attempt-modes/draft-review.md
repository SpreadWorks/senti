# Draft Review Results

5 issue(s) detected.

### 1. 1. Review scope may be too narrow
**QA:** Q3  
**Issue:** The issue says “review node maxAttempts configurable per auto/manual mode,” but Q3 leaves implementation code review as scalar `3`. That may under-cover review nodes outside plan review unless the issue explicitly excludes implementation review.  
**Suggestion:** Add evidence or revise the answer to cover all review nodes. If implementation review is intentionally excluded, state why from issue context; otherwise define `{ auto, manual }` support/value for implementation review too.

### 2. 2. “No confirmation” behavior is not tied to an observable boundary
**QA:** Q1  
**Issue:** The answer says no additional user confirmation appears on review-draft exhaustion, but it does not specify where this must be enforced: prompt text, `next-action` payload, CLI stdout, or review loop control flow. The evidence cites prompt and `review.js`, but not the actual user-facing envelope that could request confirmation.  
**Suggestion:** Add a QA entry or strengthen Q1 to define the observable contract: when `review-draft` reaches `maxAttempts`, the next action/output must stop without any confirm/approve choice, and only PASS may expose approval/confirmation choices.

### 3. 3. Mode resolution evidence is weak
**QA:** Q2  
**Issue:** The answer defines `flow.autoApprove=true` as auto and false/missing as manual, but the evidence only says `FlowNode` stores `maxAttempts`. It does not support that `autoApprove` is the correct mode source or where that value is available during resolution.  
**Suggestion:** Cite or add investigation for the code path that carries `flow.autoApprove` into next-action/review execution, then state exactly which layer resolves mode-specific `maxAttempts`.

### 4. 4. Missing test coverage expectations
**QA:** NEW  
**Issue:** No QA entry defines what regression tests/spec checks are needed, despite behavior spanning flow definition parsing, next-action payloads, retry limits, and draft exhaustion UI behavior.  
**Suggestion:** Add QA covering tests: scalar maxAttempts compatibility, object `{ auto, manual }` validation, auto/manual resolution, review-draft auto limit `1` vs manual `5`, and no confirmation on draft exhaustion.

### 5. 5. Unsupported historical evidence
**QA:** Q1, Q3  
**Issue:** Both entries rely on “User selected/specified … on 2026-05-01,” but that evidence is not present in the provided request/issue text. As a draft QA entry, this is hard to audit unless the conversation record is part of the spec evidence.  
**Suggestion:** Replace with evidence available in the issue/codebase, or explicitly cite the source artifact/log where that user decision is recorded.
