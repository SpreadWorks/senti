# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/299-agent-config-setup/test-coverage.json`

## Blocking Findings

### 1. Interactive prompt behavior is untested
**Target:** specs/299-agent-config-setup/tests/agent-config-setup.test.js: R1
**Issue:** The R1 test only checks buildSetupAgentConfig mappings after selectedAgents/mainAgent are already supplied. It does not exercise or assert the interactive setup flow that must ask for the main/default agent only when both claude and codex are selected.
**Required change:** Add a spec-local test around the interactive setup prompt orchestration, or a prompt-planning helper, asserting that single-family selections skip the main-agent prompt and dual-family selections include it.
**Why blocking:** R1's acceptance behavior is about conditional interactive prompting, and the current test would pass even if the wizard always asked, never asked, or asked at the wrong time.

### 2. Built-in override semantics are not covered
**Target:** specs/299-agent-config-setup/tests/agent-config-setup.test.js: R4
**Issue:** The R4 test verifies built-in profile resolution without config-local copies, but it does not test that user-defined agent.profiles or agent.providers override package built-ins by matching key.
**Required change:** Add assertions using a config-local profile/provider with the same key as a built-in and verify validation/runtime resolution uses the user-defined entry.
**Why blocking:** Override precedence is an explicit must requirement in R4 and is a critical config behavior; without this coverage an implementation could ignore user overrides while still passing the current test.

### 3. R5 uses a source-string anti-pattern instead of production behavior
**Target:** specs/299-agent-config-setup/tests/agent-config-setup.test.js: R5
**Issue:** The R5 test only asserts setup.js and upgrade.js do not contain a specific function call string, mergeAgentDefaults(. It does not execute setup or upgrade behavior, verify generated config omits built-in profiles/providers, or verify existing unknown entries remain preserved.
**Required change:** Replace or supplement the source-string assertion with executable tests that run the relevant setup/upgrade config path and assert no built-in agent.profiles/providers are written while existing user-defined unknown entries are retained.
**Why blocking:** This static assertion can pass without exercising production behavior and can miss equivalent seeding through any other function name, directly matching the blocking anti-pattern category.

### 4. Interactive file-target choice is not tested
**Target:** specs/299-agent-config-setup/tests/agent-config-setup.test.js: R6
**Issue:** The R6 test checks resolveSetupAgentFileTargets after selectedTargets are already provided, but it does not verify that the interactive setup flow actually lets the user choose AGENTS.md and/or CLAUDE.md when both agents are selected.
**Required change:** Add a spec-local test for the interactive prompt flow or prompt plan that asserts dual-agent interactive setup includes the file-target choice and honors both AGENTS.md and CLAUDE.md selections.
**Why blocking:** R6's interactive acceptance behavior could be absent while the helper still returns provided selectedTargets, so the test does not cover the requirement.

### 5. Documentation/help coverage for R7 is incomplete
**Target:** specs/299-agent-config-setup/tests/agent-config-setup.test.js: R7
**Issue:** The R7 test checks setup summary lines for selected aliases and built-in profile names, but it does not test help/docs output or override examples for agent.profiles and agent.providers.
**Required change:** Add spec-local assertions against the relevant help/docs text or generated documentation that verify built-in profile names and concrete override examples for both agent.profiles and agent.providers are present.
**Why blocking:** R7 is a must requirement covering setup completion output and help/docs; the current test leaves the docs/help and override-example portions untested.

### 6. R9 does not cover built-in useProfile normalization without default
**Target:** specs/299-agent-config-setup/tests/agent-config-setup.test.js: R9
**Issue:** The R9 test covers concrete provider defaults and built-in useProfile names only when agent.default is also present. It does not cover normalization from an existing built-in agent.useProfile name alone, even though R9 requires built-in useProfile names to normalize into wizard availability and main/default defaults.
**Required change:** Add cases such as { useProfile: 'claude-main' }, { useProfile: 'codex-main' }, { useProfile: 'claude-only' }, and { useProfile: 'codex-only' } and assert the expected selectedAgents/mainAgent defaults.
**Why blocking:** A rerun implementation could ignore existing built-in useProfile values unless agent.default is set and still pass the current R9 test, leaving a required migration/defaulting path uncovered.


## Advisory Findings

### 1. Add whitespace coverage for comma-separated agents
**Target:** specs/299-agent-config-setup/tests/agent-config-setup.test.js: R3
**Improvement:** Include a non-interactive parse case with spaces around comma-separated values, such as 'claude, codex', if the CLI is expected to accept typical human input formatting.
**Why non-blocking:** The core single-value and ordering semantics are covered; whitespace tolerance is a useful boundary case but not explicitly required by the stated requirement.
