# spec 215 tests

Spec verification tests for `215-flow-task-decomposition` (draft-return task flow).

## Contents

- `scenario-reopen-flow.test.js` — REQ-12 acceptance scenario: plan フェーズで tasks 2 件定義 → approval → 実装中に 1 件 done 化 → `reopen-draft` CLI → spec.json に 1 件追記 → 再 approval → flow.json.tasks[] が 3 件、既存 2 件の status が保持されることを end-to-end で検証する。

## How to run

```
node --test specs/215-flow-task-decomposition/tests/
```

These are spec-local tests and are NOT included in the default `npm test` run.
They serve as history for this spec's verification — not maintained long-term.

The monotonic check, sync, render, and reopen-draft CLI also have unit coverage
under `tests/unit/` which IS run by `npm test`.
