# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Spec-local cache scope has no implementation target
**Target:** R1/R6, Overview Data Flow, T-1
**Issue:** The spec requires cache reuse within an active flow or a current spec-local scope, but the existing Agent only receives paths and an optional FlowManager. FlowManager can resolve the active flow/current context, but there is no existing Agent.call option or service that identifies a non-active "current spec-local scope" for ordinary docs/metrics-style calls.
**Required change:** Define the exact cache scope resolution contract: for example, use only FlowManager active-flow/runId state and disable caching when no active flow exists, or add a specific Agent.call/FlowManager integration point that supplies a spec-local cache scope.
**Why blocking:** Without this, implementers cannot choose a safe storage path or write the R6 isolation test deterministically; a guessed path risks either no cache for required calls or cross-project/cross-flow cache leakage.

### 2. Cache key ignores mutable resolved profile behavior
**Target:** R1/R2/R3 cache identity
**Issue:** Existing Agent.resolve maps provider/profileKey to a profile object whose command, args, jsonOutputFlag, jsonSchemaFlag, and jsonSchemaMode directly affect the spawned provider invocation. The spec requires hits when commandId/provider/profileKey/prompt fields match, even if the underlying profile configuration changes under the same profileKey.
**Required change:** Add the resolved profile invocation identity to the cache key, or require invalidating/bypassing the cache when the resolved provider profile configuration differs from the configuration used to write the entry.
**Why blocking:** A persisted active-flow cache could replay a response produced by a different command/model/argument shape after config changes, so implementation would be unsafe and tests cannot define the correct behavior for same profileKey with changed invocation semantics.


## Non-blocking Improvements

### 1. Prefer one cache-hit evidence surface
**Target:** R5/T-3
**Improvement:** Clarify whether metrics or runtime logs are the preferred acceptance surface for cache-hit evidence, even if either remains allowed.
**Why non-blocking:** The current spec is testable because it explicitly permits either surface; choosing one would only reduce implementation variance.
