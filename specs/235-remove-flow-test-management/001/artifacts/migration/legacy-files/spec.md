# Feature Specification: 235-remove-flow-test-management

**Feature Branch**: `feature/235-remove-flow-test-management`
**Created**: 2026-04-27
**Status**: Draft
**Input**: GitHub Issue #275

## Goal
flow からプロジェクトテスト結果の管理・追跡・制御機構を削除し、gate-impl の品質保証モデルをテスト evidence 依存から行動規範ベースに変更する

## Background
flow がプロジェクトテスト結果の管理・追跡・制御機構を内蔵しており（run-tests, write-tests, test.baseline, test.summary, summarize-test-log 等）、gate-impl がその evidence に依存している。テストを書く・走らせる責務は spec にあるべきで、flow がテスト結果を管理するのは過剰な責務分担。テスト evidence への依存は gate-impl の判定を複雑化させ、baseline 取得失敗などのエッジケースを増やしている。2c8f の設計レビューで確定した方針に従い、この機構を削除して gate-impl の品質保証モデルを変更する。

## Scope
- [must] flow run tests コマンドを registry から削除する。呼び出し時は CLI がコマンド未登録エラーを返す
- [must] flow set test-summary コマンドを registry から削除する。呼び出し時は CLI がコマンド未登録エラーを返す
- [must] src/flow/lib/run-tests.js を削除する
- [must] src/flow/lib/summarize-test-log.js を削除する
- [must] src/flow/lib/set-test-summary.js を削除する
- [must] flow.json の test.baseline スロットの読み書きを除去する
- [must] gate-impl のテスト evidence 依存関数を削除する（checkMissingHeadTestEvidence, checkTestChanges, checkExpectedTests, parseAuthorizedTestModificationsFromJson, parseAuthorizedTestModifications）
- [must] buildImplCheckPrompt() からベースライン vs ヘッド差分テスト評価ロジックを除去する
- [must] TASK_STEPS_PLAN から write-tests, run-tests を除去し [impl, review, gate-impl] にする
- [must] TASK_PHASE_MAP, INTEGRATION_STEP_IDS, PASS_NEXT, FAIL_NEXT から write-tests/run-tests 関連エントリを整理する
- [must] context-rules.json の write-tests, run-tests, integration-write-tests, integration-run-tests エントリを削除する
- [must] src/flow/prompts/task/write-tests.md, run-tests.md を削除する
- [must] src/flow/prompts/plan/test.md から旧テスト管理手順を削除し、specs/<spec>/tests/ のテスト実行手順のみを残す
- [must] spec.schema.json から authorized_test_modifications, expected_tests フィールドを削除する
- [must] next-action スキーマ test.schema.json, run-tests.schema.json を削除する
- [must] registry.js から run.tests, set.test-summary エントリを削除する
- [should] report の Tests セクションを spec テスト結果のみを表示するよう変更する
- [should] integration ステップのプロンプトから testlog / baseline / test.summary への参照を除去する

## Out of Scope
- spec テストの実行機構自体（spec 側の責務は維持）
- flow のテスト以外のステップ・コマンド
- gate-draft / gate-spec の判定ロジック
- config スキーマの大規模変更
- スキルファイル（.claude/skills/）の書き換え — sdd-forge upgrade で反映

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）
- alpha 版ポリシー: 後方互換コードは書かない。旧フォーマット・非推奨パスは保持せず削除する
- 既存テストを通すためにテストコードを修正してはならない。テスト��敗時はプロダクトコードを修正する

## Design Principles
- ���ストを書く・走らせる責務は spec にある。flow から剥がすのはテスト結果の管理・追跡・制御機構のみ
- gate-impl の回帰リスクは impl の行動規範で抑制する（spec 対象外のファイルを変更しない、等）

