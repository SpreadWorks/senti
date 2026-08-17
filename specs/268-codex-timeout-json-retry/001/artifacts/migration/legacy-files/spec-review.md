# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Docs text preview source conflicts with available data path
**Target:** R4 / T-4 / Acceptance Criteria
**Issue:** The spec alternates between requiring a docs text batch JSON parse failure to include a "stdout preview" and a "response preview". In the verified code path, src/docs/commands/text.js only receives the normalized agent result returned by agent.call() after provider parsing and stripPreamble(); it does not have access to raw subprocess stdout captured inside src/lib/agent.js.
**Required change:** State explicitly whether R4 requires a preview of the normalized agent response currently passed to parseBatchJsonResponse, or add an explicit requirement for an Agent.call/raw-stdout data path if actual subprocess stdout must be shown.
**Why blocking:** Without this correction, implementation and tests can target two different behaviors: a small text.js error-message change using result.slice(0, 200), or a larger agent API/data-path change to expose raw stdout. Those are materially different implementations and cannot be tested against one unambiguous contract.


## Non-blocking Improvements

### 1. Narrow agent diagnostic wording
**Target:** R3 / T-2
**Improvement:** Clarify that R3 applies to subprocess close failures such as timeout, signal, and non-zero exit errors, not to the existing tryParseProvider fallback path unless that behavior is intentionally being changed.
**Why non-blocking:** The implementation target in src/lib/agent.js is still discoverable from the current spec, and the out-of-scope provider normalization decision reduces the risk of an accidental broader rewrite.
