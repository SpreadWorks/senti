# Spec #108 Tests

## What was tested and why

### lang-factory.test.js
Tests the Factory pattern implementation:
- Returns JS handler for .js/.ts files (with all methods)
- Returns PHP handler for .php files (with all methods)
- Returns handler with minify only for .py files
- Returns null for unsupported extensions

### lang-js.test.js
Tests the JS language handler's extraction methods:
- extractImports: ESM imports and require() calls
- extractExports: named exports, async functions, classes, re-exports, default exports

### scan-structure.test.js
Tests end-to-end structural info extraction via scan:
- Scan extracts imports and exports for JS files into analysis.json
- Scan populates usedBy from reverse import lookup

## Where tests are located

`specs/108-mechanical-extraction-of-structural-info-and-fac/tests/`

## How to run

```bash
node --test specs/108-mechanical-extraction-of-structural-info-and-fac/tests/lang-factory.test.js
node --test specs/108-mechanical-extraction-of-structural-info-and-fac/tests/lang-js.test.js
node --test specs/108-mechanical-extraction-of-structural-info-and-fac/tests/scan-structure.test.js
```

## Expected results

- All tests should **fail** before implementation (lang-factory.js does not exist yet)
