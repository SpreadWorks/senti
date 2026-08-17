# Tests for spec #136: Fix review command bugs

## What was tested and why

review コマンドの3つのバグ修正を検証する:
1. spec review の fix 出力バリデーション（isValidSpecOutput）
2. parseTestReviewOutput / parseSpecReviewOutput のエラーメッセージ品質
3. buildTestFixPrompt の Object.freeze ガイダンス

## Where tests are located

- `specs/136-fix-review-cmd-bugs/tests/review-bugs.test.js`

## How to run

```bash
node --test specs/136-fix-review-cmd-bugs/tests/review-bugs.test.js
```

## Expected results

- isValidSpecOutput が正常な spec を受け入れ、ゴミテキスト・空文字列を拒否すること
- パーサーが gaps/issues をパースできない場合に "0 gap(s)" と表示しないこと
- buildTestFixPrompt が Object.freeze に関するガイダンスを含むこと
