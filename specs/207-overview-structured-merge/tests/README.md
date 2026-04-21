# Tests for spec 207 (overview-structured-merge)

## What is tested

- **overview schema shape (`tests/unit/spec/schema.test.js`)**: structured entries `{ text, added_by_task? }` are accepted; bare-string entries rejected; missing `text` rejected.
- **render of new overview shape (`tests/unit/spec/render.test.js`)**: bullets use `item.text`; `added_by_task` metadata is not leaked into markdown.
- **merge / filter helpers (`tests/unit/flow/overview-merge.test.js`)**: `applyOverviewAdditions` stamps taskId and appends; `filterOverviewByTask` removes matching entries and preserves others; both are pure (no mutation).
- **additions-only schema for AI output (`tests/unit/flow/update-overview-schema.test.js`)**: `next-action/update-overview.schema.json` accepts additions-only; rejects removals / modifications / unknown categories / non-string entries.

## Where

All formal tests (public contract): `tests/unit/spec/*.test.js`, `tests/unit/flow/overview-merge.test.js`, `tests/unit/flow/update-overview-schema.test.js`. Breakage of these tests indicates a regression regardless of which spec introduced it.

No spec-local `specs/207-.../tests/` production-code tests — this spec's behavior is a stable public contract.

## How to run

```
node tests/run.js --filter "overview"
node tests/run.js --filter "schema"
node tests/run.js --filter "render"
```

Or run the full suite:

```
node tests/run.js
```

## Expected results

All added tests pass after implementation is complete. Before implementation (TDD red phase) the schema / render tests referencing the new entry shape and the merge / filter helpers will fail.
