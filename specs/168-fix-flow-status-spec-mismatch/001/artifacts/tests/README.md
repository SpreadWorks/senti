# Test Plan (spec 168)

## What was tested and why

- Unknown options on `sdd-forge flow get` should fail explicitly.
- This spec focuses on preventing agent misuse such as appending unsupported `--spec` to `flow get status`.
- Tests ensure failures are surfaced with guidance (`--help`) instead of silent acceptance.

## Test locations

- Formal regression tests (run by `npm run test:unit`):
  - `tests/unit/flow/get-unknown-options.test.js`

## How to run

```bash
npm run test:unit -- --test-name-pattern "flow get unknown options"
```

or run the full unit suite:

```bash
npm run test:unit
```

## Expected results

- Currently (before implementation), the new tests are expected to fail because unknown options are silently accepted for some `flow get` commands.
- After implementation, both tests should pass with non-zero exit and help guidance in output.
