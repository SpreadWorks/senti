When running `flow run tests`, if the baseline has not been retrieved yet, automatically acquire it using a detached worktree at the base commit. Remove the automatic execution of B.5 and ensure that costs are only incurred when the user explicitly chooses to run tests.

<details>
<summary>ja</summary>

[ENHANCE] テストベースラインの lazy 取得

flow run tests 実行時に baseline が未取得なら、自動的に base commit の detached worktree でベースラインを取得する。B.5 の自動実行を廃止し、テスト実行を選択した時だけコストが発生するようにする。

</details>