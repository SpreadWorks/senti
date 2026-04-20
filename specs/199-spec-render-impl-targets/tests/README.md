# spec 199 — Tests

## What is tested

Spec 199 adds an `## Implementation Targets` section to the spec.md output produced by `sdd-forge spec render`. Tests verify the renderer's contract for the new section.

## Location

Formal tests are added to the existing renderer test file (public API contract for `renderSpecMarkdown`):

- `tests/unit/spec/render.test.js` — new cases:
  - renders Implementation Targets section with each entry as bullet
  - emits Implementation Targets section with placeholder when empty
  - emits Implementation Targets section with placeholder when undefined
  - places Implementation Targets after Acceptance Criteria and before Open Questions

The new tests share the existing `sampleSpec()` / `sampleMeta()` fixtures.

## How to run

```
node tests/run.js tests/unit/spec/render.test.js
```

Or run the full unit suite:

```
npm test
```

## Expected result

- All four new tests pass after implementation.
- All pre-existing tests in `render.test.js` continue to pass.
- Determinism is preserved (the existing byte-identical test still passes).
