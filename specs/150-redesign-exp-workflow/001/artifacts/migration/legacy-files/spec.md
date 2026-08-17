# Feature Specification: 150-redesign-exp-workflow

**Feature Branch**: `feature/150-redesign-exp-workflow`
**Created**: 2026-04-06
**Status**: Draft
**Input**: GitHub Issue #102

## Goal

experimental workflow を常駐ルールではなくコマンドと skill 中心で運用できるよう再設計する。具体的には：

1. `experimental/workflow/board.js` を `experimental/workflow.js` に置き換え、`src/flow.js` と同じ dispatcher パターンに統一する
2. CLAUDE.md のタスク管理セクション（約30行の MUST ルール）を skill に移行する
3. config.json に `experimental.workflow` 設定を追加し、types.js で検証する
4. `to-issue` コマンドを `publish` に置き換え、source/publish の言語概念を導入する

## Scope

### CLI 再編
- `experimental/workflow/board.js` を削除し、`experimental/workflow.js` を新設する
- `src/flow.js` と同じ dispatcher + registry パターンを採用する
- サブコマンド: `add`, `update`, `show`, `search`, `list`, `publish`
- 各コマンドは `experimental/workflow/lib/` に class ベースで実装する
- 出力は JSON envelope 形式に統一する

### config 設定
- config.json に `experimental.workflow` セクションを追加する：
  ```json
  {
    "experimental": {
      "workflow": {
        "enable": true,
        "languages": {
          "source": "ja",
          "publish": "en"
        }
      }
    }
  }
  ```
- `experimental.workflow.enable` が `true` の場合のみ workflow 機能を有効にする
- `languages.source` 未設定時は `config.lang` を使う
- `languages.publish` 未設定時は `config.lang` を使う
- `src/lib/types.js` の `validateConfig()` に `experimental.workflow` の検証を追加する

### コマンド仕様

**add**: ボードにアイテムを追加する
- `--status` オプション（デフォルト: `Ideas`）
- `--category` オプション（`RESEARCH`, `BUG`, `ENHANCE`, `OTHER`）。指定時はタイトルに `[分類]` を付与する。未指定時はタグなし
- `--body` オプションでボディを指定する
- ハッシュID（4文字16進数）をタイトルに prefix する

**update**: 既存アイテムを更新する
- `--status`, `--body`, `--title` オプション

**show**: アイテムの詳細を表示する
- 引数: ハッシュID

**search**: テキストで検索する
- 引数: 検索テキスト

**list**: アイテム一覧を表示する
- `--status` オプションでフィルタ

**publish**: Draft を GitHub Issue に変換する
- 引数: ハッシュID
- `--label` オプション
- `languages.source` と `languages.publish` が異なる場合、AI エージェントで翻訳し、`<details>` タグ内に source 言語の原文を残す。AI エージェント呼び出しのタイムアウトは 60 秒、リトライは最大 2 回とする
- `languages.source` と `languages.publish` が同じ場合、そのまま Issue を作成する
- publish 成功時、ボードアイテムの Status フィールド値を変更する：

| 変更前 | 変更後 |
|---|---|
| Ideas（または現状） | Todo |

### skill 化
- `sdd-forge.exp.workflow` skill を新設する
- skill の description に TRIGGER キーワード（「ボードに追加」「タスク化」「メモしておいて」「issue にして」等）を記載し、Claude Code のスキルマッチングにより自動提案されるようにする
- ユーザーが `/sdd-forge.exp.workflow` を明示的に呼んだ場合にも起動する
- skill に CLAUDE.md のタスク管理セクションの MUST ルール（日本語 Draft 強制、show による確認、Draft 経由の Issue 作成等）を移行する

### upgrade 連携
- `sdd-forge upgrade` 実行時、`experimental.workflow.enable` が `true` の場合のみ `experimental/*/templates/skills/*` の skill を配置する
- `enable` が `false` またはフィールド未設定の場合、skill を配置しない

### CLAUDE.md 更新
- タスク管理セクションを更新する：skill 名 `sdd-forge.exp.workflow` の記載 + `workflow.js` のサブコマンド一覧に置き換える
- 詳細な MUST ルールは skill に移行するため CLAUDE.md からは削除する

## Out of Scope

