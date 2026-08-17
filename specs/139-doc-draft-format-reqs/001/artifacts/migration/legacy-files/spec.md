# Feature Specification: 139-doc-draft-format-reqs

**Feature Branch**: `feature/139-doc-draft-format-reqs`
**Created**: 2026-04-04
**Status**: Draft
**Input**: GitHub Issue #85

## Goal

gate-draft が検出する必須フィールド（開発種別・目的・Q&A 見出し・承認チェックボックス）のフォーマット要件を flow-plan スキルテンプレートに文書化し、draft フェーズでの不要な gate FAIL を防止する。

## Scope

- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` — draft フェーズの手順に必須フィールドのフォーマット説明を追加
- `.claude/skills/` および `.agents/skills/` 配下の同名ファイルはソーステンプレートからの派生成果物であり、`sdd-forge upgrade` で自動更新される。独立して編集しない。

## Out of Scope

- `checkDraftText` のロジック変更（コード変更なし）
- gate-draft の検出パターン変更
- 他のスキルテンプレート

## Clarifications (Q&A)

- Q: どこに追記するか？
  - A: Step 4 (Draft phase) の autoApprove self-Q&A セクション。`Write the completed draft to draft.md` の前に、必須フィールドのフォーマット要件を記載する。

- Q: テストは必要か？
  - A: テンプレート（.md ファイル）の変更のみでコード変更なし。テスト不要。仕様にその理由を明記する。

- Q: `.claude/skills/` や `.agents/skills/` の差分はどう扱うか？
  - A: これらはソーステンプレート（`src/templates/skills/`）から `sdd-forge upgrade` で生成される派生成果物である。レビュー時にソースとの差分が表示されるが、独立して編集しない。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-04
- Notes: autoApprove mode

## Requirements

1. When flow-plan スキルテンプレートの draft フェーズ（step 4、autoApprove self-Q&A セクション）に、gate-draft (`checkDraftText`) が要求する全4必須フィールドのフォーマット要件を追加する。具体的には:
   - `**開発種別:** ...` — ラベル+コロンの太字形式が必要。見出し形式（`## 開発種別`）では検出されない。
   - `**目的:** ...` — ラベル+コロンの太字形式が必要。見出し形式（`## 目的`）では検出されない。
   - `## Q&A` — `##` レベルの見出しが必要（正規表現: `/##\s+Q&A/i`）。`###` やインラインテキストでは検出されない。
   - `- [x] User approved this draft` — チェック済みチェックボックスの正確な構文が必要。
2. When autoApprove セクションおよび非 autoApprove セクションの両方で、AI がドラフト出力にこれらの必須フィールドを含めるよう明示的に指示する。ドラフトの期待構造（必須フィールドの配置例）を示し、フォーマット要件の文書化だけでなくフィールド自体の出力漏れも防止する。
3. `src/templates/skills/sdd-forge.flow-plan/SKILL.md` のソーステンプレートを変更する。プロジェクトのスキルへの反映は `sdd-forge upgrade` で行うが、これはランタイム操作であり git diff には含まれない。

## Acceptance Criteria

- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` の draft フェーズセクションに、開発種別・目的・Q&A 見出し・承認チェックボックスの4フィールドすべてのフォーマット要件が記載されていること
- autoApprove / 非 autoApprove の両セクションで、AI がドラフトにこれらのフィールドを含めるよう指示されていること
- ソーステンプレート `src/templates/skills/sdd-forge.flow-plan/SKILL.md` が変更されていること

## Test Strategy

テンプレート（.md ファイル）の変更のみでコード変更がないため、自動テストは不要。`sdd-forge upgrade` による反映を手動確認する。

## Open Questions

None.
