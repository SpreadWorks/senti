# <!-- {{data("cli.project.name")}} -->Senrail<!-- {{/data}} -->

<!-- {{data("cli.docs.langSwitcher", {labels: "absolute"})}} -->
**日本語** | [English](https://github.com/SpreadWorks/senrail/blob/main/README.md)
<!-- {{/data}} -->

[![npm version](https://img.shields.io/npm/v/senrail.svg)](https://www.npmjs.com/package/senrail)
[![license](https://img.shields.io/npm/l/senrail.svg)](https://opensource.org/licenses/MIT)
[![downloads](https://img.shields.io/npm/dm/senrail.svg)](https://www.npmjs.com/package/senrail)

> **Alpha版:** API・コマンド体系・設定フォーマットは予告なく変更される可能性があります。

## Spec-Driven Development — 設計・実装・ドキュメントを1つのフローで完結

AI コーディングエージェントと組み合わせて使う、仕様書起点の開発フローを管理するツールです。

## 仕様開発駆動フロー

仕様書を起点に 3 フェーズで機能開発を完了します。

```
plan ──────── 仕様策定
│  ├─ draft       要件を対話で整理
│  ├─ spec        仕様書を作成（feature ブランチ + spec.md）
│  ├─ gate        仕様チェック + ガードレール検証
│  └─ test        テストコード作成
│
implement ─── 実装
│  ├─ implement   gate PASS 後にコーディング
│  └─ review      AI コードレビュー
│
finalize ──── 終了処理
│  ├─ commit      コミット + 振り返り + レポート
│  ├─ merge       squash マージまたは PR
│  ├─ sync        ドキュメント自動更新
│  └─ cleanup     ブランチ / worktree 削除
```

### AI を枠の中で使う

ソースコード解析、仕様のゲートチェック、フローの進行管理はすべてプログラムが担います。AI にフローを丸投げせず、確実性が必要な工程をコマンドで制御したうえで、AI は仕様の整理・コードレビュー・説明文生成を補助します。

- **仕様ゲート** — 未解決事項・未承認をプログラムが検証。PASS するまで実装に進めない
- **ガードレール** — プロジェクト固有の設計原則に反していないか検証
- **コンパクション耐性** — フロー状態と要件を永続化し、コンテキスト圧縮後も途中から再開できる

## ドキュメント自動同期

ソースコードを静的解析し、ファイル構造・クラス・メソッド・設定・依存関係を抽出します。抽出した構造データをテンプレートに注入し、章立てされたドキュメント（`docs/`）と `README.md` を生成します。

Spec-Driven Development フローの終了処理でドキュメントが自動更新されるため、コードとドキュメントの乖離が構造的に起きません。常に最新のドキュメントがあることで、人も AI もソースコード全体を読まずにシステムの構造や依存関係を把握できます。

## クイックスタート

### インストール

<pre>
npm install -g <!-- {{data("cli.project.name")}} -->senrail<!-- {{/data}} -->
</pre>

### セットアップ

<pre>
<!-- {{data("cli.project.name")}} -->senrail<!-- {{/data}} --> setup
</pre>

対話形式でプロジェクトタイプ（プリセット）と AI エージェントを設定します。

### 既存プロジェクトのドキュメントを生成する

既にソースコードがあるプロジェクトでは、ドキュメントを生成してシステムの全体像を把握できます。レガシーシステムの保守・引き継ぎにも有効です。

<pre>
<!-- {{data("cli.project.name")}} -->senrail<!-- {{/data}} --> docs build
</pre>

### Spec-Driven Development フローで開発する

**[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** — スキルで各フェーズを実行:

| スキル | フェーズ |
|---|---|
| `/senrail.flow` | full Spec-Driven Development flow（計画、実装、finalize） |

**[Codex CLI](https://github.com/openai/codex)** — `$` プレフィックスでツールを呼び出し:

| コマンド | フェーズ |
|---|---|
| `$senrail.flow` | full Spec-Driven Development flow（計画、実装、finalize） |

## コマンド一覧

| コマンド | 説明 |
|---|---|
| `setup` | プロジェクト登録・設定ファイル生成 |
| `docs build` | ドキュメント生成パイプラインを一括実行 |

全コマンドの詳細は `senrail help` または[コマンドリファレンス](docs/cli_commands.md)を参照してください。

## 設定

`setup` で `.senrail/config.json` が生成されます。

```jsonc
{
  "type": "node-cli",          // プロジェクトタイプ（プリセット名）
  "lang": "ja",                // 操作言語
  "agent": {
    "default": "claude",       // AI エージェント
    "providers": { ... }       // エージェント設定
  }
}
```

詳細は[設定リファレンス](docs/configuration.md)を参照してください。

## ドキュメント

<!-- {{data("cli.docs.chapters", {header: "", labels: "章|概要", ignoreError: true})}} -->
| 章 | 概要 |
| --- | --- |
| [ツール概要とアーキテクチャ](https://github.com/SpreadWorks/senrail/blob/main/docs/ja/overview.md) | sdd-forge は、ソースコードの静的解析と AI を組み合わせてドキュメントを自動生成する CLI ツールです。 |
| [技術スタックと運用](https://github.com/SpreadWorks/senrail/blob/main/docs/ja/stack_and_ops.md) | 本プロジェクトは Node.js（18.0.0 以上）上で動作する ES Modules ベースの CLI ツールであり、外部依存パッケージを持たず Node.js ビルトインモジュールのみを使用しています。 |
| [プロジェクト構成](https://github.com/SpreadWorks/senrail/blob/main/docs/ja/project_structure.md) | 本章では、sdd-forge パッケージのディレクトリ構成と各領域の役割を説明します。 |
| [CLI コマンドリファレンス](https://github.com/SpreadWorks/senrail/blob/main/docs/ja/cli_commands.md) | sdd-forge は docs・flow の 2 つの名前空間ディスパッチャーと setup・upgrade・presets・help の独立コマンドを合わせた 40 以上のサブコマンドを提供します。 |
| [設定とカスタマイズ](https://github.com/SpreadWorks/senrail/blob/main/docs/ja/configuration.md) | sdd-forge は .sdd-forge/config.json を唯一の設定ファイルとして読み込み、ドキュメント出力言語・プロジェクトタイプ・エージェント動作・SDD フロー設定など幅広い項目を一括管理します。 |
| [内部設計](https://github.com/SpreadWorks/senrail/blob/main/docs/ja/internal_design.md) | このプロジェクトは、src/check・src/docs・src/flow・src/lib の各層に責務を分離し、CLI コマンド層から共通ライブラリ層へ依存する一方向の構成で実装されています。 |
| [プリセット作成ガイド](https://github.com/SpreadWorks/senrail/blob/main/docs/ja/creating_presets.md) |  |
<!-- {{/data}} -->

## License

MIT
