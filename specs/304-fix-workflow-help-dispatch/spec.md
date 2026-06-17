# Feature Specification: 304-fix-workflow-help-dispatch

**Feature Branch**: `feature/304-fix-workflow-help-dispatch`
**Created**: 2026-06-17
**Status**: Draft
**Input**: User request

## Goal
`senti workflow --help` を workflow plugin command 本体の help に到達させ、package-level workflow plugin help は `senti help workflow` として維持する。

## Background
`senti workflow --help` currently resolves to package-level plugin help because `src/senti.js` sends plugin command help requests to shared help before plugin command dispatch. `src/help.js` then treats the single topic `workflow` as a plugin package and renders `Plugin: workflow`. The workflow plugin command itself owns command-level usage and subcommands, so the top-level dispatcher must let plugin commands handle their own help while preserving `senti help workflow` as package-level discovery help.

## Scope
- Route plugin command help requests such as `senti workflow --help` to the plugin command dispatcher instead of package-topic shared help.
- Keep package-level workflow plugin help available through `senti help workflow`.
- Preserve core and independent command shared help behavior, including `senti plugin --help` and `senti plugin find --help`.
- Preserve non-help plugin command dispatch for `senti workflow`.
- Preserve failure behavior for unknown plugin command help requests.

## Out of Scope
- Changing the workflow plugin package's `commands/workflow.js` implementation.
- Updating stale `.senti/plugins/workflow` snapshots.
- Changing workflow board item behavior for add, update, show, search, list, publish, refine, or ideas.
- Changing plugin install, sync, update, or registry persistence behavior.
- Replacing `senti help workflow` package-level help with command-level help.

## Constraints
- `senti workflow --help` must not render package-level output headed by `Plugin: workflow` as its primary output.
- `senti help workflow` must continue to render package-level output headed by `Plugin: workflow` and include the workflow command row.
- Core namespace and independent command help must continue using shared metadata help when metadata exists.
- Unknown plugin command help requests must not become successful help output.
- No new external dependencies may be introduced.

## Design Principles
- Treat `senti <plugin-command> --help` as command usage help and `senti help <plugin-id>` as package discovery help.
- Use existing plugin command dispatch for plugin command help so command modules remain the owner of command-specific usage.
- Keep shared metadata help for core commands where metadata is the source of truth.

## Overview
### Modules
- `src/senti.js` owns top-level CLI dispatch, including early shared help routing and fallback to plugin command dispatch.
- `src/help.js` owns shared help rendering, including `renderPluginPackageHelp()` for `senti help <plugin-id>`.
- `src/lib/plugin-registry.js` owns plugin command resolution and execution.
- `tests/e2e/help.test.js` currently covers core and plugin core command help but not contributed plugin command help.

### Data Flow
- Current failing path: `senti workflow --help` enters the plugin fallback in `src/senti.js`, sees `--help`, calls shared help, and `src/help.js` resolves the single `workflow` topic as package-level help.
- Expected command help path: `senti workflow --help` reaches plugin command dispatch with `--help`; the workflow plugin command returns its command-level help and the CLI prints it.
- Expected package help path: `senti help workflow` continues through shared help and renders `Plugin: workflow` plus the workflow command row.
- Existing core help paths, such as `senti plugin --help` and `senti plugin find --help`, continue through shared metadata help.

### Decisions
- [VERIFY] checked `src/senti.js` plugin fallback help dispatch; result=match for root-cause hypothesis.
- [VERIFY] checked `src/help.js` package-topic behavior; result=match for preserved package help route.
- [VERIFY] checked current CLI behavior; result=bug reproduced.
- [VERIFY] checked existing help tests; result=missing contributed plugin command help coverage.
- Rationale: command invocation help and package discovery help need separate user-facing routes.

## Clarifications (Q&A)
- Q: Does this change the workflow plugin package implementation?
  - A: No. The plugin command already owns its command-level help. This spec changes only top-level dispatch behavior in `senti`.
- Q: Which route owns workflow plugin package help?
  - A: `senti help workflow` owns package-level workflow plugin help and should continue to show `Plugin: workflow`.
- Q: Which route owns workflow command usage help?
  - A: `senti workflow --help` owns command usage help and should show the workflow command's usage and subcommands.

## Alternatives Considered
- Keep using shared help for `senti workflow --help` and change `src/help.js` to prefer plugin command help over plugin package help for single-token topics. — Rejected because `senti help workflow` intentionally needs single-token package-topic help. Changing shared help topic priority would move the collision rather than separating the two surfaces.
- Change the workflow plugin package's `commands/workflow.js` help text. — Rejected because the reproduced bug occurs before plugin command dispatch and the plugin command already returns command-level help when invoked directly.
- Remove package-level workflow plugin help. — Rejected because plugin package discovery is a retained public surface and `senti help workflow` provides a clear route for it.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-17T09:15:08.011Z
- Notes:

## Requirements
- R1 [must]: `senti workflow --help` must dispatch to the workflow plugin command and print command-level help containing `Usage: senti workflow <subcommand> [args]`.
- R2 [must]: `senti workflow --help` output must contain the workflow subcommands `add`, `update`, `show`, `search`, `list`, `publish`, and `ideas`.
- R3 [must]: `senti workflow --help` must not render package-level output headed by `Plugin: workflow` as its primary output.
- R4 [must]: `senti help workflow` must continue to render package-level workflow plugin help headed by `Plugin: workflow` and include the workflow command row.
- R5 [must]: Core and independent command shared help paths must retain existing behavior for `senti help`, `senti plugin --help`, and `senti plugin find --help`.
- R6 [must]: `senti workflow` without a help flag must continue to reach plugin command dispatch and return the workflow command's normal no-subcommand result.
- R7 [must]: A nonexistent plugin command help request must not exit successfully with rendered help output.
- R8 [should]: Spec-local coverage should exercise both contributed plugin command help and package-level plugin help through the CLI entry point.

## Acceptance Criteria
- AC1: `node src/senti.js workflow --help` exits 0 and stdout contains `Usage: senti workflow <subcommand> [args]`.
- AC2: `node src/senti.js workflow --help` stdout contains `add`, `update`, `show`, `search`, `list`, `publish`, and `ideas`.
- AC3: `node src/senti.js workflow --help` stdout does not begin with `Plugin: workflow`.
- AC4: `node src/senti.js help workflow` exits 0 and stdout contains `Plugin: workflow` plus a workflow command row.
- AC5: Existing help tests for `node src/senti.js help`, `node src/senti.js plugin --help`, and `node src/senti.js plugin find --help` continue to pass.
- AC6: `node src/senti.js workflow` without `--help` exits 0 and reaches the workflow plugin command's no-subcommand help behavior.
- AC7: `node src/senti.js definitely-not-a-command --help` exits non-zero and does not render a successful command help body.
- AC8: Spec-local tests under `specs/304-fix-workflow-help-dispatch/tests/` include a `// spec: R1 R2 R3 R4 R5 R6 R7 R8` header.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Route plugin help
  - Adjust top-level plugin fallback help handling so contributed plugin commands receive their own `--help` requests while core command shared help still uses metadata.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Cover help parity
  - Add regression coverage for the separated command-help and package-help surfaces and retain existing core help behavior.
  - see `tasks/T-2.md` for full spec