## Overview
### Modules
- flow-helpers.js: TASK_STEPS_PLAN を [impl, review, gate-impl] に縮小。TASK_PHASE_MAP から write-tests/run-tests エントリを除去
- run-gate.js: テスト evidence 依存の 5 関数を削除。buildImplCheckPrompt からテスト evidence セクションを除去
- registry.js: run.tests, set.test-summary エントリを削除
- report.js: Tests セクションのデータソースを spec テスト結果のみに変更
- context-rules.json: write-tests, run-tests, integration-write-tests, integration-run-tests エントリを削除
- spec.schema.json: authorized_test_modifications, expected_tests フィールドを削除

### Data Flow
- タスク作成時: buildInitialTaskSteps → [impl, review, gate-impl] のステップリストを生成
- gate-impl 実行時: buildImplCheckPrompt がテスト evidence なしで spec + diff のみから品質判定プロンプトを構築

### Decisions
- run-tests.js は完全削除する。spec テスト実行は integration ステップのプロンプトで直接指示する。中間レイヤーを排除してシンプルにする
- gate-impl からテスト evidence 依存を完全に除去する。品質保証は spec + diff の AI 評価と行動規範で担保する
- CLI コマンド削除に移行期間は設けない。alpha ポリシーに基づき即座削除

## Clarifications (Q&A)
- Q: flow-store.js の aggregateTestSummary は削除するか？
  - A: 直接削除対象としない。呼び出し元の整合性が崩れる場合のみ修正する
- Q: FLOW_STEPS の integration-write-tests, integration-run-tests ステップ ID は削除するか？
  - A: ステップ ID 自体は残す（integration ステップとしての位置づけは変わらない）。削除するのは context-rules.json のアクション定義のみ
- Q: constants.js の testing エントリは削除するか？
  - A: 削除しない。lifecycle 状態の一部であり、テスト管理機構ではない

## Alternatives Considered
- run-tests.js を縮小して spec テスト実行ヘルパーとして残す — integration ステップのプロンプトで直接テスト実行を指示する方がシンプル。中間��イヤーは不要
- test.summary スロットも完全廃止する — report がテスト結果を表示するためにはどこかに結果を記録する必要がある。スロット自体は薄いので残す方が合理的
- deprecation warning を出して 1 バージョン後に削除 — alpha ポリシーに反する。不要なコードを残す理由がない

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-27T08:51:38.489Z
- Notes: autoApprove. gate-spec backward-compatible-cli-interface FAIL acknowledged by user

