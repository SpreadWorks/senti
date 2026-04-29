# Feature Specification: 242-impl-review-token-opt

**Feature Branch**: `feature/242-impl-review-token-opt`
**Created**: 2026-04-28
**Status**: Draft
**Input**: GitHub Issue #286

## Goal
impl review の diff 入力をファイル×要件単位のループに分割し、大規模変更（10ファイル以上）でのトークン爆発を防ぐ。品質を低下させない。

## Background
impl review は全 diff を1回の AI 呼び出しに渡す設計。大規模変更（21+ファイル）では diff がプロンプトの 91.6% を占め、トークン上限に達して破綻するケースがある。レビュー品質自体は良好であり、トークン量の最適化のみが課題。

## Scope
- `src/flow/commands/review.js` — impl review（`--phase` なし）の内部パイプライン
- file-map.json の必須化バリデーション
- 閾値ベースのルーティング（ループ / 一括）
- ファイル×要件ループ型レビュー
- cross-check パス（ファイル横断の問題検出）
- compaction（同一 diff ファイルのグループ化）

## Out of Scope
- test review / spec review のトークン最適化
- review.md の出力フォーマット変更
- CLI インターフェースの変更（新フラグ等）

## Constraints
- Node.js 組み込みモジュールのみ使用（外部依存禁止）
- レビュー品質を低下させない（cross-check パスでファイル横断の問題をカバー）
- 10 ファイル未満の変更は既存動作を維持
- ループ型レビューの AI 呼び出し回数は上限 50 回（compaction 後のグループ数が 50 を超える場合、複数ファイルを1回の呼び出しにバッチする）。cross-check パスの1回は上限に含めない

## Design Principles
- 1回の AI 呼び出しのトークン量を一定に保つ
- 既存の proposal フォーマット（### N. title / File / Issue / Suggestion）を再利用する

## Overview
### Modules
- review.js（impl review パイプライン）— 閾値判定・ルーティング・ループ実行・cross-check・compaction の統合

### Data Flow
- resolveReviewTarget → diff 取得
- loadFileMap → 要件→ファイルマッピング取得（必須）
- ファイル数判定 → 10 未満: 一括レビュー（既存）/ 10 以上: ループレビュー
- ループ: compaction でグループ化 → ファイル単位で AI 呼び出し → proposal 集約
- cross-check: 集約した proposal サマリを元にファイル横断の問題を検出
- final validation → mergeVerdicts → writeReviewMd

### Decisions
- file-map.json を必須にする。フォールバックなし。マッピングなしではループの前提データが欠如する
- 閾値を 10 ファイルに設定。80%ile が 9 ファイル以下であり、上位 20% でループの恩恵を得る
- compaction をスコープに含める。一括置換のような同一パターン変更ではループしても冗長な AI 呼び出しが発生する

## Clarifications (Q&A)
- Q: 閾値 10 はどの数値で判定するか
  - A: diff に含まれるファイル数（collectTouchedFiles の結果）で判定する
- Q: 「同一 diff」の定義は何か
  - A: ファイルパスヘッダを除いた diff テキストの一致で判定する
- Q: cross-check パスの入力は何か
  - A: 個別レビューの proposal テキスト集約であり、元の diff 全体ではない

## Alternatives Considered
- file-map.json なしでフォールバック（一括 diff レビューに戻す） — ループの前提データが欠如する状態でコードパスを2本維持するとメンテナンスコストが高い。必須化を選択
- 常時ループ（閾値なし） — 中央値5ファイルの大半のケースで不要なオーバーヘッド（AI 呼び出し回数増加）が発生。閾値切り替えを選択
- 閾値 20 ファイル（上位 7% のみ対象） — 中規模 diff にも恩恵があるため、10 ファイルを選択
- compaction を別 spec に分離 — ユーザーがスコープに含めることを決定。一括置換パターンでのループ冗長化を同時に解決

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: impl review（`--phase` なし）実行時に file-map.json が存在しない場合、エラーメッセージを stderr に出力して非ゼロ終了する
- R2 [must]: diff に含まれるファイル数が 10 以上の場合、ファイル×要件ループ型レビューに切り替える。10 未満の場合は既存の一括 diff レビューを実行する
- R3 [must]: ループ型レビューでは、各ファイルの diff と file-map.json から取得した対応要件を1回の AI 呼び出しに渡し、proposal を生成する
- R4 [must]: file-map.json に含まれないファイルが diff に存在する場合、そのファイルは要件コンテキストなしで個別にレビューする
- R5 [must]: 全ファイルのループ完了後、個別 proposal のサマリを集約した cross-check パスを1回実行し、インターフェース不整合・重複導入・命名不一致を検出する。検出結果は既存の proposal 形式（### N. title / File / Issue / Suggestion）で出力する
- R6 [should]: diff 内容が同一のファイル群を1グループとし、代表1件のみ AI レビューを実行する。代表の proposal をグループ全体に適用する
- R7 [must]: ループ型レビューと一括レビューの最終出力（review.md）は同一フォーマットとする。呼び出し元が内部ルーティングを意識しない

## Acceptance Criteria
- file-map.json がない状態で `flow run review` を実行するとエラー終了する
- 10 ファイル以上の diff でループ型レビューが実行され、1回の AI 呼び出しに全 diff が含まれない
- 10 ファイル未満の diff で既存の一括レビューが動作する
- cross-check パスが実行され、ファイル横断の proposal が review.md に含まれる
- 同一 diff のファイル群で AI 呼び出し回数が代表1件分に削減される
- review.md の出力フォーマットがループ/一括で同一である

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
- **T-1** [pending]: file-map.json の必須バリデーション追加
  - impl review 実行時に file-map.json の存在を検証し、なければエラー終了する
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: 閾値ベースのルーティング実装
  - diff のファイル数を判定し、10 以上ならループ型、未満なら既存一括レビューにルーティングする
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: ファイル×要件ループ型レビューの実装
  - 各ファイルの diff と対応要件を個別に AI へ送信し、proposal を収集する。未マッピングファイルは要件なしでレビューする
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: cross-check パスの実装
  - 個別レビュー結果を集約し、ファイル横断の問題（インターフェース不整合・重複導入・命名不一致）を検出する
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: 同一 diff ファイルの compaction 実装
  - diff 内容が同一のファイル群をグループ化し、代表1件のみ AI レビューを実行。結果をグループ全体に適用する
  - see `tasks/T-5.md` for full spec
