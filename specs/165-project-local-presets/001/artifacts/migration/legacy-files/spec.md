# Feature Specification: 165-project-local-presets

**Feature Branch**: `feature/165-project-local-presets`
**Created**: 2026-04-10
**Status**: Draft
**Input**: Issue #130

## Goal

プロジェクト固有プリセットを `.sdd-forge/presets/<name>/` に配置することで built-in と同一の探索機構で解決できるようにし、DataSource のみを上書きする中途半端な仕組みである `.sdd-forge/data/` を廃止する。

## Scope

- プリセット探索機構に `.sdd-forge/presets/<name>/` を追加（built-in より優先）
- `preset.json` 省略時の fallback 処理（built-in 同名があれば設定を継承）
- DataSource のロードパスを `.sdd-forge/presets/<name>/data/` に統一（scan フェーズ・data 解決フェーズ両方）
- `.sdd-forge/data/` からのロードを廃止し、実行時に deprecation 警告を出力
- `sdd-forge check config` で `.sdd-forge/presets/` のプリセットも有効として認識

## Out of Scope

- `.sdd-forge/presets/` 内 DataSource による `sdd-forge` パッケージの import（4ea8 で対応）
- `~/.sdd-forge/presets/<name>/` ユーザー固有探索（add3 で対応）

## Why This Approach

`.sdd-forge/data/` は DataSource のみを上書きする専用機構として存在していたが、同等の機能は `presets/` の仕組みで実現できる。統一することで「プリセット = 1 ディレクトリ構造」という一貫したモデルが成立し、将来の `~/.sdd-forge/presets/` 対応（add3）とも自然に組み合わせられる。

## Clarifications (Q&A)

- Q: 前提条件 4ea8 との関係は？
  - A: 4ea8（sdd-forge/api 公開エントリポイント）と並列開発中。DataSource の `import 'sdd-forge'` は 4ea8 に委ねる。今回は探索・ロード経路の変更のみ。
- Q: `preset.json` 省略時の挙動は？
  - A: built-in に同名があれば設定（parent, scan, chapters）を引き継ぎつつ、DataSource のみを上書きする。同名がなければ bare プリセットとして機能。
- Q: `.sdd-forge/data/` 廃止時の通知は？
  - A: コマンド実行時に標準エラーへ deprecation 警告を出力する。既存の deprecated 警告と同一形式・チャネル。

## Alternatives Considered

- `.sdd-forge/data/` をそのまま維持する: 中途半端な専用機構が残り、将来の `~/.sdd-forge/presets/` 対応と二重化する。alpha 版ポリシー（後方互換コード不要）に照らして廃止が適切。

## Requirements

1. **（必須）** `config.type` にプリセット名が指定されている場合、プリセット解決機構は `.sdd-forge/presets/<name>/` を `src/presets/<name>/` より優先して探索しなければならない。
2. **（必須）** `.sdd-forge/presets/<name>/preset.json` が存在する場合、そのプリセット定義（parent, scan, chapters）を使用しなければならない。
3. **（必須）** `.sdd-forge/presets/<name>/` が存在し `preset.json` が省略された場合:
   - `src/presets/<name>/` に同名プリセットが存在するなら、built-in の設定を引き継ぎつつ `data/` のみを上書きしなければならない。
   - 同名が存在しなければ bare プリセット（parent なし）として機能しなければならない。
4. **（必須）** `.sdd-forge/presets/<name>/data/` 内の DataSource は、scan フェーズおよび data 解決フェーズの両方でロードされなければならない（現行の `.sdd-forge/data/` と同等の動作）。
5. **（必須）** `.sdd-forge/data/` からの DataSource ロードはこのバージョンで廃止する。ディレクトリが存在しても DataSource としてロードされてはならない。
6. **（推奨）** `.sdd-forge/data/` が存在する場合、いずれかのコマンド実行時に deprecation 警告を標準エラーへ出力し、`.sdd-forge/presets/<type>/data/` への移行を促さなければならない。

## Acceptance Criteria

- `.sdd-forge/presets/eccube/` に `preset.json`（parent: "symfony"）と `data/` を置き、`config.type: ["eccube"]` で動作する。
- `.sdd-forge/presets/symfony/data/` のみを置き（preset.json なし）、`config.type: ["symfony"]` で動作する。DataSource は `.sdd-forge/presets/symfony/data/` が優先される。
- `.sdd-forge/data/` ディレクトリが存在する場合に deprecation 警告が標準エラーに出力される。
- `.sdd-forge/data/` が存在していても DataSource としてロードされない。
- `sdd-forge check config` が `.sdd-forge/presets/` のプリセット名を有効な type として受け入れる。
- 既存の built-in プリセットのみを使うプロジェクトで動作が変わらない（regression なし）。

## Test Strategy

- **unit テスト** (`tests/`): プリセット探索関数が `.sdd-forge/presets/` → `src/presets/` の優先順で解決することを検証。`preset.json` 省略時の fallback 動作を検証。
- **integration テスト** (`specs/165-project-local-presets/tests/`): 一時ディレクトリに `.sdd-forge/presets/<name>/data/` を作成し、scan/data 両フェーズで DataSource がロードされることを検証。`.sdd-forge/data/` 存在時の deprecation 警告出力を検証。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-10
- Notes: スコープを解決機構のみ（4ea8 不要部分）に限定。DataSource の import 解決は 4ea8 で対応。

## Open Questions

- `.sdd-forge/presets/` のプリセット探索を `discoverPresets()` に組み込むか、`resolveChain()` 時に動的に解決するか（実装時判断 → `resolveChain(key, root?)` シグネチャ拡張で解決済み）

## Implementation Notes

- `sddDataDir` の削除に際し、`tests/unit/lib/config.test.js` に `sddDataDir` を対象とするテストが存在しないことを確認済み。削除による既存テストへの影響なし。
- `resolveChainSafe` の `catch` ブロックに `logger.verbose` を追加（既存の silent catch パターンを修正）。
