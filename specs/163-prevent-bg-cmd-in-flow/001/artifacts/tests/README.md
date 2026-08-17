# Spec Verification Tests: 163-prevent-bg-cmd-in-flow

## What was tested

`src/templates/partials/core-principle.md` に、sdd-forge コマンドがバックグラウンドに移行した場合の待機義務 MUST ルールが追記されたことを検証する。

既存の「NEVER chain or background」ルール（禁止規定）とは別に、「移行してしまった場合は完了まで待機する」という条件付き待機義務が追加されたかどうかを確認する。

## Test location

`specs/163-prevent-bg-cmd-in-flow/tests/verify-core-principle.js`

## How to run

```bash
node specs/163-prevent-bg-cmd-in-flow/tests/verify-core-principle.js
```

## Expected results

実装後は 3 件すべて PASS:

1. `core-principle.md` に「if/when background occurs」の条件分岐的な記述がある
2. 「完了通知を受け取るまで待機する」という待機義務の記述がある
3. 特定のサブコマンドではなく `sdd-forge` コマンド全般を対象としている
