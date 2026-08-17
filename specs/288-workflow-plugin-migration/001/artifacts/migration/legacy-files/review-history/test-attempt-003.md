# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/288-workflow-plugin-migration/test-coverage.json`

## Blocking Findings

### 1. Service behavior can be stubbed while tests pass
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js: R2/R3 service coverage
**Issue:** The command tests use injected fake services and the shared-service test only asserts method existence. A plugin with no real board add/update/show/search/list behavior, no real issue-start behavior, and mostly stubbed service implementations could satisfy these tests.
**Required change:** Add spec-local service-level tests that instantiate the plugin-owned services with fake board/GitHub/agent clients and assert the required board operations, publishing, issue-start, and idea extraction behavior is actually performed through those clients.
**Why blocking:** R2 and R3 require the migrated plugin to own existing workflow behavior and shared services; current tests would pass without exercising that production behavior.

### 2. Finalize-cleanup core lifecycle is not covered
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js: R4 lifecycle coverage
**Issue:** The generic lifecycle test only executes a prepare.post hook. finalize-cleanup.post is tested only by directly instantiating the workflow plugin hook, so the core lifecycle path is not verified for finalize-cleanup with durable spec, issue-log, and artifact context.
**Required change:** Add a lifecycle test that runs runFlowCommandWithPluginLifecycle with command "finalize-cleanup" and asserts the hook receives durable spec, issue-log, and artifact path context while hook business failures remain non-fatal.
**Why blocking:** R4 explicitly requires generic core lifecycle support for finalize-cleanup.post; the coverage artifact marks R4 covered, but this required core behavior has no corresponding executable test.

### 3. Core workflow fixture removal check misses non-JS fixtures
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js: R10 test
**Issue:** The R10 test scans only JavaScript files under tests/. Workflow-specific JSON, Markdown, snapshot, or other fixture files could remain while this test passes.
**Required change:** Expand the R10 scan to include test fixture files and relevant path names, with exclusions only for the spec-local migration tests or explicitly generic plugin fixtures.
**Why blocking:** R10 requires core tests to remove workflow-specific feature fixtures and expectations. The current test does not cover fixture files, so the requirement coverage artifact overstates actual coverage.


## Advisory Findings

### 1. Upgrade evidence check does not compare generated artifacts
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js: R12 test
**Improvement:** The R12 test checks for upgrade evidence and removed workflow strings, but it does not verify that deployed/generated skill artifacts actually match the changed source. Consider comparing generated artifacts to their source-derived expected content when src/skills or src/presets changes.
**Why non-blocking:** R12 is a should requirement, and the existing test still gives useful evidence that upgrade was considered and removed workflow commands are absent.
