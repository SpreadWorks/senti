# Feature Specification: 157-agent-profile-switching

**Feature Branch**: `feature/157-agent-profile-switching`
**Created**: 2026-04-08
**Status**: Draft
**Input**: Issue #112

## Goal

`agent.profiles` ベースの設定フォーマットに刷新し、`useProfile` / `SDD_FORGE_PROFILE` によるエージェントプロファイル切り替えを実現する。agent 使用制限が発生した場合などに設定ファイルまたは環境変数で手軽にエージェントを切り替えられるようにする。

## Scope

- `agent.profiles` / `agent.useProfile` の新設
- `SDD_FORGE_PROFILE` 環境変数によるプロファイルオーバーライド
- プロファイルのコマンドマッチング（プレフィックスマッチ方式）
- src/ へのビルトインプロバイダー定義（4種）とユーザー定義との統合
- `agent.commands` および provider-level `profiles` の廃止
- `sdd-forge setup` が生成する初期 config.json の新フォーマット対応
- `README.md` の `agent` 設定セクション更新
- `CHANGELOG.md` への breaking change 記載
- typo 修正: `experimental.workflow.borad.to-issue` → `experimental.workflow.board.to-issue`

## Out of Scope

- config.json バリデーション警告機能（別 spec: dcad）
- `SDD_SOURCE_ROOT` / `SDD_WORK_ROOT` 等の既存環境変数の `SDD_FORGE_` プレフィックスへの統一（別 spec: ffbc）
- 環境変数以外のプロファイル動的切り替え手段

## Why This Approach

`agent.commands` は個別コマンドへの上書きのみ可能で、「複数コマンドをまとめてプロバイダー切り替えしたい」というユースケースに対応できなかった。`agent.profiles` は名前付きグループ（例: `fast`, `claude-only`）として定義し `useProfile` または環境変数で一括切り替えできるため、日常的な運用操作に適している。プレフィックスマッチは wildcard 構文を不要にし、設定の記述量を最小化する。

## Clarifications (Q&A)

- Q: typo 修正（`borad` → `board`）はこの spec に含めるか？
  - A: 含める（同一変更セットとして扱う）
- Q: `SDD_FORGE_PROFILE` と `agent.useProfile` が両方設定されている場合の優先順位は？
  - A: 環境変数（`SDD_FORGE_PROFILE`）が優先される
- Q: 存在しないプロファイル名が指定された場合の挙動は？
  - A: エラーを投げて停止する（サイレント失敗禁止）
- Q: ビルトインプロバイダーのリストは？
  - A: `claude/opus`、`claude/sonnet`、`codex/gpt-5.4`、`codex/gpt-5.3` の4つ
- Q: 旧フィールド（`agent.commands`、provider-level `profiles`）が残っていた場合の挙動は？
  - A: 黙って無視する（alpha ポリシー）

## Migration Plan

`agent.commands` および provider-level `agent.providers.*.profiles` は本 spec で廃止される breaking change である。

**廃止フィールド:**
- `agent.commands` — コマンド別エージェント上書き設定
- `agent.providers.<key>.profiles` — provider-level の args 切り替え

**移行手順（ユーザーが行う）:**

旧フォーマット:
```json
"agent": {
  "default": "claude/opus",
  "commands": {
    "docs.review": { "agent": "codex/gpt-5.3" }
  }
}
```

新フォーマット:
```json
"agent": {
  "default": "claude/opus",
  "useProfile": "fast",
  "profiles": {
    "fast": { "docs": "codex/gpt-5.3" }
  }
}
```

**移行時の挙動:** 旧フィールドが残っていても黙って無視される（alpha ポリシー）。エラーにはならない。

## Alternatives Considered

- **`agent.commands` を拡張してグループ化対応**: 既存のキーを拡張する案。ただし命名が分かりにくくなるため不採用。`profiles` という明示的な名前で新設する方が意図が明確。
- **ワイルドカード（`docs.*`）構文**: グロブ形式の検討。プレフィックスマッチで同等の表現力を得られるため不要と判断。設定がシンプルになる。

## Requirements

優先度: **必須（P1）** → **重要（P2）** → **付随（P3）**

**P1: コア機能**

1. `agent.profiles` フィールドを新設する。各プロファイルはコマンドID（例: `docs`）をキー、プロバイダーキー（例: `claude/opus`）を値とするオブジェクトである
2. `agent.useProfile` フィールドを新設する。値はプロファイル名の文字列。未設定または空文字の場合は `agent.default` を使用する
3. 環境変数 `SDD_FORGE_PROFILE` が設定されている場合、`agent.useProfile` より優先してプロファイルを選択する
4. `useProfile`（または `SDD_FORGE_PROFILE`）で指定されたプロファイル名が `agent.profiles` に存在しない場合、エラーを投げて処理を停止する
5. コマンドIDとプロファイルエントリのマッチングはプレフィックスマッチ方式とする。`docs` は `docs.review`、`docs.text` 等すべての `docs.*` コマンドにマッチする。より長い（具体的な）プレフィックスを持つエントリが優先される。マッチングはプロファイルエントリを線形走査するのみ（再帰なし、リトライなし）。エントリ数は config.json のサイズで自然に制限される
6. 有効なプロファイルが選択され、かつ対象コマンドIDにマッチするエントリがない場合は `agent.default` にフォールバックする

