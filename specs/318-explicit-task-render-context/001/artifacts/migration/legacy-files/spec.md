# Feature Specification: 318-explicit-task-render-context

**Feature Branch**: `feature/318-explicit-task-render-context`
**Created**: 2026-07-18
**Status**: Draft
**Input**: GitHub Issue #414

## Goal
Validate spec-render task identity, collection structure, output paths, and target metadata through invariant-enforcing value objects so invalid input is rejected before any Markdown or flow-state write.

## Background
The spec schema currently accepts any 1-100 character task ID or parent string. CLI render and internal view use those raw values as task Markdown filenames after already writing spec.md, and approval sync copies them into flow task IDs and task-spec paths. CLI render also reads ambient active-flow metadata after selecting an explicit spec directory. Consequently invalid task structures can cause partial writes or path escape attempts, and metadata for flow A can appear in spec B. The correction is a shared validated render contract and a pre-side-effect plan in every consumer.

## Scope
- Apply one schema/runtime TaskId grammar to spec tasks and parent references.
- Validate task ID uniqueness and parent existence across the complete task collection, including forward parent references.
- Resolve every task Markdown output as a direct child of the target spec tasks directory before the first write.
- Bind render metadata to a flow.json colocated with and identifying the selected spec, and use the existing selected-spec defaults when matching metadata is absent.
- Require validated task, output-path, and render-context objects in CLI render, internal view render, and approval task sync paths.
- Prove rejection-path immutability and retained CLI, view, Markdown, and approval-sync behavior with spec-local automated tests.

## Out of Scope
- Task lifecycle, promotion, completion, or task-gate semantic changes.
- Audit findings other than F-007 and F-023.
- A general filesystem sandbox or symlink policy outside task Markdown path construction.
- Deletion of orphan task Markdown files or changes to additive render behavior.
- External dependencies, npm publish, npm dist-tag, or an official release.

## Constraints
- Use only Node.js built-in modules and existing repository abstractions.
- Represent TaskId, TaskCollection, TaskOutputPath, and SpecRenderContext as dedicated classes whose constructors enforce their invariants.
- Keep the TaskId runtime grammar byte-for-byte equivalent to the JSON Schema pattern string "^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$"; the final dollar sign is the end-of-string anchor.
- Complete collection, output-path, and context validation before fs.writeFile, fs.promises.writeFile, fs.mkdir, fs.mkdirSync, or FlowStore mutation.
- Do not add a compatibility fallback that accepts an identity rejected by the new schema/runtime contract.
- `src/` shall contain no project- or environment-specific information: no fixed Issue, run, spec, repository, worktree, user, or absolute-path values; target values come from validated arguments or selected-spec files.
- When source changes, complete the flow-prescribed documentation sync; do not publish or release.

## Design Principles
- Validate semantic identity once and pass typed values through every consumer instead of repeating string checks.
- Plan all rejection-sensitive work before the first side effect rather than adding rollback behavior.
- Bind metadata authority to the selected spec directory, never to ambient active-flow state.
- Preserve existing successful output and lifecycle behavior while intentionally rejecting previously accepted invalid task structures.

## Overview
### Modules
- `src/spec/lib/render-contract.js` owns TaskId, TaskCollection, TaskOutputPath, and SpecRenderContext invariants and exposes the validated values needed by render and sync consumers.
- `src/flow/schemas/spec.schema.json` expresses the same TaskId pattern for task IDs and non-null parent references.
- `src/spec/commands/render.js` and `src/flow/lib/render-spec-view.js` build a complete validated render plan before creating directories or writing spec/task Markdown.
- `src/flow/lib/sync-spec-tasks.js` validates the complete spec task collection before entering the append-only FlowStore mutation.
- `specs/318-explicit-task-render-context/tests/` proves invalid-input immutability and retained behavior through production entry points.

### Data Flow
- CLI render resolves the selected spec.json, performs schema validation, constructs TaskCollection and every TaskOutputPath, constructs SpecRenderContext from the selected directory, renders content in memory, and only then writes the requested spec.md and additive task views.
- Internal view rendering resolves the selected spec.json, constructs the same collection, paths, and colocated context, and writes the unchanged spec/task view content only after the complete plan is valid.
- Approval sync loads the active selected spec, constructs TaskCollection before mutation, filters already-present IDs, converts validated IDs and parents to flow tasks, appends them, and retains existing round assignment and promotion behavior.

