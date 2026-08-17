# Feature Specification: 144-extract-parse-helpers

**Feature Branch**: `feature/144-extract-parse-helpers`
**Created**: 2026-04-04
**Status**: Approved
**Input**: Issue #92

**開発種別:** リファクタリング

**目的:** DataSource の `parse()` メソッドと `analyze*()` ディレクトリレベル関数で重複しているパースロジックを共有ヘルパーに抽出し、DRY 原則を回復する。

## Goal

各プリセットの DataSource ファイルで `parse()` と `analyze*()`/`parse*Scan()` 間に存在するパースロジックの重複を、プリセットごとのプライベートヘルパー関数に抽出して解消する。

## Scope

以下の5ファイルを対象とする:

1. **`src/presets/laravel/data/controllers.js`** — `parse()` と `parseControllerScan()` の重複解消
2. **`src/presets/laravel/data/models.js`** — `parse()` と `parseModelScan()` の重複解消
3. **`src/presets/symfony/data/controllers.js`** — `parse()` と `parseControllerFile()` の重複解消
4. **`src/presets/symfony/data/entities.js`** — `parse()` と `parseEntityFile()` の重複解消
5. **`src/presets/cakephp2/data/models.js`** — `parse()` と `analyzeModels()` 内ループ本体の重複解消

## Out of Scope

- webapp 親の `parse()` メソッド（子が override するため重複ではない）
- cakephp2/data/controllers.js の `analyzePermissionComponent()`, `analyzeAcl()` — parse() と無関係の解析
- cakephp2/data/commands.js の `analyzeCommandDetails()` — parse() との重複は class match のみで軽微
- クロスプリセットの汎用ヘルパー抽出（各プリセットの parse ロジックは FW 固有）
- 新しいファイル追加（既存ファイル内にヘルパーを配置する）

## Clarifications (Q&A)

- Q: ヘルパーの配置場所は？
  - A: 各 DataSource ファイル内のモジュールスコープ関数として配置する。`analyze*()` と同じファイルに既にあるため、新ファイルは不要。

- Q: ヘルパーの命名規約は？
  - A: `parseOneFile(content)` または `parseContent(content)` 形式。content (文字列) を受け取り、パース結果オブジェクトを返す。ファイル読み込みはヘルパーの外で行う。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-04 (autoApprove mode)
- Notes: Self-Q&A による自動承認

## Requirements

（優先順位: P1 が最高。P1 は変更の正当性、P2 は設計制約、P3 は品質検証。）

1. [P1] 対象ファイル（Scope 記載の5ファイル）の `parse()` と `analyze*()`/`parse*Scan()` にパースロジックの重複がある場合、その重複部分をモジュールスコープのヘルパー関数に抽出すること
2. [P1] ヘルパーを抽出した場合、`parse()` メソッドはそのヘルパーを呼び出して AnalysisEntry を構築すること
3. [P1] ヘルパーを抽出した場合、`analyze*()` / `parse*Scan()` 関数もそのヘルパーを呼び出してデータを構築すること
4. [P2] ヘルパーを新規作成する場合、`content` (文字列) を引数に取り、パース結果の素オブジェクトを返すこと（ファイル I/O を含まない）
5. [P2] リファクタリングを行った場合、外部インターフェース（`parse()` の戻り値型、`analyze*()` の戻り値型、export 一覧）を変更しないこと
6. [P3] 全変更完了後、既存テストがすべてパスすること

## Test Plan

- **既存テストの維持**: 既存の unit / e2e / acceptance テストがすべてパスすることで、外部インターフェースの不変を検証する
- **新規テスト不要の根拠**: 本変更は純粋なリファクタリング（extract method）であり、新しい機能・分岐・エッジケースを追加しない。抽出されるヘルパーは既存の `parse()` テストと `analyze*()` テストで間接的にカバーされる

## Acceptance Criteria

- [x] laravel/controllers: parse() と analyzeControllers() が共通ヘルパーを使用
- [x] laravel/models: parse() と analyzeModels() が共通ヘルパーを使用
- [x] symfony/controllers: parse() と analyzeControllers() が共通ヘルパーを使用
- [x] symfony/entities: parse() と analyzeEntities() が共通ヘルパーを使用
- [x] cakephp2/models: parse() と analyzeModels() が共通ヘルパーを使用
- [x] `npm test` が全パス (1439/1439 passed, 0 failed)
- [x] 各ヘルパーが content 文字列を受け取り、ファイルI/Oを含まない

## Open Questions

- (none)