**P2: ビルトインプロバイダーと既存設定の廃止**

7. 以下の4つのプロバイダーを src/ にビルトイン定義する:
   - `claude/opus`: `claude -p {{PROMPT}} --model opus --system-prompt ...`
   - `claude/sonnet`: `claude -p {{PROMPT}} --model sonnet --system-prompt ...`
   - `codex/gpt-5.4`: `codex exec -m gpt-5.4 --full-auto -C .tmp {{PROMPT}}`
   - `codex/gpt-5.3`: `codex exec -m gpt-5.3-codex --full-auto -C .tmp {{PROMPT}}`
8. ユーザーが `agent.providers` に同名のプロバイダーを定義した場合、ユーザー定義がビルトイン定義より優先される（上書き）
9. 旧フィールド（`agent.commands`、`agent.providers.*.profiles`）が config.json に存在する場合は無視する。これはエラーではなく廃止済みフィールドの意図的な廃棄であり、alpha ポリシー（後方互換なし）に基づく設計判断である。config バリデーション警告（未知フィールドへの警告）は別 spec（dcad）で対応する
10. `sdd-forge setup` が生成する初期 config.json を新フォーマット（`profiles` / `useProfile`）に更新する

**P3: ドキュメント・typo 修正**

11. `README.md` の `agent` 設定セクションを新フォーマットに更新し、旧フォーマット記述を削除する。更新内容:
    - `agent.commands` の記述を削除する
    - `agent.profiles` / `agent.useProfile` / `SDD_FORGE_PROFILE` の使用例を追加する
12. `CHANGELOG.md` に breaking change セクションを追加する。以下の内容を含める:
    - 廃止されたフィールド: `agent.commands`、`agent.providers.*.profiles`
    - 移行手順: `agent.commands` 内の各エントリを `agent.profiles` の1プロファイルとして書き直す具体例
    - 新フィールド: `agent.useProfile`、`SDD_FORGE_PROFILE` 環境変数の説明
13. `experimental.workflow.borad.to-issue` の typo を `experimental.workflow.board.to-issue` に修正する

## Acceptance Criteria

- [ ] `agent.useProfile: "fast"` が設定されている場合、`docs build` 実行時に `profiles.fast.docs` で指定されたプロバイダーが使用される
- [ ] `SDD_FORGE_PROFILE=claude-only` が設定されている場合、`agent.useProfile` の値に関わらず `profiles.claude-only` のプロバイダーが使用される
- [ ] `SDD_FORGE_PROFILE=nonexistent` を設定してコマンドを実行すると、エラーメッセージとともに非ゼロ終了する
- [ ] `agent.useProfile` も `SDD_FORGE_PROFILE` も未設定の場合、`agent.default` のプロバイダーが使用される（従来通り）
- [ ] `useProfile: "fast"` で `profiles.fast` に `docs` エントリはあるが `docs.review` エントリがない場合、`docs.review` 実行時は `docs` エントリのプロバイダーが使用される（プレフィックスマッチ）
- [ ] `useProfile: "fast"` で `profiles.fast` にいずれのエントリもマッチしない場合、`agent.default` にフォールバックする
- [ ] config.json に `agent.providers` の定義がない場合、ビルトインプロバイダーが使用可能である
- [ ] ユーザーが `agent.providers.claude/opus` を定義した場合、ビルトイン定義より優先される
- [ ] `experimental.workflow.board.to-issue` キーが正しく参照される（typo 修正確認）

## Test Strategy

- **配置**: `tests/unit/lib/agent.test.js`（既存テストの更新・拡張）および `tests/e2e/052-agent-command-config.test.js`（既存テストの更新）
- **既存テスト変更の承認**: `agent.commands` および provider-level `profiles` を廃止する breaking change に伴い、これらを前提とした既存テスト (`tests/unit/lib/agent.test.js` 内の `commands`/`profiles` テスト、`tests/e2e/052-agent-command-config.test.js` 内の `setup generates full config` テスト) を新フォーマットに合わせて書き換えることを本スペックで承認する。
- **テスト内容**:
  - `resolveAgent` のプロファイル解決ロジック（useProfile / SDD_FORGE_PROFILE / デフォルト）
  - プレフィックスマッチのロジック（`docs` vs `docs.review` vs `docs.review.deep`）
  - ビルトインプロバイダーとユーザー定義のマージ（ユーザー定義優先）
  - 存在しないプロファイル指定時のエラー throw
  - 環境変数オーバーライドの優先順位

## Open Questions

なし

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-08
- Notes: Approved via /sdd-forge.flow-auto-on
