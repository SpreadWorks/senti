## Background
The finalize report / cleanup report tends to include the full issue-log content, which reduces readability in long flows. There is too much noise even when you only want to see the most recent important items.

## Goal
Summarize the issue-log display in the finalize report by splitting entries into important items and recent normal items. The report body and report.json should retain only the summary, with the full log referenced from the existing specs/<spec>/issue-log.json as the source of truth.

## Decisions
- Important items are determined mechanically by the AI implementation
- Criteria for "important": fail / error / blocked / recovery / workaround / force variants, and failures originating from gate / review / final-regression
- Normal items show the 5 most recent entries not classified as important
- Important items are shown up to 10; excess is indicated by count only
- The summary must always display the reference path to the full artifact
- Implementation scope is limited to the report generation side; finalize-cleanup continues to display report.json text as-is

## Display Example
```
Issue Log Summary (12 total)
Full issue log: specs/123-example/issue-log.json

Important (3)
- [gate-impl] fail: ...
- [final-regression] fail: ...

Recent Other (5 of 9)
- [implement] ...
```

## Implementation Approach
- Changes are centered on `generateReport()` / text formatting in `src/flow/commands/report.js`
- Responsibility for converting issue-log entries into a summary structure is encapsulated in the report generation side
- `report.json`'s `issueLog.entries` should also contain only summarized entries; the full log is referenced via `specs/<spec>/issue-log.json`
- The existing issue-log.json storage format is not changed

## Test Scenarios
- Report text remains readable when the issue-log has few entries
- Important items, 5 recent normal items, and the full-log path all appear in the report text
- `report.json`'s `issueLog.entries` contains only the summary and does not retain full entries
- Excess count is displayed when important items exceed 10

## Completion Criteria
The finalize report remains a readable length even in long flows. Important issue-log entries are visible in the report, and when details are needed the full log is accessible via the displayed issue-log artifact path.

<details>
<summary>ja</summary>

[ENHANCE] finalize report: issue-log 表示を要約化する

## 背景
finalize report / cleanup report に issue-log 全文が入りやすく、長い flow では report の可読性が落ちる。直近の重要事項を見たいだけでもノイズが多い。

## やりたいこと
finalize report の issue-log 表示を、重要項目と直近の通常項目に分けた要約にする。report 本文と report.json は要約だけを保持し、全文は既存の specs/<spec>/issue-log.json を正本として参照させる。

## 決定事項
- 重要項目は AI 実装側の判断で機械判定する
- 重要扱いの目安は fail / error / blocked / recovery / workaround / force 系、および gate / review / final-regression 由来の失敗
- 通常項目は重要項目に含まれない entries の直近 5 件を表示する
- 重要項目は最大 10 件まで表示し、超過分は件数だけ示す
- 要約には全文 artifact の参照パスを必ず表示する
- 実装スコープは report 生成側に限定し、finalize-cleanup は既存どおり report.json の text を表示する

## 表示イメージ
Issue Log Summary (12 total)
Full issue log: specs/123-example/issue-log.json

Important (3)
- [gate-impl] fail: ...
- [final-regression] fail: ...

Recent Other (5 of 9)
- [implement] ...

## 実装方針
- src/flow/commands/report.js の generateReport() / text formatting を中心に変更する
- issue-log entries を要約用の構造に変換する責務を report 生成側へ閉じ込める
- report.json の issueLog.entries も要約された entries のみとし、全文は specs/<spec>/issue-log.json を参照する
- 既存の issue-log.json の保存形式は変更しない

## テスト観点
- issue-log が少ない場合も読みやすい report text になる
- 重要項目、通常項目 5 件、全文パスが report text に出る
- report.json の issueLog.entries が要約だけになり、全文 entries を保持しない
- 重要項目が 10 件を超える場合に超過件数が表示される

## 完了条件
長い flow でも finalize report が読める長さに保たれる。重要な issue-log は report 上で把握でき、詳細が必要な場合は表示された issue-log artifact パスから全文へ遷移できる。

</details>