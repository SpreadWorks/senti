run-update-overview.js is missing `export default RunUpdateOverviewCommand`, causing the dynamic import in run-gate.js:73 to receive `undefined`. The export was forgotten when the class was added in commit c928179a. All other FlowCommand subclasses have `export default`. Because the error is swallowed by a try-catch, gate-impl itself passes, but the overview update silently fails.

<details>
<summary>ja</summary>

[BUG] gate-impl mergeOverview 副作用で RunUpdateOverviewCommand が未定義になりクラッシュする

run-update-overview.js に export default RunUpdateOverviewCommand が欠落しており、run-gate.js:73 の dynamic import が undefined を受け取る。commit c928179a でクラス追加時の書き忘れ。他の全 FlowCommand サブクラスには export default がある。try-catch でエラーが握りつぶされるため gate-impl 自体は PASS するが overview 更新が黙って失敗する。

</details>