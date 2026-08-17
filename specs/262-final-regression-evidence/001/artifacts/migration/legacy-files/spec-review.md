# Spec Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. Clarify worktree root resolution source
**Target:** R6 / src/flow/lib/run-final-regression.js
**Improvement:** The spec says to compare the active worktree root with ctx.root, but it does not name which helper resolves the active worktree root (e.g., flow-context.js vs flow-manager.js). Naming the resolver would prevent ambiguous implementations.
**Why non-blocking:** Implementation can still proceed by inspecting existing flow-context/flow-manager helpers; this is a clarity aid, not a correctness blocker.

### 2. Specify attempt-number allocation rule on gaps
**Target:** R4 / Tasks T-3
**Improvement:** The spec requires monotonically increasing zero-padded attempt numbers but does not state behavior when existing attempt files have gaps (e.g., 001, 003 present). Stating whether to use max+1 vs lowest-missing would remove ambiguity.
**Why non-blocking:** Either policy is implementable and testable; the constraint already bounds discovery to scanning tests/.raw, so this is a refinement.

### 3. State retention policy for legacy final-regression.log
**Target:** Clarifications / R4
**Improvement:** The clarification says the old single-log path is not kept as an active output but does not state whether an existing tests/.raw/final-regression.log left over from prior runs should be deleted, ignored, or left in place. Making this explicit avoids inconsistent cleanup.
**Why non-blocking:** Implementation can default to leaving stale files untouched without breaking acceptance criteria; this is a tidiness clarification.
