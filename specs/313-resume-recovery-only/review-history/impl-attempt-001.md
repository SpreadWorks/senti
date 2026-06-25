# Code Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Local stale flows are classified as branch-only
**Failure mode:** spec_behavior_contradiction
**File:** src/lib/flow-manager.js
**Requirement:** R2
**Issue:** `_scanAllFlowsResult()` assigns `mode: "branch"` to local `specs/<id>/flow.json` files whenever `featureBranch !== baseBranch`, and `_recoveryStateFor()` then labels every such unregistered local candidate as `branch-only`. This collapses stale local candidates into the branch-only state instead of classifying stale and branch-only candidates separately.
**Suggestion:** Change `_recoveryStateFor()` so `branch-only` is returned only for candidates discovered from the branch traversal, for example when `entry.location` starts with `branch:`; let unregistered local candidates fall through to `stale`.
**Rationale:** R2 requires recovery discovery to classify stale and branch-only candidates separately. Branch-only should represent a candidate found only from `feature/*` branch discovery, while a local unregistered flow in `specs/` should remain a stale/display-only candidate.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
