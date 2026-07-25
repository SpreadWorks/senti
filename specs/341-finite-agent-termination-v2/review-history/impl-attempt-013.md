# Code Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. Unreadable /proc members can be treated as terminated
**Finding key:** proc-member-read-errors-mark-tree-dead
**Failure mode:** security_or_data_integrity_bug
**File:** src/lib/agent.js
**Requirement:** R1
**Issue:** readLinuxProcessGroupMembers() reports per-member stat read/parse failures but drops those entries and still returns the remaining parsed list. With originalPosixMembers set, processGroupHasNoLiveOriginalMembers() returns true whenever no parsed member matches the original identities, so an EACCES/ENOENT/parse failure for a still-running original process can make the supervisor mark the POSIX tree dead and resolve before the final deadline.
**Suggestion:** Change readLinuxProcessGroupMembers() so any member inspection failure makes the scan unavailable, or otherwise carry an explicit incomplete-scan state. In processGroupHasNoLiveOriginalMembers(), return false when the scan is incomplete instead of treating missing entries as dead.
**Disposition:** must-fix
**Rationale:** R1 requires finite timeout settlement based on real process-tree termination state. Silently dropping unreadable members breaks the mandatory guardrail that unknown live processes must not be treated as terminated.

### 2. Original POSIX members are captured too late for PID reuse protection
**Finding key:** original-members-captured-after-sigterm-grace
**Failure mode:** security_or_data_integrity_bug
**File:** src/lib/agent.js
**Requirement:** R3
**Issue:** _captureOriginalPosixMembers() runs in _forceKill() after the SIGTERM grace period has already elapsed. If an original process exits during that grace window and its PID is reused before SIGKILL, the reused process can be recorded as an original member and later included in liveness checks or unterminated diagnostics.
**Suggestion:** Capture the original POSIX process-group identities before sending the first timeout signal in _onDeadline(), then reuse that immutable identity map through SIGTERM, SIGKILL, polling, and final diagnostics.
**Disposition:** must-fix
**Rationale:** R3 is specifically about excluding PID-reused members from original live-member accounting. Capturing identities only after the grace period leaves a reuse window and does not satisfy the mandatory PID-reuse guardrail.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
