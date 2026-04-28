# Feature Specification: 241-req-file-test-mapping

**Feature Branch**: `feature/241-req-file-test-mapping`
**Created**: 2026-04-28
**Status**: Draft
**Input**: GitHub Issue #284

## Goal
要件-ファイル-テストのマッピング基盤を構築し、retro / impl review / test review の3機能が共通で利用できるようにする

## Background
retro（要件充足判定）、impl review（要件単位のコードレビュー）、test review（テスト設計の存在確認）の3機能がそれぞれ独立に要件-ファイル/テストの対応関係を必要としている。現在の retro は AI に diff 全文を渡して判定しており、トークンコストが高く精度も不安定。共通のマッピング基盤がないため、各機能が個別に対応を推測する必要がある。

## Scope
- flow set files コマンド（追記型、file-map.json に記録）
- test-map.json フォーマット定義とテストフェーズプロンプト変更
- gate-impl での git diff と file-map.json の突合（未記録ファイル検出）
- retro が test-map.json を読んで静的判定（フォールバックあり）
- impl review が file-map.json を読んで要件単位レビュー（フォールバックあり）
- test review が test-map.json を読んで要件-テスト突合（フォールバックあり）

## Out of Scope
- spec.json スキーマの変更
- 過去 spec の tests/README.md の移行

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）
- alpha 版ポリシー: 後方互換コード不要。過去 spec の README.md は移行しない
- file-map.json / test-map.json が存在しない場合、各消費側は既存動作にフォールバックする

## Design Principles
- マッピングデータは spec.json とは別ファイル（file-map.json / test-map.json）に分離し、スキーマ変更を回避する
- file-map.json は flow set files コマンドで追記型記録。test-map.json は既存 tests/README.md の JSON 化でテストフェーズの成果物として agent が作成する

## Overview
### Modules
- set-files.js: flow set files コマンド。reqId + paths を受け取り file-map.json に追記
- req-map.js: file-map.json / test-map.json のロード・保存・突合ユーティリティ

### Data Flow
- impl 中: agent → flow set files → file-map.json に追記
- テストフェーズ: agent が test-map.json を直接作成（プロンプト指示による）
- gate-impl: git diff --name-only + file-map.json → 未記録ファイルを警告
- retro: test-map.json + テスト実行結果 → 要件ごとの PASS/FAIL 静的判定
- impl review: file-map.json + git diff → 要件ごとのスコープ付きレビュー
- test review: test-map.json + spec.json requirements → テスト未設計の要件を報告

### Decisions
- マッピングを spec.json 内ではなく別ファイルに分離する
- tests は flow set tests コマンドではなく tests/README.md の JSON 化（test-map.json）で記録する
- flow set files は追記型（重複排除あり）

## Clarifications (Q&A)
- Q: file-map.json と test-map.json の配置場所が異なるのはなぜか？
  - A: file-map.json は impl フェーズの成果物なので specs/<spec>/ 直下。test-map.json は tests/ ディレクトリの成果物（README.md の代替）なので specs/<spec>/tests/ 配下
- Q: 過去 spec の tests/README.md はどうなるか？
  - A: alpha 版ポリシーにより移行しない。既存 README.md はそのまま残る。test-map.json が存在しない場合は各消費側がフォールバックする

