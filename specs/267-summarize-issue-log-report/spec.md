# Feature Specification: 267-summarize-issue-log-report

**Feature Branch**: `feature/267-summarize-issue-log-report`
**Created**: 2026-05-25
**Status**: Draft
**Input**: GitHub Issue #343

## Goal
finalize report の issue-log 表示を重要項目と直近通常項目の要約にする

## Background
Issue #343 identifies that finalize report / cleanup report can become hard to read when the Issue Log section expands every issue-log entry. The current report generator builds data.issueLog.entries from all issue-log entries and formatText() prints each one. This spec keeps the full issue-log artifact unchanged, but changes report generation so report text and report.json contain only a bounded summary with a pointer back to the full artifact.

## Impact on Existing Features

- finalize report text changes from full Issue Log entries to a bounded Issue Log Summary section.
- report.json data.issueLog.entries changes from full entries to selected summary entries.
- specs/<spec>/issue-log.json persistence remains unchanged and remains the full-log source of truth.
- finalize-cleanup behavior remains unchanged because it displays report.json text as-is.

## Scope
- src/flow/commands/report.js の generateReport() が作る issueLog data と report text の Issue Log 表示
- report.json の data.issueLog に保持される entries の要約化
- 全文 issue-log artifact 参照パスの report text / report.json への保持
- 重要項目 10 件上限、通常項目直近 5 件、overflow count の表示
- generateReport() の spec-local test と unit test

## Out of Scope
- specs/<spec>/issue-log.json の保存形式変更
- issue-log entry 作成コマンドや gate / review / final-regression 側の記録形式変更
- finalize-cleanup の report 表示ロジック変更
- metrics token コマンドなど report 以外の issue-log 集計仕様変更

## Constraints
- 外部依存を追加しない。Node.js 組み込みモジュールと既存 report 生成コードの範囲で実装する。
- 既存の specs/<spec>/issue-log.json を全文の正本として維持し、保存形式を変更しない。
- report 生成側だけで要約を作る。finalize-cleanup は report.json の text を表示する既存責務のままにする。
- bounded-resource-usage: report に保持する issue-log summary は重要項目最大 10 件、通常項目最大 5 件に制限する。
- 旧 report.json 形式への後方互換変換は追加しない。alpha 版ポリシーに従い、新しい report 形式を正とする。

## Design Principles
-

## Overview
### Modules
- src/flow/commands/report.js — generateReport() で issue-log entries を summary data に変換し、formatText() で Issue Log Summary を表示する。
- src/flow/lib/run-report.js — loadIssueLog() で読み込んだ全文 issue-log を generateReport() に渡す既存経路。保存形式は変更しない。
- src/flow/lib/run-finalize.js — finalize-commit 後の report 生成経路。generateReport() の出力を saveReport() で保存する既存経路を使う。
- tests/unit/flow/commands/report-metrics.test.js — generateReport() の既存 unit test 群。issue-log summary の unit test を同じ責務付近に追加する。
- specs/267-summarize-issue-log-report/tests/ — R1-R5 の spec-local coverage を置き、test-execute の対象にする。

### Data Flow
- loadIssueLog() は specs/<spec>/issue-log.json の全文 entries を返す。generateReport() は全文 entries を読み、summary count、fullLogPath、important entries、recent other entries、overflow count を持つ issueLog data を作る。
- formatText() は issueLog data から Issue Log Summary セクションを作る。report.json には summary data と text だけを保存し、全文 entries は保存しない。
- finalize-cleanup は既存どおり report.json の text を表示する。cleanup 側で issue-log entries を再読込または再加工しない。

### Decisions
- [VERIFY] draft policy: report generation already owns report.json data and text; result=match.
- [VERIFY] draft policy: full issue-log storage is separate from report generation; result=match.
- [VERIFY] draft policy: final-regression failures include explicit failure fields; result=match.
- Important entries are selected from bounded, source-verifiable criteria rather than subjective severity.
- report.json keeps summary entries only; full entry details stay in issue-log.json.

## Clarifications (Q&A)
- Q: summary entries とは何を含むか。
  - A: summary entries は report 表示に必要な step、reason、resolution、classification などの短い fields に限定する。全文 artifact の entries 全件は report.json に複製しない。
- Q: recent non-important entries の順序はどうするか。
  - A: issue-log entries の保存順を時系列として扱い、重要項目に含まれない entries の末尾 5 件を recent other とする。表示は保存順を保つ。
