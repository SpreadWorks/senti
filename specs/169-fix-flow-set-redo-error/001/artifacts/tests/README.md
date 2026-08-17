# Spec 169 Tests

## What was tested
- `flow set redo` が `entry.command is not a function` でクラッシュしないこと
- redo エントリ削除後に非ゼロ終了コードで適切にエラーが返ること

## Test location
- `specs/169-fix-flow-set-redo-error/tests/verify-redo-removed.js`

## How to run
```bash
node specs/169-fix-flow-set-redo-error/tests/verify-redo-removed.js
```

## Expected results
- `flow set redo` は非ゼロ終了コードを返す
- 出力に `entry.command is not a function` を含まない
