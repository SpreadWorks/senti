# Tests — 165-add-api-entry-module-loader

## What Was Tested and Why

This spec adds a public API entry point (`sdd-forge/api`) and a module loader hook so that external preset files can import `DataSource`, `Scannable`, and `AnalysisEntry` from sdd-forge.

Two levels of tests were written:

### Formal tests (`tests/unit/`) — run by `npm test`

These verify contracts that must hold regardless of which spec introduced them:

| File | What it verifies |
|---|---|
| `tests/unit/api.test.js` | `src/api.js` exports exactly the 3 classes; `package.json` exports map has `./api` and `.`; `engines.node` is `>=18.19.0` |
| `tests/unit/lib/loader.test.js` | Loader hook `resolve()` correctly maps `sdd-forge/<subpath>` to `src/<subpath>.js`; non-sdd-forge specifiers pass through |

### Spec verification tests (`specs/165-add-api-entry-module-loader/tests/`) — NOT run by `npm test`

| File | What it verifies |
|---|---|
| `external-import.test.js` | An external file outside the package can import and instantiate classes via `sdd-forge/api` after the loader hook is registered |

## How to Run

```bash
# Formal unit tests (run as part of npm test)
npm test

# Spec verification test only
node --test specs/165-add-api-entry-module-loader/tests/external-import.test.js
```

## Expected Results

- All formal tests pass after implementation
- `external-import.test.js` prints "OK" and exits 0
- Tests fail before implementation (no `src/api.js` or `src/loader.js` yet)
