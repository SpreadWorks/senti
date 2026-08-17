# Draft: 157-agent-profile-switching

**開発種別:** 機能追加・既存機能の刷新
**目的:** agent 設定を `profiles` ベースに刷新し、`useProfile` / `SDD_FORGE_PROFILE` によるプロファイル切り替えを実現する

## 背景

agent の使用制限が発生した場合などに、どのエージェントを使うかを手軽に切り替えたい。
現在は `agent.commands` で個別設定が可能だが、プロファイルとして名前付きで束ねる仕組みがない。

## Q&A

**Q1: typo 修正（`experimental.workflow.borad.to-issue` → `experimental.workflow.board.to-issue`）はこの spec に含めるか？**
A: 含める。

**Q2: `SDD_FORGE_PROFILE`（環境変数）と `agent.useProfile`（config）が両方設定されていた場合の優先順位は？**
A: 環境変数（`SDD_FORGE_PROFILE`）を優先する。

**Q3: 存在しないプロファイルが指定された場合の挙動は？**
A: エラーを投げて停止する。

**Q4: ビルトインプロバイダーのリストは？**
A: `claude/opus`、`claude/sonnet`、`codex/gpt-5.4`、`codex/gpt-5.3` の4つ。

**Q5: 旧フィールド（`agent.commands`、`provider.profiles`）が config.json に残っていた場合の挙動は？**
A: 黙って無視する（alpha ポリシー）。config バリデーション警告機能は別 spec（dcad）で対応。

**CLI コマンドへの影響:** `sdd-forge` の各サブコマンド（`docs build`, `flow run` 等）のインターフェース・オプションは変わらない。変更は `config.json` のスキーマのみであり、コマンドライン操作は従来通り動作する。

**移行計画（alpha ポリシー）:** 後方互換コードは書かない。以下を本 spec の実装範囲に含める。
- `CHANGELOG.md` に breaking change セクションを追加し、旧 `agent.commands` → 新 `agent.profiles` への書き換え手順を例示する
- `src/README.md` の `agent` 設定セクションを新フォーマット（`profiles` / `useProfile`）に更新し、旧フォーマット記述を削除する
- config バリデーション警告（dcad）が実装されれば、旧フィールド残存時に警告で気づける（本 spec のスコープ外）

## 設計決定（優先順位順）

1. `agent.commands` を廃止し `agent.profiles` に一本化する（コアアーキテクチャ変更）
2. コマンドマッチングはプレフィックスマッチ方式（`docs` → `docs.*` 全体にマッチ、より長いプレフィックス優先）
3. よく使うプロバイダーを src/ にビルトイン定義。ユーザー定義が同名の場合はユーザー定義優先
4. `providers` 配下に `profiles` は入らない（provider-level profiles も廃止）

## 影響範囲（優先順位順）

1. `src/lib/agent.js` — `resolveAgent` / `resolveCommandSettings` / `mergeProfileArgs` の刷新（コア）
2. `src/lib/config.js` — config スキーマの更新（`commands` 削除、`profiles` / `useProfile` 追加）
3. `src/lib/cli.js` — `SDD_FORGE_PROFILE` 環境変数の読み取り追加
4. 既存テスト（`agent.js` 関連）— `resolveAgent` のテスト更新
5. `experimental/workflow.js` — typo 修正（`borad` → `board`）※独立した小変更

### 追加の影響

- **`sdd-forge setup` が生成する初期 config.json** — `agent.commands` ではなく `agent.profiles` / `agent.useProfile` を含む新フォーマットで出力するよう更新が必要
- **テンプレート・プリセット内の config サンプル** — `src/templates/` や README 等に旧フォーマットの config サンプルが含まれる場合は新フォーマットに更新が必要

## エッジケース（優先度高い順）

1. プロファイル名が存在しない → エラーを投げて停止（最重要：サイレント失敗を防ぐ）
2. `useProfile` 未設定・`SDD_FORGE_PROFILE` 未設定 → `agent.default` を使用（従来動作の維持）
3. 指定プロファイルにマッチするコマンドエントリがない → `agent.default` にフォールバック
4. ビルトインプロバイダーとユーザー定義が同名 → ユーザー定義優先（マージ・上書き）

## テスト戦略

- `resolveAgent` の単体テストを更新（プロファイル解決・プレフィックスマッチ・環境変数優先）
- ビルトインプロバイダーのマージロジックのテスト
- エラーケース（存在しないプロファイル）のテスト
- テスト配置: `tests/unit/lib/agent.test.js`（既存テストの更新）

- [x] User approved this draft
- Confirmed at: 2026-04-08
