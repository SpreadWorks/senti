# spec 226 tests

本 spec のテストは **formal test** として `tests/unit/226-task-decomp-wiring/` 配下に配置する。spec-local tests (`specs/226/tests/`) は使用しない。

## 理由

spec 226 が実装する機能は sdd-forge の core 機能（タスク分解、forest 構造、step 構成、CLI）であり、将来の変更で壊れた場合は常にバグ。よって `tests/` 配下の formal test として継続 maintain する。

## テストファイル配置

```
tests/unit/226-task-decomp-wiring/
├── t1-entry-enforcement.test.js       T-1: guardrail + prompts + spec gate tasks check
├── t2-schema-structured.test.js       T-2: spec.json.tasks[*] schema restructuring
├── t3-spec-render-tasks-md.test.js    T-3: spec render generates tasks/<id>.md
├── t4-forest-wiring.test.js           T-4: forest traversal + propagation
├── t5-auto-promote.test.js            T-5: auto-promote function and callers
└── t6-step-redesign-and-cli.test.js   T-6: step redesign + manual CLI
```

各ファイルは spec.json.tasks[*] の各 task の REQ / Acceptance / Test Strategy に対応する。

## 実行方法

```
npm test                                            # 全 unit + integration test
npm test -- tests/unit/226-task-decomp-wiring/     # 本 spec のテストのみ
```

## テスト書き方（計画段階の骨格）

test step 時点では `it.todo` で placeholder を登録。implement step で各 task を実装する際に `it.todo` を `it` に置き換えて内容を埋める。これは本 spec 226 が flat task list として実装される (bootstrap 問題のため forest dogfood は board draft `3f91` で行う) ためで、impl 中に test を充実させる運用とする。

## 期待結果

- test step 完了時点: 既存 test は全 PASS、placeholder は skip（node:test の `it.todo` 扱い）
- implement step 完了時点: 全 placeholder が実テストに置き換わり、PASS する
- gate-impl 時点: 全テスト（新規 + 既存）が exit 0 で PASS
