# Tests for spec 131: fix finalize hook bypass

## What is tested

- **AC1**: registry defines finalize sub-steps (commit, merge, sync, cleanup)
- **AC2**: commit sub-step has post hook (retro + report)
- **AC3**: all sub-steps have onError hooks
- **AC4**: finalize.js has no direct (betagai) implementations of retro/merge/sync
- **AC5**: error flow test — retro failure records to issue-log.json (manual verification with test flow)

## Location

`specs/131-fix-finalize-hook-bypass/tests/finalize-hooks.test.js`

## How to run

```bash
node --test specs/131-fix-finalize-hook-bypass/tests/finalize-hooks.test.js
```

## AC5 manual verification

1. Create a test flow with `sdd-forge flow prepare --title test --base main --no-branch`
2. Configure a broken AI agent that returns invalid JSON
3. Run `sdd-forge flow run finalize --mode all`
4. Verify `specs/<spec>/issue-log.json` contains the retro failure entry

## Expected results

All tests pass after implementation. Before implementation, AC1-AC4 will fail.
