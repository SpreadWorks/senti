# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Workflow flowIntegration behavior can be removed without a replacement
**Target:** R9 / T-9
**Issue:** The spec requires removing workflow-specific flow instructions from generated AI skill text, but it does not require an implementation target that preserves the existing workflow.flowIntegration behavior that currently runs workflow issue-start for linked issues. Because workflow implementation migration is out of scope, it is unclear whether this behavior should be implemented as a bundled/internal workflow hook, a temporary core-side hook, or deferred by keeping the skill text.
**Required change:** Add the smallest explicit requirement for preserving or intentionally dropping the existing workflow.flowIntegration behavior, including the concrete CLI-side hook/integration target if it must be preserved.
**Why blocking:** If left unchanged, an implementation can satisfy the text-removal assertions while silently disabling the existing opt-in board integration, and tests cannot determine what observable behavior should replace the removed skill instruction.

### 2. Top-level workflow config migration path is missing
**Target:** R8 / R9 / Constraints
**Issue:** The spec moves plugin-specific config under plugin.config.<pluginId>, and the workflow flowIntegration example moves under plugin.config.workflow, but the migration guidance only names plugin.repos and packages[].repo. Existing workflow.flowIntegration config is a user-visible behavior input and would be ignored unless a migration/error path is specified.
**Required change:** State the required handling for existing top-level workflow config fields affected by the namespace move, at least workflow.flowIntegration: migrate, reject with actionable guidance, or explicitly preserve as non-plugin config until a later workflow migration.
**Why blocking:** Without this, existing projects that opted into workflow board integration can lose the behavior silently after loadConfig() starts reading plugin.config.workflow, creating a compatibility and testing gap that gate cannot infer from schema shape alone.


## Non-blocking Improvements

### 1. Clarify plugin command help metadata shape
**Target:** R7 / AC9
**Improvement:** Mention that plugin command metadata must use the same field structure as the existing core help registry, or list the minimum fields needed for top-level help, command help, subcommands, locale wording, and experimental display.
**Why non-blocking:** The implementation can likely derive the structure from existing help code, but making it explicit would reduce manifest fixture ambiguity.

### 2. Clarify unsupported snapshot apiVersion behavior
**Target:** R4 / R5 / AC6
**Improvement:** Add the expected behavior when flow.json contains plugins.flowCommandHooks entries with an unsupported apiVersion.
**Why non-blocking:** Initial implementations can reasonably reject unsupported versions, but an explicit acceptance case would make future snapshot compatibility tests cleaner.
