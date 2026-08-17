# Tests for 184-preset-cross-import

## What was tested

Loader hook resolution for `sdd-forge/presets/<name>/<subpath>` specifiers,
covering all five spec requirements:

- REQ-1: 3-tier priority (project → user → builtin)
- REQ-2: fall-through to `nextResolve` when no tier has the file
- REQ-3: regression — `sdd-forge/api` and other non-preset specifiers unchanged
- REQ-4: in-memory cache — second resolution skips `fs.existsSync`
- REQ-5: project tier skipped when `projectRoot` is not provided

## Location

Formal test (long-lived, run by `npm test`):

- `tests/unit/lib/loader-cross-import.test.js`

Rationale: the loader hook is a public API boundary. Any regression is a bug
regardless of which spec introduced it, so the test belongs in `tests/` rather
than in `specs/<spec>/tests/`.

## How to run

```bash
# Only the new loader cross-import tests
node --test tests/unit/lib/loader-cross-import.test.js

# The loader test group (existing + new)
node --test tests/unit/lib/loader.test.js tests/unit/lib/loader-cross-import.test.js

# Full unit suite
node tests/run.js --scope unit
```

## Expected results

All 10 new tests pass. Full unit suite remains at `# pass <N> # fail 0`.
