# Tests for 138-symfony-guardrails

## What was tested

- `VALID_PHASES` に `"review"` が含まれること（phases.js の変更）
- `filterByPhase` が review フェーズで正しくフィルタすること
- Symfony guardrail.json に38件（既存4 + 新規34）が含まれること
- coding-rule guardrail.json に5件（既存3 + 新規2）が含まれること
- 既存 guardrail が維持されていること
- ja/en の id が一致していること
- UX 系 guardrail の body に条件前置があること
- NOTICE ファイルが存在し出典3件を含むこと

## Where tests are located

- **Formal test**: `tests/unit/flow/phases-review.test.js` — phases.js の公開 API テスト
- **Spec test**: `specs/138-symfony-guardrails/tests/guardrail-content.test.js` — guardrail 内容の検証

## How to run

```bash
# formal test (npm test に含まれる)
node --test tests/unit/flow/phases-review.test.js

# spec test
node --test specs/138-symfony-guardrails/tests/guardrail-content.test.js
```

## Expected results

全テストが PASS すること。テスト失敗時は guardrail.json の件数・id・フォーマットを確認する。
