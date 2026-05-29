# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/269-promote-workflow-cli/test-coverage.json`

## Blocking Findings

### 1. R1 file relocation coverage is incomplete
**Target:** specs/269-promote-workflow-cli/tests/promote-workflow-cli.test.js R1 test
**Issue:** The R1 test only asserts src/workflow/registry.js, src/workflow/lib/, and a subset of command files. It does not assert the relocated dispatcher or the required dependency files lib/config.js, lib/graphql.js, lib/board-helpers.js, lib/hash.js, lib/validation.js, lib/category.js, and lib/base-command.js.
**Required change:** Extend the R1 test to assert every file named by R1 exists under src/workflow/, including the dispatcher and all listed lib dependencies.
**Why blocking:** R1 is a must requirement, and the current spec-local test coverage can pass while several explicitly required relocated files are missing.

### 2. R2 routing test does not verify routing target or subcommand dispatch
**Target:** specs/269-promote-workflow-cli/tests/promote-workflow-cli.test.js R2 test
**Issue:** The R2 test only searches src/sdd-forge.js for a workflow key in NAMESPACE_SCRIPTS. It does not prove that sdd-forge workflow <subcommand> routes to the src/workflow dispatcher.
**Required change:** Add an executable assertion that invokes at least one workflow subcommand through node src/sdd-forge.js workflow <subcommand> and/or statically asserts the workflow namespace target points at src/workflow, not just that a workflow key exists.
**Why blocking:** R2 is a must requirement, and the current test would pass for a workflow namespace entry that points somewhere other than the promoted src/workflow dispatcher.

### 3. R12 help test misses required experimental labeling and usage sweep
**Target:** specs/269-promote-workflow-cli/tests/promote-workflow-cli.test.js R12 test
**Issue:** The R12 test only checks that top-level help contains workflow and that workflow --help omits workflow.js. It does not assert top-level help lists workflow as [EXPERIMENTAL], and it does not inspect dispatcher/registry usage strings beyond workflow --help output.
**Required change:** Assert top-level sdd-forge help contains workflow with [EXPERIMENTAL], and inspect or exercise workflow dispatcher/registry usage surfaces so all user-facing usage strings use sdd-forge workflow <subcommand> and do not mention workflow.js.
**Why blocking:** R12 is a must requirement, and the current coverage can pass while the official help lacks the required [EXPERIMENTAL] label or while stale workflow.js usage remains outside the single help path tested.


## Advisory Findings

### 1. R5 upgrade branch removal is only partially checked
**Target:** specs/269-promote-workflow-cli/tests/promote-workflow-cli.test.js R5 test
**Improvement:** Also inspect src/upgrade.js for removal of the enable-conditioned workflow skill placement branch, since R5 explicitly calls it out.
**Why non-blocking:** The unconditional skill relocation is partly covered by the source path and skills helper check, but directly checking src/upgrade.js would make the test intent clearer.

### 2. R4 runtime config reads are not exercised
**Target:** specs/269-promote-workflow-cli/tests/promote-workflow-cli.test.js R4 test
**Improvement:** Add a focused check that workflow command code reads workflow.languages.source/publish rather than only validating the schema accepts and rejects keys.
**Why non-blocking:** Schema migration is covered, but runtime read-site coverage would catch a likely implementation slip without being strictly necessary for this static test set.
