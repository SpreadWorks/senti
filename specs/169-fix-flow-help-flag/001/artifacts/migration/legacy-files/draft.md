# Draft: fix-flow-help-flag

**開発種別:** バグ修正
**目的:** flow サブコマンドの positional-only 経路で `--help`/`-h` が通常引数として解釈され、ヘルプが表示されないバグを修正する

## 背景

`flow get check --help` や `flow set step --help` など、`args` に `positional` のみを定義し `flags`/`options` を持たないコマンドで `--help` がヘルプとして認識されない。

- `parseNoArgEntry`（args なし）は `-h`/`--help` を処理済み
- `splitArgsBySpec`（flags/options あり）は `-h`/`--help` を処理済み
- `parseEntryArgs` の positional-only 経路（L140-146）のみ未対応

## 影響範囲

positional-only コマンド 11 件が影響を受ける:

| グループ | コマンド | positional |
|---|---|---|
| get | check | target |
| get | prompt | kind |
| get | issue | number |
| set | step | id, status |
| set | request | text |
| set | issue | number |
| set | note | text |
| set | summary | json |
| set | req | index, status |
| set | metric | phase, counter |
| set | auto | value |

## 修正方針

`parseEntryArgs` の positional-only 経路で、引数に `-h`/`--help` が含まれている場合は `ctx.help = true` を設定してリターンする。既存の `parseNoArgEntry` や `splitArgsBySpec` と同じパターン。

修正箇所は `src/flow.js` の `parseEntryArgs` 関数内 1 箇所のみ。

## テスト戦略

- CLI 実行（e2e 的）で help 出力を検証
- positional-only コマンド代表で `--help` が exit 0 + help テキスト出力になることを確認
- 既存の正常引数パースが壊れないことを確認

## Q&A

1. **Q: 修正スコープは positional-only 経路の 1 箇所で十分か？**
   A: registry.js の全コマンドを調査し、3 パターン（args なし / flags・options あり / positional のみ）に分類した結果、positional-only 経路のみが未対応。修正は 1 箇所で全 11 コマンドをカバーできる。

2. **Q: help フラグの位置（引数の前後）は考慮不要か？**
   A: 不要。引数配列に `-h`/`--help` が含まれていれば help として扱う方針。

3. **Q: テストは CLI 実行か unit か？**
   A: CLI 実行で help 出力と exit code を検証する。parseEntryArgs は内部関数のため export は不要。

## User Confirmation

- [x] User approved this draft
- Date: 2026-04-13
