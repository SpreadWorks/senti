# Feature Specification: 480-freshness-scan-policy

**Feature Branch**: `feature/480-freshness-scan-policy`
**Created**: 2026-07-28
**Status**: Draft
**Input**: GitHub Issue #480

## Goal
Make `senti check freshness` evaluate only the source surface relevant to documentation builds, so generated and runtime artifacts cannot exhaust traversal budgets or change freshness verdicts.

## Background
Freshness walks the repository root with the default bounded policy. Generated flow evidence and runtime output can therefore consume the shared file limit before relevant source and documentation are evaluated, producing indeterminate despite complete relevant inputs.

## Scope
- A generic freshness source-surface exclusion policy for bounded file traversal.
- Structured diagnostics for source and documentation freshness scans.
- Regression coverage for generated artifacts, relevant traversal limits, and timestamp verdicts.

## Out of Scope
- Increasing traversal limits to mask repository growth.
- Changing documentation build output or generated artifact storage.
- Changing the public fresh, stale, never-built, or indeterminate result names.

## Constraints
- Use Node.js built-in modules only.
- Keep the existing ScanPolicy bounds of maxDepth 32, maxDirectoryEntries 10,000, and maxFiles 10,000; return indeterminate when a non-excluded source path or any documentation path reaches a bound or is unreadable.
- Do not encode Issue-specific identifiers or artifact filenames in product code.
- Use a dedicated class for any new meaningful scan-policy or scan-detail value.

## Design Principles
- Exclude generic generated, dependency, metadata, and runtime directory boundaries before they consume traversal budgets.
- Preserve limit evidence for every included path.

## Overview
### Modules
- src/lib/file-tree-walker.js supplies bounded traversal policies and directory-entry filtering.
- src/check/commands/freshness.js selects the source policy, compares mtimes, and serializes diagnostics.
- tests/unit/check/scan-freshness.test.js covers bounded scan and freshness behavior.
- FreshnessSourcePolicy owns the named source traversal boundary and maps generated/runtime directories to pre-recursion exclusion.
- FreshnessScan owns serializable source and documentation traversal diagnostics.
- The bounded freshness unit suite verifies excluded source boundaries and structured scan diagnostics.

### Data Flow
- Source root -> freshness source policy -> bounded source scan -> mtime comparison with bounded docs scan -> FreshnessResult JSON or text.
- Source root -> FreshnessSourcePolicy.shouldEnterDirectory -> FileTreeWalker traversal without excluded-directory file-budget consumption.
- Source and docs traversals -> FreshnessScan details -> FreshnessResult JSON and preserved text verdict.
- Synthetic generated directories -> freshness source policy -> unchanged relevant-file freshness verdict.

### Decisions
- [VERIFY] FileTreeWalker already invokes shouldEnterDirectory before recursive descent, so excluded directories can avoid file-budget consumption without weakening limit reporting.
- [VERIFY] check scan already uses generic directory-boundary filtering with FileTreeWalker; freshness should reuse that class of policy instead of matching evidence filenames.
- Freshness diagnostics will preserve the scan target, policy identity, and limit paths for source and documentation surfaces.
- Migration parity: FreshnessResult retains fresh, stale, never-built, and indeterminate; toText retains each result label and its current fresh/stale/never-built guidance; toJSON retains ok, result, srcNewest, docsNewest, and limits. The new scan-detail owner is FreshnessResult, and unit tests verify every retained public value through the policy path.
- T-1 keeps exclusion classification in the traversal domain so freshness consumers do not duplicate directory-boundary logic.
- T-2 reports policy identity and structured limits separately from the existing human-readable limit text.
- T-3 uses small traversal budgets in repository-neutral temporary trees to prove exclusions without weakening production bounds.

## Clarifications (Q&A)
- Q: Which paths are excluded?
  - A: Only generic boundaries representing generated metadata, runtime output, dependencies, or version-control internals; never a particular Issue or artifact filename.
- Q: Can included scan failures be ignored?
  - A: No. Any included source or documentation traversal failure remains indeterminate.

## Alternatives Considered
- Raise maxFiles for freshness. — Rejected because repository growth would recreate the failure and unrelated generated files would still influence the budget.
- Filter generated files after traversal. — Rejected because filtering after traversal cannot recover budget already consumed by generated files.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-28T10:48:00.282Z
- Notes: Auto-approved from accepted preflight summary and passed spec gate.

## Requirements
- R1 [must]: Define the named freshness source policy `freshness-source`. It skips a directory before recursion when its basename is .git, .senti, node_modules, or vendor; it also skips a path matching specs/*/review-history, specs/*/review-evidence, or specs/*/tests/.raw. Every other source-root directory remains traversed and counted.
- R2 [must]: Use that policy only for sourceRoot traversal. Traverse docs/ without source exclusions; return indeterminate if either scan reaches maxDepth 32, maxDirectoryEntries 10,000, maxFiles 10,000, or an unreadable non-excluded path.
- R3 [must]: Add sourceScan and docsScan JSON details, each containing target, policy name, complete, and limits with kind, relativePath, and maximum. Keep result names and retain toText labels: fresh, stale with docs-build guidance, never-built with docs-build guidance, and indeterminate with limits.
- R4 [must]: Add unit tests in which .senti, node_modules, vendor, .git, and generated specs evidence contain more than maxFiles files but source and docs still return fresh or stale; separately prove that a limit in non-excluded source or docs returns indeterminate.

## Acceptance Criteria
- A tree with excluded generated files beyond maxFiles and complete relevant files returns fresh or stale according to relevant source and docs mtimes.
- Changing only an excluded generated or runtime artifact does not change a freshness verdict.
- A limit or unreadable path on an included source or documentation surface returns indeterminate with the affected target and limit path in structured details.
- Existing never-built, fresh, stale, JSON, and text result contracts remain available.
- No production source contains an Issue-specific spec identifier or generated evidence filename.

## Implementation Targets
- src/lib/file-tree-walker.js
- src/check/commands/freshness.js
- tests/unit/check/scan-freshness.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Define freshness scan policy
  - Add a reusable generic directory-boundary policy for freshness source traversal so excluded directories do not consume bounded traversal budgets.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Report freshness scan details
  - Use the freshness source policy for source mtimes and retain structured diagnostics for source and documentation scans while preserving verdict behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Cover generated scan boundaries
  - Add regression tests for generated artifacts exceeding the scan budget and limits in included source or documentation paths.
  - see `tasks/T-3.md` for full spec
