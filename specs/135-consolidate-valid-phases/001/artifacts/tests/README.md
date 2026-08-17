# Tests for spec #135: Consolidate VALID_PHASES

## What was tested and why

VALID_PHASES が3つのファイルにそれぞれ独立定義されドリフトしていた問題（#79）の修正を検証する。
共有定数の内容、各コマンドのフェーズ受け入れ、REVIEW_PHASES の subset 制約をテストする。

## Where tests are located

- `specs/135-consolidate-valid-phases/tests/phases.test.js`

## How to run

```bash
node --test specs/135-consolidate-valid-phases/tests/phases.test.js
```

## Expected results

- VALID_PHASES が `["draft", "spec", "gate", "impl", "test", "lint"]` であること
- VALID_PHASES が Object.freeze されていること
- get-guardrail が全 VALID_PHASES を受け入れ、不正フェーズを拒否すること
- set-metric が全 VALID_PHASES を受け入れ、不正フェーズを拒否すること
- REVIEW_PHASES のキーが全て VALID_PHASES に含まれること
