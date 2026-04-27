Parent item: 2c8f
Prerequisite: spec A (e992: guardrail reorganization) must be completed

## Background

Implements the policy finalized through the 2c8f design review. Removes the management, tracking, and control mechanism for project test results from flow, and changes the gate-impl quality assurance model.

## Core Policy

- The responsibility for writing and running tests belongs to the spec. What is removed from flow is only the management, tracking, and control mechanism for test results.
- Project tests are part of the application code. Fix them normally during impl and verify they pass.
- The `testing` flag is not needed. The post-finalize test skill is also not needed.
- gate-impl requires passing spec tests as a mandatory condition (impl → spec-test → gate-impl)
- Loop limit on failure (constant or common config setting)
- Reuse the `test.summary` slot for spec test results

## Targets for Removal

### Commands & Modules
- `flow run tests` (as a formal step)
- `flow set test-summary`
- `src/flow/lib/summarize-test-log.js`
- `src/flow/lib/run-tests.js` (delete or significantly reduce)

### flow.json Slots & State
- `test.baseline` slot

### gate-impl Related
- `checkMissingHeadTestEvidence()`
- Baseline vs head diff evaluation logic inside `buildImplCheckPrompt()`
- `checkTestChanges()` (mechanical check for `impl-test-preservation`)
- `checkExpectedTests()`
- `parseAuthorizedTestModificationsFromJson()`

### Steps & Flow Structure
- Remove `write-tests`, `run-tests` from `TASK_STEPS_PLAN`
- `plan.test-mode` prompt
- Clean up PHASE_MAP, INTEGRATION_STEP_IDS, PASS_NEXT, FAIL_NEXT
- `write-tests`, `run-tests` entries in context-rules.json

### Prompts
- `src/flow/prompts/task/write-tests.md`
- `src/flow/prompts/task/run-tests.md`
- `src/flow/prompts/plan/test.md` (rewrite to spec tests only)

### Schemas
- `authorized_test_modifications`, `expected_tests` in spec schema
- `src/flow/schemas/next-action/test.schema.json`
- `src/flow/schemas/next-action/run-tests.schema.json`

### registry / config
- `run.tests` entry
- `set.test-summary` entry
- `config.commands.test` related

### report
- Change the Tests section in report to spec test results only

## gate-impl Quality Assurance Model Change

- Remove test evidence dependency (rewrite `buildImplCheckPrompt()`)
- Regression risk is suppressed by impl's code of conduct:
  - Do not modify files outside the spec scope
  - If modification is unavoidable, test including surrounding behavior
  - Do not distort existing design to realize the spec

## Handling of Integration Steps

- Remove testlog dependency
- Change to a step that writes and runs integration verification tests for the entire spec in `specs/<spec>/tests/`
- Prompt rewrite required

<details>
<summary>ja</summary>

[ENHANCE] flow テスト管理機構の削除と gate-impl 品質保証モデル変更

親アイテム: 2c8f
前提: spec A（e992: guardrail 再編）が完了していること

## 背景

2c8f の設計レビューにより確定した方針を実装する。flow からプロジェクトテスト結果の管理・追跡・制御機構を削除し、gate-impl の品質保証モデルを変更する。

## 基本方針

- テストを書く・走らせる責務は spec にある。flow から剥がすのはテスト結果の管理・追跡・制御機構のみ
- プロジェクトテストはアプリコードの一部。impl 中に普通に修正し通過を確認する
- `testing` フラグは不要。post-finalize テストスキルも不要
- gate-impl は spec テスト通過を必須条件とする（impl → spec-test → gate-impl）
- 失敗時ループ上限あり（定数 or config の共通設定）
- `test.summary` スロットを spec テスト結果用に再利用

## 削除対象

### コマンド・モジュール
- `flow run tests`（フォーマルなステップとして）
- `flow set test-summary`
- `src/flow/lib/summarize-test-log.js`
- `src/flow/lib/run-tests.js`（削除または大幅縮小）

### flow.json スロット・状態
- `test.baseline` スロット

### gate-impl 関連
- `checkMissingHeadTestEvidence()`
- `buildImplCheckPrompt()` 内のベースライン vs ヘッド差分評価ロジック
- `checkTestChanges()`（`impl-test-preservation` の機械的チェック）
- `checkExpectedTests()`
- `parseAuthorizedTestModificationsFromJson()`

### ステップ・フロー構造
- `TASK_STEPS_PLAN` から `write-tests`, `run-tests` を除去
- `plan.test-mode` プロンプト
- PHASE_MAP, INTEGRATION_STEP_IDS, PASS_NEXT, FAIL_NEXT の整理
- context-rules.json の `write-tests`, `run-tests` エントリ

### プロンプト
- `src/flow/prompts/task/write-tests.md`
- `src/flow/prompts/task/run-tests.md`
- `src/flow/prompts/plan/test.md`（spec テストのみに書き換え）

### スキーマ
- spec schema の `authorized_test_modifications`, `expected_tests`
- `src/flow/schemas/next-action/test.schema.json`
- `src/flow/schemas/next-action/run-tests.schema.json`

### registry / config
- `run.tests` エントリ
- `set.test-summary` エントリ
- `config.commands.test` 関連

### report
- report の Tests セクションを spec テスト結果のみに変更

## gate-impl 品質保証モデル変更

- テスト evidence 依存の除去（`buildImplCheckPrompt()` 書き換え）
- 回帰リスクは impl の行動規範で抑制:
  - spec 対象外のファイルは変更しない
  - やむを得ず変更する場合は周辺動作を含めてテストする
  - spec 実現のために既存設計を歪めない

## integration ステップの扱い

- testlog 依存を除去
- spec 全体の結合検証テストを `specs/<spec>/tests/` に書いて実行するステップに変更
- プロンプト書き換えが必要

</details>