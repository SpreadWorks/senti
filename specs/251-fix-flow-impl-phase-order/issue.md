## Current State

The FLOW_DEFINITION (impl phase) in `src/flow/definition.js` has the following order:

```
implement → gate-impl → review → finalize
```

Meanwhile, the TASK_DEFINITION side has:

```
implement → review → gate-impl
```

Having `gate-impl` come before `review` in the flow integration phase is a design error.

## Problems

- `gate-impl` is the final gate for pass/fail judgment, but `review` runs after it and may modify code via auto-correction. This results in a state where "code is changed after passing the gate," breaking the meaning of the gate.
- It is inconsistent with the TASK_DEFINITION order (`review → gate-impl`).

## Expected Behavior

Make the flow integration phase follow the same order as task: `implement → review → gate-impl → finalize`.

## Notes

Discovered during scope discussion of spec 251 (Issue #309: delegating test execution to AI agent). In accordance with spec 251's scope discipline (1 spec = 1 concern), it was agreed to extract the order reversal fix as a separate spec.

<details>
<summary>ja</summary>

[ENHANCE] flow integration phase の review/gate-impl 順序逆転を修正

## 現状

src/flow/definition.js の FLOW_DEFINITION (impl phase) は以下の順序:

```
implement → gate-impl → review → finalize
```

一方 TASK_DEFINITION 側は:

```
implement → review → gate-impl
```

flow integration phase で gate-impl が review より前に来ているのは設計として誤り。

## 問題点

- gate-impl は pass/fail 判定の最終ゲートだが、その後 review が走り auto-correction で code を変更し得る。結果として「gate 通過後にコードが変更される」状態が発生し、gate の意味が壊れる。
- TASK_DEFINITION の順序 (review → gate-impl) と整合しない。

## 期待動作

flow integration phase も task と同じ `implement → review → gate-impl → finalize` 順にする。

## 補足

spec 251 (Issue #309: test 実行 AI agent 委託化) のスコープ議論中に発見。spec 251 のスコープ規律 (1 spec = 1 concern) に従い、順序逆転の修正は別 spec として切り出すことに合意。

</details>