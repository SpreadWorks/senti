# Code Review Results

### [x] 1. Avoid Double Directory Scans For Preparing Flows
**File:** `src/flow/lib/set-init.js`  
**Issue:** `cleanStalePreparingFlows()` is called immediately before `listPreparingFlows()`, which likely scans the same workspace state twice and can introduce a small timing inconsistency window.  
**Suggestion:** Consolidate to one API call, e.g. make `cleanStalePreparingFlows()` return the remaining preparing entries, or add `listPreparingFlows({ pruneStale: true })` and use that single result for warning logic.

**Verdict:** APPROVED
**Reason:** This targets a real inefficiency and removes a small race window between prune and list. If implemented as a single authoritative API (`prune+list` in one pass) with identical filtering semantics, behavior should remain unchanged while quality improves.

### [ ] 2. Make TTL Intent Explicit Instead Of Embedded As a Raw Formula
**File:** `src/lib/flow-helpers.js`  
**Issue:** `PREPARING_TTL_MS = 60 * 60 * 1000` is correct but hides business intent (1 hour policy) in arithmetic, making future policy changes less obvious.  
**Suggestion:** Introduce a semantic constant such as `const PREPARING_TTL_HOURS = 1;` and derive milliseconds from it, or add a short comment (`// 1 hour`) to improve readability and consistency with policy-driven constants.

**Verdict:** REJECTED
**Reason:** This is mostly readability/cosmetic. It does not materially improve structure or correctness, and under a conservative bar it is too low-impact to justify churn.
