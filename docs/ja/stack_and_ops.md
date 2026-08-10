<!-- {{data("base.docs.langSwitcher", {labels: "relative"})}} -->
**日本語** | [English](../stack_and_ops.md)
<!-- {{/data}} -->

# 技術スタックと運用

<!-- {{data("monorepo.monorepo.apps", {labels: "stack_and_ops", ignoreError: true})}} -->
<!-- {{/data}} -->

## 説明

<!-- {{text({prompt: "この章の概要を1〜2文で記述してください。使用言語・フレームワーク・主要ツールのバージョンを踏まえること。"})}} -->

本プロジェクトは Node.js（18.0.0 以上）上で動作する ES Modules ベースの CLI ツールであり、外部依存パッケージを持たず Node.js ビルトインモジュールのみを使用しています。パッケージマネージャーには pnpm 10.33.0 を採用し、npm レジストリへ `sennel` として公開しています。
<!-- {{/text}} -->

## 内容

### 技術スタック

<!-- {{text({prompt: "技術スタックをカテゴリ・技術名・バージョンの表形式で記述してください。"})}} -->

| カテゴリ | 技術名 | バージョン |
|---|---|---|
| 言語 | JavaScript（ES Modules） | `"type": "module"` |
| ランタイム | Node.js | >= 18.0.0 |
| パッケージマネージャー | pnpm | 10.33.0 |
| パッケージレジストリ | npm | — |
| CLI エントリーポイント | sennel バイナリ | `./src/sennel.js` |
| 外部依存 | なし（Node.js ビルトインのみ） | — |
<!-- {{/text}} -->

### 依存パッケージ

<!-- {{text({prompt: "プロジェクトの依存パッケージ管理方法を説明してください。"})}} -->

本プロジェクトは外部依存パッケージを持たないポリシーを採用しており、`fs`・`path`・`child_process`・`url` など Node.js ビルトインモジュールのみを使用しています。`dependencies` および `devDependencies` フィールドはいずれも空です。

パッケージマネージャーには pnpm 10.33.0 を使用しており、`package.json` の `packageManager` フィールドに SHA512 完全性ハッシュ付きで固定されています。これにより、すべての開発者が同一の再現可能な環境を得られます。ロックファイル（`pnpm-lock.yaml`、フォーマット 9.0）はリポジトリにコミットして管理します。

Dependabot による自動脆弱性監視が `.github/dependabot.yml` で週次スケジュールとして設定されています。
<!-- {{/text}} -->

### デプロイフロー

<!-- {{text({prompt: "デプロイの手順とフローを説明してください。"})}} -->

npm への公開は、ユーザーがリリースの意図を明示した場合にのみ実施します。手順は以下の 2 ステップです。

1. **パッケージ検証** — `npm pack --dry-run` を実行し、公開対象ファイルを確認するとともに、機密情報が含まれていないことを確かめます。
2. **alpha タグで公開** — `npm publish --tag alpha` を実行します。
3. **latest タグへのプロモート** — `npm dist-tag add sennel@<version> latest` を実行します。

`npm publish --tag alpha` のみでは npm レジストリページの `latest` タグが更新されないため、必ず 2 段階で実施してください。バージョン番号は `0.1.0-alpha.N`（N = `git rev-list --count HEAD` の値）形式を使用します。一度公開したバージョン番号は再利用できないため（unpublish 後も 24 時間は不可）、注意が必要です。現時点では自動化された CI/CD パイプラインは構成されていません。
<!-- {{/text}} -->

### 運用フロー

<!-- {{text({prompt: "運用手順を説明してください。"})}} -->

日常的な運用では以下のコマンドを使用します。

- **プロジェクト初期化**: `sennel setup` — 新規プロジェクトのセットアップを行います。
- **スキル・テンプレートの更新**: `sennel upgrade` — `src/templates/` や `src/presets/` の変更をプロジェクトのスキル・設定に反映します。変更があったファイルのみ更新されます。
- **ドキュメント生成**: `sennel build` — scan → enrich → init → data → text → readme の順でドキュメントを生成します。各ステージを個別に実行することも可能です。
- **テスト実行**: `pnpm test`（全テスト）、`pnpm run test:unit`（ユニットテスト）、`pnpm run test:e2e`（E2E テスト）、`pnpm run test:acceptance`（受け入れテスト）。
- **SDD フロー管理**: `sennel flow` サブコマンド群（`start`・`status`・`resume`・`review`・`merge`・`cleanup`）でフロー状態を管理します。

テスト実行など長時間かかるコマンドの結果は `command > /tmp/output.log 2>&1` でファイルに保存し、`grep` や Read ツールで確認します。
<!-- {{/text}} -->

### alpha リリース invariant

release train の全変更を commit し、対象 worktree が clean になった後で `npm run release:version:sync` を実行します。このコマンドは、専用 version commit の作成後に `git rev-list --count HEAD` と一致する `0.1.0-alpha.N` を `package.json` だけへ設定します。その manifest 変更だけを最後の release commit として commit し、続けて `npm run release:preflight` を実行します。

preflight と単独実行用の `npm run release:version:validate` は、package version と HEAD の commit count を同じ validator で比較し、形式不正または stale な version なら失敗します。その後に別 commit を追加した場合、release 対象 HEAD は確定状態ではなくなるため、release 前に専用の version 同期 commit をやり直します。これらのコマンドは release 状態を検証するだけで、package の公開は行いません。

### テストコマンド契約

| コマンド | 選択範囲 |
| --- | --- |
| `npm test` | ユニットテストと E2E テスト |
| `npm run test:unit` | ユニットテストのみ |
| `npm run test:e2e` | E2E テストのみ |
| `npm run test:acceptance` | fixture から検出した受け入れテスト |
| `npm run test:agent` | 実プロバイダーを使う agent テスト |
| `npm run test:all` | 既定テストと実プロバイダーを使う agent テスト |
| `npm run test:ci` | 認証情報不要の unit、E2E、stub acceptance、CLI smoke の各ステージ |

`npm run test:ci` は 4 ステージを順番に実行し、最初の失敗で停止します。`tests/agent` は選択しません。プロバイダー認証情報を利用できる場合だけ `npm run test:agent` を明示的に実行します。

`node tests/run.js --help` はテストを検出・実行せず usage を表示します。機械可読の一覧取得には `--list --json` の組み合わせが必要で、suite または file の有効な選択を 1 つ指定できます。`--preset`、`--scope`、`--agent`、`--all` は相互排他で、file 選択と併用できません。複数の `--file`、複数の `--pattern`、位置引数は 1 つの file union として解決後に重複排除されます。

---

<!-- {{data("base.docs.nav")}} -->
[← ツール概要とアーキテクチャ](overview.md) | [プロジェクト構成 →](project_structure.md)
<!-- {{/data}} -->
