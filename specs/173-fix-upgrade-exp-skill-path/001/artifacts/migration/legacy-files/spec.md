# Feature Specification: 173-fix-upgrade-exp-skill-path

**Feature Branch**: `feature/173-fix-upgrade-exp-skill-path`
**Created**: 2026-04-13
**Status**: Draft
**Input**: GitHub Issue #142

## Goal

`sdd-forge upgrade` 実行時に、experimental スキル（`sdd-forge.exp.workflow`）のテンプレートパスが sdd-forge パッケージディレクトリ基準で解決されるよう修正し、スキルが正しくインストールされるようにする。

## Scope

- `src/upgrade.js` の experimental スキルテンプレートパス解決ロジックの修正

## Out of Scope

- 通常スキルのデプロイロジック（`deploySkills`）— 既に PKG_DIR 基準で正常動作
- experimental スキルの新規追加・機能変更
- config バリデーション（`lib/types.js` の `experimental.workflow` スキーマ）

## Clarifications (Q&A)

- Q: 影響範囲は `upgrade.js:91` のみか？
  - A: はい。`deploySkills` は内部で `MAIN_SKILLS_TEMPLATES_DIR`（PKG_DIR 基準）を使用しており正常。他の `path.join(root, ...templates...)` パターンはプロジェクトローカルテンプレート参照であり正常。
- Q: テスト方針は？
  - A: spec テスト（`specs/<spec>/tests/`）でパス解決の正しさを検証する。

## Alternatives Considered

- **`MAIN_SKILLS_TEMPLATES_DIR` と同様に `skills.js` 内で定数定義する案**: experimental スキルのテンプレートパスは `skills.js` のスコープ外（`experimental/workflow/` 配下）であり、`upgrade.js` 側で解決するのが適切。将来 experimental スキルが増えた場合も `upgrade.js` の config 分岐で管理するのが自然。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-13
- Notes: 承認済み

## Requirements

1. When `config.experimental.workflow.enable === true` and `sdd-forge upgrade` is executed, the experimental skill template path shall be resolved relative to the sdd-forge package directory (`PKG_DIR`), not the project root.
2. The fix shall not alter the behavior of `deploySkills` (standard skill deployment).

## Acceptance Criteria

1. `sdd-forge upgrade` を `experimental.workflow.enable: true` の設定で実行した際、`sdd-forge.exp.workflow` スキルが `.claude/skills/` および `.agents/skills/` にデプロイされること。
2. 通常スキルのデプロイが引き続き正常に動作すること。
3. `expDir` に指定されるパスが実在するディレクトリであること。

## Test Strategy

- **テスト種別**: spec テスト（`specs/173-fix-upgrade-exp-skill-path/tests/`）
- **検証内容**: 修正後の `expDir` パスが PKG_DIR 基準で解決され、実在するディレクトリを指すこと
- **正式テスト（`tests/`）を含めない理由**: `upgrade` コマンドは `deploySkills`/`deployProjectSkills` を組み合わせたオーケストレーション関数であり、内部で使用する `deploySkillsFromDir` は `templatesDir` が存在しない場合に空配列を返す（既存の正常系動作）。今回のバグは呼び出し側のパス組み立てミスであり、`deploySkillsFromDir` 自体の契約は変わらない。「将来この expDir パスが壊れたら常にバグか？」→ No（experimental ディレクトリ構造の変更は意図的に起こりうる）。ユーザーも spec テストで合意済み。

## Open Questions

（なし）