## Requirements
- R1 [must]: registry.js の run サブコマンド定義オブジェクトから 'tests' キーを削除し、set サブコマンド定義オブジェクトから 'test-summary' キーを削除する。diff で該当キーの行が削除されていることで検証する
- R2 [must]: src/flow/lib/run-tests.js, src/flow/lib/summarize-test-log.js, src/flow/lib/set-test-summary.js の 3 ファイルを削除する。diff でこれらのファイルが全行削除されていること、および他ファイルからこれらへの import 行が削除されていることで検証する
- R3 [must]: flow-helpers.js の TASK_STEPS_PLAN 配列を ["impl", "review", "gate-impl"] に変更する。diff で write-tests, run-tests の要素が削除されていることで検証する
- R4 [must]: flow-helpers.js の TASK_PHASE_MAP オブジェクトから 'write-tests' と 'run-tests' のプロパティを削除する。diff で該当行が削除されていることで検証する
- R5 [must]: run-gate.js から関数定義 checkMissingHeadTestEvidence, checkTestChanges, checkExpectedTests, parseAuthorizedTestModificationsFromJson, parseAuthorizedTestModifications を削除する。diff でこれらの関数定義が全行削除されていることで検証する。exports オブジェクトからも該当エントリを削除する
- R6 [must]: run-gate.js の buildImplCheckPrompt 関数から testEvidence 引数を削除し、関数本文のテスト evidence セクション生成ロジックを削除する。呼び出し元から testEvidence 引数の渡しを削除する。diff で引数リストの変更と本文のテスト evidence 行の削除が確認できることで検証する
- R7 [must]: context-rules.json から 'write-tests', 'run-tests', 'integration-write-tests', 'integration-run-tests' のキーとその値オブジェクトを削除する。diff で該当 JSON エントリが削除されていることで検証する
- R8 [must]: src/flow/prompts/task/write-tests.md と src/flow/prompts/task/run-tests.md の 2 ファイルを削除する。diff でこれらのファイルが全行削除されていることで検証する
- R9 [must]: src/flow/prompts/plan/test.md の本文から write-tests ステップの説明と run-tests ステップの説明を削除し、specs/<spec>/tests/ 配下のテスト実行手順のみを残す。diff で旧テスト管理手順の行が削除され、specs/<spec>/tests/ を参照する行が残っていることで検証する
- R10 [must]: spec.schema.json のトップレベル properties から 'authorized_test_modifications' キーを削除し、tasks[].items.properties から 'expected_tests' キーを削除する。diff で該当 JSON プロパティ定義が削除されていることで検証する
- R11 [must]: src/flow/schemas/next-action/test.schema.json と src/flow/schemas/next-action/run-tests.schema.json の 2 ファイルを削除する。diff でこれらのファイルが全行削除されていることで検証する
- R12 [should]: report.js の Tests セクション生成ロジックで、state.test.summary が falsy の場合に 'No test data' を表示する分岐を追加する。diff で該当条件分岐の追加が確認できることで検証する
- R13 [should]: integration ステップ関連のプロンプトファイル（存在する場合）から testlog / test.summary / baseline への参照行を削除する。diff で該当参照行の削除が確認できることで検証する
- R14 [must]: Migration plan for CLI command removal: (1) flow run tests と flow set test-summary は registry.js から削除する（R1 で実施）。(2) 削除後のコマンド呼び出しは CLI の標準未登録エラー（exit code 1）を返す。(3) deprecation 期間は設けない（alpha 版ポリシーに基づく即座削除）。(4) スキルファイルは sdd-forge upgrade で自動更新される。diff で deprecation warning や互換エイリアスが追加されていないことで検証する

## Acceptance Criteria
- npm test が全件 pass する（既存テストの回帰なし）
- flow run tests を実行すると CLI が non-zero exit code でコマンド未登録エラーを返す
- flow set test-summary を実行すると CLI が non-zero exit code でコマンド未登録エラーを返す
- 新規タスク作成時のステップリストが [impl, review, gate-impl] の 3 ステップになる
- gate-impl 実行時にテスト evidence 関連のエラーが発生しない
- spec.schema.json に authorized_test_modifications / expected_tests が存在しない
- specs/235-remove-flow-test-management/tests/ 配下にテストコードが存在し、全テストが pass する

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-pending-spec** [pending]: Pending spec definition
  - Placeholder task until spec.json tasks[] is populated.
  - see `tasks/T-pending-spec.md` for full spec

### Round 1
- **T-1** [pending]: Remove test management commands from registry
  - registry.js か�� run.tests と set.test-summary エントリを削除し、対応する実装モジュール（run-tests.js, set-test-summary.js, summarize-test-log.js）を削除する
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Remove write-tests and run-tests from task step plan
  - TASK_STEPS_PLAN を [impl, review, gate-impl] に変更し、関連する TASK_PHASE_MAP, INTEGRATION_STEP_IDS から不要なエントリを除去する
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Remove test evidence functions from gate-impl
  - run-gate.js から checkMissingHeadTestEvidence, checkTestChanges, checkExpectedTests, parseAuthorizedTestModificationsFromJson, parseAuthorizedTestModifications を削除し、gate-impl 実行パスからの呼び出しを除去する
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Rewrite buildImplCheckPrompt to remove test evidence
  - buildImplCheckPrompt() からテスト evidence セクション（baseline vs head 差分評価、test summary 参照、testEvidence パラメータ）を除去する
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Remove test-related schemas and prompts
  - テスト管理に関連するスキーマファイル、プロンプトファイル、context-rules エントリを削除し、test.md を spec テスト向けに書き換える
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Update report Tests section for spec-test-only model
  - report.js の Tests セクションを spec テスト結果のみを表示するよう変更し、test.summary がない場合は「テストデータなし」を表示する
  - see `tasks/T-6.md` for full spec
