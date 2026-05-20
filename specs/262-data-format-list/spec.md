# Feature Specification: 262-data-format-list

**Feature Branch**: `feature/262-data-format-list`
**Created**: 2026-05-20
**Status**: Draft
**Input**: GitHub Issue #336

## Goal
Add a parser-owned `format` option to `{{data(...)}}` directives so exactly two-column `Table` renderables can be rendered as either the existing Markdown table or a Markdown bullet list.

## Background
`{{data(...)}}` currently renders the Renderable returned by a DataSource through its default Markdown method. `format` is not a parser-owned option, so a directive author cannot request list output without pushing a `params.format` concern into individual DataSources. Issue #336 narrows the feature to a reusable first step: preserve the current table default, add list rendering for exactly two-column `Table`, and keep unsupported cases explicit.

## Scope
- [must] Parse `format: "table" | "list"` from data directives as a parser-owned option.
- [must] Keep omitted `format` and `format: "table"` output identical to current Markdown table rendering.
- [must] Render `format: "list"` only for exactly two-column `Table` values as `- first-column: second-column` lines.
- [must] Exclude `format` from the params object passed to DataSource methods.
- [must] Fail with an explicit error for unsupported format values, `format: "list"` on non-Table renderables, and `format: "list"` on tables whose column count is not two.
- [must] Add spec-local tests and shared unit tests for parser filtering, default table rendering, list rendering, and unsupported format errors.

## Out of Scope
- Generic format conversion for every Renderable type.
- `grouped-list` rendering for repeated first-column values.
- Changing existing directives that do not specify `format`.
- Changing preset templates as first consumers.
- Adding external dependencies.

## Constraints
- Use only Node.js built-in modules and existing project helpers.
- Keep `src/` generic; do not encode project-specific preset, issue, or generated-doc assumptions.
- Represent new behavior on classes rather than object-literal type tags; Table-specific list rendering belongs on the Renderable/Table side.
- `format` is reserved as a parser-owned data directive option and must not be forwarded to DataSource params.
- Unsupported format usage must throw or propagate an explicit error; do not silently convert it to unresolved data.
- bounded-resource-usage acknowledged exception: `format: "list"` preserves the existing `Table.toMarkdown()` output-size contract and does not introduce a separate row cap. DataSource analysis and `Table` construction remain the upstream boundaries for row volume; adding a list-only cap would make `format: "list"` drop or reject rows that `format: "table"` renders, violating the requirement that format selection only changes Markdown representation.
- This spec does not add or modify CLI commands or CLI arguments. CLI exit-code and user-input validation guardrails are not changed by this work.
- This spec does not change `src/templates/` or `src/presets/` template files; `sdd-forge upgrade` is not required unless implementation expands scope into those paths.

## Design Principles
- Preserve existing table output unless a directive opts into `format: "list"`.
- Keep rendering decisions in the Renderable hierarchy and keep directive expansion responsible for selecting the requested rendering mode.
- Treat invalid directive format usage as authoring error at the directive expansion boundary.
- Add capability first; apply it to a concrete preset template only after a specific table is selected.

## Overview
### Modules
- `src/docs/lib/directive-parser.js` parses data directive options, filters parser-owned controls, resolves Renderables, and replaces directive blocks.
- `src/docs/lib/renderable.js` owns Markdown rendering for Renderable subclasses, including `Table`.
- `src/docs/lib/resolver-factory.js` passes filtered params to DataSource methods; `format` must not reach that boundary.
- `src/docs/commands/data.js`, `readme.js`, and `agents.js` share `resolveDataDirectives`, so one directive-expansion implementation covers generated docs, README, and AGENTS output paths.

### Data Flow
- Template directive options are parsed by `parseDirectives`; `format` remains available to directive expansion while `extractUserParams` removes it before DataSource invocation.
- The resolver returns a Renderable. Directive expansion renders it with default table behavior or requested list behavior, then applies existing header/footer wrapping and block replacement.
- `format: "list"` validates the resolved value before rendering: the value must be a `Table`, and the table must have exactly two labels and two values per row.

### Decisions
- [VERIFY] Parser-owned controls already exist and are filtered before DataSource invocation.
- [VERIFY] `Table` is the right type boundary for list rendering.
- [VERIFY] DataSource params are downstream of parser-owned filtering.
- [VERIFY] All data expansion command paths share `resolveDataDirectives`.
- Use `- first-column: second-column` for `format: "list"`.
- Do not update preset templates in this spec.

