# Feature Specification: 191-preset-di-container

**Feature Branch**: `feature/191-preset-di-container`
**Created**: 2026-04-18
**Status**: Draft
**Input**: GitHub issue #161 — 外部プリセットの DI 化（sdd-forge 実装からの疎結合）

## Goal

sdd-forge の全プリセットが sdd-forge 内部実装パスに依存せず、DI Container 経由のみで sdd-forge の機能（設定・ロガー・agent・パス・基底クラス・言語ハンドラ・親プリセット資産等）にアクセスする構造にリファクタする。これにより sdd-forge 側の内部リファクタで preset が壊れなくなり、各 preset を独立 npm パッケージとして外部配布可能な状態にする。

## Scope

本 spec は以下を 1 PR で実装する:

1. **Container の preset 対応拡張**
   - preset が必要とするサービス（基底クラス、scanner ユーティリティ、path helper、言語ハンドラ）を Container に登録する
   - 親プリセット資産を Container から取得する経路を提供する（preset registry）
2. **preset エントリ形式の変更**
   - 全 preset の `data/*.js` ファイルの default export を、依存契約（Container）を引数で受け取るファクトリ関数形式に変更
   - エントリは Container への登録のみを行い、トップレベルで内部パスを import しない
3. **preset loader の置き換え**
   - 現行の「class を default export する前提」の読み込み経路を削除
   - 新形式エントリを呼び出して登録させる経路に置き換える
4. **公開 API 経路の整理**
   - `src/api.js` および `package.json` の `"./api"` exports を削除
   - 3-tier cross-import 経路（`package.json` の `"./presets/*"` exports と `src/sdd-forge.js` の module loader hook）を削除。preset が他 preset を直接 import する必要がなくなるため不要
5. **全プリセットの書き換え**
   - `src/presets/` 配下 37 プリセットの `data/` 配下ファイルを新形式に統一
6. **テスト整備**
   - Container preset registry の unit テスト
   - 全 preset の `register()` 契約テスト
   - 移行前後の docs build 出力 diff による回帰検証（spec ローカル acceptance）
   - 既存 `preset-scan-integrity.test.js` / `preset-datasources.test.js` の継続合格

## Out of Scope

- CLI コマンドインターフェースの変更（`sdd-forge docs build` 等の公開契約は不変）
- `docs/` テンプレート・章構成の変更
- preset ごとのスキャンロジック自体の修正（書き換えは純粋な構造変更に限定し、解析結果は変えない）
- `.sdd-forge/presets/` にユーザーが追加する外部プリセットへの影響調査（公開 API 契約として新形式を提示し、peerDependencies 運用で表現する方針のみ記す）
- Container の他コマンド層（flow / docs ディスパッチャ）への適用拡張（既に #155 で実施済みのためスコープ外）

## Clarifications (Q&A)

draft.md の Q1〜Q8 の結論を反映済み。主要決定:

- **スコープ**: 内部・外部プリセット両方を DI 化（外部配布を視野に、内部プリセットにも同契約を適用）
- **エントリ形式**: ファクトリ関数 `export default function register(container)` 形式
- **Container 公開 API**: 既存 `container.get("<key>")` 文字列キー方式を preset 層にも適用
- **移行戦略**: 全 preset 一括書き換え、後方互換なし（alpha ポリシー準拠）
- **API バージョニング**: 独立したバージョンフィールドは持たず、package.json の `peerDependencies` で互換表現
- **テスト**: 契約テスト + 移行前後 docs build 出力 diff の両方を担保
- **`sdd-forge/api` export**: 削除

## Alternatives Considered

| 案 | 採否 | 理由 |
|---|---|---|
| 外部 preset のみ DI 化し内部 preset は相対 import を継続 | 棄却 | 内部 preset を将来外部化する予定があり、契約を二重化する保守コストが合理的でない |
| 現行 class-based エントリを維持し、loader が container を後セット | 棄却 | 親 preset 継承時に require-time で親クラスを解決する必要があり、相対 import 禁止と両立しない |
| Container に `container.config` 等の名前付きフィールドを新設 | 棄却 | 既存 `_map` ベース実装と二重仕様になる |
| 基盤のみ先行、preset 移行は後続 spec で段階的に実施 | 棄却 | alpha ポリシー（後方互換コードを残さない）に反する。dead code の期間を作らない |
| Container API バージョンを `meta.version` で提供 | 棄却 | 単一バージョン運用のため不要。alpha 期間は package.json バージョンで表現する |
| `sdd-forge/api` export を保持 | 棄却 | Container 経由で同じものが取得でき、公開経路の二重化となる |

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-19
- Notes: autoApprove 経由で承認 (user instruction: "後はautoで進行してください")