- `src/flow.js` の dispatcher 自体の変更（参照のみ）
- GitHub Projects の GraphQL API 仕様の変更
- 既存の board データ（GitHub Projects 上のアイテム）の移行
- 他の publish 先（spec, draft PR 等）への拡張（将来の課題）
- `experimental.workflow.enable` が `false` の場合の workflow.js コマンド実行時は、config 未設定のエラーメッセージを返す（エラーハンドリングのみ）

## Clarifications (Q&A)

- Q: スコープを段階的に分割するか？
  - A: 全体を1つの spec で進める
- Q: CLI 再編の後方互換性は？
  - A: alpha版ポリシーにより一括置き換え。board.js を削除し workflow.js に完全移行
- Q: config 検証は含めるか？
  - A: config.json フィールド追加 + types.js で検証も含める
- Q: board 登録のデフォルトステータスは？
  - A: `--status` オプションを残しつつデフォルトを `Ideas` にする。`--category` で分類タグを追加
- Q: src/ 共通関数の追加は許可するか？
  - A: プロジェクト非依存であれば src/lib/ に汎用関数を追加してよい
- Q: skill のトリガー条件は？
  - A: 明示呼び出し + description の TRIGGER キーワードによる自動提案の両方

## Alternatives Considered

- **段階的分割**: CLI 再編を先に行い、publish や skill 化を後続 spec にする案。一貫性のある再設計のため一括で進めることにした
- **board.js を thin wrapper として残す**: 移行期間を設ける案。alpha版ポリシーにより後方互換不要のため却下
- **skill なし（CLAUDE.md ルールの維持）**: 常駐トークン削減と揺れ防止のため skill 化を選択

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-07
- Notes: gate PASS 後に承認

## Requirements

### P0（必須）

1. **REQ-CLI-DISPATCHER**: `experimental/workflow.js` は `src/flow.js` と同じ dispatcher + registry パターンで実装すること。エントリポイントが args を parse し、registry から command を lookup し、command class の `execute(ctx)` を呼び出す構造とする
2. **REQ-CLI-COMMANDS**: サブコマンド `add`, `update`, `show`, `search`, `list`, `publish` を実装すること。各コマンドは `experimental/workflow/lib/` に個別ファイルで実装する
3. **REQ-CLI-OUTPUT**: 全コマンドの出力は JSON envelope 形式（`{ok, type, key, data, errors}`）に統一すること。コマンド内で `console.log` や `process.exit` を呼ばないこと
4. **REQ-CONFIG-SCHEMA**: config.json に `experimental.workflow` セクション（`enable`: boolean, `languages.source`: string, `languages.publish`: string）を追加すること
5. **REQ-CONFIG-VALIDATE**: `src/lib/types.js` の `validateConfig()` で `experimental.workflow` の型と値を検証すること。`experimental` フィールドは任意とし、存在する場合のみ検証する
6. **REQ-CONFIG-FALLBACK**: `languages.source` 未設定時は `config.lang` を使うこと。`languages.publish` 未設定時も `config.lang` を使うこと
7. **REQ-PUBLISH**: `publish` コマンドは Draft を GitHub Issue に変換すること。`languages.source` と `languages.publish` が異なる場合は AI エージェントで翻訳し、source 言語の原文を `<details>` タグ内に残すこと。AI エージェント呼び出しのタイムアウトは 60 秒、リトライは最大 2 回とする
8. **REQ-PUBLISH-STATUS**: publish 成功時、GitHub Projects Status フィールド値を以下の通り更新すること：

| フィールド | 値 |
|---|---|
| Status | Todo |
9. **REQ-EXIT-CODE**: コマンド失敗時は非ゼロの終了コードを返すこと。成功時は 0 を返すこと

### P1（重要）

