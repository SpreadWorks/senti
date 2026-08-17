# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Non-base presets still resolve from bundled artifacts as built-ins
**Target:** R3/R5 and src/lib/presets.js
**Issue:** Existing preset discovery defines PRESETS_DIR as officialPresetPluginRoot()/presets and merges that directory into PRESETS even when no plugin package is enabled. That means non-base official presets can remain available from src/official-plugins, contradicting the spec's requirement that base is the only core builtin and that tests must not pass solely because bundled artifacts exist.
**Required change:** Add a spec-level requirement and acceptance case that updates preset discovery so core built-ins come only from src/presets/base and non-base official presets are resolved only through an enabled official-presets plugin, with a test proving an unenabled non-base preset is unavailable while upgrade-installed sibling artifacts make it available.
**Why blocking:** Leaving the existing resolver behavior unchanged lets implementation and tests pass through bundled src/official-plugins even when the sibling senti-presets repository is empty or incomplete, so the repair cannot prove the three-repository migration.

### 2. Official upgrade path is not tied to the committed sibling source
**Target:** R3/R4/R5 and src/lib/plugin-registry.js ensureOfficialPackage
**Issue:** Existing ensureOfficialPackage copies files directly from sourceRoot and records officialPackageCommit(), which falls back to a zero SHA when sourceRoot is not a Git repository and does not enforce the clean local-repo and git-archive materialization semantics used by normal plugin install. The spec requires commit-pinned sibling repository artifacts but does not explicitly require the official upgrade path to validate and install from the committed sibling HEAD rather than a working tree or bundled fallback.
**Required change:** Specify that official preset/workflow upgrade or install from sibling roots must validate a clean Git worktree with resolvable HEAD, materialize/copy from that pinned commit, and reject dirty or missing-HEAD official sources before writing plugin.packages.
**Why blocking:** Without this correction, upgrade can record a commit that does not correspond to the copied runtime files, or can silently use bundled compatibility material, defeating reproducible completion proof and making dirty/incomplete sibling repositories unsafe to test.

### 3. Workflow plugin artifact lacks an execution acceptance basis
**Target:** R2/R5 and src/official-plugins/senti-workflow-plugin/commands/workflow.js
**Issue:** The existing bundled workflow command imports ../../../lib/cli.js, a relative path that only works from src/official-plugins. Once the command is copied into a real sibling repository package and installed under .senti/plugins/workflow/commands/workflow.js, that import path resolves outside the package to a non-existent .senti/lib/cli.js path. The current spec requires the command file to exist and activation behavior to be preserved, but does not require executing the installed sibling-sourced workflow command.
**Required change:** Add an acceptance/test requirement that a temp project installs or upgrades from /home/nakano/workspace/senti-workflow-plugin and successfully runs an installed workflow command entry point, such as senti workflow --help, from .senti/plugins/workflow.
**Why blocking:** A manifest/path-complete workflow plugin can still be undeployable: upgrade records the package, but the migrated senti workflow command crashes at runtime, so existing workflow behavior is not actually preserved.


## Non-blocking Improvements

No non-blocking improvements.