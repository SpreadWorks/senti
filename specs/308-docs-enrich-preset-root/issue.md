When running `senti docs build --verbose` with `coding-rule` / `document` / `senti-plugin` included in the `type` field of `.senti/config.json` in `senti-workflow-plugin`, docs enrich emits a `[presets] resolveChain failed` warning. Investigation result: `runEnrich` in `src/docs/commands/enrich.js` calls `resolveChaptersOrder(type, undefined)`, so the project root is not passed and plugin registry presets cannot be referenced. init/readme uses the `resolveChaptersOrder(type, configChapters, root)` path. Expected: docs enrich should also pass the project root, allowing presets from the plugin registry to resolve without warnings.

<details>
<summary>ja</summary>

docs enrich が plugin registry preset を root 付きで解決しない

senti-workflow-plugin の .senti/config.json type に coding-rule / document / senti-plugin が含まれる状態で senti docs build --verbose を実行すると docs enrich で [presets] resolveChain failed 警告が出る。調査結果: src/docs/commands/enrich.js の runEnrich が resolveChaptersOrder(type, undefined) を呼んでおり、project root が渡らないため plugin registry preset を参照できない。init/readme は resolveChaptersOrder(type, configChapters, root) の経路。期待: docs enrich でも project root を渡し、plugin registry 由来 preset が警告なしに解決される。

</details>