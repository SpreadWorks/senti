# Tests for spec 130: flow logic/CLI separation

## What is tested

- **AC1**: FlowCommand base class exists with run() and execute()
- **AC2**: All 27+ command files in lib/ extend FlowCommand
- **AC3**: lib/ files do not import output, fail, ok from flow-envelope or parseArgs
- **AC4**: src/flow/run/, get/, set/ directories are deleted
- **AC5**: registry entries have command property

## Location

`specs/130-flow-logic-cli-separation/tests/flow-lib-separation.test.js`

## How to run

```bash
node --test specs/130-flow-logic-cli-separation/tests/flow-lib-separation.test.js
```

## Expected results

All tests pass after implementation. Before implementation, AC1-AC5 will fail.
