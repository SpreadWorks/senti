# Feature Specification: 128-remove-guardrail-exemption

**Feature Branch**: `feature/128-remove-guardrail-exemption`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #69

## Goal
gate.js の guardrail exemption 機構（二重除外）を廃止する。全 guardrail 記事を AI に渡し、適用外かどうかの判断を AI に委ねる。コードの簡素化と透明性向上が目的。

## Scope
- `src/flow/run/gate.js` の exemption 関連コード削除とプロンプト変更
- 既存テストの exemption 関連テスト削除・更新

## Out of Scope
- spec テンプレートからの `## Guardrail Exemptions` セクション削除（既存 spec に残っていても無視されるだけで害はない）
- SKILL.md への guardrail 判断指示の追加（別タスク 02df で対応）
- draft フェーズへの guardrail 差し込み（別タスク 02df）

## Clarifications (Q&A)
- Q: 全記事を渡すとトークン消費が増えるか？
  - A: exemption で除外される記事は通常0-2件であり、実質的な影響はない。
- Q: 既存 spec の `## Guardrail Exemptions` セクションはどうなるか？
  - A: `extractExemptions()` が削除されるため無視される。既存 spec を修正する必要はない。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-02
- Notes: autoApprove mode

## Requirements

要件は実装順序に沿って番号付けされている。優先順位は R1 > R2 > R3 の順。

### R1: extractExemptions() 削除
`extractExemptions()` 関数を `src/flow/run/gate.js` から削除する。この関数が削除された後、spec テキストからの exemption 抽出は行われなくなる。

### R2: buildGuardrailPrompt() 簡素化
`buildGuardrailPrompt()` から以下を変更する:
- exemption フィルタリング（`extractExemptions()` 呼び出しと `.filter()` による除外）を削除し、全 spec-phase guardrail をプロンプトに含める
- 「Exempted Articles (do NOT check these)」セクションの出力を削除する
- プロンプトに以下の指示を追加する: 「If an article is inapplicable by nature of the spec, mark it as PASS and state the reason.」

### R3: テスト更新
`tests/unit/specs/commands/guardrail.test.js` から以下を変更する:
- `extractExemptions` のインポートと関連テスト（`describe("extractExemptions", ...)` と `describe("buildGuardrailPrompt with exemptions", ...)`）を削除する
- `buildGuardrailPrompt` が全 spec-phase guardrail を含むことを検証するテストを追加する

### 破壊的変更
alpha 版ポリシーにより後方互換コードは不要。以下は破壊的変更としてリリースノートに記載する:
- `extractExemptions()` のエクスポートを削除
- spec の `## Guardrail Exemptions` セクションは gate チェックで無視される

## Acceptance Criteria
- `sdd-forge flow run gate` が exemption なしで全 guardrail をチェックする
- `buildGuardrailPrompt()` が全 spec-phase guardrail をプロンプトに含める
- プロンプトに「適用外なら PASS + 理由」の指示が含まれる
- `extractExemptions` 関数がエクスポートされていない
- 既存テストがパスする

## Open Questions
(none)
