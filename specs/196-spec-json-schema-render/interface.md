# spec.md I/O Sites — T8 Migration Reference

Survey of every source file that currently reads or writes `spec.md`, captured for cac6/T8 (the task that replaces these sites with `spec.json`-based access).

Methodology: `grep -rn "spec.md" src/ --include="*.js"` + manual inspection of each match. Excludes test files (`tests/`) and documentation (`.md`).

## Summary

| # | File | I/O | Fields / Sections Touched | T8 Migration Approach |
|---|------|-----|---------------------------|------------------------|
| 1 | `src/docs/commands/changelog.js` | Read + link-emit | Existence check for spec.md, meta fetch, and emits relative links `../specs/<dir>/spec.md` in generated changelog tables | Replace existence/meta reads with `spec.json` loads. Keep generated-doc links pointing at spec.md (still the human-readable artifact; spec render keeps it in sync). |
| 2 | `src/docs/commands/forge.js` | Read | Full spec text fed to AI agent as `specText` context for generation prompts | Load spec.json and either render to spec.md on the fly via `renderSpecMarkdown`, or switch the prompt to consume structured fields directly. Prefer the latter to avoid round-tripping. |
| 3 | `src/lib/flow-helpers.js` | Path manipulation only | No content parsing; converts relative `specs/NNN-xxx/spec.md` into `NNN-xxx` dir names | When flow.json switches to storing `spec.json` path, update the helpers to accept either extension (or canonicalize to directory name up front). |
| 4 | `src/flow/lib/run-finalize.js` | Read | Reads `flowState.spec` (spec.md relative path) during finalize metadata extraction | Point at `spec.json` once flow.json's `spec` field is migrated. No content-level changes required beyond path extension. |
| 5 | `src/flow/lib/run-retro.js` | Read | Extracts `## Requirements` section text from spec.md for retro report | Read `spec.json.requirements` array directly; render structured list without regex parsing. |
| 6 | `src/flow/lib/run-prepare-spec.js` | Write (create) | Creates spec.md from skeleton template with `{{BRANCH_NAME}}`, `{{SPEC_DIR}}`, `{{DATE}}` substitutions; flow.json `spec` field set to `specs/<dir>/spec.md` | Change skeleton creation to emit `spec.json` (empty structured object satisfying schema minimal requirements) and render spec.md as derivative. Update flow.json `spec` to `spec.json` path. |
| 7 | `src/flow/lib/run-gate.js` | Read | spec.md structure check (headings, Q&A, approval checkbox) and guardrail AI compliance | Validate `spec.json` against schema + guardrail; legacy structural regex on spec.md becomes unnecessary. |
| 8 | `src/flow/commands/review.js` | Read + Write | Extracts Goal/Scope/Requirements sections by regex, writes `tests/spec.md` test design, and can rewrite the entire spec.md via AI review | Split into: (a) read structured fields from spec.json; (b) test design output keeps writing `tests/spec.md` (separate concern); (c) AI rewrite produces updated spec.json, then render spec.md. |
| 9 | `src/flow/commands/merge.js` | Read | Parses Goal/Scope/Requirements sections from spec.md for merge commit/PR metadata | Switch to reading structured fields from spec.json directly. |
| 10 | `src/flow/registry.js` | CLI help text | Help string for `--spec` option references "spec.md" | Update help text to "spec.json" once CLI flag semantics flip. |
| 11 | `src/metrics/commands/token.js` | Read | Reads spec.md path for metrics aggregation context | Point at spec.json path after flow.json migration. |

## Notes for T8

- `flow.json`'s `spec` field currently holds `specs/<dir>/spec.md` (see flow-helpers.js, run-prepare-spec.js, run-finalize.js). Migration must update both the field value and every consumer simultaneously, or introduce a normalization helper that accepts either extension during the transition.
- `tests/spec.md` (written by review.js) is a **test design** doc — unrelated to the feature spec; do NOT migrate it in T8.
- The cac6 migration script (`src/scripts/migrate-flow-to-tasks.js`, planned for a later cac6 task) should convert existing `specs/*/spec.md` to `spec.json` by parsing the known skeleton sections; any content not matching a known section becomes an `open_questions` entry or manual-review TODO.
- Parsing existing spec.md files in T8 requires a best-effort Markdown → structured converter. Lossless conversion is not guaranteed; the migration script should log warnings for unrecognized sections.

## Fields required by consumers (for schema adequacy check)

| Consumer | Fields it needs from spec |
|----------|--------------------------|
| docs/changelog.js | title, feature branch, status, created |
| docs/forge.js | full text (all fields) |
| flow/run-retro.js | requirements |
| flow/run-gate.js | all content fields + user_confirmation state |
| flow/review.js | goal, scope, requirements |
| flow/merge.js | goal, scope, requirements |
| metrics/token.js | no content (path-only) |

All required fields are covered by the 11-field schema. Meta fields (title/branch/status/created) are sourced from flow.json, not spec.json (see `spec render` design).