### Decisions
- [VERIFY] Task identity is currently length-only in the schema and raw in all three consumers; result=match: the draft's shared schema/runtime boundary is required.
- [VERIFY] Explicit CLI render currently reads ambient active-flow metadata; result=match: selected-spec metadata resolution must remove that ambient lookup.
- TaskId permits 1-100 ASCII alphanumeric, underscore, and hyphen characters and requires an alphanumeric first character; this preserves existing T-1, T-child-2, C2, and Leaf fixtures while rejecting separators, dot segments, drive prefixes, and UNC-style input.
- TaskCollection validates uniqueness after constructing every TaskId, then validates parents against the complete ID set so a child may precede its parent in serialization order.
- TaskOutputPath uses resolved absolute paths and requires each task file dirname to equal the resolved target tasks directory; every path is constructed before any render write.
- SpecRenderContext accepts colocated flow.json metadata only when its canonical state.spec equals the selected repo-relative spec.json; absent or mismatched metadata uses the selected-spec defaults `feature/<selected-directory>` and `User request`.
- Migration parity keeps `--spec`/`--out`, schema diagnostics, stdout paths, deterministic Markdown, optional missing-view results, changed path reporting, additive orphan files, append-only task sync, round assignment, parent/status transcription, and pending promotion under their existing owners.

## Clarifications (Q&A)
- Q: Does parent validation require a parent to appear before its child?
  - A: No. TaskCollection first validates and collects every ID, then checks parents against the complete set, so forward references remain valid.
- Q: Which metadata is authoritative when an explicitly selected spec has no matching colocated flow.json?
  - A: The selected-spec defaults are `feature/<selected spec directory basename>` and `User request`. They are derived only from the selected spec directory when colocated flow metadata is absent or mismatched; ambient active-flow metadata is never used.
- Q: Does TaskOutputPath introduce a repository-wide symlink sandbox?
  - A: No. It owns lexical resolved-path confinement for generated task Markdown. General filesystem and symlink policy remains outside Issue #414.

## Alternatives Considered
- Keep validation local to each render and sync consumer. — Rejected because schema/runtime and three consumer boundaries would drift, duplicate the same invariants, and continue passing raw strings between modules.
- Validate each task immediately before its own write and roll back earlier writes on failure. — Rejected because complete prevalidation prevents partial output with less state and no rollback path.
- Use the active FlowManager state as metadata whenever colocated metadata is absent. — Rejected because it reproduces F-023 by allowing flow A metadata to be rendered into selected spec B.
- Restrict the new classes to render.js to avoid adding a shared module. — Rejected because sync and internal view are independent consumers; a dedicated deep module gives one invariant owner without coupling task sync to CLI orchestration.
- Reject rendering when matching colocated flow.json is absent or mismatched. — Rejected because explicit `--spec` currently requires only a selected directory and spec.json; rejection would remove the established standalone render path.
- Omit Feature Branch and Input when matching metadata is absent. — Rejected because the existing Markdown renderer always emits both fields and already defines selected-spec defaults; omission would change valid output bytes outside Issue #414.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-18T19:09:32.333Z
- Notes: Preserved spec SHA b0bb1faa is unchanged; the draft clarification is already represented; canonical spec-review attempt 1 passed with zero proposals and spec-gate attempt 1 passed 15/15 guardrails with zero observations.

