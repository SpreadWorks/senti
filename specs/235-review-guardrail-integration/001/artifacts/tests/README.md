# Spec 235 Tests — Review Guardrail Integration

## What was tested

`buildDraftSystemPrompt` の guardrail 注入機能:
- 引数なし呼び出しで既存動作を維持すること
- 空配列で既存動作を維持すること
- guardrail 配列を渡した場合に id, title, body がプロンプトに含まれること
- 既存の 5 つのレビュー観点が guardrail 注入後も維持されること

## Test location

`specs/235-review-guardrail-integration/tests/review-guardrail.test.js`

## How to run

```bash
node --test specs/235-review-guardrail-integration/tests/review-guardrail.test.js
```

## Expected results

All tests pass. Tests will fail initially (before implementation) because `buildDraftSystemPrompt` does not yet accept a guardrails parameter.
