# Draft: 052-task-specific-agent-and-model-config

## 背景

現在の config.json は `defaultAgent` + `providers` でエージェントを一括管理している。
コマンドごとにエージェントやモデルを使い分けたいニーズがある（例: docs 生成は sonnet、gate レビューは opus）。

## 設計決定

### 1. providers に profiles を追加

providers 内に名前付き args プリセット（profiles）を定義する。

```json
{
  "providers": {
    "claude": {
      "command": "claude",
      "args": ["-p", "{{PROMPT}}"],
      "profiles": {
        "default": [],
        "opus": ["--model", "opus"],
        "sonnet": ["--model", "sonnet"]
      }
    },
    "codex": {
      "command": "codex",
      "args": ["{{PROMPT}}"],
      "profiles": {
        "default": [],
        "o3": ["--model", "o3"]
      }
    }
  }
}
```

最終 args = `profiles[name]` + `provider.args` を concat。

### 2. commands セクション新設

フラットキー（`"docs.review"`）でコマンドごとに agent + profile を指定。

```json
{
  "commands": {
    "docs": { "agent": "claude", "profile": "default" },
    "docs.review": { "agent": "claude", "profile": "default" },
    "spec": { "agent": "claude", "profile": "default" },
    "spec.gate": { "agent": "claude", "profile": "default" },
    "flow": { "agent": "claude", "profile": "default" }
  }
}
```

### 3. 解決順序

`resolveAgent(config, "docs.review")` の探索順:

1. `commands["docs.review"]` — サブコマンド指定
2. `commands["docs"]` — 親コマンドにフォールバック
3. `providers[defaultAgent]` — デフォルト

profile も同様にフォールバックする。

### 4. resolveAgent 拡張

各コマンドファイルに `COMMAND_ID` 定数を定義し、resolveAgent に渡す。

```js
// src/docs/commands/review.js
const COMMAND_ID = "docs.review";
const agent = resolveAgent(config, COMMAND_ID);
```

resolveAgent は文字列を `.` で分割して階層探索する。
既存の `resolveAgent(config)` （引数なし）は従来通り defaultAgent を返す。

### 5. --agent CLI オプション廃止

コマンドごとの設定は config.json で管理する。`--agent` CLI オプションは削除。

### 6. args マージルール

- provider に agent が変わった場合、その provider の args + profile をベースにする
- profile 指定なし → 親コマンドの profile にフォールバック
- 親もなし → `profiles.default` があればそれ、なければ provider.args のみ

### 7. setup の変更

- 質問はデフォルトエージェントの選択のみ（claude / codex）
- skip 選択肢は廃止
- 両方の providers + 全 commands を default profile で自動生成
- カスタマイズは config.json 手動編集 → `sdd-forge upgrade` で反映

### 8. ドキュメント整備

config.json のカスタマイズ方法のドキュメントが最重要。設定例を充実させる。

## Q&A

- Q: コマンドの粒度は？
  - A: トップレベル（`docs`）とサブコマンド（`docs.review`）の両方対応。サブコマンド → 親 → デフォルトの順にフォールバック。

- Q: resolveAgent を新設するか既存を拡張するか？
  - A: 既存の resolveAgent を拡張。第2引数に COMMAND_ID 文字列を受け取る。

- Q: setup で細かく聞くか？
  - A: デフォルトエージェントのみ。profiles や commands のカスタマイズは config.json 編集。

- Q: 推奨設定でエージェントを混ぜるか？
  - A: 混ぜない。全て defaultAgent + default profile で生成。カスタマイズはユーザーの手動編集。

- Q: モデル廃止時の問題は？
  - A: 推奨設定を default profile にすることで回避。モデル固定はユーザーの自己責任。

## Approval

- [x] User approved this draft
- Confirmed at: 2026-03-14
