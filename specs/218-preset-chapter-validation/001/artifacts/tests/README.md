# 218-preset-chapter-validation — Tests

## What is tested

1. **Validator unit tests** (`tests/unit/presets/validate-preset-chain.test.js`):
   - Happy path with built-in preset (`base`).
   - Missing chapter throws `Error` with chapter name, language, and searched paths in message.
   - Project-local `.sdd-forge/templates/<lang>/<chapter>.md` satisfies the requirement.
   - `configChapters` override is respected (overrides preset.json chapters).
   - Multiple types (array input) validated per chain.
   - Reverse direction (template without chapter) does not throw (warning only).
   - Empty `languages` array: no-op.

2. **Ecosystem integrity test** (`tests/unit/presets/preset-scan-integrity.test.js`):
   - Added 4th describe block: for every built-in preset with chapters, `validatePresetChain` PASSes when `languages` is set to all language directories present in the chain.

## Location

- Formal tests (run by `npm test`): `tests/unit/presets/validate-preset-chain.test.js`.
- Ecosystem integrity check: new describe block in the existing `tests/unit/presets/preset-scan-integrity.test.js`.

## How to run

```bash
npm test -- --test=tests/unit/presets/validate-preset-chain.test.js
npm test -- --test=tests/unit/presets/preset-scan-integrity.test.js
```

Or the full suite:

```bash
npm test
```

## Expected results

- All new unit tests PASS after implementation.
- All existing tests remain green.
- Existing built-in presets have fully resolvable chapters → ecosystem integrity test PASSes.
