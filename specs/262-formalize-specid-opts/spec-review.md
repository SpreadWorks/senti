# Spec Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. Clarify accumulateAgentMetrics opts shape
**Target:** R1, R3
**Improvement:** Note explicitly whether accumulateAgentMetrics receives specId via its existing options bag or a new opts parameter, since src/lib/flow-store.js currently has a domain-specific signature that differs from the simple setRequest/setIssue setters.
**Why non-blocking:** The requirement still names the method and selection rule; implementation can pick the consistent signature from existing patterns without ambiguity that blocks coding or testing.

### 2. State FlowManager constructor compatibility
**Target:** R3
**Improvement:** Mention whether forRoot(root) (no options) continues to behave exactly as today and whether the bound specId is stored on the FlowManager instance versus on its underlying FlowStore, to remove any reader doubt about scope of the binding.
**Why non-blocking:** R3 and Constraints already specify fallback behavior and precedence; this is a clarity improvement, not an implementation gap.

### 3. Acceptance for CLI invalid-input exit codes
**Target:** Acceptance Criteria / T-2
**Improvement:** Add an explicit acceptance bullet that flow set request/issue/note/metric with invalid input still exits non-zero when ctx.specId is present, matching the Exit code contract constraint.
**Why non-blocking:** The Constraints section already defines the exit code contract and T-2 acceptance covers it; an extra acceptance bullet would only sharpen test design.
