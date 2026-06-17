## Goal

After installing or updating plugins with `senti plugin install` / `senti plugin update-all`, automatically run `senti upgrade` when needed, so that applying plugin-provided skills / presets / templates / AGENTS can be completed as a single flow.

## Background

Currently, `senti plugin update-all` updates `plugin.packages[].commit` in `.senti/config.json` and `.senti/plugins/<id>`, but applying skills / presets / templates and other items expanded into the project still requires running `senti upgrade` separately.

From the user's perspective, once they have "updated a plugin," it is natural to expect the available features provided by that plugin to also be updated. If the process stops at `plugin update-all`, it can easily leave the project in a half-updated state where the plugin has been fetched but not applied.

## Scope

- Automatically run `senti upgrade` after `senti plugin install <id>` succeeds
- Automatically run `senti upgrade` after `senti plugin update-all` succeeds, when at least one package was actually updated
- Exclude `senti plugin source update`
  - This resolves and updates sources, and is not an operation that updates the pinned commit of an installed package
- Exclude `senti plugin sync`
  - This is intended for re-materializing / restoring pinned commits, and implicitly running upgrade would broaden its responsibility
- Add `--no-upgrade` to suppress automatic upgrade
- In `--json` output, return both the plugin update result and upgrade execution result in a structured format

## Proposed Behavior

### install

1. Install the plugin package
2. After installation succeeds, run `senti upgrade` by default
3. Do not run upgrade when `--no-upgrade` is specified

### update-all

1. Run `senti upgrade` by default only when a package's resolved commit changed
2. Skip upgrade if there are no updates
3. Do not run upgrade when `--no-upgrade` is specified

### source update

- Do not run upgrade

### sync

- Do not run upgrade

## Options

- `--no-upgrade`
  - Suppresses automatic `senti upgrade` after plugin install/update-all
  - Used for cases where only CI or the plugin runtime should be synced

## JSON Output

Example:

```json
{
  "packages": [
    {
      "id": "workflow",
      "source": "workflow-source",
      "previousCommit": "old...",
      "commit": "new...",
      "updated": true
    }
  ],
  "upgrade": {
    "ran": true,
    "ok": true
  }
}
```

## Acceptance

- `senti upgrade` is automatically run after `senti plugin install <id>`
- `senti upgrade` is automatically run when one or more package commits changed during `senti plugin update-all`
- `senti upgrade` is not run when there are no updates during `senti plugin update-all`
- `senti upgrade` is not run for `senti plugin source update`
- `senti upgrade` is not run for `senti plugin sync`
- Automatic upgrade is not run when `--no-upgrade` is specified
- `--json` output makes it possible to distinguish the plugin update result and upgrade execution result
- If upgrade fails, the response shows both the plugin update result and the upgrade failure
- Existing basic behavior of plugin install / plugin update-all / plugin sync is not broken

## Non-goals

- Do not change the internal behavior of `senti upgrade` itself
- Do not make `plugin source update` a package commit update command
- Do not make `plugin sync` a command that automatically runs upgrade
- Do not perform npm publish or external release operations

<details>
<summary>ja</summary>

[ENHANCE] plugin install/update-all 後に必要な upgrade を自動実行する

## Goal

`senti plugin install` / `senti plugin update-all` でプラグインを導入・更新したあと、必要に応じて `senti upgrade` まで自動実行し、プラグイン由来の skills / presets / templates / AGENTS 反映まで一連の操作で完了するようにする。

## Background

現在は `senti plugin update-all` により `.senti/config.json` の `plugin.packages[].commit` と `.senti/plugins/<id>` は更新されるが、プロジェクト側へ展開される skill / preset / template などの反映は別途 `senti upgrade` が必要になる。

ユーザー視点では「プラグインを更新した」時点で、そのプラグイン由来の利用可能機能も更新済みであることを期待しやすい。`plugin update-all` だけで止まると、取得済みだが反映されていない中途半端な状態になりやすい。

## Scope

- `senti plugin install <id>` 成功後に `senti upgrade` を自動実行する
- `senti plugin update-all` で実際に更新された package がある場合、成功後に `senti upgrade` を自動実行する
- `senti plugin source update` は対象外にする
  - source の解決・更新であり、installed package の pinned commit を更新する操作ではないため
- `senti plugin sync` は対象外にする
  - pinned commit の再 materialize / 復元用途であり、upgrade まで暗黙実行すると責務が広がるため
- 自動 upgrade を抑止する `--no-upgrade` を追加する
- `--json` 出力では plugin 更新結果と upgrade 実行結果を構造化して返す

## Proposed Behavior

### install

1. plugin package を導入する
2. 導入成功後、デフォルトで `senti upgrade` を実行する
3. `--no-upgrade` 指定時は upgrade を実行しない

### update-all

1. package の resolved commit が変わった場合のみ、デフォルトで `senti upgrade` を実行する
2. 更新対象がなければ upgrade はスキップする
3. `--no-upgrade` 指定時は upgrade を実行しない

### source update

- upgrade は実行しない

### sync

- upgrade は実行しない

## Options

- `--no-upgrade`
  - plugin install/update-all 後の自動 `senti upgrade` を抑止する
  - CI や plugin runtime だけ同期したいケースで使う

## JSON Output

例:

```json
{
  "packages": [
    {
      "id": "workflow",
      "source": "workflow-source",
      "previousCommit": "old...",
      "commit": "new...",
      "updated": true
    }
  ],
  "upgrade": {
    "ran": true,
    "ok": true
  }
}
```

## Acceptance

- `senti plugin install <id>` 後に `senti upgrade` が自動実行される
- `senti plugin update-all` で 1 件以上の package commit が変わった場合に `senti upgrade` が自動実行される
- `senti plugin update-all` で更新がない場合は `senti upgrade` を実行しない
- `senti plugin source update` では `senti upgrade` を実行しない
- `senti plugin sync` では `senti upgrade` を実行しない
- `--no-upgrade` 指定時は自動 upgrade を実行しない
- `--json` 出力で plugin 更新結果と upgrade 実行結果を判別できる
- upgrade が失敗した場合、plugin 更新結果と upgrade 失敗が分かる形で返る
- 既存の plugin install / plugin update-all / plugin sync の基本挙動を壊さない

## Non-goals

- `senti upgrade` の内部仕様自体は変更しない
- `plugin source update` を package commit 更新コマンドにはしない
- `plugin sync` を自動 upgrade 実行コマンドにはしない
- npm publish や外部リリース操作は行わない

</details>