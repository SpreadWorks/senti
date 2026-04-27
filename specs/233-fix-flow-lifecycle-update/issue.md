All 12 spec flow.json files are left with lifecycle: active, finalize: in_progress.
The actual branches have all been merged into main and deleted.
The process that updates lifecycle to completed after finalize is done may not be running.

<details>
<summary>ja</summary>

[BUG] flow lifecycle 不整合の修正

全12 specの flow.json が lifecycle: active, finalize: in_progress のまま放置されている。
実際のブランチは全て main にマージ済みでブランチも削除済み。
finalize 完了後に lifecycle を completed に更新する処理が動いていない可能性がある。

</details>