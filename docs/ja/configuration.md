<!-- {{data("base.docs.langSwitcher", {labels: "relative"})}} -->
**日本語** | [English](../configuration.md)
<!-- {{/data}} -->

# 設定とカスタマイズ

## 説明

<!-- {{text({prompt: "この章の概要を1〜2文で記述してください。設定ファイルの種類・設定可能な項目の範囲・カスタマイズポイントを踏まえること。"})}} -->

sdd-forge は `.sdd-forge/config.json` を唯一の設定ファイルとして読み込み、ドキュメント出力言語・プロジェクトタイプ・エージェント動作・SDD フロー設定など幅広い項目を一括管理します。バリデーションにより必須フィールドの欠落や不正値を起動時に検出し、ドキュメントスタイル・並行実行数・フローのマージ戦略などをカスタマイズできます。
<!-- {{/text}} -->

## 内容

### 設定ファイル

<!-- {{text({prompt: "このツールが読み込む設定ファイルの一覧と、それぞれの配置場所・役割を表形式で記述してください。ソースコードのファイル読み込み処理から抽出すること。"})}} -->

| ファイルパス | 役割 |
|---|---|
| `.sdd-forge/config.json` | プロジェクトの主設定ファイル。`loadConfig()` が読み込み、`validateConfig()` によりスキーマ検証を行います |
| `package.json` | `loadPackageField()` により、プロジェクトルートの `package.json` から特定フィールドを補助的に参照します |

設定ファイルの配置ディレクトリは `sddDir()` が返す `.sdd-forge/` です。出力結果は `.sdd-forge/output/`、データキャッシュは `.sdd-forge/data/` に格納されます。
<!-- {{/text}} -->

### 設定項目リファレンス

<!-- {{text({prompt: "設定ファイルの全フィールドを表形式で記述してください。フィールド名・必須かどうか・型・デフォルト値・説明を含めること。ソースコードのバリデーション処理やデフォルト値定義から抽出すること。", mode: "deep"})}} -->

| フィールド | 必須 | 型 | デフォルト値 | 説明 |
|---|---|---|---|---|
| `lang` | ✓ | string | — | ドキュメント生成時の基本言語コード（例: `"ja"`） |
| `type` | ✓ | string \| string[] | — | プロジェクトのプリセットタイプ（例: `"node-cli"`、`"laravel"`） |
| `docs` | ✓ | object | — | ドキュメント出力設定のルートオブジェクト |
| `docs.languages` | ✓ | string[] | — | 出力するドキュメントの言語コード一覧（1件以上必須） |
| `docs.defaultLanguage` | ✓ | string | — | デフォルトの出力言語（`docs.languages` のいずれかを指定） |
| `docs.mode` | — | string | `"translate"` | 多言語出力モード。`"translate"` または `"generate"` |
| `docs.style` | — | object | — | ドキュメントの文体設定 |
| `docs.style.purpose` | ※ | string | — | ドキュメントの用途説明（`docs.style` 指定時は必須） |
| `docs.style.tone` | ※ | string | — | 文体トーン。`"polite"` / `"formal"` / `"casual"` のいずれか（`docs.style` 指定時は必須） |
| `docs.style.customInstruction` | — | string | — | AI へのカスタム指示文字列 |
| `docs.exclude` | — | string[] | — | ドキュメント生成から除外する glob パターン一覧 |
| `concurrency` | — | number | `5` | AI エージェントの並行実行数（1以上の整数） |
| `chapters` | — | object[] | — | 章の出力順・除外設定。各要素は `{ chapter, desc?, exclude? }` |
| `chapters[].chapter` | ✓ | string | — | 章ファイル名（例: `"overview.md"`） |
| `chapters[].desc` | — | string | — | 章の説明文 |
| `chapters[].exclude` | — | boolean | — | `true` を指定すると出力対象から除外 |
| `agent.workDir` | — | string | — | エージェントの作業ディレクトリ |
| `agent.timeout` | — | number | — | エージェントのタイムアウト値（1以上の整数） |
| `agent.retryCount` | — | number | — | エージェントのリトライ回数（1以上の整数） |
| `agent.batchTokenLimit` | — | number | — | バッチ処理のトークン上限（1000以上の整数） |
| `agent.providers` | — | object | — | エージェントプロバイダーの定義マップ |
| `agent.providers.<key>.command` | ✓ | string | — | プロバイダーの実行コマンド |
| `agent.providers.<key>.args` | ✓ | string[] | — | コマンドに渡す引数の配列 |
| `scan.include` | ✓ | string[] | — | スキャン対象の glob パターン一覧（`scan` 指定時は必須） |
| `scan.exclude` | — | string[] | — | スキャン除外の glob パターン一覧 |
| `flow.merge` | — | string | — | マージ戦略。`"squash"` / `"ff-only"` / `"merge"` のいずれか |
| `flow.push.remote` | — | string | — | プッシュ先のリモート名 |
| `flow.commands.context.search.mode` | — | string | — | コンテキスト検索モード。`"ngram"` または `"ai"` |
| `commands.gh` | — | string | — | GitHub CLI 使用可否。`"enable"` または `"disable"` |
<!-- {{/text}} -->

