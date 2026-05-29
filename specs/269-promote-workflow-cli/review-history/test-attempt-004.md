# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/269-promote-workflow-cli/test-coverage.json`

## Blocking Findings

### 1. Dispatcher location test permits a non-compliant src/workflow.js layout
**Target:** tests/promote-workflow-cli.test.js R1/R2
**Issue:** R1 requires experimental/workflow.js and its dependencies to be relocated under src/workflow/, but the test accepts a top-level src/workflow.js dispatcher and R2 accepts NAMESPACE_SCRIPTS mapping workflow to "workflow". That can pass with the dispatcher outside src/workflow/, contradicting the relocation requirement and weakening the src/workflow dispatcher contract.
**Required change:** Require the dispatcher to live under src/workflow/ and require the route to target that dispatcher path, for example src/workflow/index.js or the exact repo convention chosen for src/workflow/.
**Why blocking:** A implementation that leaves the promoted dispatcher outside src/workflow/ could pass these tests while violating R1/R2.

### 2. R8 test does not enforce non-generated documentation regions or usage-pattern wording
**Target:** tests/promote-workflow-cli.test.js R8
**Issue:** R8 specifically requires README.md, AGENTS.md, and CLAUDE.md to mention in non-generated regions that workflow is experimental and usage patterns may change. The test only checks that each full file contains /workflow/i and /experimental/i anywhere, so generated {{data}}/{{text}} regions or unrelated mentions can satisfy it, and it never checks the required usage-patterns-may-change wording.
**Required change:** Strip or ignore {{data}}/{{text}} directive-generated regions before matching, and assert each file contains a workflow experimental notice that includes the usage-patterns-may-change meaning.
**Why blocking:** The acceptance requirement can be missed entirely while the test passes due to unrelated or generated text.

### 3. R10 test does not verify migrated experimental files were deleted
**Target:** tests/promote-workflow-cli.test.js R10
**Issue:** R10 requires experimental/workflow.js and all files relocated to src/workflow/ to be removed from experimental/. The test only asserts experimental/workflow.js is absent and does not check registry.js, lib/config.js, lib/graphql.js, lib/board-helpers.js, lib/hash.js, lib/validation.js, lib/category.js, lib/base-command.js, or lib/commands/* are gone from experimental/.
**Required change:** Add assertions that the relocated workflow dependency files and command files no longer exist under experimental/.
**Why blocking:** An implementation can duplicate files into src/workflow/ while retaining old experimental copies, passing the test but violating R10.

### 4. R10 test does not enforce the required experimental/AGENTS.md rewrite
**Target:** tests/promote-workflow-cli.test.js R10
**Issue:** R10 requires experimental/AGENTS.md to be revised from a workflow.js entrypoint description to a description of experimental/ as a pre-src promotion test-code area. The test only checks that workflow.js is not mentioned, which can pass with the file deleted, empty, or rewritten to unrelated content.
**Required change:** Assert experimental/AGENTS.md exists if it is expected to remain, and assert it contains the new pre-src promotion test-code meaning while not describing workflow.js as the entrypoint.
**Why blocking:** The required documentation change can be omitted while the current test still passes.

### 5. R12 user-facing workflow.js sweep is too narrow
**Target:** tests/promote-workflow-cli.test.js R12
**Issue:** R12 requires all workflow dispatcher/registry usage strings to use `sdd-forge workflow <subcommand>` and no user-facing workflow.js name to remain. The test only checks workflow --help stdout and src/workflow/registry.js for workflow.js, and does not inspect the dispatcher or command usage strings where user-facing usage text may also live.
**Required change:** Scan the workflow dispatcher and command files, or invoke representative subcommand help output, to assert user-facing usage strings use `sdd-forge workflow` and do not contain workflow.js.
**Why blocking:** A stale workflow.js usage string outside registry.js can remain and still pass the current test, violating R12.


## Advisory Findings

### 1. R4 old-key rejection could be more specific
**Target:** tests/promote-workflow-cli.test.js R4
**Improvement:** Use assert.throws with an expected error shape or message for unknown experimental.workflow keys, so the assertion distinguishes schema rejection from unrelated validation failures.
**Why non-blocking:** The test still exercises the intended old-key rejection path, but a more specific assertion would improve diagnostic quality.

### 2. R7 only checks global label presence
**Target:** tests/promote-workflow-cli.test.js R7
**Improvement:** Assert the [EXPERIMENTAL] label appears in the title line or at the head of the subcommand list, matching the precise placement requested by R7.
**Why non-blocking:** The existing test covers the core experimental-label requirement, but placement drift would be easier to catch with a tighter assertion.
