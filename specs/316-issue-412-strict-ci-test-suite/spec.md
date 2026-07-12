# Feature Specification: 316-issue-412-strict-ci-test-suite

**Feature Branch**: `feature/316-issue-412-strict-ci-test-suite`
**Created**: 2026-07-11
**Status**: Draft
**Input**: GitHub Issue #412

## Goal
Make test suite selection strict and provide a credential-free, reproducible `npm run test:ci` for Issue #412.

## Background
Issue #412 addresses ambiguous suite selection and unstable CI caused by silent flags, a missing CI-safe script, hard-coded acceptance names, and mixing deterministic tests with tests requiring real provider credentials. The existing runner already separates selector validation and search directory construction, so strictness can be added at that boundary while retaining valid commands.

## Scope
- Strict selector validation and separate `--help` / `--list --json` contracts.
- A deterministic `test:ci` composed of unit, integration, stub acceptance, and CLI smoke coverage.
- Fixture-derived acceptance targets that fail when no target matches.
- Regression coverage and documentation synchronization for the changed test contract.

## Out of Scope
- Findings other than F-013 suite foundation and F-022.
- Real-provider credential configuration, publishing, dist-tags, or release execution.

## Constraints
- Use only Node.js built-in modules; do not add dependencies.
- Keep project-specific Issue values out of `src/`.
- Preserve valid existing test scripts and explicit `test:agent` real-provider execution.
- Bound discovery: shared test traversal depth is at most 32, resolved files at most 10000, each repository-relative path at most 4096 characters, and serialized list JSON at most 16 MiB; acceptance discovery examines at most 1000 immediate preset directories and only fixed test.js/fixtures path existence without traversing fixture contents.
- Synchronize related docs after source changes.

## Design Principles
- Reject invalid suite specifications at the CLI boundary rather than silently ignoring them.
- Keep human-readable usage and machine-readable suite discovery as independent output contracts.
- Derive deterministic test targets from repository fixtures instead of a duplicated name list.

## Overview
### Modules
- `tests/run.js` owns test selector parsing, usage/listing contracts, discovery, and execution.
- `tests/helpers/test-runner-search-dirs.js` owns reusable selector validation and search-directory selection.
- `tests/acceptance/lib/targets.js` owns acceptance fixture/test target discovery.
- `tests/acceptance/run.js` owns requested/all-target validation, zero-target process failure, and acceptance test execution.
- `tests/ci.js`, `tests/ci/stub-acceptance.test.js`, and `tests/ci/cli-smoke.test.js` own the four deterministic CI stages.
- `tests/helpers/stub-agent.js` owns a schema-aware docs/quality stub; `tests/agent/report.test.js` remains a real-provider consumer using the discovered base fixture.
- `package.json` exposes deterministic CI composition without changing real-provider `test:agent`.

### Data Flow
- CLI arguments are parsed once into a strict TestSelection: suite selectors are single-valued and mutually exclusive, while repeated --file/--pattern/positional inputs remain one multi-valued file union; invalid inputs exit non-zero before discovery.
- Execution and --list --json use the same selected-file resolver bounded to depth 32 and 10000 files; listing emits at most 16 MiB of stable relative paths and category counts without spawning node --test.
- Fixture discovery checks fixed test.js/fixtures paths under at most 1000 immediate preset directories without reading fixture contents; tests/acceptance/run.js turns limit, empty all/requested, or unknown-target resolution into a non-zero process result.
- `test:ci` invokes exact sequential unit, e2e/integration, schema-aware stub acceptance, and CLI smoke stages; real-provider tests remain behind `test:agent`.

### Decisions
- [VERIFY] Existing selector validation is helper-owned and `tests/run.js` currently ignores unknown flags.
- [VERIFY] Existing public test surfaces are retained with explicit ownership mapping.
- [VERIFY] Existing docs describe a custom Node runner and unit/e2e/acceptance surfaces.
- Preserve the existing multi-valued file-spec union while making --preset, --scope, --agent, and --all single-valued mutually exclusive suite selectors.
- Define --list --json as a versioned view of the exact resolver used for execution.
- Implement test:ci through tests/ci.js with four fixed foreground child commands and a schema-aware acceptance stub.
- Keep target discovery side-effect-free and assign empty-target exit behavior to tests/acceptance/run.js.
- Repair tests/agent/report.test.js to import ../acceptance/lib helpers and use the discovered base fixture.

## Clarifications (Q&A)
- Q: Which behavior is intentionally removed?
  - A: Only silent acceptance of invalid suite specifications is removed. Invalid calls now receive a documented non-zero usage error; valid selectors and existing scripts remain supported.
- Q: How is migration parity verified?
  - A: Behavior-level regressions execute every retained package-script/selector surface, fixture acceptance and CLI smoke through their new deterministic owner, while test:agent remains an explicit real-provider command.