## Alternatives Considered
- spec.json の requirements に files/tests フィールドを埋め込む — additionalProperties: false のスキーマ変更が必要で影響範囲が広い。別ファイル方式ならスキーマ変更不要
- flow set tests コマンドを新設して spec.json に直接記録する — 既存の tests/README.md が既に要件 ID とテスト名の対応を含んでおり、JSON 化するだけで済む。新規コマンドは冗長
- flow set files を上書き型にする — agent は実装中にファイルを1つずつ変更するため、毎回全ファイル列挙は非現実的。追記型が自然

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: flow set files <reqId> <path...> コマンドを新設する。reqId（文字列、必須）は spec.json の requirements[].id と突合し、存在しない場合は INVALID_REQ_ID エラー（非ゼロ終了）を返す。path（1つ以上必須、文字列）は file-map.json に追記され、同一 reqId+path の重複は無視される。引数不足時は INVALID_USAGE エラー（非ゼロ終了）を返す。成功時は exit 0
- R2 [must]: file-map.json は specs/<spec>/ に配置される。スキーマは { [reqId: string]: string[] } 形式のオブジェクトで、reqId をキー、ファイルパスの配列を値とする
- R3 [must]: test-map.json は specs/<spec>/tests/ に配置される。スキーマは { [reqId: string]: string[] } 形式で、reqId をキー、テスト名または検証コマンドの配列を値とする
- R4 [must]: src/flow/prompts/plan/test.md の tests/README.md 作成指示を tests/test-map.json 作成指示に変更する。test-map.json のスキーマと記入例をプロンプトに含める
- R5 [must]: gate-impl で git diff --name-only の結果と file-map.json の全パスを突合し、diff に含まれるが file-map.json に未記録のファイルを警告として列挙する。file-map.json が存在しない場合はこのチェックをスキップする。未記録ファイルの存在は警告であり gate の pass/fail 判定や exit code には影響しない（既存の exit code 契約を維持）
- R6 [must]: retro が test-map.json を読み、node --test --test-reporter tap で spec テストを実行し、TAP 出力をパースして各テストの pass/fail を取得する。test-map.json の各 reqId のテスト名を TAP 結果と照合し、全 pass → done、一部 pass → partial、全 fail → not_done、test-map.json に reqId のエントリがない → unverified と判定する。test-map.json が存在しない場合は現行の AI diff 評価にフォールバックする。retro の exit code 契約は既存のまま（retro.json 書き出し成功で exit 0、エラー時は非ゼロ）
- R7 [should]: impl review が file-map.json を読み、要件ごとに該当ファイルの diff のみを対象にレビューを実行する。全要件のレビュー完了後、全 diff を対象にファイル横断の問題（モジュール間の不整合、import 漏れ等）を検出する cross-check レビューを1回実行する。file-map.json が存在しない場合は現行の全 diff レビューにフォールバックする。review の exit code 契約は既存のまま
- R8 [should]: test review が test-map.json を読み、spec.json の requirements と突合して tests が空の要件を「テスト未設計」として報告する。test-map.json が存在しない場合はスキップする。review の exit code 契約は既存のまま

## Acceptance Criteria
- flow set files R1 src/a.js を実行すると file-map.json に {"R1":["src/a.js"]} が記録される
- 同じ flow set files R1 src/a.js を再実行しても重複が発生しない
- 存在しない reqId を指定した場合にエラーが返る
- gate-impl が file-map.json と diff を突合し、未記録ファイルを警告に含める
- retro が test-map.json から静的判定し、AI 呼び出しを行わない（test-map.json 存在時）
- test-map.json が存在しない場合、retro は現行の AI diff 評価で動作する
- npm test が全件パスする

## Implementation Targets
- src/flow/lib/set-files.js
- src/flow/lib/req-map.js
- src/flow/registry.js
- src/flow/prompts/plan/test.md
- src/flow/lib/run-gate.js
- src/flow/lib/run-retro.js
- src/flow/lib/run-review.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-pending-spec** [pending]: Pending spec definition
  - Placeholder task until spec.json tasks[] is populated.
  - see `tasks/T-pending-spec.md` for full spec

### Round 1
- **T-1** [pending]: Add file-map.json persistence and flow set files command
  - file-map.json のロード・保存ユーティリティと flow set files CLI コマンドを実装する
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Define test-map.json format and update test prompt
  - test-map.json のスキーマを定義し、テストフェーズプロンプト（test.md）の README.md 作成指示を test-map.json 作成指示に変更する
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add file-map reconciliation to gate-impl
  - gate-impl で git diff と file-map.json を突合し、未記録ファイルを警告として出力する
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Integrate test-map.json into retro for static evaluation
  - retro が test-map.json を読んで要件ごとにテスト結果で静的判定し、AI diff 評価を置き換える
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Integrate file-map.json into impl review for scoped review
  - impl review が file-map.json を読んで要件ごとに該当ファイルの diff のみでレビューを実行する
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Add test review using test-map.json
  - test review が test-map.json と spec.json requirements を突合し、テスト未設計の要件を報告する
  - see `tasks/T-6.md` for full spec
