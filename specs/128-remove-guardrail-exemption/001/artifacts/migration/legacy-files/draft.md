# Draft: Remove guardrail exemption mechanism

## Goal
gate.js の exemption（二重除外）を廃止し、全 guardrail を AI に渡して判断させる。

## Decisions
- `extractExemptions()` 関数を削除
- `buildGuardrailPrompt()` から exemption フィルタリングと Exempted Articles セクションを削除
- プロンプトに「spec の性質上その記事が適用外であれば PASS として理由を明記せよ」を追加
- 既存 spec の `## Guardrail Exemptions` セクションは無視されるだけで害はない（削除不要）

## Impact
- `src/flow/run/gate.js`: extractExemptions 削除、buildGuardrailPrompt 簡素化
- テスト: extractExemptions と exemption 関連テストを削除、新しい動作のテスト追加

## Edge Cases
- 全記事を渡すことでトークン消費がわずかに増えるが、exemption で除外される記事は通常0-2件で実質影響なし

## Test Strategy
- `buildGuardrailPrompt` が全 spec-phase guardrail をフィルタなしで渡すことを検証
- exemption セクションがある spec でも全記事が含まれることを検証

- [x] User approved this draft (autoApprove)
