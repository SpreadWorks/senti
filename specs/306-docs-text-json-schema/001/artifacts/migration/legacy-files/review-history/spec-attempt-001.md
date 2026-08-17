# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Default docs.text path is not covered by schema-default alignment
**Target:** R2 / T-4 / src/lib/agent-defaults.js
**Issue:** The spec only requires Codex default alignment, but existing built-in profiles route docs.text to claude/sonnet in claude-main, codex-main, and claude-only. ProviderRegistry merges provider builtin profiles first and then defaultAgentProviders(), so the src/lib/agent-defaults.js provider pool entries override the schema-capable provider.js profiles; the claude/sonnet pool entry currently lacks jsonSchemaFlag/jsonSchemaMode.
**Required change:** Broaden R2/T-4 and the related acceptance criterion to require jsonSchemaFlag/jsonSchemaMode on every built-in default provider entry that can be resolved for docs.text, at least claude/sonnet and codex/gpt-5.4, or explicitly require built-in missing-schema diagnostics/failure for those defaults.
**Why blocking:** If left unchanged, implementation can satisfy the Codex-specific requirement while the default docs.text configuration still passes jsonSchema to Agent.call without any schema flag reaching the CLI, so the core schema-enforcement behavior is not actually implemented or testable on the default path.


## Non-blocking Improvements

### 1. Clarify directive-id schema strictness
**Target:** R1 / T-1
**Improvement:** State whether the batch JSON schema should require the exact directive ids for the target file and reject extra keys, or whether an open string-to-string object is sufficient.
**Why non-blocking:** Both shapes can be implemented and tested from the current spec, but the stricter choice would better match the directive-id contract and avoid ambiguity in test expectations.