## Requirements

### P0 — 契約の骨格

- **R1**: **When** sdd-forge が preset エントリモジュールを読み込むとき, **the system shall** 依存契約を引数で受け取るファクトリ関数として呼び出し, Container への登録以外のトップレベル副作用および sdd-forge 内部パス import を禁止する
- **R2**: **When** preset が sdd-forge の機能を利用するとき, **the system shall** 単一の依存契約（Container）経由のみでアクセス可能とし, sdd-forge 内部実装パスへの直接 import を preset コード内に 0 箇所で維持する
- **R3**: **When** preset が親プリセットの資産（基底 DataSource クラス等）を拡張するとき, **the system shall** 相対 import を使わず依存契約経由で取得して継承できる経路を提供する

### P1 — 移行範囲

- **R4**: **When** 本 spec が完了したとき, **the system shall** `src/presets/` 配下の 37 プリセット全てを新形式に書き換えた状態にする
- **R5**: **When** 本 spec が完了したとき, **the system shall** 旧形式 preset loader コードおよび `src/api.js` / `package.json` の `"./api"` exports を削除し, 後方互換コードを残さない
- **R6**: **When** preset が sdd-forge 内部ユーティリティ（ファイル走査 `findFiles`、パス判定 `hasPathPrefix`、言語ハンドラ `getLangHandler`、基底クラス `DataSource` / `Scannable` / `AnalysisEntry` / `Table` / `MarkdownText`）を必要とするとき, **the system shall** それらを Container のキー経由で提供する

### P2 — バージョニングと拡張

- **R7**: **When** preset と sdd-forge のバージョン整合を表現するとき, **the system shall** package.json の `peerDependencies` のみを手段とし, Container 内部に独立した API バージョンフィールドを持たない
- **R8**: **When** 依存契約に新しいサービスを追加するとき, **the system shall** 既存 preset のソースコードを変更させずに拡張可能（追加のみで既存キーは不変）な方式を採る

### P3 — 品質担保

- **R9**: **When** 本 spec の実装完了時, **the system shall** 移行前後で `sdd-forge docs build` の全 preset 生成物差分がゼロであることを acceptance テストで検証した状態にする
- **R10**: **When** preset が新形式エントリを実装したとき, **the system shall** 全 preset に対し `register()` 呼び出しによる登録内容を検証する契約テストを提供する
- **R11**: **When** 本 spec の実装完了時, **the system shall** 既存の `tests/unit/presets/preset-scan-integrity.test.js` および `preset-datasources.test.js` を合格し続ける状態にする

## Acceptance Criteria

1. `src/presets/` 配下の全 `.js` エントリファイル（preset.json 以外）で、`grep` により sdd-forge 内部パスへの相対 import（`../../../lib/`, `../../../docs/`, `../../<sibling-preset>/` 等）が **0 件** である
2. `package.json` の `exports` から `"./api"` キーが消えている。`src/api.js` ファイルが存在しない
3. 全 preset に対して `register(mockContainer)` を呼び出す契約テストが PASS する
4. 移行前後で `sdd-forge docs build` の生成物（`docs/**/*.md`、`.sdd-forge/output/analysis.json`）の diff が 0 である（全 preset を対象）
5. `npm test` で既存の preset-scan-integrity / preset-datasources 両テストが合格する
6. CLI コマンド契約（`sdd-forge docs build`, `sdd-forge scan`, `sdd-forge flow ...` 等）が無変更であることを既存 CLI テストで確認する

## Open Questions

実装中に判明する以下の事項は、発生時点で issue-log に記録する:

- 「Container に登録すべき sdd-forge 内部ユーティリティ」の網羅漏れ
- 特定 preset が使っている内部パス import のうち、Container 経由代替が自明でないもの
- 移行前後 docs build 出力 diff で差分が発生した場合の原因分析と修正
