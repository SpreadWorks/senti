# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Duplicate selector rule conflicts with file-spec union
**Target:** R1 / T-1
**Issue:** Verified existing tests treat repeated `--file`, repeated `--pattern`, and file-spec unions as valid selector behavior, while R1 broadly requires rejecting duplicate/conflicting selector specifications. The spec does not distinguish single-valued suite selectors from intentionally multi-valued file selectors.
**Required change:** Constrain duplicate rejection to single-selection flags such as `--preset`, `--scope`, `--agent`, and `--all`, or explicitly state which existing repeated `--file`/`--pattern`/positional union behavior is intentionally removed.
**Why blocking:** Implementation and tests cannot know whether repeated file selectors must be rejected to satisfy R1 or preserved to avoid breaking verified existing behavior.

### 2. `--list --json` lacks an output contract
**Target:** R2 / Acceptance Criteria
**Issue:** R2 requires parseable machine-readable suite output, but the spec does not define the JSON shape, required fields, or how selectors affect the listed suites/files/categories. Parseable-only acceptance would allow arbitrary JSON such as `{}`.
**Required change:** Add the minimal JSON output contract for `tests/run.js --list --json`, including required top-level fields and selector semantics.
**Why blocking:** Tests cannot prove suite discovery correctness, and implementers can satisfy parseability without producing a usable machine-readable listing.

### 3. `test:ci` targets are not concretely identifiable
**Target:** R3 / T-3
**Issue:** The codebase has no existing CLI smoke script/directory, and the existing `tests/helpers/stub-agent.js` emits flow guardrail JSON while acceptance code expects docs text/enrich and quality-verification responses. The spec names unit, integration, stub acceptance, and CLI smoke, but not the exact commands/files or stub-agent injection path.
**Required change:** Specify the exact `test:ci` command sequence or named test files for unit, integration/e2e, stub acceptance, and CLI smoke, including how the stub agent is configured for acceptance execution.
**Why blocking:** Credential-free CI can be implemented with arbitrary or incomplete coverage, and a naive stub acceptance target can still fail against the existing acceptance pipeline response contracts.

### 4. Zero-target acceptance failure has no runner owner
**Target:** R4 / T-2
**Issue:** The spec assigns fixture/test discovery to `tests/acceptance/lib/targets.js`, but zero-target non-zero exit is process behavior. Existing `npm run test:acceptance` executes `tests/acceptance/run.js`, which owns argument validation and execution, yet that runner is not named as an integration target.
**Required change:** Add `tests/acceptance/run.js` as the integration point that consumes discovered targets and exits non-zero for empty all-target or requested-target resolution, while keeping `targets.js` side-effect-free.
**Why blocking:** Without a runner owner, implementers either put process exits in a library used by tests or update discovery while leaving package-script execution and zero-match behavior untested.

### 5. `test:agent` preservation omits its current consumer
**Target:** R5 / T-3
**Issue:** R5 requires proving retained real-provider `test:agent` behavior, but existing `test:agent` runs `tests/agent/report.test.js`, which currently imports acceptance helpers through a wrong relative path and calls `getAcceptanceFixtureDir("node")` even though only the `base` acceptance fixture exists. Fixture-derived discovery may also drop `node` unless compatibility is specified.
**Required change:** Specify the compatibility change for `tests/agent/report.test.js`: update it to a discovered fixture target and correct acceptance-lib imports, or revise R5 so it does not require executing that surface.
**Why blocking:** `npm run test:agent` cannot be proven from the current spec because it fails before any real-provider credential boundary, and target discovery changes can strand its acceptance fixture lookup.


## Non-blocking Improvements

### 1. Mention preset alias helper
**Target:** Codebase Context / R1
**Improvement:** Add `tests/helpers/preset-aliases.js` to related files because strict preset validation and acceptance target naming both depend on alias resolution.
**Why non-blocking:** The existing target list already names the main runner/helper files, so implementers can still discover this dependency while working.

### 2. Call out localized docs
**Target:** R6
**Improvement:** Mention that both `docs/stack_and_ops.md` and `docs/ja/stack_and_ops.md` may need synchronization for the revised test command contract.
**Why non-blocking:** R6 already requires related generated documentation synchronization broadly.
