# Feature Specification: 124-guardrail-output-format

**Feature Branch**: `feature/124-guardrail-output-format`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #67

## Goal
`flow get guardrail <phase>` のデフォルト出力を JSON envelope から Markdown に変更し、AI が制約として直接認識しやすい形式にする。`--format json` で従来の JSON envelope 出力も可能にする。

## Scope
- `src/flow/get/guardrail.js` の出力形式変更
- `--format` オプションの追加

## Out of Scope
- exemption 廃止（別タスク 0fa0）
- draft フェーズへの guardrail 差し込み（別タスク 02df）
- guardrail.json のデータ構造変更（#63 で完了済み）
- SKILL.md の変更（フォーマットに依存していないため不要）

## Clarifications (Q&A)
- Q: Markdown 出力に meta 情報（phase, scope, lint）を含めるか？
  - A: 含めない。フェーズフィルタリングは `flow get guardrail <phase>` で済んでおり、出力時点では title + body で十分。
- Q: デフォルトを Markdown に変えると既存の呼び出し元が壊れるか？
  - A: gate.js と lint.js は `loadMergedGuardrails()` を直接呼んでおり `flow get guardrail` コマンド経由ではない。SKILL.md は出力フォーマットに依存していない。影響なし。
- Q: SKILL.md の記述を修正する必要があるか？
  - A: 不要。「Load guardrail articles...」「If output is non-empty, consider these principles...」であり、フォーマットに依存していない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: Gate PASS 後に承認

## Requirements

要件は実装順序に沿って番号付けされている。優先順位は R1 > R2 > R3 の順。

### R1: Markdown 出力実装
`flow get guardrail <phase>` を実行した場合、デフォルトでは以下のフォーマットの Markdown テキストを標準出力に出力する（JSON envelope なし）:
```markdown
## Guardrail: <title>

<body>

## Guardrail: <title>

<body>
```
- guardrail が 0 件の場合、空文字列を出力する
- meta 情報（phase, scope, lint）は出力に含めない

### R2: `--format json` オプション
`flow get guardrail <phase> --format json` を実行した場合、従来通りの JSON envelope を出力する:
```json
{
  "ok": true,
  "type": "get",
  "key": "guardrail",
  "data": {
    "phase": "...",
    "count": N,
    "guardrails": [...]
  }
}
```
- `--format` が未指定またはそれ以外の値の場合は Markdown 出力（R1）

### R3: エラー出力
phase が未指定または無効な場合、`--format` の値に関わらず JSON envelope でエラーを返す（既存動作を維持）。

### 破壊的変更
alpha 版ポリシーにより後方互換コードは不要。以下は破壊的変更としてリリースノートに記載する:
- `flow get guardrail <phase>` のデフォルト出力が JSON から Markdown に変更

## Acceptance Criteria
- `sdd-forge flow get guardrail spec` が Markdown フォーマットのテキストを出力する
- `sdd-forge flow get guardrail spec --format json` が従来の JSON envelope を出力する
- guardrail が 0 件の場合、Markdown モードでは空文字列を出力する
- 無効な phase を指定した場合、JSON エラーを返す
- 既存テストがパスする

## Open Questions
(none)
