# Tests for spec 214-datasource-renderable-class

## What is tested and why

This spec introduces the `Renderable` type system (base class + 8 concrete classes: `Table`, `BulletList`, `OrderedList`, `Paragraph`, `CodeBlock`, `Blockquote`, `Heading`, `Fragment`) and migrates all DataSource resolver methods from `string | null` returns to `Renderable | null` returns.

Tests verify:
- REQ-01/02/09: Renderable class contract — exports, `toMarkdown()` output, invariant enforcement, nested list indentation.
- REQ-03: `DataSource.toMarkdownTable(rows, labels)` delegates to `new Table(labels, rows).toMarkdown()`.
- REQ-04/06: `resolveDataDirectives` calls `.toMarkdown()` on Renderable instances; plain strings from resolvers are treated as unresolved after migration completes.
- REQ-08: Renderable classes are registered in `container` under `base.*` names for external preset use.

REQ-05 (no string-returning DataSource method remains) and REQ-07 (byte-identical docs output) are verified via grep/inspection and the existing acceptance-level regression tests respectively, not via new unit tests.

## Where the tests live

All tests are placed in the formal `tests/` tree because they exercise stable public contracts (class interfaces, directive-parser semantics, container registration) that should remain valid regardless of which spec introduced them:

- `tests/unit/docs/lib/renderable.test.js` — new file, full Renderable coverage.
- `tests/unit/docs/lib/directive-parser.test.js` — appended Renderable-handling tests.
- `tests/unit/docs/lib/data-source.test.js` — appended `toMarkdownTable` delegation test.
- `tests/unit/lib/container-init.test.js` — appended container registration test.

No tests are placed in `specs/214-datasource-renderable-class/tests/` — nothing in this spec has a short-lived scope; the Renderable contract is expected to be long-lived.

## How to run

```bash
npm test -- --filter renderable
npm test -- --filter directive-parser
npm test -- --filter data-source
npm test -- --filter container-init
```

Or run the whole unit suite:

```bash
npm test
```

## Expected results

Initially all new tests fail (Renderable module does not exist yet). After the implementation is complete:

- All `renderable.test.js` cases pass.
- New `directive-parser.test.js` cases pass (existing cases continue to pass until the string-support removal step; at that point the "non-Renderable non-null → unresolved" case becomes active and replaces any prior string-permissive behavior).
- `data-source.test.js` delegation test passes (existing `toMarkdownTable` cases continue to pass since output is unchanged).
- `container-init.test.js` Renderable registration test passes.
- Acceptance fixtures produce byte-identical docs output (REQ-07).
