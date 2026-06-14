# Code Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Setup persists config before preset integrity validation
**Failure mode:** security_or_data_integrity_bug
**File:** src/setup.js
**Issue:** main() now writes configPath before ensureSetupOfficialPresetState() and writes it again after config.type minimization, but validatePresetChain() runs only after both writes. If the preset/template integrity check fails, setup exits after leaving .senti/config.json mutated to the failed configuration.
**Suggestion:** In main(), defer writing wizard-managed config fields until after leafTypes are computed and both validate(config) and validatePresetChain(config.type, workRoot, ...) have succeeded. If official package state must be prepared first, keep that mutation separate from the pending setup config and perform the final config write only after validation passes.
**Rationale:** This is a data integrity failure: a fail-fast validation path can persist an invalid or partially applied setup state instead of leaving the project config unchanged.

### 2. Metadata containment can be bypassed by symlinks
**Failure mode:** security_or_data_integrity_bug
**File:** src/lib/plugin-registry.js
**Issue:** pluginMetadataPath() checks only the lexical resolved path, while readPluginJson() uses fs.statSync(), which follows symlinks. A plugin can place a preset/config metadata path inside the plugin root as a symlink to a small JSON file outside the root; it passes isUnderPath() but setup reads external JSON as trusted plugin metadata.
**Suggestion:** Update the metadata read path to reject symbolic links with lstatSync() or compare fs.realpathSync(file) against fs.realpathSync(root) before reading. Apply that containment check to PluginManifest.fromRoot(), presetEntries(), and loadPluginConfigDefaults().
**Rationale:** R9's path/file bounds need to constrain the actual file being read, not just the string path. Otherwise plugin metadata can escape the package root and influence setup candidates or config defaults from outside the plugin package.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
