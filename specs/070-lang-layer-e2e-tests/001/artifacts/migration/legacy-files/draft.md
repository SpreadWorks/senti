# Draft: lang層 e2e テスト (#070)

## 背景

preset 階層の lang 層（`preset.json` の `lang` フィールドで宣言）は、
parent チェーンとは独立に DataSource・テンプレート・章を追加合成する仕組み。

既存テスト状況:
- `tests/e2e/065-preset-hierarchy.test.js`: `resolveLangPreset()`, `buildLayers()`, `config.stack()` のユニット的検証あり
- `tests/acceptance/`: 全プリセットでフルパイプライン実行しているが、lang 層固有の検証はしていない

不足: scan, init, data を**個別に実行**して、各ステップで lang 層が正しく合成されているかの e2e テスト。

## テスト対象

| ステップ | 検証内容 | lang 層 |
|---|---|---|
| scan | lang 層の DataSource がロードされ、extras に結果が入る | node, php |
| init | lang 層のテンプレートが合成され、章ファイルが正しく生成される | node, php |
| data | lang 層の DataSource でディレクティブ（`config.stack` 等）が解決される | node, php |

## テスト設計

### fixture
- **node-cli**: `tests/acceptance/fixtures/node-cli/` を再利用（package.json + src/*.js あり）
- **laravel**: `tests/acceptance/fixtures/laravel/` を再利用（composer.json + app/ あり）

### scan テスト
1. node-cli: scan 実行 → `analysis.json` に `config` カテゴリのデータが含まれること（node lang 層の DataSource が scan した結果）
2. laravel: scan 実行 → `extras` に `composerDeps`, `envKeys`, `providers` 等が含まれること（php lang 層経由ではなく laravel 固有だが、lang 層の config DataSource も合成されていること）

### init テスト
1. node-cli (`cli/node-cli`): init 実行 → lang 層の `stack_and_ops.md` テンプレートが章に含まれること
2. laravel (`webapp/laravel`): init 実行 → webapp + laravel の章テンプレートが生成されること
3. 章順序: `resolveChaptersOrder()` が lang 層の chapters を union マージしていること

### data テスト
1. node-cli: init + data 実行 → `config.stack` ディレクティブが lang 層の DataSource で解決されること
2. laravel: init + data 実行 → `config.composer` 等のディレクティブが解決されること

## テスト実行方式
- e2e テスト方式: `execFileSync` または `main()` の直接呼び出し
- tmpDir に config.json + fixture ソースをコピー
- env vars: `SDD_WORK_ROOT`, `SDD_SOURCE_ROOT`

## 決定事項
- テスト粒度: 各ステップ個別検証（scan, init, data）
- テスト対象: node-cli（node 層）+ laravel（php 層）の両方
- fixture: acceptance テストの既存 fixture を再利用

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-03-18
