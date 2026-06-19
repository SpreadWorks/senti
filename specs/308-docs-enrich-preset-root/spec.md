# Feature Specification: 308-docs-enrich-preset-root

**Feature Branch**: `feature/308-docs-enrich-preset-root`
**Created**: 2026-06-19
**Status**: Draft
**Input**: GitHub Issue #402

## Goal
Fix docs enrich so preset chapter order resolution receives the current project root and can resolve plugin registry presets configured in .senti/config.json type during senti docs build.

## Background
Issue #402 reports that senti docs build --verbose emits [presets] resolveChain failed warnings for registry presets during docs enrich when project type includes plugin registry presets. The failing path is specific to docs enrich: it obtains root from context but omits it when resolving chapter order. Without projectRoot, resolveChainSafe can only resolve builtin presets and falls back for registry-only keys. Passing root aligns docs enrich with docs init/readme and lets the existing plugin registry preset mechanism work.

## Scope
- Update docs enrich chapter order resolution to pass the current project root into resolveChaptersOrder.
- Add regression coverage showing docs enrich uses project-root-aware preset resolution for plugin registry presets.
- Verify valid registry presets no longer produce Preset not found warnings from the docs enrich chapter-order path.

## Out of Scope
- Do not change plugin registry discovery, plugin installation, or manifest parsing.
- Do not change builtin preset definitions or plugin preset definitions.
- Do not hardcode local workspace paths, local project names, or specific registry preset names in production src/ code.
- Do not rewrite unrelated docs build, docs scan, docs text, docs init, or docs readme behavior.

## Constraints
- Use only existing Node.js built-in modules and project helpers; no external dependency addition.
- Keep src/ production code generic for npm distribution; project-specific preset names may appear only in tests or manual verification notes.
- Do not weaken existing tests to make this bugfix pass.
- Preserve resolveChainSafe fallback behavior for genuinely unknown presets when no registry entry exists.
- Migration parity inventory: retained public surfaces are senti docs build, docs enrich, docs init, docs readme, resolveChaptersOrder, resolveChainSafe warning/fallback behavior, docs.exclude filtering, static chapter mapping, AI enrich batching, and analysis.json enrichment output.
- Migration parity mapping: docs enrich preset chapter lookup moves from builtin-only resolver input to the existing project-root-aware resolveChaptersOrder path; all other retained docs enrich behavior remains owned by runEnrich and no public surface is intentionally removed.

## Design Principles
- Reuse the existing resolveChaptersOrder projectRoot parameter instead of adding a docs enrich-specific registry lookup.
- Keep the production diff minimal because docs init/readme already define the intended project-root-aware pattern.
- Make the regression fail on the missing root argument rather than only asserting a final default chapter list.

## Overview
### Modules
- src/docs/commands/enrich.js owns docs enrich orchestration, including loading analysis.json, resolving chapter names, building static chapter maps, and invoking the AI enrichment batches.
- src/docs/lib/template-merger.js exposes resolveChaptersOrder(presetKeys, configChapters, projectRoot), which delegates preset chain lookup to resolveChainSafe with the supplied project root.
- src/lib/presets.js loads plugin registry preset contributions only when a project root is provided to preset resolution.

### Data Flow
- docs enrich receives ctx.root from resolveDocsContext, reads ctx.type from config, and resolves preset chapter names before static chapter assignment and AI enrichment.
- After the fix, docs enrich passes ctx.root into resolveChaptersOrder so resolveChainSafe can see registry presets installed for the current project.

### Decisions
- [VERIFY] checked draft policy / src/docs/commands/enrich.js / result=match: runEnrich has root in ctx but calls resolveChaptersOrder(type, undefined).
- [VERIFY] checked draft policy / src/docs/commands/init.js and src/docs/commands/readme.js / result=match: both pass root into resolveChaptersOrder.
- [VERIFY] checked draft policy / src/docs/lib/template-merger.js / result=match: resolveChaptersOrder forwards projectRoot to resolveChainSafe.
- Use the existing root-aware resolver path rather than adding a new plugin-registry branch in docs enrich.
- Migration parity: retain docs enrich pipeline behavior and change only the chapter-order resolver input so registry presets can be seen.

## Clarifications (Q&A)
- Q: Should the fix alter plugin registry loading?
  - A: No. The registry loader already supports project-root-aware preset resolution; the bug is that docs enrich does not pass the root.
- Q: Should warnings for invalid preset names be hidden?
  - A: No. resolveChainSafe fallback warnings for genuinely unknown presets remain valid behavior.

## Alternatives Considered
- Change src/lib/presets.js to search plugin registries without a project root. — Rejected because the registry is project-scoped; resolving it without a project root would blur boundaries and affect unrelated callers.
- Special-case docs enrich to load plugin registry presets directly. — Rejected because resolveChaptersOrder already owns chapter-order preset resolution and init/readme already use its root-aware path.
- Suppress verbose Preset not found warnings in docs enrich. — Rejected because it would hide the symptom without resolving valid registry presets or preserving warnings for real configuration mistakes.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-19T00:38:49.901Z
- Notes: autoApprove accepted after spec gate PASS for Issue #402

## Requirements
- R1 [must]: docs enrich must call resolveChaptersOrder with the current project root when resolving preset chapter names from ctx.type.
- R2 [must]: A project whose .senti/config.json type references plugin registry presets must resolve those presets during docs enrich without Preset not found warnings for valid registry entries.
- R3 [must]: docs init, docs readme, plugin registry loading, and builtin fallback behavior for genuinely unknown presets must remain unchanged by this bugfix.

## Acceptance Criteria
- A diff of src/docs/commands/enrich.js shows resolveChaptersOrder receives root as its third argument for the preset chapter list.
- Spec-local test coverage fails against the previous missing-root behavior and passes after the fix.
- The regression fixture uses a temporary project/plugin registry setup or equivalent test seam; production src/ code contains no hardcoded local project path or registry preset key.
- Manual or automated verification on a project with registry presets confirms docs enrich no longer emits Preset not found warnings for those valid registry presets.
- Behavior-level migration parity verification for senti docs build confirms the docs enrich step resolves valid registry presets without Preset not found warnings while retaining static chapter mapping, docs.exclude filtering, AI enrich batching, and analysis.json output shape.
- Behavior-level migration parity verification for docs init and docs readme confirms their existing root-aware resolveChaptersOrder calls remain unchanged by the implementation diff.
- Behavior-level migration parity verification for resolveChaptersOrder confirms configChapters override behavior, project-root registry lookup, and unknown-preset fallback behavior remain owned by the existing resolver.
- Existing docs command tests continue to pass.

## Implementation Targets
- src/docs/commands/enrich.js
- tests/unit/docs/commands/enrich.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Pass root to enrich resolver
  - Update docs enrich so its preset chapter-order lookup passes the current project root to resolveChaptersOrder.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Cover registry preset resolution
  - Add regression coverage proving docs enrich resolves plugin registry presets through the project root.
  - see `tasks/T-2.md` for full spec
