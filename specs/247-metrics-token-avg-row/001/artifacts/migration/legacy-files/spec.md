# Feature Specification: 247-metrics-token-avg-row

**Feature Branch**: `feature/247-metrics-token-avg-row`
**Created**: 2026-04-30
**Status**: Draft
**Input**: GitHub Issue #299

## Goal
metrics token の出力を改修し、サマリー行を AVG 行としてテーブルカラムに揃えて表示する。specs 列・cache hit 列を全フォーマットに追加し、cost 精度を toFixed(1) に変更する。

## Background
現在のサマリー行はフリーテキスト形式（avg cost: $X | avg duration: Xs | ...）で、どのカラムの集計値かが視覚的に不明確。またスペック数や行レベルの cache hit rate が表示されていない。カラムヘッダーがフェーズごとに繰り返されるのも冗長。

## Scope
- [must] text 形式: サマリー行を AVG 行としてデータ行と同じカラム配置で出力
- [must] text 形式: カラムヘッダーを出力先頭に一度だけ表示
- [must] text 形式: フェーズ区切りを -- phase --- 形式に変更
- [must] 全フォーマット: 行データに specCount (日付+フェーズを構成する flow.json 数) を追加
- [must] 全フォーマット: 行データに cacheHitRate (cacheRead / (tokenInput + cacheRead)) を追加
- [must] text/CSV: cost 表示精度を toFixed(1) に変更
- [should] キャッシュ: 旧フォーマット検出時に自動再構築

## Out of Scope
- 集計ロジック（分母の混在）の変更
- flow.json スキーマの変更

## Constraints
- cost/duration の平均は non-null 行のみで算出、token/callCount は null=0 で全行平均。この混在を維持する
- JSON の cost は数値のまま（toFixed しない）
- 外部依存の追加は不可（Node.js 組み込みのみ）

## Design Principles
- 既存の集計セマンティクス（分母ロジック）は不変。行データモデルとキャッシュスキーマは specCount/cacheHitRate/version のために変更する
- 全フォーマット (text/json/csv) でデータモデルを一貫させる
- 既存機能への影響: text 出力のカラムヘッダー・フェーズ区切り・サマリー行のフォーマットが変更される。CSV ヘッダーに specCount/cacheHitRate カラムが追加される。text 形式をパースする外部ツールは新フォーマットへの対応が必要。JSON の既存フィールドは変更なし（新フィールド追加のみ）。既存 e2e テスト (token.test.js) のアサーションは新フォーマットに合わせて更新する

## Overview
### Modules
- src/metrics/commands/token.js — 対象ファイル。formatText, formatCsv, formatJson, computePhaseSummary, buildRows, buildRowsFromMetrics, createEmptyRow, applyPhaseMetrics, finalizeRow, writeCache, isCacheFresh を変更

### Data Flow
- flow.json → buildRows (specCount カウント追加) → finalizeRow (cacheHitRate 算出追加) → formatText/formatCsv/formatJson → stdout

### Decisions
- 全フォーマットに specCount/cacheHitRate を追加。データモデルの一貫性を優先。
- キャッシュに version フィールドを追加し旧フォーマット検出時にリビルド。
- AVG 行の specs は全行平均、cache hit は全行合算からの比率（computePhaseSummary と同じ加重比率）。

## Clarifications (Q&A)
- Q: AVG 行の specs 値は合計か平均か
  - A: 平均。データ行と同じ意味単位で比較可能にするため
- Q: AVG 行の cache hit はどう算出するか
  - A: 全行の cacheRead 合計 / (全行の tokenInput 合計 + 全行の cacheRead 合計)。行ごとの平均ではなく加重比率

## Alternatives Considered
- text のみ変更し JSON/CSV は変更しない — データモデルの不整合が生じるため却下
- キャッシュの暗黙リビルド（新フィールド不在チェック） — version フィールドの方が明示的で将来の変更にも対応しやすいため却下
- AVG 行の specs を合計表示 — 平均の方がデータ行と同じ意味単位で比較可能なため却下

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: formatText は出力先頭にカラムヘッダーを一度だけ出力し、フェーズごとにヘッダーを繰り返さない
- R2 [must]: formatText のフェーズ区切りは '-- {phaseLabel} ' + '-' パディング（現行の罫線幅に合わせる）形式とする
- R3 [must]: formatText のサマリー行を AVG 行に変更。データ行と同じカラムに揃え、先頭列に 'AVG.' を表示する
- R4 [must]: 行データに specCount フィールドを追加。値は buildRows で同一 (date, phase) キーに集約された flow.json の数。全フォーマット (text/json/csv) に反映する
- R5 [must]: 行データに cacheHitRate フィールドを追加。値は cacheRead / (tokenInput + cacheRead)。(tokenInput + cacheRead) が 0 の場合は null。全フォーマットに反映する
- R6 [must]: text/CSV の cost 表示精度を toFixed(1) に変更する。JSON は数値のまま
- R7 [should]: キャッシュ JSON に version フィールドを追加し、コード側の期待バージョンと不一致の場合はリビルドする
- R8 [must]: computePhaseSummary に avgSpecCount と avgDifficulty を追加し、AVG 行に反映する

## Acceptance Criteria
- text 出力でカラムヘッダーが出力先頭に一度だけ表示される
- text 出力でフェーズ区切りが '-- draft ---...' 形式で表示される
- text 出力で各フェーズの末尾に AVG 行がデータ行と同じカラム配置で表示される
- text/json/csv 出力で各行に specCount が含まれる
- text/json/csv 出力で各行に cacheHitRate が含まれる
- text/CSV の cost が小数点1位 ($X.X) で表示される
- JSON の cost は数値のまま
- 旧バージョンのキャッシュが存在する場合、自動的にリビルドされる
- 既存テスト (token.test.js) が新フォーマットに合わせて更新され、全テストが PASS する

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add specCount and cacheHitRate to row data model
  - buildRows で specCount をカウントし、finalizeRow で cacheHitRate を算出してフィールドに追加する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Update computePhaseSummary for AVG row
  - computePhaseSummary に avgSpecCount と avgDifficulty を追加し、AVG 行の全カラムに対応する値を返す。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Rewrite formatText with new layout
  - カラムヘッダーを先頭に一度だけ出力、フェーズ区切りを -- phase --- 形式に、サマリーを AVG 行に変更する。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Update formatCsv and formatJson for new fields
  - CSV ヘッダーに specCount, cacheHitRate を追加。JSON の phaseSummary にも新フィールドを反映。
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Add cache version for schema change detection
  - キャッシュ JSON に version フィールドを追加し、旧バージョン検出時にリビルドする。
  - see `tasks/T-5.md` for full spec
