**開発種別:** 機能改善（スキル統合）

**目的:** `sdd-forge.flow-auto-on` と `sdd-forge.flow-auto-off` の2スキルを `sdd-forge.flow-auto` に統合し、引数で on/off を切り替えられるようにする。合わせて `sdd-forge upgrade` で旧スキルを自動クリーンアップする仕組みを導入する。

## 背景

現在、autoApprove の有効化・無効化に2つの独立したスキルが存在する。
これを1スキルに統合することで、ユーザーの操作を単純化し、スキルの管理コストを下げる。

## スコープ

- `src/templates/skills/sdd-forge.flow-auto/SKILL.md` を新規作成
- `src/templates/skills/sdd-forge.flow-auto-on/` と `sdd-forge.flow-auto-off/` を削除
- `src/templates/partials/core-principle.md` の参照を更新（`/sdd-forge.flow-auto-on` → `/sdd-forge.flow-auto`）
- `src/lib/skills.js` の `deploySkillsFromDir` に旧スキル自動削除ロジックを追加
- `src/upgrade.js` の出力（ログ）に削除されたスキル名を表示

## スコープ外

- `sdd-forge flow set auto on/off` CLI コマンド自体の変更なし
- experimental スキル（`experimental/workflow/templates/skills/`）の扱い変更なし

## Q&A

**Q1: 旧スキル（`flow-auto-on` / `flow-auto-off`）のクリーンアップ方法は？**
A: `upgrade.js` に deprecated リストを持つのではなく、`deploySkillsFromDir` 内で「メインテンプレートに存在しない `sdd-forge.*` スキルを削除する」ロジックを追加する。削除対象の判定は：
- `.claude/skills/` と `.agents/skills/` にある `sdd-forge.*` ディレクトリのうち
- メインテンプレート（`src/templates/skills/`）に存在しない、かつ
- experimental テンプレート（`experimental/workflow/templates/skills/` 等、upgrade 時に別途渡される）にも存在しないもの

→ `deploySkills` はメインテンプレートの skill 名セットを返すので、呼び出し側（upgrade.js）でそれを使って削除を判断する設計が自然。あるいは `deploySkillsFromDir` にすべての有効テンプレートディレクトリを渡す形に変更する。

**Q2: 引数なし（`/sdd-forge.flow-auto` のみ）の挙動は？**
A: `on` として扱い、フロー継続（resume）まで行う。現行 `sdd-forge.flow-auto-on` と同じ挙動。

**Q2-b: 引数が `on`/`off` 以外の不正値の場合は？**
A: エラーメッセージ（「Usage: /sdd-forge.flow-auto [on|off]」）を表示して STOP する。

**Q3: テスト戦略は？**
A: `specs/163-merge-flow-auto-skills/tests/` のみ（スキルの動作確認は手動）。

## 影響範囲

- `src/templates/skills/` — 2ディレクトリ削除、1ディレクトリ追加
- `src/templates/partials/core-principle.md` — 参照更新
- `src/lib/skills.js` — クリーンアップロジック追加
- `src/upgrade.js` — 出力メッセージ更新（削除スキル名を表示）
- 既存ユーザー: `sdd-forge upgrade` 実行後、旧スキルが自動削除される

## マイグレーション

本プロジェクトは alpha ポリシー（後方互換コードを書かない）を採用しているため、移行期の grace period は設けない。
`sdd-forge upgrade` 実行後、`/sdd-forge.flow-auto-on` および `/sdd-forge.flow-auto-off` は利用不可となる。
移行先: `/sdd-forge.flow-auto [on|off]`（引数なしは `on` 扱い）。
upgrade の出力ログに削除されたスキル名を表示し、ユーザーに変更を通知する。

---

- [x] User approved this draft