## Clarifications (Q&A)
- Q: Does `format` belong to DataSource params?
  - A: No. It is parser-owned because it controls directive rendering after a DataSource has returned a Renderable.
- Q: What is the list syntax?
  - A: Each two-column row renders as `- first-column: second-column`, preserving row order.
- Q: Should unsupported list targets respect `ignoreError`?
  - A: No. Unsupported format usage is a directive authoring error and must fail explicitly instead of becoming an unresolved data source.
- Q: Does this spec change CLI command behavior?
  - A: No. It changes template directive expansion only; no CLI command or CLI option is added, removed, or redefined.

## Alternatives Considered
- Convert any Renderable to alternate formats. — Rejected because Issue #336 narrows the first step to exactly two-column `Table`; generic conversion would broaden scope and require contracts for Paragraph, Blockquote, CodeBlock, and other types.
- Pass `params.format` to each DataSource and let DataSources choose output. — Rejected because output format is a directive rendering concern and would duplicate rendering decisions across DataSource implementations.
- Use Markdown definition-list syntax. — Rejected because the project has `BulletList` but no DefinitionList Renderable, and the bullet syntax can be verified with exact string assertions.
- Update a Laravel or Symfony template in this spec. — Rejected because Issue #336 lists several candidate tables without selecting one, and controller/action tables may need a separate `grouped-list` format.
- Treat unsupported format usage as unresolved data. — Rejected because it would hide directive authoring mistakes behind the existing unresolved data path.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-20T04:57:40.744Z
- Notes: User approved gate-passed spec for Issue #336.

## Requirements
- R1 [must]: `parseDirectives` shall accept `format: "table"` and `format: "list"` on data directives and retain the value for directive expansion.
- R2 [must]: `format` shall be treated as parser-owned and shall not appear in the params object passed to DataSource resolver methods.
- R3 [must]: A data directive with omitted `format` or `format: "table"` shall render exactly the same Markdown table output as the current `Table.toMarkdown()` path.
- R4 [must]: A data directive with `format: "list"` and a resolved two-column `Table` shall render one Markdown bullet per row in the exact form `- first-column: second-column`.
- R5 [must]: `format: "list"` shall fail with an explicit error when the resolved value is not a `Table` or when the `Table` has any column count other than two.
- R6 [must]: Any `format` value other than `table` or `list` shall fail with an explicit error that names the unsupported value.
- R7 [must]: The same format behavior shall apply to all existing `resolveDataDirectives` callers, including docs data population, README generation, and AGENTS generation.
- R8 [must]: Automated tests shall cover parser-owned format filtering, unchanged default table rendering, explicit table format rendering, two-column list rendering, non-Table list error, non-two-column list error, and unsupported format value error.

## Acceptance Criteria
- A resolver spy used by `resolveDataDirectives` receives params without `format` when the directive includes `{format: "list", labels: "A|B"}`.
- A directive resolving to `new Table(["Name", "Role"], [["auth", "login"], ["docs", "build"]])` renders `- auth: login\n- docs: build` when `format: "list"` is specified.
- The same two-row table renders the existing pipe table when `format` is omitted and when `format: "table"` is specified.
- `format: "list"` with a three-column `Table` throws an error whose message includes `format` and `2-column Table`.
- `format: "list"` with a `Paragraph` throws an error whose message includes `format` and `Table`.
- `format: "grid"` throws an error whose message includes `grid`.
- Existing tests for `resolveDataDirectives` Renderable rendering continue to pass.
- Spec-local tests under `specs/262-data-format-list/tests/` include `// spec: R<N>` headers covering R1 through R8.

## Implementation Targets
- src/docs/lib/directive-parser.js
- src/docs/lib/renderable.js
- tests/unit/docs/lib/directive-parser.test.js
- tests/unit/docs/lib/renderable.test.js
- specs/262-data-format-list/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add Table list rendering
  - Add the Table-side behavior needed to render exactly two-column table rows as Markdown bullet list lines.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Handle directive format
  - Wire the data directive `format` option through parser-owned filtering and Renderable rendering selection.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add spec coverage
  - Add spec-local tests that connect the new directive format behavior to requirements R1 through R8.
  - see `tasks/T-3.md` for full spec
