# Feature Specification: 122-auto-generate-spec-work-report-on-finalize

**Feature Branch**: `feature/122-auto-generate-spec-work-report-on-finalize`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #64

## Goal
finalize パイプラインの Step 6 `record`（プレースホルダー）を `report` に置き換え、作業レポートを自動生成する。レポートはコマンド側で整形済みテキストと構造化 JSON の両方を出力し、AI スキルに表示を委ねない。

## Scope
- `src/flow/run/finalize.js` の Step 6 を `record` → `report` に変更
- レポート生成ロジックの実装（データ収集 + テキスト整形 + JSON 構造化）
- Step 4 (sync) の git diff 情報をレポート用に保持する変更
- `specs/NNN/report.json` へのファイル保存
- SKILL.md の retro 表示ステップを report 表示に置き換え

## Out of Scope
- テスト情報（テスト数・種類: unit/e2e/acceptance）の収集 → 別 spec（ボード adb3）
- レポートの統計・集計ダッシュボード
- レポートフォーマットのカスタマイズ機能

## Clarifications (Q&A)
- Q: レポート生成はパイプラインのどこに配置するか？
  - A: Step 6 の既存 `record` プレースホルダーを `report` に置き換える
- Q: sync（docs 再生成）の結果はどこまで含めるか？
  - A: 変更ファイル一覧 + 章変更概要（git diff --stat + diff の概要）
- Q: 出力形式は？
  - A: 構造化 JSON（`steps.report.data`）+ コマンド側整形テキスト（`steps.report.text`）。AI に表示を任せない
- Q: レポートの保存先は？
  - A: finalize JSON レスポンスに含める + `specs/NNN/report.json` にファイル保存
- Q: テスト情報は含めるか？
  - A: 今回スコープ外。別 spec で対応（ボード adb3）

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: Gate PASS 後にユーザー承認

## Requirements

優先順位: P1（必須）> P2（重要）> P3（推奨）

R1 [P1]: STEP_MAP の `6: "record"` を `6: "report"` に変更する。

R2 [P1]: report ステップで以下のデータを収集する:
  - 実装内容の要約: feature ブランチの `git diff --stat <baseBranch>...HEAD` + コミットメッセージ一覧
  - retro 結果: finalize Step 3 の retro 結果（`results.retro`）から取得。retro 未実行またはスキップの場合は null
  - redolog: `specs/NNN/redolog.json` から `loadRedoLog()` で取得。バグ一覧とエントリ数
  - metrics: flow.json の `metrics` フィールドからフェーズ別カウンター（docsRead, srcRead, question, redo）を集約
  - sync 結果: Step 4 の sync コミットの `git diff --stat` + 変更された docs ファイルの diff 概要

R3 [P2]: sync の git diff 情報を取得するため、Step 4 (sync) の処理を拡張する:
  - sync コミット前後で `git diff --stat` と `git diff` を取得し、`results.sync` に `diffStat`（string）と `diffSummary`（string）を追加する
  - PR ルートで sync がスキップされた場合、`results.sync.diffStat` と `results.sync.diffSummary` は設定しない（`results.sync` は既存の `{ status: "skipped", message: "..." }` のまま）

R4 [P1]: report の出力を2形式で構成する:
  - `steps.report.data`: 構造化 JSON オブジェクト（プログラム参照用）
  - `steps.report.text`: コマンド側で整形済みのプレーンテキスト（そのまま表示可能）

R5 [P2]: `specs/NNN/report.json` にレポートデータを保存する。report.json はコマンドが自動生成する出力成果物（retro.json と同等の位置づけ）であり、ユーザーが編集するファイルではない。保存タイミングは report ステップの最後。cleanup (Step 5) の前に実行されるため spec ディレクトリは存在する。finalize 再実行時は最新の結果で上書きする。

R6 [P3]: `--dry-run` の場合は report ステップもデータ収集・保存をスキップし `{ status: "dry-run" }` を返す。

R7 [P1]: report ステップでエラーが発生してもパイプラインをブロックしない（retro と同様の方針）。エラー時は `{ status: "failed", message: "..." }` を返す。

## Acceptance Criteria

AC1: `sdd-forge flow run finalize --mode all` を実行すると、レスポンスの `steps.report` に `data` と `text` フィールドが含まれる。

AC2: `steps.report.data` に以下のキーが存在する: `implementation`, `retro`, `redolog`, `metrics`, `sync`。

AC3: `steps.report.text` はセクション見出し付きのプレーンテキストで、レポート項目（implementation, retro, redolog, metrics, sync）ごとにセクションが区切られている。

AC4: finalize 完了後、`specs/NNN/report.json` ファイルが作成されている。

AC5: retro がスキップ/失敗した場合でも report は生成される（retro フィールドが null になる）。

AC6: sync がスキップされた場合（PR ルート等）、sync フィールドに `{ status: "skipped", reason: "..." }` が入る。

AC7: `--dry-run` で report ステップが `dry-run` ステータスになり、report.json は作成されない。

AC8: report ステップでエラーが発生してもパイプラインの他ステップ（cleanup 等）は正常に完了する。

## Open Questions
- [x] 整形テキストの具体的なフォーマットは実装時に決定する（見出し・罫線・インデント等）
