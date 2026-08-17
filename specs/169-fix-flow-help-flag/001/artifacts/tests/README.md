# Tests: 169-fix-flow-help-flag

## What was tested and why

`--help`/`-h` フラグが positional-only の flow サブコマンド（`get check`, `set step` 等）で正しく help を表示するかを検証する。Issue #135 のバグ修正の受け入れテスト。

## Test files

- `help-flag.test.js` — CLI 実行で help 出力と exit code を検証

## How to run

```bash
node --test specs/169-fix-flow-help-flag/tests/help-flag.test.js
```

## Expected results

- 全 positional-only コマンド（11 件）で `--help` が exit 0 + usage テキスト出力
- `-h` ショートハンドも同様に動作
- 通常の positional 引数パースに影響なし（regression テスト）
