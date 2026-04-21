# Feature Specification: 203-migrate-prompts-to-src-flow

**Feature Branch**: `feature/203-migrate-prompts-to-src-flow`
**Created**: 2026-04-21
**Status**: Draft
**Input**: GitHub Issue #188 — `[ENHANCE] [cac6/T6] Migrate step prompt templates to src/flow/`

## Goal

Resolve the divergence between two distribution channels for per-step procedural guidance:
- **Skill channel**: SKILL.md files read by Claude Code at session start.
- **CLI channel**: `flow get next-action` queried at each step transition.

Today the per-step procedural text exists only inside `src/templates/skills/sdd-forge.flow-{plan,impl,finalize}/SKILL.md`. T5 (#187, merged) added the `flow get next-action` CLI but its `instructions` field returns only a step key — the CLI cannot return the same procedural text the skill channel exposes.

This spec creates a single source of truth at `src/flow/prompts/<phase>/<step>.md`. Both channels read from these files: the skill channel via the existing `<!-- include("/...") -->` directive at deploy time, the CLI channel via a new loader that resolves the step key to file content at runtime. After this spec, the two channels cannot drift because they share the underlying files.

## Scope

- Create per-step content files at `src/flow/prompts/<phase>/<step>.md` for every `instructions_key` registered in `src/flow/schemas/context-rules.json` (23 entries: 14 flow-scope + 9 task-scope).
- Add `src/flow/lib/get-step-instructions.js` exporting `getStepInstructions(instructionsKey)` returning the file content string.
- Modify `src/flow/lib/get-next-action.js` so its `instructions` field returns `{ key, content }` instead of `{ key }`. The loader is invoked synchronously from `execute()`.
- Replace per-step procedural sections in the three skill templates (`src/templates/skills/sdd-forge.flow-{plan,impl,finalize}/SKILL.md`) with `<!-- include("/flow/prompts/<phase>/<step>.md") -->` directives that point at the new files. Cross-cutting partials (`src/templates/partials/*.md`) and existing partial includes are not touched.
- Add three test files under `tests/`:
  - `tests/unit/flow/get-step-instructions.test.js` — loader behaviour.
  - `tests/unit/flow/instructions-coverage.test.js` — registry-to-file coverage.
  - `tests/unit/flow/get-next-action.test.js` — extended to assert the new `content` field.

## Out of Scope

- i18n of skill templates, partials, step prompts, or the include mechanism.
- Changes to `src/flow/lib/get-prompt.js` (short-choice prompts).
- Changes to `src/lib/include.js`.
- Restructuring of `src/templates/partials/*.md`.
- Other cac6 tasks (T1–T5, T7–T11).
- Modifying `src/flow/schemas/context-rules.json`.

## Clarifications (Q&A)

See `draft.md` (Q1–Q9) for the full record. Key decisions:
- Q: Per-step file granularity? — A: One file per registered step key.
- Q: i18n placement? — A: Monolingual (English) for now; defer ecosystem-wide i18n.
- Q: Single source of truth? — A: Per-step files are the source; skill templates include them via the existing pkgDir-rooted absolute path syntax (`/flow/prompts/...`).
- Q: T5 boundary? — A: T6 enriches T5's CLI output to return `content` alongside `key`.

## Alternatives Considered

- **Lean skill (key-only references, no embedded content).** Rejected: forces the skill channel to depend on the CLI channel for every step, breaking the "read SKILL.md to understand the phase" UX and increasing CLI dependency for skill function.
- **Skill templates as the truth source, per-step files derived by a build script.** Rejected: introduces a fragile parser parallel to the existing include mechanism, with drift risk between manual edits and re-extraction runs.
- **Bilingual step prompts upfront.** Rejected: the surrounding ecosystem (SKILL.md, partials) is monolingual; partial i18n creates inconsistent half-state. Defer to a coordinated future spec.

## Why This Approach

Per-step files as the truth source plus skill-template include is the only structure that:
1. Reuses the existing include mechanism (no new derivation logic, no parser).
2. Lets both channels consume the same byte sequence (structural drift impossible).
3. Preserves session-start UX (deployed SKILL.md still contains full procedural content after include expansion).
4. Lets the next-action CLI return real content rather than only a key.
5. Keeps the change additive at the CLI shape layer (existing key field preserved).

## User Confirmation

- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-21
- Notes: auto mode enabled at draft Q9; gate spec PASS preceded approval.

## Requirements

Listed in priority order (P1 highest):

- **P1 — Single source of truth coverage.** When `src/flow/schemas/context-rules.json` registers an `instructions_key` of the form `<phase>.<step>`, the system shall provide a content file at `src/flow/prompts/<phase>/<step>.md`. Verifiable: `tests/unit/flow/instructions-coverage.test.js` enumerates all 22 keys, asserts each maps to an existing file, and asserts no orphan files exist under `src/flow/prompts/`.
- **P2 — Loader contract.** When `getStepInstructions(instructionsKey)` is called with a registered key, it shall return the file content as a UTF-8 string. If the key is unregistered or the file is missing, it shall throw an `Error` whose message contains the offending key. Verifiable: `tests/unit/flow/get-step-instructions.test.js` covers happy path and both error paths.
- **P3 — CLI returns content.** When `sdd-forge flow get next-action` returns its envelope, the `instructions` field shall be an object `{ key, content }` where `key` is the existing `instructions_key` and `content` is the resolved string from the loader. Verifiable: `tests/unit/flow/get-next-action.test.js` is extended to assert both fields are present and `content` is non-empty for at least one step in each scope (`flow`, `task`).
- **P4 — Skill channel reuses the same files.** When the skill templates are deployed via `sdd-forge upgrade`, the per-step procedural sections of the deployed `.claude/skills/<name>/SKILL.md` shall come from the same files referenced by the loader. Verifiable: each of the three skill templates' Required Sequence per-step blocks contains an `<!-- include("/flow/prompts/<phase>/<step>.md") -->` directive instead of inline procedural text; spec author confirms this during implementation review.
- **P5 — No content loss during migration.** When the new content files are populated from existing skill text, the deployed skill output (after `sdd-forge upgrade` include expansion) shall, for each migrated procedural section, contain a body whose non-whitespace characters are byte-equal to the corresponding pre-change section's non-whitespace characters. Verifiable: a one-shot diff is captured during implementation between a snapshot of the deployed skill output before the change and after the change; results recorded in the spec retro under `specs/203-migrate-prompts-to-src-flow/`.

## Test Strategy

- **`tests/unit/flow/get-step-instructions.test.js`** (new): tests for `getStepInstructions(key)`.
  - Happy path: returns non-empty string for at least one known `instructions_key`.
  - Unknown key: throws `Error` containing the key name.
  - Registered key with missing file: throws `Error` containing the file path. (Use a temporary directory + env var override to simulate.)
- **`tests/unit/flow/instructions-coverage.test.js`** (new): registry-to-file coverage check.
  - Reads `src/flow/schemas/context-rules.json`, iterates all `flow.*.instructions_key` and `task.*.instructions_key` values.
  - Asserts each key maps to an existing file at `src/flow/prompts/<phase>/<step>.md`.
  - Asserts every `*.md` under `src/flow/prompts/` is referenced by at least one registry key (no orphans).
- **`tests/unit/flow/get-next-action.test.js`** (existing, extended): new assertions for `instructions.key` AND `instructions.content` shape, with `content` length > 0, for at least one step in each of `flow` and `task` scopes. **User approved this modification** in draft Q9 (option [1] explicitly included extending this existing test). Existing assertions are preserved; only additive assertions are added.

All three test files live under `tests/unit/flow/` because they verify long-lived contracts (loader behaviour, schema-to-file integrity, CLI output shape) — not spec-local behaviour. Per project rule "tests where breakage indicates a bug regardless of which spec introduced them", these belong in `tests/`.

No tests are placed under `specs/203-migrate-prompts-to-src-flow/tests/`.

## Acceptance Criteria

- AC1 — `npm test` passes after the change.
- AC2 — `tests/unit/flow/instructions-coverage.test.js` passes (all 22 keys covered, zero orphans).
- AC3 — `sdd-forge flow get next-action` returns `instructions: { key, content }` with non-empty `content` when run in this worktree's prepared flow state.
- AC4 — `sdd-forge upgrade` succeeds and the deployed `.claude/skills/sdd-forge.flow-plan/SKILL.md` (and the other two) contains all the per-step procedural sections present today (verified by the diff captured for P5).
- AC5 — `npm pack --dry-run` shows the new `src/flow/prompts/` directory and its files included in the published package.

## Migration Plan

The CLI output shape changes additively: the existing `key` field is preserved and `content` is added. No fields are renamed or removed.

Existing in-tree consumers of the `instructions` field: only `tests/unit/flow/get-next-action.test.js`. That test is updated as part of this spec.

External consumers: the CLI is in alpha with no documented stable contract for the `instructions` field shape. Per project alpha policy, the additive change requires no deprecation period and no compatibility shim.

## Exit Code Contract

When `getStepInstructions(key)` throws (unknown key or missing file), the error propagates through `GetNextActionCommand.execute()` and surfaces in the CLI envelope as a non-zero exit. The CLI shall not return exit code 0 in this case. The error message contains the offending key (and the resolved file path for the missing-file case) so the operator can diagnose the gap.

Existing exit-code behaviour for other `flow get next-action` failure modes (`NO_ACTIVE_FLOW`, `NO_IN_PROGRESS_STEP`, `NO_RULE_FOR_STEP`) is unchanged.

## Bounded Resource Usage

- Loader file reads are bounded by the registry (22 entries today; one read per call). No recursion, no retries.
- Coverage test enumerates 22 keys; bounded.
- Include expansion at deploy time uses the existing `resolveIncludes` machinery, which already enforces circular-include detection and explicit error on missing paths.

## Open Questions

None.
