# Spec Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. Branch authority is required but not defined against existing branch-flow state
**Target:** R1, R2, R4, R5, R10
**Issue:** The spec requires FlowTargetBinding to store and validate "branch authority" and to fail ACTIVE_FLOW_MISMATCH on branch-authority mismatch, but it does not define which existing codebase authority is canonical for non-worktree branch flows. Existing active-flow entries distinguish only mode/spec, while flow state and finalization paths use featureBranch/baseBranch and Git refs/current checkout in different places. Without a spec-level definition, implementation could validate mode only, flowState.featureBranch, the current Git branch, or a ref OID, producing different behavior.
**Required change:** Define the branch-authority fields FlowTargetBinding must capture and compare for normal branch flows, using existing state/interface names such as flowState.featureBranch, active-flow mode, execution root, and/or Git ref identity as applicable.
**Why blocking:** Tests cannot assert R4/R5/R10 branch mismatch behavior, and implementers can choose incompatible validation targets that either allow finalize/cleanup against the wrong branch or reject valid branch-flow continuations.


## Non-blocking Improvements

### 1. Docs freshness is stale
**Target:** GLOBAL
**Improvement:** `senti check freshness` reported `stale — source is newer than docs/, run: senti docs build`, so implementation planning should treat docs as potentially stale and prefer source when they differ.
**Why non-blocking:** The supplied spec includes direct codebase context and the reviewer could verify relevant source behavior; this does not make the spec itself impossible to implement or test.
