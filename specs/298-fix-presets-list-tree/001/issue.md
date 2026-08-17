Even after selecting and installing official presets during setup, `senti presets list` does not read the project plugin registry and only displays the built-in `PRESETS`, causing the presets tree to appear broken with only `base`. The setup candidate and runtime resolver can resolve presets such as `nextjs` as `base > webapp > js-webapp > nextjs`, so the `presets list` side should support `projectRoot`/plugin registry. Reproduction: in a temporary project after running `setup --type nextjs`, `node src/senti.js presets list` only outputs `base`. Expected: display the inheritance tree including the `official-presets` installed during setup.

<details>
<summary>ja</summary>

[BUG] setup後のpresetsツリー表示がbaseだけになる

setup で official presets を選択・導入した後も、senti presets list が project plugin registry を読まず builtin PRESETS だけを表示するため、presets のツリーが base のみ崩れて見える。setup candidate と runtime resolver は nextjs などを base > webapp > js-webapp > nextjs と解決できるため、presets list 側を projectRoot/plugin registry 対応にする。再現: setup --type nextjs 後の一時プロジェクトで node src/senti.js presets list が base しか出さない。期待: setup で導入済みの official-presets を含む継承ツリーを表示する。

</details>