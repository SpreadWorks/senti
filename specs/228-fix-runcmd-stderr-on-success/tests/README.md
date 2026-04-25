# Tests: 228-fix-runcmd-stderr-on-success

## What was tested
- `runCmd` が成功時（exit 0）に stderr を正しく返却すること

## Test location
- `tests/unit/lib/process.test.js` — formal test (run by `npm test`)
- Test case: "captures stderr on success"

## How to run
```bash
node --test tests/unit/lib/process.test.js
```

## Expected results
- `runCmd("node", ["-e", "console.error('ERR')"])` returns `ok: true`, `status: 0`, `stderr` matching `/ERR/`
