# Tests for Spec 170: flow-runid-state-bootstrap

## What was tested

- `resolveWorkDir` should resolve temporary work directory with this priority:
  1. `SDD_FORGE_WORK_DIR`
  2. `config.agent.workDir`
  3. `.tmp` fallback
- Existing `enrich` dump path behavior remains tied to `resolveWorkDir`.

## Where tests are located

- Formal unit test (run by `npm test` / `node --test`):
  - `tests/unit/docs/enrich-dump-path.test.js`

## How to run

```bash
node --test tests/unit/docs/enrich-dump-path.test.js
```

## Expected results

- At planning stage (before implementation), the new env-override test is expected to fail.
- After implementation, all tests in the file should pass.