- Q: failure entry の判定はどの値を見るか。
  - A: step が gate / review / final-regression を含み、level / result / status / failureKind のいずれかが fail / failed / error / blocked を含む entry を失敗由来として重要扱いにする。gate issue-log entries は level に failure signal を持つ場合があるため level も見る。
- Q: CLI exit code contract は変わるか。
  - A: 変わらない。この spec は既存 command の出力内容を変えるだけで、新しい user-facing argument や failure condition は追加しない。

## Alternatives Considered
- report.json に全文 entries と要約 entries の両方を保持する — report artifact の肥大化を残し、Issue #343 の readable report という目的を満たしにくいため不採用。全文は issue-log.json に残す。
- finalize-cleanup 側で report text を再加工する — report.json と cleanup 表示の二重管理になるため不採用。generateReport() で summary text を生成すれば全 report 表示経路に同じ結果が反映される。
- 通常項目を report から完全に省略する — 直近の通常 issue-log context を見たいという Issue #343 の表示イメージを満たさないため不採用。直近 5 件だけを表示する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-25T03:15:49.743Z
- Notes: autoApprove: spec gate passed and user enabled auto mode for Issue #343

## Requirements
- R1 [must]: generateReport() shall set data.issueLog.count to the total number of full issue-log entries and data.issueLog.fullLogPath to `specs/<spec-id>/issue-log.json` when a flow state spec path is available. The fullLogPath shall be present in report.json and report text whenever issueLog data is rendered.
- R2 [must]: generateReport() shall classify an issue-log entry as important when any of step, level, reason, trigger, resolution, guardrailCandidate, result, status, or failureKind contains fail, failed, error, blocked, recovery, recover, workaround, force, or forced using case-insensitive substring matching, or when step contains gate, review, or final-regression and level/result/status/failureKind indicates a failure.
- R3 [must]: data.issueLog.entries shall contain only summary entries: all important entries up to 10 entries, then recent non-important entries up to 5 entries. Full issue-log entries beyond those summary selections shall not be copied into report.json.
- R4 [must]: report text shall render an `Issue Log Summary (<total> total)` section with the fullLogPath, an Important subsection when important entries exist, a Recent Other subsection when non-important entries exist, and explicit omitted counts when important entries exceed 10 or non-important entries exceed the 5 displayed entries.
- R5 [must]: issue-log entries with 0, 1, or 2 total entries shall not render omitted-count text when no entries are hidden. With 0 entries, report text shall not render an Issue Log Summary section. With 1 or 2 entries, report text shall not contain an issue-log omitted-count line or phrase containing `omitted` or `more`.
- R6 [must]: The existing issue-log.json load/save format and finalize-cleanup report display behavior shall remain unchanged; all summary behavior shall be implemented in the report generation path.

## Acceptance Criteria
- A report generated from 12 issue-log entries displays `Issue Log Summary (12 total)`, the full issue-log path, important entries, recent other entries, and omitted counts.
- report.json data.issueLog.entries contains only the selected summary entries and does not contain all full issue-log entries when more entries exist than the summary limits.
- Important entry selection includes entries with fail/error/blocked/recovery/workaround/force terms and gate/review/final-regression failure entries.
- Recent Other displays the 5 most recent non-important entries when more than 5 non-important entries exist.
- Important omitted count is displayed when more than 10 important entries exist.
- Entries 0, 1, and 2 cases produce stable report text: 0 entries omits the Issue Log Summary section, and 1 or 2 entries contain no issue-log omitted-count line or phrase containing `omitted` or `more`.
- Existing issue-log.json persistence tests continue to pass without storage schema changes.
- Spec-local tests under specs/267-summarize-issue-log-report/tests/ include `// spec: R<N>` headers covering R1-R6.

## Implementation Targets
- src/flow/commands/report.js
- tests/unit/flow/commands/report-metrics.test.js
- specs/267-summarize-issue-log-report/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Build issue-log summary data
  - generateReport() が full issue-log entries から bounded summary data を作り、report.json に全文 entries を複製しないようにする。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Render issue-log summary text
  - formatText() が Issue Log Summary、fullLogPath、Important、Recent Other、省略件数を読みやすく表示する。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Preserve issue-log storage contract
  - issue-log.json の保存形式と finalize-cleanup の表示責務を変えず、summary behavior を report generation path に限定する。
  - see `tasks/T-3.md` for full spec
