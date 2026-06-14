# Code Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Interactive setup resolves candidates from cwd instead of the target work root
**Failure mode:** missing_acceptance_requirement
**File:** src/setup.js
**Requirement:** R1
**Issue:** main() passes defaultPath to loadExistingDefaults(), runWizard(), and buildSummaryLines(), even when --path or --work-root points setup at a different target project root. As a result, installed plugin presets and configured defaults in the actual target work root are not used for the preset tree or summary.
**Suggestion:** In main(), compute the target setup root from workRootPath when provided, otherwise sourcePath, and pass that target root to loadExistingDefaults(), runWizard({ projectRoot }), and buildSummaryLines(). Keep final post-registration validation on the registered workRoot.
**Rationale:** R1/R5/R6 require setup candidates, defaults, and summary resolution to use available plugin preset contributions for the target project root. Using process.cwd() creates candidate/validation drift for existing projects configured via --work-root or --path.

### 2. Candidate discovery still omits required resource bounds
**Failure mode:** missing_acceptance_requirement
**File:** src/lib/presets.js
**Requirement:** R9
**Issue:** listSetupPresetCandidates() relies on loadPluginRegistry() and PluginManifest.fromRoot() but only the enabled package count and preset chain depth are enforced on this path. The R9-required source count, manifest JSON size, and official metadata read/file bounds are still not checked during candidate discovery.
**Suggestion:** Update listSetupPresetCandidates() and the manifest-loading path it uses to enforce MAX_PLUGIN_SOURCES, MAX_PLUGIN_JSON_BYTES, and bounded official preset metadata reads before returning candidates. Apply the same bounded reader to installed plugin manifests and officialPresetRoot metadata.
**Rationale:** A9 explicitly requires candidate discovery to reject or stop at package count, source count, manifest JSON/path/file limits, and preset parent chain depth. The current implementation can still read unbounded official/plugin metadata and ignore excessive source lists.

### 3. Non-interactive setup exits with failure after completing setup
**Failure mode:** missing_acceptance_requirement
**File:** src/setup.js
**Requirement:** R6
**Issue:** main() unconditionally calls process.stdin.unref() at the end. In spawned non-interactive setup runs, process.stdin.unref is not always a function, so the command exits with status 1 after writing config and agent files.
**Suggestion:** In main(), replace the final process.stdin.unref() call with a guarded branch that only calls it when typeof process.stdin.unref === "function", or remove the call if it is not required for setup completion.
**Rationale:** R6/A7 require non-interactive --type setup to complete successfully through the same validation path. A post-success TypeError makes the CLI report failure even when the generated official preset state is otherwise valid.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
