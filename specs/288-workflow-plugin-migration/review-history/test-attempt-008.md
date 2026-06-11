# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/288-workflow-plugin-migration/test-coverage.json`

## Blocking Findings

### 1. Provider override assertions are missing
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R5: workflow plugin agent adapter resolves publish and ideas overrides through public context
**Issue:** The configured-provider case only asserts call.options.provider equals resolve.options.provider. If the implementation ignores plugin.config.workflow.agent.<name>.provider entirely, both values can be undefined and the test still passes.
**Required change:** Assert the expected configured provider for each workflow agent name on the resolve call and the eventual call options, for example publish => codex/gpt-5.4, classify => claude/haiku, similarity => codex/gpt-5.4-mini, compose => claude/sonnet.
**Why blocking:** R5 explicitly requires provider/profile overrides from plugin.config.workflow.agent.<name>; profile is covered, but provider override behavior has no effective regression test.

### 2. Workflow config removal coverage is too narrow
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R7: core has no workflow-specific config, bootstrap, help, locale, or agent defaults
**Issue:** The R7 regex only catches workflow config objects when they appear after CONFIG_SCHEMA, plus a few specific strings. Core could still retain workflow defaults or migrations in another config/default/migration module using keys like workflow: {...} or "workflow" without matching this test.
**Required change:** Add targeted assertions over core config/default/migration files that reject workflow-specific config keys/defaults/migrations and workflow agent default entries regardless of the surrounding symbol name.
**Why blocking:** R7 requires removing workflow-specific config schema/defaults/migration and default agent profiles; the current test can pass while those artifacts remain.


## Advisory Findings

### 1. Upgrade evidence check is shallow
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R12: changed skills and templates have upgrade evidence
**Improvement:** When source skills or presets change, compare generated deployed skill artifacts against source expectations or inspect upgrade-result.json content instead of only checking that an evidence file or log exists.
**Why non-blocking:** R12 is a should-level requirement and the existing test still catches absence of upgrade evidence, but it does not prove generated artifacts match the changed sources.
