# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/288-workflow-plugin-migration/test-coverage.json`

## Blocking Findings

### 1. Temp lifecycle hook is not importable as ESM
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R4 lifecycle test
**Issue:** The test writes hooks/prepare.js with ESM syntax under fs.mkdtempSync(os.tmpdir()) but does not create a package.json with type module or use an .mjs file. Node will treat that temporary .js file as CommonJS outside the repo package boundary, so dynamic import or registry loading can fail before lifecycle behavior is exercised.
**Required change:** Create a package.json with {"type":"module"} in the temporary plugin/package root, or write/load the hook as .mjs or CommonJS in a way the registry supports.
**Why blocking:** A non-executable spec-local test blocks implementation independently of production code.

### 2. Plugin-owned service implementations are not covered
**Target:** R3 coverage in workflow-plugin-migration.test.js
**Issue:** The command and hook tests inject fake context.services and only assert that those fakes are called. No test imports, resolves, or executes the workflow plugin's real board, publish, issueStart, or ideas services, so a plugin with no production service implementations could pass.
**Required change:** Add a spec-local check that the external plugin exposes or loads real plugin-owned service modules for board, publish, issueStart, and ideas, and that commands/hooks use that shared plugin service boundary without core workflow imports.
**Why blocking:** R3 is a must requirement and currently lacks production-service coverage; the tests can pass without implementing the required services.

### 3. Command argument and option mapping can be ignored
**Target:** R2 test for public workflow subcommands
**Issue:** The valid-case assertions only compare service and method names. They do not assert that service input contains the title, id, status, category, body, label, spec path, or normalized validated values, and invalid cases do not cover every user-facing option contract.
**Required change:** For each public subcommand, assert the exact service input shape for representative valid arguments/options and add invalid cases for each user-facing argument or option required by the validation contract.
**Why blocking:** R2 requires entry-point validation and preservation of existing user-facing behavior; without input assertions, the test can pass while dropping or corrupting user input.

### 4. Agent override resolution is only partially tested
**Target:** R5 WorkflowAgentResolver test
**Issue:** The test checks profile and lang on agent.call but does not assert provider propagation, does not require agent.resolve to be used, and does not exercise the publish or ideas service call sites that must use publish, classify, similarity, and compose resolution.
**Required change:** Assert resolve/call interactions include the configured provider and profile for all four workflow agents, and add service-level coverage proving publish and ideas paths use WorkflowAgentResolver instead of direct or private AI calls.
**Why blocking:** R5 is a must requirement for public plugin agent API use and provider/profile override resolution; the current test misses required parts of that contract.

### 5. In-boundary plugin verification is not tested
**Target:** R1 workflow plugin workspace test
**Issue:** The R1 test verifies that plugin-workspace.json points under the active worktree and records a commit, but it does not verify that plugin-side implementation or verification was performed from that in-boundary workspace. The only smoke command runs from the core root.
**Required change:** Require recorded plugin-side verification evidence under the spec or plugin workspace, or execute a plugin-owned smoke/test command with cwd set to the recorded pluginRoot.
**Why blocking:** R1 explicitly requires plugin-side implementation and verification from the in-boundary location, and that acceptance requirement currently has no corresponding spec-local coverage.


## Advisory Findings

### 1. Upgrade artifact equivalence could be stronger
**Target:** R12 upgrade evidence test
**Improvement:** The test checks for upgrade evidence and absence of old workflow strings in deployed skills, but it does not compare generated deployed artifacts against source changes. Adding a source-to-generated diff or checksum assertion would better prove artifacts match the updated sources.
**Why non-blocking:** R12 is a should requirement, and the existing test still catches the most obvious stale workflow guidance.
