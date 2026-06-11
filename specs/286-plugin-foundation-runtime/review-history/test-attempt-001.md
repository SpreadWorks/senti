# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/286-plugin-foundation-runtime/test-coverage.json`

## Blocking Findings

### 1. R2 known-path assertion builds invalid regexes
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js R2
**Issue:** The loop creates RegExp objects with expected.replace(..., "\\{{PROMPT}}"), so entries containing dots such as plugin.json and config.schema.json are transformed into patterns containing {{PROMPT}} rather than escaped dots. This makes the test fail or check the wrong text before it can validate the installer contract.
**Required change:** Replace the placeholder replacement with a real regex escape helper, for example replacing metacharacters with "\\$&".
**Why blocking:** A test that is not executable or clearly checks the wrong pattern blocks implementation because it cannot provide valid acceptance feedback.

### 2. R1 is covered only by source-text greps
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js R1
**Issue:** The test only searches src/lib/config.js, src/lib/plugin-registry.js, and src/plugin.js for terminology. It does not exercise config schema validation, actionable errors for old fields, plugin CLI output, documented migration guidance, or registry source resolution behavior.
**Required change:** Add spec-local executable coverage that loads/validates configs using plugin.sources/packages[].source and old plugin.repos/packages[].repo, invokes or directly tests plugin CLI output, and resolves plugin registry sources from fixtures.
**Why blocking:** The acceptance requirement is behavioral, and the current test could pass from comments or unused strings without proving the public behavior works.

### 3. R2 does not exercise installer copy and safety behavior
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js R2
**Issue:** Beyond the invalid regex construction, the test only checks for constants and strings in plugin-registry.js. It does not install a fixture plugin, assert plugin.json.files is optional, verify only known package paths are copied, or regression-test the required safety rejections and copy limits.
**Required change:** Add executable fixture-based installer tests that omit plugin.json.files, include allowed and disallowed paths, and assert copied files plus representative safety failures for traversal/symlink/scripts/package.json/depth/count/path-length/JSON-size constraints.
**Why blocking:** R2's critical safety and packaging behavior has no corresponding production-behavior coverage.

### 4. R3 hook discovery validation is not exercised
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js R3
**Issue:** The test greps for hook-related names but does not create hook fixtures or run discovery/validation. It would pass without enforcing one hook per hooks/*.js file, plugin/package caps, default export register(api), named class returns, FlowCommandHook inheritance, command/hook metadata, integer priority, or prepare.pre rejection.
**Required change:** Add executable hook discovery tests with valid and invalid hook modules and assertions for the required validation errors and caps.
**Why blocking:** A static string check can pass without exercising production hook discovery, leaving R3 effectively uncovered.

### 5. R4 snapshot guarantees are not tested
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js R4
**Issue:** The test checks for field names in source files and even asserts that absolute-path related text exists, but it does not run flow prepare, inspect flow.json, verify relative module paths, or prove hooks are not re-discovered during active flows.
**Required change:** Add an executable flow prepare fixture test that inspects flow.json plugins.flowCommandHooks and asserts the exact persisted fields, no absolute paths, and active-flow execution uses the snapshot after hook files are changed or removed.
**Why blocking:** R4 requires persisted runtime state semantics; the current test could pass while the implementation stores absolute paths or re-discovers hooks.

### 6. R5 hook execution behavior is not covered
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js R5
**Issue:** The test only searches source text for context and warning terms. It does not execute snapshot hooks at pre/post lifecycle points, inspect the public context shape, verify envelope helpers/artifacts, or assert hook failures become non-blocking warnings plus issue-log candidates.
**Required change:** Add executable flow command tests using fixture hooks that record received context and throw, then assert lifecycle execution, warning envelopes, and issue-log candidate output.
**Why blocking:** R5's lifecycle and failure-normalization behavior has no production-behavior regression coverage.

### 7. R6 plugin command contract is not exercised
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js R6
**Issue:** The test greps for register(api), Envelope, and command.main strings but does not load a plugin command module, execute command.main(argv, context), verify Envelope-compatible returns, normalize thrown errors, or ensure raw core ctx is absent from the context.
**Required change:** Add executable plugin command fixtures for success, invalid return, and thrown error cases, and assert argv/context shape plus failure-envelope normalization.
**Why blocking:** The command loading and execution contract could be broken while this test still passes from unused strings.

### 8. R7 help metadata path is not protected by behavior tests
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js R7
**Issue:** The test statically checks help.js and plugin-registry.js but does not render top-level, command, or subcommand help from plugin.json contributions.commands[]. It also does not prove plugin command modules are not imported, because no throwing side-effect command fixture is used.
**Required change:** Add executable help rendering tests with plugin metadata fixtures, including locale and experimental display, plus a command module that would throw if imported during help rendering.
**Why blocking:** R7 specifically requires a no-import metadata rendering path, and the current static test does not verify that public behavior.

### 9. R8 config migration/defaults and agent API are undercovered
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js R8
**Issue:** The test only checks strings in config.js and official workflow schema/default files. It does not assert defaults merge under plugin.config.<pluginId> at loadConfig runtime, that .senti/config.json is not rewritten, that top-level workflow config migrates through guidance, or that plugins can pass provider/profile overrides through a generic agent execution API.
**Required change:** Add executable loadConfig/upgrade guidance tests with plugin schema/default fixtures and a focused generic agent API test that observes provider/profile override propagation from plugin config.
**Why blocking:** Several must requirements in R8 have no corresponding spec-local behavioral coverage.

### 10. R9 workflow migration behavior is only checked by text presence
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js R9
**Issue:** The test asserts that a hook file exists and contains certain words, and that the skill text omits old workflow wording. It does not execute the official workflow plugin prepare.post hook or verify issue-start behavior reads plugin.config.workflow.flowIntegration after migration.
**Required change:** Add an executable prepare.post hook test using migrated plugin.config.workflow.flowIntegration and assert the issue-start behavior/artifacts are preserved.
**Why blocking:** R9 requires preserving existing workflow behavior through the official plugin hook, which is not proven by file existence or word matching.

### 11. R10 scans only tests/unit, not source/runtime expectations
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js R10
**Issue:** The test only scans selected files under tests/unit. The requirement also calls out core runtime/source expectations, so source files and other relevant core tests can still depend on actual official preset names without this test failing.
**Required change:** Expand R10 coverage to include the relevant core source/runtime files and non-historical test locations while preserving the explicit exclusions for user config examples, generated docs, and historical specs.
**Why blocking:** The requirement coverage artifact claims R10 is covered, but the actual test omits part of the stated acceptance surface.


## Advisory Findings

No advisory findings.