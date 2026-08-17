When retro rate < 1.0, append the requirement IDs and notes for partial/not_done items to the end of the Retro section in the report. A single change in formatText() (src/flow/commands/report.js) will be reflected in both the report text and issue comment. Extract from retro data in report.json (requirements[].status + note).

<details>
<summary>ja</summary>

[ENHANCE] retro 100%未満時にレポート・issueコメントへ理由を表示

retro rate < 1.0 のとき、レポートの Retro セクション末尾に partial/not_done の要件 ID と note を追記する。formatText() (src/flow/commands/report.js) の1箇所変更で、report text と issue コメントの両方に反映される。report.json の retro データ (requirements[].status + note) から抽出。

</details>