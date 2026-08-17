# Tests for spec 165: project-local-presets

## What is tested

### Unit tests (`tests/unit/lib/project-local-presets.test.js`)

Verifies the preset resolution function correctly prioritizes `.sdd-forge/presets/` over built-in presets:

- `.sdd-forge/presets/<name>/preset.json` is used when present (overrides built-in)
- Built-in settings (parent, scan, chapters) are inherited when `preset.json` is omitted
- Bare preset is returned when `preset.json` is omitted and no built-in match exists
- Built-in chain resolution is unchanged when no project presets exist (regression guard)

These tests belong in `tests/` because breaking them always indicates a regression.

### Integration tests (`specs/165-project-local-presets/tests/project-local-presets.test.js`)

Verifies the full DataSource loading pipeline with project-local presets:

- `createResolver()` loads DataSources from `.sdd-forge/presets/<name>/data/`
- `.sdd-forge/data/` DataSources are NOT loaded (deprecated path)
- A deprecation warning is emitted to stderr when `.sdd-forge/data/` exists

## How to run

```bash
# Unit tests
node --test tests/unit/lib/project-local-presets.test.js

# Integration tests
node --test specs/165-project-local-presets/tests/project-local-presets.test.js

# All tests
npm test
```

## Expected results

All tests should FAIL before implementation and PASS after implementation.
