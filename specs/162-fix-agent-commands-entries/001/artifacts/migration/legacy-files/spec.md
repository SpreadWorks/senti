# Feature Specification: 162-fix-agent-commands-entries

**Feature Branch**: `feature/162-fix-agent-commands-entries`
**Created**: 2026-04-08
**Status**: Draft
**Input**: GitHub Issue #120

## Goal

`config.example.json` が機能しない `agent.commands` フォーマットを記載しており、ユーザーが per-command agent を設定できない問題を修正する。あわせて `types.js` の型定義・バリデーションを実装の実態（`agent.profiles`）に整合させ、コード上で使われているすべての commandId を設定可能にする。

## Why This Approach

`resolveAgent()` は `agent.profiles` フォーマットのみを読む。`agent.commands` は `types.js` の typedef に記載されているが実装されていない。`config.example.json` を `agent.profiles` に書き直すことで、既存の実装を変えずにユーザーへの正しい設定例を提供できる。`agent.commands` を新規実装する案は scope が大きく、別 spec で扱う。

## Scope

1. `src/lib/types.js` — `AgentConfig` typedef と `validateConfig` の修正
2. `src/templates/config.example.json` — `agent.commands` → `agent.profiles` への書き直しと未登録 commandId 追加
3. `src/docs/commands/init.js` — commandId 未設定の修正
4. `src/flow/lib/run-retro.js` — エラーメッセージの誤参照修正

## Out of Scope

- `agent.commands` フォーマットの実装（resolveAgent での読み込み）
- 各プリセット tests/acceptance/fixtures の config.json 更新

## Requirements

優先順位: R1 → R2 → R3 → R4

**R1. `AgentConfig` 型定義の修正**
- `src/lib/types.js` の `AgentConfig` typedef から `[commands]` プロパティを削除する
- 代わりに `[profiles]` プロパティ（`Object<string, Object<string, string>>`）を追加する

**R2. `validateConfig` への `agent.profiles` バリデーション追加**
- `src/lib/types.js` が `src/lib/agent.js` から `BUILTIN_PROVIDERS` をインポートする
- `validateConfig` で `raw.agent.profiles` が存在する場合、以下を検証する：
  - profiles がオブジェクトであること
  - 各プロファイル値がオブジェクトであること
  - 各プロファイルエントリの値が文字列であること
  - 各値が `BUILTIN_PROVIDERS` と `raw.agent.providers` のマージに存在するか（参照整合性チェック）

**R3. `config.example.json` の profiles 形式への書き直し**
- `agent.commands` ブロックを削除し `agent.profiles.default` ブロックを追加する
- 既存の commandId（`docs.enrich`, `docs.text`, `docs.forge`, `docs.readme`, `docs.agents`, `spec.gate`, `flow.review.draft`, `flow.review.final`, `docs.translate`）を profiles 形式で記載する
- 以下の commandId を新規追加する：`docs.init`, `flow.review.test`, `flow.review.spec`, `flow.retro`, `context.search`
- `agent.providers` 内の `profiles` フィールド（旧フォーマット）を削除する

**R4. コード修正**
- `src/docs/commands/init.js`: `resolveCommandContext(cli)` → `resolveCommandContext(cli, { commandId: "docs.init" })`
- `src/flow/lib/run-retro.js:188`: エラーメッセージ内の `agent.commands.flow.retro` を `agent.profiles` への言及に修正する

## Acceptance Criteria

- [ ] `validateConfig` に `agent.profiles` の値として存在しない provider key を渡した場合、エラーが throw される
- [ ] `validateConfig` に `agent.profiles` の値として `BUILTIN_PROVIDERS` のキー（例: `"claude/sonnet"`）を渡した場合、バリデーションが通る
- [ ] `config.example.json` を `JSON.parse` して `validateConfig` に渡した場合、エラーが出ない（ただし `docs` / `lang` / `type` 等の必須フィールドは補完して検証）
- [ ] `config.example.json` に `agent.commands` キーが存在しない
- [ ] `config.example.json` に `agent.profiles.default` が存在し、`context.search`, `flow.retro`, `flow.review.test`, `flow.review.spec`, `docs.init` が含まれる
- [ ] `init.js` が `resolveCommandContext` に `commandId: "docs.init"` を渡している
- [ ] `run-retro.js` のエラーメッセージが `agent.commands` を参照していない

## Test Strategy

- **`tests/` に配置**（公開 API の契約テストのため）：
  - `validateConfig` の `agent.profiles` バリデーション正常系・異常系のユニットテスト
  - 存在しない provider key を渡した場合にエラーが throw されること
  - BUILTIN_PROVIDERS の既知 key を渡した場合に pass すること
  - ユーザー定義 providers にある key を渡した場合に pass すること
- **コードレビュー確認**（自動テスト不要）：
  - `init.js` の commandId 追加
  - `run-retro.js` のエラーメッセージ修正
  - `config.example.json` の内容確認

## Clarifications (Q&A)

**Q: `config.example.json` のフォーマット不一致をどう解決するか？**
A: `agent.profiles` 形式に書き直す。`agent.commands` は実装されていないため、機能しない設定例を示すことになる。

**Q: `validateConfig` の profiles バリデーション範囲は？**
A: provider 参照の整合性チェックまで行う。`types.js` が `agent.js` から `BUILTIN_PROVIDERS` をインポートして検証する。

**Q: `docs.init` を `config.example.json` に追加するか？**
A: はい。`init.js` に commandId を追加するのに合わせて example にも記載する。

## Alternatives Considered

- **`agent.commands` を新規実装する**: scope が大きく、別 spec で扱う。
- **`validateConfig` に providers 引数を追加する**: シグネチャ変更により全呼び出し元を更新する必要がある。インポートで解決できるため採用しない。

## Impact on Existing Features

- `resolveAgent` のロジックは変更しない。`agent.profiles` を使っている既存ユーザーへの影響なし。
- `init.js` に commandId を追加しても、profiles 未設定の場合は従来通り default agent が使われる（非破壊的変更）。
- `validateConfig` の追加検証により、profiles エントリが未定義 provider を参照している場合にエラーになる。従来は無検証でサイレントにフォールバックしていた。

## Open Questions

なし

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-08
- Notes: Q&A を経て要件確定。agent.commands 実装は別 spec。
