# Feature Specification: 144-improve-auto-spec-quality

**Feature Branch**: `feature/144-improve-auto-spec-quality`
**Created**: 2026-04-04
**Status**: Draft
**Input**: GitHub Issue #91
**開発種別:** Enhancement

## Goal

auto mode の self-Q&A で生成される spec の品質を向上させる。draft チェックリストに「代替案の検討」「将来の拡張性」を追加し、Issue 内容が薄い場合のソースコード深読み指示を追加する。

## Scope

- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` の autoApprove mode self-Q&A チェックリストと通常モードの Requirements category checklist の両方に2項目を追加
- 同ファイルに Issue 内容が薄い場合のソースコード深読み指示を追加
- `src/flow/lib/run-prepare-spec.js` の `DEFAULT_SPEC_TEMPLATE` に `## Alternatives Considered` セクションのプレースホルダーを追加（`## Clarifications (Q&A)` と `## User Confirmation` の間に配置）

## Out of Scope

- gate チェックへの新規バリデーション追加
- コードロジックの変更
- 他のスキルテンプレートの変更

## Clarifications (Q&A)

- Q: 追加するチェック項目は？
  - A: 6. Alternatives considered — 他のアプローチを検討し、選択理由を説明する。7. Future extensibility — 将来の拡張・変更への影響を考慮する。

- Q: Issue 内容が薄い場合の判断基準は？
  - A: Issue 本文が200文字未満の場合。AI の判断目安であり、ハードコードされたバリデーションではない。

## Alternatives Considered

- **SKILL.md のみ変更し DEFAULT_SPEC_TEMPLATE は変更しない案**: AI が毎回セクションを動的に挿入する必要があり、一貫性が損なわれる。テンプレートにプレースホルダーを含めることで発見性と一貫性を確保する。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-04
- Notes: auto mode

## Requirements

1. (P1) `src/templates/skills/sdd-forge.flow-plan/SKILL.md` の autoApprove mode self-Q&A チェックリストに「6. Alternatives considered」と「7. Future extensibility」の2項目を追加する。
2. (P1) 同ファイルの通常モード Requirements category checklist にも同じ2項目を追加する。
3. (P2) autoApprove mode セクションに「Issue 本文が200文字未満の場合、関連ソースコードファイルを直接 Read してより深く理解する」指示を追加する。
4. (P2) `src/flow/lib/run-prepare-spec.js` の `DEFAULT_SPEC_TEMPLATE` に `## Alternatives Considered` セクションを `## Clarifications (Q&A)` と `## User Confirmation` の間に追加する（`-` プレースホルダー付き。`TBD`・`TODO` はプレースホルダーに使用しない — `checkSpecText` が全行で `TBD`/`TODO` パターンを検出し gate 失敗の原因となるため）。

## Acceptance Criteria

1. autoApprove mode チェックリストに Alternatives considered と Future extensibility が含まれること（既存5項目: Goal & Scope, Impact on existing features, Constraints & dependencies, Edge cases, Test strategy に2項目追加し計7項目）
2. 通常モードチェックリストに同じ2項目が含まれること（既存5項目: Goal & Scope, Impact on existing features, Constraints & dependencies, Edge cases, Test strategy に2項目追加し計7項目）
3. ソースコード深読み指示が追加されていること
4. `DEFAULT_SPEC_TEMPLATE` に `## Alternatives Considered` セクションのプレースホルダーが含まれること
5. `sdd-forge upgrade` でプロジェクトに反映されること
6. `npm test` が全 PASS すること

## Test Strategy

- `sdd-forge upgrade` の正常実行で SKILL.md テンプレートがプロジェクトに反映されることを検証
- `npm test` で既存テストの回帰がないことを確認
- spec 固有テスト: `grep` で変更後の SKILL.md に "Alternatives considered" と "Future extensibility" が含まれることを検証（`specs/<spec>/tests/` に配置）
- **既存テスト `specs/110-auto-mode-flow-start-and-skill-transitions/tests/verify-skill-templates.test.js`**: このテストは flow-plan の SKILL.md を読み取り `autoApprove` や `flow-impl` キーワードの存在を検証する。現在のアサーションは本変更で破壊されない。さらに、新規チェックリスト項目（"Alternatives considered", "Future extensibility"）の存在を検証するアサーションを追加し、将来のリグレッションを防止する。

## Existing Feature Impact

- **auto mode**: draft 品質が改善される（代替案と拡張性を検討）
- **通常モード**: チェックリストが充実する（ガイドとして使用）
- **gate チェック**: 変更なし。`checkSpecText` は `## Alternatives Considered` を必須セクションとして検証しないため影響なし。プレースホルダーに `TBD`/`TODO` を含めないことで、全行 `TBD`/`TODO` パターンチェックも回避される。
- **既存テスト**: 影響なし
- **`changelog.js` の `parseSpecFile()`**: spec ファイルからタイトル・ステータス・日付のメタデータのみを読み取るため、`## Alternatives Considered` セクションの追加による影響はない。
- **ローカルテンプレートオーバーライド**: `loadLocalTemplate` は `.sdd-forge/templates/<lang>/specs/spec.md` にローカルオーバーライドが存在する場合 `DEFAULT_SPEC_TEMPLATE` を無視する。ローカルテンプレートを使用しているプロジェクトでは `## Alternatives Considered` セクションが自動で含まれないため、オーバーライドを手動更新する必要がある。`sdd-forge upgrade` はスキル・設定ファイルの差分を検出・更新するが、ローカル spec テンプレートはユーザーがカスタマイズした資産であるため自動上書きの対象外である。

## Open Questions
- (none)
