# Draft: agent.commands の未登録コマンドIDとデッドエントリを整理する

**開発種別:** バグ修正 / 設定整備
**目的:** コードで使用されている commandId を config.example.json に網羅し、types.js の型定義・バリデーションを実態（agent.profiles）に合わせる。これにより、ユーザーがコマンド別エージェントを正しく設定できるようになる。

## 背景

`resolveAgent()` は `agent.profiles` フォーマットで per-command agent を解決するが、`config.example.json` は `agent.commands` フォーマット（コードで読まれない）を記載している。また `types.js` の `AgentConfig` typedef も `commands` を定義して `profiles` を省略しており、`validateConfig` に profiles の検証がない。

## Q&A

**Q1. config.example.json のフォーマット不一致をどう解決するか？**
A. `agent.profiles` 形式に書き直す（[1] 選択）。`agent.commands` は実装されていないため、ユーザーに機能しない設定を示すことになる。

**Q2. validateConfig の profiles バリデーション範囲は？**
A. プロバイダー参照の妥当性チェックまで行う（[2] 選択）。`types.js` が `agent.js` から `BUILTIN_PROVIDERS` をインポートして検証する。`validateConfig` のシグネチャは変えない。

**Q3. docs.init commandId を config.example.json に追加するか？**
A. はい追加する（[1] 選択）。

## 変更対象と内容

### 1. `src/lib/types.js`
- `AgentConfig` typedef: `[commands]` を削除 → `[profiles]` を追加
- `validateConfig`: `agent.profiles` の検証を追加
  - profiles がオブジェクトであること
  - 各エントリの値が文字列であること
  - 値が providers（BUILTIN_PROVIDERS + user providers のマージ）に存在するか参照チェック
  - `BUILTIN_PROVIDERS` を `agent.js` からインポート

### 2. `src/templates/config.example.json`
- `agent.commands` ブロックを削除
- `agent.profiles.default` ブロックを追加（agent.profiles フォーマット）
- 追加する commandId: `docs.enrich`, `docs.text`, `docs.forge`, `docs.readme`, `docs.agents`, `spec.gate`, `flow.review.draft`, `flow.review.final`, `docs.translate`, **`docs.init`（新規）**, **`flow.review.test`（新規）**, **`flow.review.spec`（新規）**, **`flow.retro`（新規）**, **`context.search`（新規）**
- `agent.providers` の formats も profiles 形式に合わせて見直し

### 3. `src/docs/commands/init.js`
- `resolveCommandContext(cli)` → `resolveCommandContext(cli, { commandId: "docs.init" })` に修正

### 4. `src/flow/lib/run-retro.js:188`
- エラーメッセージ内の `agent.commands.flow.retro` → `agent.profiles` 参照に修正

## 既存機能への影響

- `resolveAgent` のロジックは変更しない。`agent.profiles` を使っている既存ユーザーへの影響なし。
- `init.js` に commandId を追加しても、`agent.profiles` や `agent.useProfile` が設定されていなければ従来通り default agent が使われる。
- `validateConfig` の追加検証により、profiles の値が unknown provider の場合はエラーになる。ただし従来は検証なしでサイレントに動作していたため、既存の正しい設定には影響なし。

## スコープ外

- `agent.commands` フォーマットの実装（resolveAgent での読み込み）
- acceptance/unit テストの fixtures config.json の一括更新（各プリセットが独自の config を持つため別スコープ）

- [x] User approved this draft