## Requirements
- R1 [must]: The spec schema and TaskId constructor shall both accept exactly strings matching the JSON Schema pattern string "^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$", where the final dollar sign is the end-of-string anchor, for tasks[].id and non-null tasks[].parent; both shall reject empty, over-100-character, slash, backslash, dot-segment, drive-prefix, UNC-style, whitespace, and non-ASCII inputs before any consumer side effect.
- R2 [must]: TaskCollection construction shall reject more than the schema-declared 200 task entries before allocating per-task state, then use two linear passes and O(n) auxiliary TaskId and lookup entries to validate every ID and non-null parent, reject duplicates, reject parents absent from the complete ID set, and accept a valid parent serialized later; public iteration and lookup shall expose validated task identities.
- R3 [must]: For a TaskCollection of n entries, where 0 <= n <= 200, CLI and internal view shall construct exactly n TaskOutputPath values and at most n task Markdown bodies and write-plan entries before the first directory creation or file write; each path shall resolve the target tasks directory and candidate `<TaskId>.md` to absolute paths and require the candidate dirname to equal the resolved tasks directory. Plan construction shall use O(n) auxiliary entries and no recursive or pairwise collection scan.
- R4 [must]: SpecRenderContext shall derive title and creation date from the selected spec.json and use featureBranch/Issue metadata only from a flow.json in the same directory whose state.spec exactly identifies that selected repo-relative spec.json; absent or mismatched colocated metadata shall produce `feature/<selected-directory>` and `User request` without reading ambient active-flow state.
- R5 [must]: runSpecRender and renderSpecView shall use TaskCollection, every TaskOutputPath, and SpecRenderContext before rendering side effects; any R1-R4 rejection shall leave the selected spec.md, tasks directory, existing task files, orphan task files, requested --out path, and files outside the selected spec directory byte-for-byte unchanged.
- R6 [must]: syncSpecTasksToFlow shall construct TaskCollection before FlowStore mutation and shall build appended task IDs, parent values, and `tasks/<id>.md` paths only from validated values; any invalid ID, duplicate, or unknown parent shall leave flow.json byte-for-byte unchanged.
- R7 [must]: For valid input, the change shall retain CLI --spec/--out resolution, schema error reporting, rendered stdout paths, deterministic spec/task Markdown bytes, additive orphan-file behavior, internal optional-missing result and changed list, and approval sync append-only filtering, assigned_round calculation, field transcription, task-step construction, and pending-task promotion.
- R8 [must]: Spec-local node:test coverage with `// spec: R<N>` headers shall exercise R1-R7 through production classes and entry points, including pre-fix failure reproductions and before/after filesystem and flow-state snapshots, without directly rewriting flow state or generated artifacts to manufacture pass conditions.

## Acceptance Criteria
- AC1: Schema and TaskId table tests accept the lower/upper length boundaries and existing valid ID forms, and reject every invalid class named in R1 with matching schema/runtime outcomes.
- AC2: TaskCollection tests accept valid 0-, 1-, and 200-entry collections including child-before-parent input; reject 201 entries, duplicate IDs, and unknown parents before consumer side effects; and expose only TaskId-backed IDs and parents.
- AC3: For valid task counts 0, 1, and 200, each render plan contains exactly one TaskOutputPath and no more than one task Markdown body/write entry per task; every candidate is an exact direct child of the resolved tasks directory, and crafted non-confined candidates are rejected before any mkdir or write spy is called.
- AC4: Rendering explicit spec B while flow A is active uses matching colocated B metadata when present; when B flow.json is absent or its state.spec does not exactly identify B, output uses the selected-spec defaults `feature/<B-directory>` and `User request`, contains no branch or Issue value from A, and does not mutate either flow file.
- AC5: For invalid ID, over-limit collection, duplicate ID, unknown parent, and non-confined task output, snapshots show no new or changed spec.md, --out, tasks directory, task Markdown, orphan file, outside file, or flow.json.
- AC6: Valid CLI and internal-view fixtures produce byte-identical spec/task Markdown to the existing pure renderers, retain relative stdout and changed paths, create tasks directories when needed, and do not delete or modify orphan files.
- AC7: Valid approval sync fixtures retain append-only filtering, first and later round assignment, parent/status/origin transcription, task step initialization, and pending promotion; invalid collections preserve the original flow.json bytes.
- AC8: Spec-local tests cover R1-R8, affected shared render/schema/sync tests pass, and final-regression proves the full project suite without skipped or weakened assertions.

## Implementation Targets
- src/spec/lib/render-contract.js
- src/flow/schemas/spec.schema.json
- src/spec/commands/render.js
- src/flow/lib/render-spec-view.js
- src/flow/lib/sync-spec-tasks.js
- specs/318-explicit-task-render-context/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Define validated render contracts
  - Create the four invariant-enforcing value objects and align the spec schema with their shared TaskId grammar.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Prevalidate Markdown render plans
  - Move CLI and internal-view rendering behind one complete validated collection, output-path, and selected-spec context plan before any filesystem side effect.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Prevalidate approval task sync
  - Require a validated complete TaskCollection before approval sync enters its append-only flow-state mutation.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Prove rejection immutability and parity
  - Complete spec-local behavior-level evidence for every invalid boundary and each retained CLI, view, Markdown, and sync surface.
  - see `tasks/T-4.md` for full spec