### カスタマイズポイント

<!-- {{text({prompt: "ユーザーがカスタマイズできる項目を説明してください。ソースコードから設定可能な項目を抽出し、各項目に設定例を含めること。", mode: "deep"})}} -->

**ドキュメント言語・出力モードのカスタマイズ**

`docs.languages` と `docs.defaultLanguage` で出力言語を制御します。`docs.mode` を `"generate"` にすると、翻訳ではなく各言語向けに直接生成するモードになります。

```json
{
  "docs": {
    "languages": ["ja", "en"],
    "defaultLanguage": "ja",
    "mode": "translate"
  }
}
```

**ドキュメントスタイルのカスタマイズ**

`docs.style` で AI が生成するドキュメントの文体を指定します。`tone` には `"polite"`・`"formal"`・`"casual"` を指定できます。`customInstruction` には AI への追加指示を自由記述できます。

```json
{
  "docs": {
    "style": {
      "purpose": "開発者向けの内部技術ドキュメント",
      "tone": "formal",
      "customInstruction": "箇条書きを積極的に活用してください。"
    }
  }
}
```

**並行実行数のカスタマイズ**

`concurrency` を指定することで AI エージェントの並行実行数を変更できます。省略時のデフォルト値は `5` です。

```json
{
  "concurrency": 3
}
```

**章の出力制御**

`chapters` 配列で章の出力順序を定義し、`exclude: true` で特定の章を出力対象から除外できます。

```json
{
  "chapters": [
    { "chapter": "overview.md" },
    { "chapter": "internal_design.md", "exclude": true }
  ]
}
```

**フローのマージ戦略**

`flow.merge` で SDD フロー完了時のマージ方法を指定します。

```json
{
  "flow": {
    "merge": "squash"
  }
}
```

**GitHub CLI 連携の有効化**

`commands.gh` を `"enable"` にすると、フロー完了時に `gh` コマンドを使った PR 作成が行われます。

```json
{
  "commands": {
    "gh": "enable"
  }
}
```

**エージェントプロバイダーの定義**

`agent.providers` にプロバイダー名をキーとして実行コマンドと引数を定義します。

```json
{
  "agent": {
    "providers": {
      "claude": {
        "command": "claude",
        "args": ["--model", "claude-opus-4-5"]
      }
    }
  }
}
```
<!-- {{/text}} -->

### built-in エージェント profile

`senti setup` は選択した agent family を `agent.default` に `claude` または `codex` として保存し、routing intent を `agent.useProfile` に保存します。built-in profile 名は `claude-only`, `codex-only`, `claude-main`, `codex-main` です。

built-in の `agent.profiles` と `agent.providers` は package から実行時に解決されます。`.senti/config.json` へコピーする必要はありません。package default を上書きしたい場合だけ、同じ key を local config に定義します。

```json
{
  "agent": {
    "default": "codex",
    "useProfile": "codex-main",
    "profiles": {
      "codex-main": {
        "docs.readme": "my-codex"
      }
    },
    "providers": {
      "my-codex": {
        "command": "codex",
        "args": ["exec", "{{PROMPT}}"]
      }
    }
  }
}
```

### 環境変数

<!-- {{text({prompt: "ツールが参照する環境変数の一覧と用途を表形式で記述してください。ソースコードの process.env 参照から抽出すること。", mode: "deep"})}} -->

提供された解析データの対象ファイル（`src/lib/config.js`・`src/lib/types.js`）には、`process.env` を直接参照する処理は含まれていません。設定値はすべて `.sdd-forge/config.json` から読み込まれ、環境変数によるオーバーライドはこれらのファイルの責務外となっています。
<!-- {{/text}} -->

---

<!-- {{data("base.docs.nav")}} -->
[← CLI コマンドリファレンス](cli_commands.md) | [内部設計 →](internal_design.md)
<!-- {{/data}} -->