## Alternatives Considered
- Keep the hard-coded acceptance target list. — Rejected because it can diverge from actual fixtures and cannot prove zero-match failure.
- Run real-provider tests in test:ci. — Rejected because CI must be credential-free and reproducible.
- Treat --help and --list --json as one output mode. — Rejected because human usage and JSON consumers require independent stable contracts.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-11T14:47:42.428Z
- Notes: User approved Wave 1 specifications for Issues #410, #411, and #412 together by selecting option 1 on 2026-07-11.

## Requirements
- R1 [must]: `tests/run.js` shall parse a TestSelection that rejects unknown flags, missing values, unknown/missing presets, repeated --preset/--scope/--agent/--all, and combinations of those mutually exclusive suite selectors with each other or file-spec mode. Repeated --file, repeated --pattern, and positional paths shall remain a valid multi-valued union and deduplicate only after resolution.
- R2 [must]: `tests/run.js --help` shall return usage without discovery or execution. `--list` and `--json` shall require each other and may combine with one valid selection; stdout shall be only JSON with version=1, selection { mode, preset, scope }, suites[] in unit/integration/acceptance/other order containing { category, files, count }, and totalFiles. The shared execution/list resolver shall reject traversal beyond depth 32, more than 10000 resolved files, or a repository-relative path longer than 4096 characters; listing shall fail before stdout if serialized JSON exceeds 16 MiB. Files shall be sorted repository-relative POSIX paths, and counts/totalFiles shall match those arrays without spawning tests.
- R3 [must]: `npm run test:ci` shall execute `node tests/ci.js`, which runs these stages sequentially and stops non-zero on the first failure: `node tests/run.js --scope unit`, `node tests/run.js --scope e2e`, `node --test tests/ci/stub-acceptance.test.js`, and `node --test tests/ci/cli-smoke.test.js`. The stub acceptance shall copy the base fixture, inject a schema-aware provider from tests/helpers/stub-agent.js for docs enrich/text and passing quality responses, run the pipeline, and require no provider credentials; tests/agent shall not be selected.
- R4 [must]: `tests/acceptance/lib/targets.js` shall inspect at most 1000 immediate directories under src/presets and derive targets only by checking each fixed tests/acceptance/test.js and tests/acceptance/fixtures path pair, with no recursive fixture traversal or file-content reads; exceeding the directory/path bound shall return a structured discovery error. The library shall remain side-effect-free. `tests/acceptance/run.js` shall consume discovery and exit non-zero on a discovery limit/error, empty all-target result, unknown requested target, or empty requested resolution; otherwise it shall execute only the resolved test files.
- R5 [must]: Automated regressions shall prove every new failure mode and retained valid selector/package-script surface. `tests/agent/report.test.js` shall import helpers from ../acceptance/lib, select the discovered base fixture rather than node, and remain under explicit real-provider `npm run test:agent`; fixture/import resolution shall be testable without credentials while real agent execution remains excluded from test:ci.
- R6 [should]: Related generated documentation must reflect the revised test command contract after source changes.

## Acceptance Criteria
- Spec-local tests under `specs/316-issue-412-strict-ci-test-suite/tests/` contain `// spec: R<N>` headers for R1-R5.
- Regression tests prove unknown/conflicting/missing and duplicate suite-selector cases exit non-zero, while repeated --file/--pattern/positional unions resolve, deduplicate, and execute as before.
- Dedicated tests prove `--help` is usage-only and `--list --json` emits the exact versioned selection/suites/totalFiles contract, uses the execution resolver, writes no non-JSON stdout, does not spawn tests, and fails on depth, 10000-file, 4096-character path, or 16 MiB output bounds.
- Dedicated library and command tests prove fixed-depth fixture-pair discovery, the 1000-preset bound, no fixture-content traversal, base target resolution, discovery-error propagation, unknown requested target failure, and empty all/requested target non-zero behavior in tests/acceptance/run.js.
- `npm run test:ci` executes the four named stages in order, passes with provider credentials absent, stops on a failing stage, and never selects tests/agent.
- The schema-aware stub acceptance test completes scan/enrich/init/data/text/readme plus passing quality verification against the base fixture, and the CLI smoke test covers senti help, docs help, test-runner help, and selected JSON listing.
- tests/agent/report.test.js resolves its acceptance imports and base fixture before any provider call; existing relevant unit/e2e/acceptance happy paths pass, and docs synchronization completes.

## Implementation Targets
- package.json
- tests/run.js
- tests/helpers/test-runner-search-dirs.js
- tests/acceptance/lib/targets.js
- tests/acceptance/run.js
- tests/helpers/stub-agent.js
- tests/ci.js
- tests/ci/stub-acceptance.test.js
- tests/ci/cli-smoke.test.js
- tests/agent/report.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Strictify test selection
  - Make the runner parse one valid selection and reject invalid selector input before discovery.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Derive acceptance targets
  - Replace fixed acceptance target enumeration with bounded repository fixture/test discovery and fail empty resolution in the runner.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Compose deterministic CI tests
  - Expose the exact four-stage credential-free test:ci suite and preserve explicit test:agent.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Document test contracts
  - Synchronize generated documentation with the new test command surface.
  - see `tasks/T-4.md` for full spec