10. **REQ-ADD-DEFAULT**: `add` コマンドの `--status` デフォルトを `Ideas` にすること
11. **REQ-ADD-CATEGORY**: `add` コマンドに `--category` オプション（`RESEARCH`, `BUG`, `ENHANCE`, `OTHER`）を追加すること。指定時はタイトルに `[分類]` を prefix すること（ハッシュID の後）。未指定時はタグなし
12. **REQ-SKILL**: `sdd-forge.exp.workflow` skill を作成すること。skill の description に TRIGGER キーワードを記載し、CLAUDE.md のタスク管理 MUST ルールを skill に移行すること
13. **REQ-UPGRADE**: `sdd-forge upgrade` 実行時、`experimental.workflow.enable === true` の場合のみ `experimental/*/templates/skills/*` の skill を配置すること
14. **REQ-CLAUDEMD**: CLAUDE.md のタスク管理セクションを更新すること。skill 名と `workflow.js` サブコマンド一覧のみを残し、詳細ルールは skill に移行すること
15. **REQ-ENABLE-CHECK**: `experimental.workflow.enable` が `false` またはフィールド未設定の場合、workflow.js のコマンド実行時にエラーメッセージ「workflow is not enabled」を返し、非ゼロ終了コードで終了すること

### P2（望ましい）

16. **REQ-SHARED-FN**: experimental/workflow の実装中に dispatcher パターンや言語 fallback 解決で src/lib/ に汎用関数を追加する場合、その関数はプロジェクト固有の情報を含まないこと。追加の判断は実装時に行う
17. **REQ-DELETE-OLD**: 移行完了後、`experimental/workflow/board.js` および不要になった `experimental/workflow/lib/` のファイルを削除すること

## Acceptance Criteria

1. `node experimental/workflow.js add "テストタイトル"` が Ideas ステータスでアイテムを作成し、JSON envelope を出力すること
2. `node experimental/workflow.js add "テストタイトル" --category BUG` がタイトルに `[BUG]` を含むアイテムを作成すること
3. `node experimental/workflow.js publish <hash> --label enhancement` が Draft を GitHub Issue に変換し、Status フィールド値を以下に更新すること：

| フィールド | 値 |
|---|---|
| Status | Todo |
4. `node experimental/workflow.js list --status Ideas` がフィルタされたアイテム一覧を JSON envelope で返すこと
5. config.json に `experimental.workflow` が未設定の場合、`workflow.js` の全コマンドがエラーメッセージを返して非ゼロ終了すること
6. `experimental.workflow.enable: false` の場合も同様にエラーで終了すること
7. types.js の検証が `experimental.workflow.enable` に boolean 以外の値が入った場合にエラーを返すこと
8. `sdd-forge upgrade` が `enable: true` の場合のみ workflow skill を配置すること
9. `.claude/skills/sdd-forge.exp.workflow.md` が存在し、TRIGGER キーワードと MUST ルールを含むこと
10. CLAUDE.md のタスク管理セクションが skill 参照 + コマンド一覧のみに更新されていること
11. 旧 `board.js` が削除されていること

## Migration Steps

alpha版ポリシーにより後方互換は不要。以下の順序で移行する：

1. `experimental/workflow.js` と新しい `experimental/workflow/lib/` を作成する
2. `experimental/workflow/registry.js` にコマンドメタデータを定義する
3. CLAUDE.md のタスク管理セクションの内容を skill ファイルに移行する
4. CLAUDE.md のタスク管理セクションを新コマンド体系に更新する（skill 名の記載 + `workflow.js` のサブコマンド一覧）
5. `experimental/AGENTS.md` の workflow 関連記述を新パスに更新する
6. 既存の `experimental/tests/board-validation.test.js` を新しい構造に合わせて更新する
7. 旧 `board.js` を削除する

## Test Strategy

### ユニットテスト（`experimental/tests/`）
- hash 生成・抽出: `generateId()`, `prefixTitle()`, `extractId()`
- 日本語バリデーション: `assertJapaneseDraft()`, `stripHashPrefix()`
- config 検証: `experimental.workflow` フィールドの検証（types.js）
- dispatcher ルーティング: コマンド名 → 正しい registry エントリの解決
- category タイトル付与: `--category BUG` → `[BUG]` prefix

### コマンドレベル E2E テスト（`specs/150-redesign-exp-workflow/tests/`）
- 各サブコマンド（add, update, show, search, list, publish）の入出力検証
- JSON envelope 形式の出力検証
- enable: false 時のエラーハンドリング検証
- 不正な引数でのエラー検証

## Open Questions
- [x] dispatcher パターンの共通化をどの程度行うか — experimental 内で flow.js のパターンを再実装する。flow.js のコードを直接 import するのではなく、同じアーキテクチャを参考にして独立した dispatcher を構築する。共通化が有益な汎用関数が見つかった場合のみ src/lib/ に追加する
