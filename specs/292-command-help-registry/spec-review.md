# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Independent core commands have no metadata owner
**Target:** R2 / Overview Modules / Acceptance Criteria
**Issue:** The current top-level help includes `help`, `setup`, `upgrade`, `plugin`, and `presets list`, but `src/lib/command-registry.js` only aggregates `flow`, `docs`, `check`, `metrics`, `spec`, and `hook`. The independent commands live in standalone entrypoints and are not Command subclasses or registry entries, so the spec does not identify where their help metadata should live after `src/help.js` stops owning the hardcoded LAYOUT.
**Required change:** Add a spec-level mapping for the independent top-level core commands, naming their new metadata owner or an explicit unchanged owner for each of `help`, `setup`, `upgrade`, `plugin`, and `presets list`.
**Why blocking:** Without this mapping, implementing the removal of `src/help.js` LAYOUT can either drop existing public help entries or keep new static exceptions, and tests cannot verify that every currently shown core command is registry/metadata-derived.

### 2. Public help invocation surfaces are not mapped to renderer ownership
**Target:** R3 / R4 / R7 / Migration parity
**Issue:** Existing help is split across multiple observable CLI paths: `senti help`, `senti help <plugin>`, namespace help such as `senti docs --help` and `senti flow run --help`, leaf help such as `senti docs build --help`, and direct plugin help through `senti <plugin> --help` via `dispatchPluginCommand`. The spec names broad surfaces like core command help and plugin command help, but does not say which concrete invocations must move to the shared renderer and which, if any, remain with existing dispatchers or plugin execution.
**Required change:** Enumerate the retained CLI help invocation surfaces and assign each one to the shared renderer or to an explicit unchanged owner, including namespace/group help and direct plugin `--help` behavior.
**Why blocking:** Without this, implementers and tests cannot determine whether paths like `senti docs --help`, `senti flow run --help`, or `senti <plugin> --help` must be renderer-backed. That can leave drift-prone help paths in place while still satisfying only generic top-level tests.


## Non-blocking Improvements

### 1. Related file list misses key dispatcher files
**Target:** Codebase Context
**Improvement:** Add `src/senti.js`, `src/lib/dispatcher.js`, `src/docs.js`, `src/check.js`, `src/metrics.js`, `src/spec.js`, `src/hook.js`, `src/setup.js`, `src/upgrade.js`, `src/plugin.js`, and `src/presets-cmd.js` to the related files list because they own current public help routing and independent command behavior.
**Why non-blocking:** The spec already names the main help and registry modules, so implementation can still discover these files, but listing them would reduce missed compatibility paths.
