## Symptom
In the `senti setup` preset selection, only `base` (Base shared) is shown, and official presets such as `node-cli`, `webapp`, and `cakephp2` do not appear as options.

## Investigation Notes
- `src/setup.js:282` uses `buildTreeItems(PRESETS)`.
- In `src/lib/presets.js`, `PRESETS = CORE_PRESETS`, and currently the only core preset bundled in `src/presets` is `base`.
- Official presets come from the plugin registry, and by design `loadPluginRegistry(root).presets` contains presets from `official-presets`.
- However, during a new setup, `.senti/config.json` / `.senti/plugins` do not exist yet, so `loadPluginRegistry()` returns empty.
- Enabling the official preset plugin happens through the `ensureOfficialPackage` path on the upgrade side, and has not run before setup displays the candidate list.

## Proposed Fix Direction
For existing projects, use a preset list that includes the plugin registry as the setup choices. For new setup, add a path that resolves and bootstraps the official preset source before building the candidate list. Note that simply replacing `PRESETS` will not fix new setup.

<details>
<summary>ja</summary>

[BUG] setup のプリセット選択に base しか表示されない

## 現象
senti setup のプリセット選択で base (Base shared) しか表示されず、公式プリセット（node-cli, webapp, cakephp2 など）が候補に出ない。

## 調査メモ
- src/setup.js:282 が buildTreeItems(PRESETS) を使っている。
- src/lib/presets.js では PRESETS = CORE_PRESETS で、現在 src/presets に同梱される core preset は base のみ。
- 公式プリセットは plugin registry 由来で、loadPluginRegistry(root).presets には official-presets 由来の preset が入る設計。
- ただし新規 setup 時点では .senti/config.json / .senti/plugins がまだ無く、loadPluginRegistry() は空になる。
- 公式 preset plugin の有効化は upgrade 側の ensureOfficialPackage 経路にあり、setup の候補表示前には走っていない。

## 修正方針案
既存プロジェクトでは plugin registry を含む preset 一覧を setup の選択肢に使う。新規 setup では公式 preset source を解決・bootstrap してから候補を作る経路を追加する。単純に PRESETS を置き換えるだけでは新規 setup が直らない点に注意。

</details>