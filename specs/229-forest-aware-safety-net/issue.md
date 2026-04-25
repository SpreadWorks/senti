The current safety-net fallback in get-next-action.js (spec 219) recovers using promoteFirstPending (array order), but should use promoteNextPending in forest DFS order. On the normal path, promoteNextPending already sets currentTaskId so there is no issue, but during recovery from manual edits or unfired post-hooks, the order becomes unintentional. Fix cost is small. Remaining work from spec 227 (REQ-B2).

<details>
<summary>ja</summary>

[ENHANCE] get-next-action safety-net fallback を forest-aware にする

現在の get-next-action.js の safety-net fallback (spec 219) は promoteFirstPending（配列順）で回復するが、forest DFS 順の promoteNextPending を使うべき。正常パスでは promoteNextPending が currentTaskId を設定済みなので問題ないが、手動編集や post-hook 未発火からの回復時に意図しない順序になる。修正コスト小。spec 227 (REQ-B2) の残作業。

</details>