# Feature Specification: 245-metrics-output-improvements

**Feature Branch**: `feature/245-metrics-output-improvements`
**Created**: 2026-04-29
**Status**: Draft
**Input**: GitHub Issue #293

## Goal
metrics コマンドの出力を改善する: PHASE 順序をフロー実行順に固定、text 出力でフェーズあたり最新7件に制限、全フォーマットにフェーズ別集計データを追加、cost null 行の表示を改善して情報損失を解消する。

## Background
metrics.json の出力で、PHASE がアルファベット順にソートされフロー実行順と一致しない。件数制限がなく大量データ時に見づらい。集計行がなくフェーズ単位の傾向を掴めない。cost null 行が一律 N/A 表示で他の有用なフィールド（callCount, durationMs 等）が埋没している。

## Scope
- [must] sortRows を VALID_PHASES のインデックス順でソート（全フォーマット共通）
- [must] cost null 行の表示改善（text/CSV: — マーカー、JSON: null 維持）
- [should] 全フォーマットにフェーズ別集計データ追加
- [should] formatText でフェーズあたり最新7件表示 + 省略表記

## Out of Scope
- metrics.json キャッシュスキーマの変更
- difficulty 計算ロジックの変更
- report.js（flow report）の変更

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）
- 既存の CLI インターフェース（--format text|json|csv）は変更しない

## Design Principles
-

## Overview
### Modules
- src/metrics/commands/token.js — metrics token コマンドの実装。sortRows, formatText, formatCsv, formatJson を含む

### Data Flow
- flow.json → buildRows → sortRows(VALID_PHASES順) → format(Text|Json|Csv) → stdout

### Decisions
- VALID_PHASES 配列のインデックスをソートキーとして使用。VALID_PHASES に含まれないフェーズは末尾にフォールバック。
- 7件制限は text のみ。JSON/CSV はフルデータ出力 + 集計データ付与。
- JSON の集計は phaseSummary キーとしてトップレベルに追加。CSV の集計行は date 列を SUMMARY にして区別。

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- text 出力のみ変更（JSON/CSV は変更なし） — ユーザーが全フォーマット適用を希望したため却下
- JSON/CSV も7件に制限 — 消費側の柔軟性が失われるため却下。フルデータ + 集計が最も有用
- CSV 集計行に # コメント行を使用 — RFC 4180 準拠を損なうため却下

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: sortRows は VALID_PHASES 配列のインデックス順でフェーズをソートする。同一フェーズ内は日付昇順。VALID_PHASES に含まれないフェーズは末尾に配置する。
- R2 [should]: formatText は各フェーズの行を日付降順で最新7件に制限する。8件目以降は '... and N more' の省略表記を表示する。7件以下の場合はそのまま全件表示。
- R3 [should]: formatText は各フェーズブロックの末尾に集計行を表示する。集計値: avg cost（cost non-null 行のみ）、avg duration、total calls、avg tokens in/out、cache hit rate（cacheRead / (tokenInput + cacheRead)）。
- R4 [should]: formatJson は出力 JSON に phaseSummary キーを追加する。キーはフェーズ名、値は R3 と同じ集計値のオブジェクト。rows はフル出力（件数制限なし）。
- R5 [should]: formatCsv は各フェーズの全行出力後、集計行を追加する。集計行の date 列は 'SUMMARY' とし、他列に R3 と同じ集計値を格納する。
- R6 [must]: asDisplayValue で cost が null の場合、'N/A' ではなく '—' を返す。costIncomplete マーカー（+）の動作は既存のまま維持する。
- R7 [must]: asCsvValue で cost が null の場合、'N/A' ではなく '—' を返す。
- R8 [must]: specs/245-metrics-output-improvements/tests/ にテストコードを配置し、全テストが通ること。既存テスト（tests/e2e/metrics, tests/unit/metrics）の出力変更に伴う期待値更新は許可する。

## Acceptance Criteria
- sdd-forge metrics token --format text の出力で PHASE がフロー実行順に並ぶ
- text 出力で8件以上あるフェーズが7件 + 省略表記で表示される
- text 出力の各フェーズ末尾に集計行が表示される
- JSON 出力に phaseSummary キーが存在し、フェーズ別集計値を含む
- CSV 出力のフェーズ末尾に SUMMARY 行が存在する
- cost null 行で text/CSV の cost 列が — 表示になる
- npm test が全て通る

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: sortRows を VALID_PHASES 順にソート
  - sortRows のソート順をアルファベット順から VALID_PHASES インデックス順に変更する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: cost null 行の表示改善
  - asDisplayValue と asCsvValue で cost null の場合に N/A ではなく — を返すようにする。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: フェーズ別集計ロジックの追加
  - フェーズごとの集計値（avg cost, avg duration, total calls, avg tokens, cache hit rate）を算出する共通関数を追加する。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: formatText に7件制限と集計行を追加
  - text 出力でフェーズあたり最新7件に制限し、各フェーズ末尾に集計行を表示する。
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: formatJson に phaseSummary を追加
  - JSON 出力に phaseSummary キーを追加し、フェーズ別集計値を格納する。
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: formatCsv に集計行を追加
  - CSV 出力の各フェーズ末尾に集計行（date=SUMMARY）を追加する。
  - see `tasks/T-6.md` for full spec
