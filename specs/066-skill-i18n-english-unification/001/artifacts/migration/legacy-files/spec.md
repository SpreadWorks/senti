# Feature Specification: 066-skill-i18n-english-unification

**Feature Branch**: `feature/066-skill-i18n-english-unification`
**Created**: 2026-03-17
**Status**: Draft
**Input**: SKILL.md の英語統一と config.lang 翻訳指示の追加。setup.js のモノレポ関連 i18n キー未定義の修正。

## Goal

SKILL.md ファイルのハードコード日本語を英語に統一し、config.lang に応じた翻訳指示を追加する。
setup.js で追加されたモノレポ関連の i18n キーを locale ファイルに定義する。

## Scope

### 1. SKILL.md の英語統一

以下の 4 ファイル（flow-resume は日本語なし）のハードコード日本語を英語に翻訳：
- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` (40 箇所)
- `src/templates/skills/sdd-forge.flow-impl/SKILL.md` (33 箇所)
- `src/templates/skills/sdd-forge.flow-merge/SKILL.md` (22 箇所)
- `src/templates/skills/sdd-forge.flow-status/SKILL.md` (3 箇所)

### 2. config.lang 翻訳指示の追加

各 SKILL.md の先頭（frontmatter 直後）に以下の指示を追加：

```
## Language

Present all user-facing text (choices, questions, explanations, status messages) in the language
specified by `.sdd-forge/config.json` `lang` field. If config.json is not available, use English.
```

### 3. .claude/skills/ への反映

`src/templates/skills/` の変更を `.claude/skills/` にも反映する（sdd-forge 自身の開発用）。

### 4. setup.js モノレポ i18n キーの追加

`src/locale/en/ui.json` と `src/locale/ja/ui.json` に以下のキーを追加：
- `setup.questions.monorepo`
- `setup.choices.monorepo.single`
- `setup.choices.monorepo.mono`
- `setup.messages.monorepoInstructions`

## Out of Scope

- skill テンプレートの多言語ファイル分離（SKILL.en.md / SKILL.ja.md 方式）
- skill の i18n フレームワーク構築
- setup.js のモノレポ機能の拡張

## Design Decisions

### なぜ英語統一 + config.lang 指示か

- マーケットプレイス配布を考慮すると、前処理に依存する i18n 方式は使えない
- 英語ベース + AI 翻訳指示が最も確実で互換性が高い
- 失敗しても英語が表示されるだけで壊れない

## Clarifications (Q&A)

- Q: 翻訳の信頼性は？
  - A: 短いコンテキストでは 95%+、長いコンテキストでは 80-85%。ベストエフォートだが実用的。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-17
- Notes:

## Requirements

1. `src/templates/skills/sdd-forge.flow-plan/SKILL.md` 内のハードコード日本語を英語に翻訳する。`sdd-forge upgrade` 実行時にこのテンプレートがプロジェクトにコピーされる。
2. `src/templates/skills/sdd-forge.flow-impl/SKILL.md` 内のハードコード日本語を英語に翻訳する。
3. `src/templates/skills/sdd-forge.flow-merge/SKILL.md` 内のハードコード日本語を英語に翻訳する。
4. `src/templates/skills/sdd-forge.flow-status/SKILL.md` 内のハードコード日本語を英語に翻訳する。
5. 全 SKILL.md の frontmatter 直後に Language セクションを追加する。このセクションは AI に対して `.sdd-forge/config.json` の `lang` フィールドに従ってユーザー向けテキストを翻訳するよう指示する。
6. この spec の実装コミット時に、`src/templates/skills/` の変更内容を `.claude/skills/` にも手動コピーする。sdd-forge 自身の開発中にスキルが最新状態で動作するようにする。
7. `sdd-forge setup` 実行時に lang=en でモノレポ質問が英語で表示されるよう、`src/locale/en/ui.json` に `setup.questions.monorepo`、`setup.choices.monorepo.single`、`setup.choices.monorepo.mono`、`setup.messages.monorepoInstructions` を追加する。
8. `sdd-forge setup` 実行時に lang=ja でモノレポ質問が日本語で表示されるよう、`src/locale/ja/ui.json` に同じキーの日本語訳を追加する。

## Acceptance Criteria

1. 全 SKILL.md にハードコード日本語が含まれない
2. 全 SKILL.md の先頭に Language セクションがある
3. `sdd-forge setup` で lang=en 時にモノレポ質問が英語で表示される
4. `sdd-forge setup` で lang=ja 時にモノレポ質問が日本語で表示される
5. `npm test` が全て PASS する
6. `sdd-forge upgrade` で skill が正しく更新される

## Open Questions

(なし)
