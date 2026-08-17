# Draft: 068-test-restructure

## Requirements Summary

### 1. ディレクトリ構造の再編成
- `tests/unit/` と `tests/e2e/` を作成
- 既存53ファイルを振り分け（unit: 29, e2e: 25）※下記リスト参照
- サブディレクトリ構造は維持（`docs/lib/`, `docs/commands/`, `flow/commands/` 等）

### 2. package.json test スクリプト更新
- `test`: 全テスト実行（`find tests/unit tests/e2e ...`）
- `test:unit`: unit のみ
- `test:e2e`: e2e のみ

### 3. SHALLOW テスト書き直し（5ファイル）
1. `resolver-factory.test.js` — DataSource ロード・overrides マージ・エラーハンドリング
2. `data.test.js` — `{{data}}` ディレクティブ解決の実データ検証
3. `forge-prompts.test.js` — buildForgeFilePrompt アサーション強化
4. `forge.test.js` — プロンプト生成の網羅的テスト
5. `process.test.js` — タイムアウト・大出力テスト

### 4. MISSING_COVERAGE テスト補強（3ファイル）
1. `readme.test.js` — README 生成の内容検証追加
2. `merge.test.js` — dry-run 以外の実行パス検証
3. `cleanup.test.js` — ブランチ/worktree 削除の正常系・異常系

### 5. 欠落 HIGH 新規テスト作成（3ファイル）
1. `data-source.test.js` — 基底クラス（desc(), toMarkdownTable, カテゴリメタデータ）
2. `text.test.js` — text コマンド main の E2E テスト
3. `flow/commands/start.test.js` — flow start コマンド（状態初期化、ブランチ/worktree 作成）

## 振り分けリスト

### tests/unit/ (29ファイル)
```
lib/cli.test.js
lib/config.test.js
lib/agent.test.js
lib/i18n.test.js
lib/types.test.js
lib/process.test.js
docs/lib/directive-parser.test.js
docs/lib/template-merger.test.js
docs/lib/scanner.test.js
docs/lib/review-parser.test.js
docs/lib/resolver-factory.test.js
docs/lib/forge-prompts.test.js
docs/lib/test-env-detection.test.js
docs/lib/text-prompts.test.js
docs/lib/command-context.test.js
docs/commands/enrich.test.js
docs/commands/text-helpers.test.js
docs/commands/text-batch.test.js
docs/commands/translate.test.js
docs/commands/forge.test.js
docs/commands/forge-selective.test.js
docs/data/docs-lang-switcher.test.js
flow.test.js
flow/commands/review.test.js
specs/commands/gate.test.js
specs/commands/guardrail.test.js
package.test.js
presets/laravel/analyzers.test.js
presets/symfony/analyzers.test.js
```

### tests/e2e/ (25ファイル)
```
dispatchers.test.js
help.test.js
docs/commands/scan.test.js
docs/commands/data.test.js
docs/commands/readme.test.js
docs/commands/init.test.js
docs/commands/setup.test.js
docs/commands/agents.test.js
docs/commands/changelog.test.js
docs/commands/review.test.js
flow/commands/merge.test.js
flow/commands/status-check.test.js
flow/commands/cleanup.test.js
flow/commands/resume.test.js
specs/commands/init.test.js
presets/laravel/scan.test.js
presets/laravel/integration.test.js
presets/symfony/scan.test.js
presets/symfony/integration.test.js
043-configurable-scan.test.js
051-skill-namespace.test.js
052-agent-command-config.test.js
060-help-layout-validate-config.test.js
062-incremental-scan.test.js
065-preset-hierarchy.test.js
```

## Decisions
- 振り分け基準: unit=単一モジュール隔離テスト、e2e=CLI実行/複数モジュール連携テスト
- Mixed テスト（review.test.js, guardrail.test.js）は主要な性格で分類
- spec 番号付きテスト（043, 051, ...）は全て e2e

- [x] User approved this draft
- Confirmed at: 2026-03-17
