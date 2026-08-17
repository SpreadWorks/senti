# Spec #105 Tests

## What was tested and why

### flow-get-context.test.js
Tests the new `flow get context` command:
- List mode returns filtered fields (no hash/mtime/lines/id/enrich)
- Unenriched entries are marked with needsSource
- File mode increments docsRead for docs/ paths
- File mode increments srcRead for src/ paths
- --raw returns content without JSON envelope

### analysis-format.test.js
Tests analysis.json formatting:
- scan outputs multi-line indented JSON (not single-line)

## Where tests are located

`specs/105-ai-context-optimization-with-flow-get-context-co/tests/`

## How to run

```bash
node --test specs/105-ai-context-optimization-with-flow-get-context-co/tests/flow-get-context.test.js
node --test specs/105-ai-context-optimization-with-flow-get-context-co/tests/analysis-format.test.js
```

## Expected results

- `flow-get-context.test.js`: All tests should **fail** before implementation (command does not exist yet)
- `analysis-format.test.js`: Should **fail** before implementation (analysis.json is still single-line)
