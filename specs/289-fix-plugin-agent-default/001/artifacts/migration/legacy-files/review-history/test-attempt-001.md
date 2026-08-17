# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/289-fix-plugin-agent-default/test-coverage.json`

## Blocking Findings

### 1. R1 fallback chain lacks active/default profile prefix coverage
**Target:** specs/289-fix-plugin-agent-default/tests/agent-resolution.test.js
**Issue:** R1 requires plugin command resolution through active profile prefix match, then default profile prefix match, then generic default fallback, but the tests only exercise the generic default path when the active profile has no plugin mapping. There is no spec-local executable test for an active profile prefix mapping or a default profile prefix fallback mapping for a plugin command.
**Required change:** Add the smallest executable tests that resolve a plugin command through an active profile prefix mapping and through a default profile prefix mapping before generic default fallback.
**Why blocking:** The coverage artifact marks R1 covered, but a required acceptance behavior has no corresponding spec-local test coverage.

### 2. R3 bare claude normalization is untested
**Target:** specs/289-fix-plugin-agent-default/tests/agent-resolution.test.js
**Issue:** R3 requires both bare built-in defaults to normalize before lookup: codex to codex/gpt-5.4 and claude to claude/sonnet. The current tests only assert the codex mapping.
**Required change:** Add an executable assertion that agent.default: "claude" resolves to profileKey "claude/sonnet".
**Why blocking:** A must requirement branch has no direct regression coverage.

### 3. R4 diagnostic content is only partially asserted
**Target:** specs/289-fix-plugin-agent-default/tests/agent-resolution.test.js
**Issue:** R4 requires unresolved-provider errors to include commandId, explicit provider override state, explicit/profile environment selection, active profile name, default key, and a concise failed-lookup reason. The test checks commandId, active profile, default key, and a generic provider override phrase, but does not clearly assert the explicit/profile environment selection or the failed-lookup reason.
**Required change:** Extend the R4 assertion to check the explicit/profile environment selection and a concise lookup-failure reason in the diagnostic message.
**Why blocking:** The acceptance requirement for diagnostic fields is broader than the executable assertions, so an implementation could omit required context and still pass.

### 4. Absolute path redaction assertion does not exercise the agent path
**Target:** specs/289-fix-plugin-agent-default/tests/agent-resolution.test.js
**Issue:** The R5 test checks err.message against a RegExp built from tmpDir() inside the assertion predicate. That creates a new unrelated temporary directory, not the root or config path used by the Agent under test, so the test would pass even if the actual local path leaked.
**Required change:** Capture the Agent test root/path used by makeAgent, or allow makeAgent to accept a caller-supplied root, and assert that the actual absolute path does not appear in the diagnostic.
**Why blocking:** This is a static anti-pattern that would pass without exercising the required production behavior for absolute local config path redaction.


## Advisory Findings

### 1. Aggregate R7 smoke test adds no coverage
**Target:** specs/289-fix-plugin-agent-default/tests/agent-resolution.test.js
**Improvement:** Remove or replace the final R7 assert.ok(true) test with concrete assertions, since R7 is already represented by the individual requirement tests.
**Why non-blocking:** It is harmless as a coverage index marker, but it does not validate behavior and may make coverage look stronger than it is.
