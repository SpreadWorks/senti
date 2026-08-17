# Draft: Document gate-draft format requirements in skill (#85)

**開発種別:** ドキュメント改善

**目的:** gate-draft が検出する必須フィールド（開発種別・目的）のフォーマット要件をスキルテンプレートに文書化し、draft フェーズでの不要な gate FAIL を防止する。

## Q&A

### Q1: 何を変更するか？
A: `src/templates/skills/sdd-forge.flow-plan/SKILL.md` の draft フェーズ（step 4）に、gate-draft が要求するフォーマットの説明を追加する。

### Q2: gate-draft が要求するフォーマットは？
A: `checkDraftText` (run-gate.js) が以下のパターンで検出:
- `**開発種別:** ...` or `**Development Type:** ...`（ラベル + コロン形式）
- `**目的:** ...` or `**Goal:** ...`（ラベル + コロン形式）
見出し形式（`## 開発種別`）では検出されない。

### Q3: テストは必要か？
A: テンプレート（.md ファイル）の変更のみ。コードの変更はなく、テスト不要。ただしテンプレート変更後に `sdd-forge upgrade` が必要。

- [x] User approved this draft (autoApprove)
