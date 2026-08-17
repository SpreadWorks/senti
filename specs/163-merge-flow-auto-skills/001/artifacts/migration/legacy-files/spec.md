# Feature Specification: 163-merge-flow-auto-skills

**Feature Branch**: `feature/163-merge-flow-auto-skills`
**Created**: 2026-04-09
**Status**: Draft
**Input**: Issue #122

## Goal

`sdd-forge.flow-auto-on` と `sdd-forge.flow-auto-off` の2スキルを `sdd-forge.flow-auto` に統合し、引数 `on`/`off` で切り替えられるようにする。合わせて `sdd-forge upgrade` で旧スキルを自動クリーンアップする仕組みを導入する。

## Scope

- `src/templates/skills/sdd-forge.flow-auto/SKILL.md` を新規作成
- `src/templates/skills/sdd-forge.flow-auto-on/` と `sdd-forge.flow-auto-off/` を削除
- `src/templates/partials/core-principle.md` の `/sdd-forge.flow-auto-on` 参照を `/sdd-forge.flow-auto` に更新
- `src/lib/skills.js` の `deploySkillsFromDir` に旧スキル自動削除ロジックを追加
- `src/upgrade.js` の出力ログに削除されたスキル名を表示

## Out of Scope

- `sdd-forge flow set auto on/off` CLI コマンド自体の変更
- experimental スキル（`experimental/workflow/templates/skills/`）の扱い変更
- 移行期の grace period・後方互換コード（alpha ポリシーにより不要）

## Clarifications (Q&A)

- Q: 旧スキルのクリーンアップ方法は？
  - A: `upgrade.js` に deprecated リストを持つのではなく、`deploySkillsFromDir` 内で「配置元テンプレートに存在しない `sdd-forge.*` スキル」を自動削除する。メインテンプレートと experimental テンプレート両方のスキル名セットを正として、それ以外を削除対象とする。
- Q: 引数なしの挙動は？
  - A: `on` として扱い、フロー継続（resume）まで行う。現行 `sdd-forge.flow-auto-on` と同じ挙動。
- Q: 引数が `on`/`off` 以外の場合は？
  - A: エラーメッセージ（`Usage: /sdd-forge.flow-auto [on|off]`）を表示して STOP する。

## Alternatives Considered

- `upgrade.js` に deprecated スキルリストを静的定義する案 → テンプレートディレクトリ自体が truth であり、リストのメンテナンスコストが高いため却下。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-09
- Notes: 承認済み

## Requirements

**Priority 1 — Core（スキル統合）**

1. `/sdd-forge.flow-auto` スキルは引数 `on`・`off`・引数なし（`on` として扱う）を受け付ける
2. 引数が `on`/`off` 以外の場合、エラーメッセージを表示して STOP する
3. `on`（または引数なし）の場合、現行の `sdd-forge.flow-auto-on` と同じ手順（フロー確認→autoApprove有効化→フロー継続）を実行する
4. `off` の場合、現行の `sdd-forge.flow-auto-off` と同じ手順（autoApprove無効化→確認表示）を実行する

**Priority 2 — Core（upgrade クリーンアップ）**

5. `sdd-forge upgrade` 実行時、`.claude/skills/` と `.agents/skills/` のうち「配置元テンプレートに存在しない `sdd-forge.*`」スキルディレクトリを自動削除する
6. experimental スキル（`experimental/` 配下のテンプレートから配置されたもの）は削除対象から除外する
7. `sdd-forge upgrade` のログに削除されたスキル名を表示する

**Priority 3 — Enhancement（参照更新）**

8. `src/templates/partials/core-principle.md` の `/sdd-forge.flow-auto-on` 参照を `/sdd-forge.flow-auto` に更新する

## Acceptance Criteria

- `/sdd-forge.flow-auto` が引数なし・`on`・`off` で正しく動作する
- 不正引数時にエラーメッセージを表示して停止する
- `sdd-forge upgrade` 実行後、`.claude/skills/sdd-forge.flow-auto-on/` と `.claude/skills/sdd-forge.flow-auto-off/` が削除される
- `.claude/skills/sdd-forge.flow-auto/` が作成される
- experimental スキル（`sdd-forge.exp.workflow` 等）が削除されない
- `core-principle.md` のリンクが `/sdd-forge.flow-auto` に更新される

## Test Strategy

- テスト配置: `specs/163-merge-flow-auto-skills/tests/`（この spec の要件検証のみ）
- スキル（SKILL.md）の動作はAIへの指示テキストであり自動テスト不可。手動確認とする
- upgrade クリーンアップロジック（`deploySkillsFromDir` の削除挙動）の動作を検証するスクリプトを `specs/163-merge-flow-auto-skills/tests/` に置く
- `npm test` には含めない理由: このテストは「この spec の要件（旧スキル削除）が正しく実装されているか」を一度確認するためのもの。将来のコード変更でこのテストが壊れたとしても、それは必ずしもバグではない（テンプレート名やディレクトリ構造の変更によって合法的に動作が変わりうる）。長期メンテナンスを前提とする `tests/` には適さない。

## Open Questions

- (none)
