# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Provider-family default behavior is underspecified against ProviderRegistry
**Target:** R3 / AC1 / Overview.Data Flow
**Issue:** The spec treats agent.default="codex" as a resolvable provider-family default for the observed Issue #378 config, but verified code shows ProviderRegistry.resolveProfile("codex") currently returns null for built-in Codex profiles because built-ins are keyed as "codex/gpt-5.4" and "codex/gpt-5.3" and _profileForKey only falls back from slash-qualified keys to exact family keys, not from a bare family key to a built-in profile.
**Required change:** Specify the exact spec-level policy for bare built-in provider-family defaults: either require ProviderRegistry to map "codex" to a defined built-in profile key and name the selection rule, or change AC1/R3 to use only exact user-defined family keys that ProviderRegistry already resolves.
**Why blocking:** Without this correction, an implementation can satisfy the stated 'only when ProviderRegistry can resolve' wording while leaving the observed default "codex" unresolved, or different implementers can choose different built-in Codex profiles, making the fix and tests unsafe to implement consistently.

### 2. Dry-run diagnostic requirement conflicts with current Agent.call behavior
**Target:** Scope.In / T-3 test_strategy
**Issue:** The scope asks for Agent.call dry-run failure diagnostic coverage, but existing Agent.call returns immediately when options._dryRun is true, before Agent.resolve runs. T-3 later says diagnostic tests should use _dryRun false for unresolved configs or use seams, which conflicts with the dry-run wording.
**Required change:** Choose one spec-level behavior: either remove/replace the dry-run diagnostic requirement with unresolved Agent.call diagnostics that run without _dryRun, or explicitly require _dryRun to perform resolution before short-circuiting.
**Why blocking:** The current spec changes what should be implemented and tested: preserving _dryRun means no dry-run failure diagnostics can exist, while making _dryRun resolve first changes an existing test-only contract.


## Non-blocking Improvements

### 1. Clarify plugin profile override granularity
**Target:** R2 / AC3 / T-2
**Improvement:** Clarify that createPluginAgentApi's profile override is a profile name passed to Agent.resolve for command-prefix lookup, while provider override is a provider/profile key override; this would make the expected tests for pluginConfig.agentProfile versus options.profile easier to target.
**Why non-blocking:** The existing module boundary and requirements are enough to implement precedence, but the distinction would reduce ambiguity in focused test cases.
