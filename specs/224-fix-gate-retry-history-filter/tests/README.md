# Tests for spec 224 (fix-gate-retry-history-filter)

## What is tested and why

`src/flow/lib/run-gate.js` の `formatRetryHistory` が gate escalation 時の `Previous FAIL reasons` 表示を escalating phase 自身の FAIL 履歴のみに正しく絞り込むことを検証する。現行実装は step フィルタだけで phase を見ず、`startsWith("gate-")` が `step === "gate"` を除外するため、別 phase の履歴が混入していた（Issue #248）。

## Test location

Formal unit test:

- `tests/unit/flow/format-retry-history.test.js`

将来 `formatRetryHistory` の filter が壊れた場合に常に回帰として検知されるべきロジックであるため、spec-scoped ではなく `tests/` 配下に置く（decision rule: "If a future change breaks this test, is that always a bug?" → YES）。

## How to run

```
npm test
```

または個別実行:

```
node --test tests/unit/flow/format-retry-history.test.js
```

## Test cases

| ID | Covers | 概要 |
|---|---|---|
| AC-1 | REQ-1 | task-impl escalation → `phase==="task-impl"` のみ、`phase==="draft"` は除外 |
| AC-2 | REQ-2 | integration escalation → `phase==="integration"` のみ、`phase==="task-impl"` は除外 |
| AC-3 | REQ-3 | escalation 自己記録 (`trigger === "gate onError hook (auto)"`) は履歴から除外 |
| AC-4 | REQ-4 | `phase` 欠落エントリは履歴から除外 |
| AC (extra) | REQ-5 | gate 系以外の step (`"finalize"` 等) は履歴から除外 |
| AC-1 (extra) | REQ-1 | step `"gate"` を持つ `spec` / `task-spec` phase は task-impl escalation 時に除外 |

既存の `tests/unit/flow/gate-envelope-issue-log.test.js` は REQ-6 の回帰担保として変更なしに PASS し続けることを要求する。

## Expected results

- 修正適用前: 上記ケースの多くが FAIL する（現状のバグ）
- 修正適用後: 全 PASS
- 既存テスト群: 本修正の前後で挙動不変（`npm test` で全 PASS）
