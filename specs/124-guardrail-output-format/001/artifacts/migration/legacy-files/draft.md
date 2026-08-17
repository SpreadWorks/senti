# Draft: Improve output format of `flow get guardrail`

## Goal
`flow get guardrail <phase>` のデフォルト出力を Markdown に変更し、AI が制約として認識しやすい形式にする。`--format json` で従来の JSON 出力も可能にする。

## Decisions

### Markdown フォーマット
```markdown
## Guardrail: No Hardcoded Secrets

Source code shall not contain API keys, passwords, tokens...

## Guardrail: No Silent Error Swallowing

Empty catch blocks or code that silently discards errors...
```

- title + body のみ。meta 情報（phase, scope, lint）は含めない
- フェーズフィルタリングは `flow get guardrail <phase>` で済んでいるため、出力時点では不要

### デフォルト出力の変更
- デフォルト: Markdown（JSON envelope なし、プレーンな Markdown テキスト）
- `--format json`: 従来の JSON envelope 出力

### 既存の呼び出し元への影響
- SKILL.md（flow-plan, flow-impl）: 修正不要。出力フォーマットに依存していない。Markdown になることでむしろ AI が直接読みやすくなる
- gate.js: `loadMergedGuardrails()` を直接呼んでおり、`flow get guardrail` コマンド経由ではない。影響なし
- lint.js: 同上。影響なし

### SKILL.md
- 修正不要

## Scope
- `src/flow/get/guardrail.js` の出力形式変更のみ
- exemption 廃止（0fa0）、draft 差し込み（02df）は別タスク

- [x] User approved this draft (2026-04-02)
