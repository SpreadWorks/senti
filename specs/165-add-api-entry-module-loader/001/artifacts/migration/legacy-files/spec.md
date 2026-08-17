# Feature Specification: 165-add-api-entry-module-loader

**Feature Branch**: `feature/165-add-api-entry-module-loader`
**Created**: 2026-04-10
**Status**: Draft
**Input**: GitHub Issue #129

## Goal

外部プリセット（`~/.sdd-forge/presets/`、`.sdd-forge/data/`）が `import 'sdd-forge/api'` の一行で `DataSource`・`Scannable`・`AnalysisEntry` の基底クラスにアクセスできるようにする。

## Why This Approach

Node.js ESM はファイル自身の場所を起点に `node_modules` を探索するため、グローバルインストールされた `sdd-forge` のパスには到達できない。`package.json` の `exports` マップでサブパスを定義し、モジュールローダーフックで `sdd-forge/*` 指定の解決をパッケージ自身に委ねることで、外部ファイルの配置場所に依存しない import を実現する。

## Scope

- 公開 API エントリポイントの作成（`DataSource`・`Scannable`・`AnalysisEntry` の3クラスを export）
- `package.json` の `exports` マップへの `sdd-forge/api` サブパス追加
- sdd-forge プロセス起動時のモジュールローダーフック登録
- Node.js 動作保証バージョンを `>=18.19.0` に引き上げ
- ローダーフックの自動テスト

## Out of Scope

- 外部プリセット間のクロスimport（`sdd-forge/preset/*` 名前空間）→ ボード b554 に分離
- `WebappDataSource` の公開 API への追加

## Clarifications (Q&A)

- Q: Node.js version 要件はどうするか？モジュールローダーフック機能の安定版は 18.19+ が必要だが、現 engines は `>=18.0.0`。
  - A: `>=18.19.0` に bump する。alpha 期間は後方互換不要なため。

- Q: `WebappDataSource` を公開 API に含めるか？
  - A: 除外する。`WebappDataSource` は `Scannable(DataSource)` の薄いラッパーに過ぎず、外部プリセットはプリミティブを組み合わせることで同等の継承が可能。API 表面積を最小に保つ。

- Q: 外部プリセット間のクロスimport（例: `my-webapp` を継承した `my-specific-app`）は今回のスコープか？
  - A: スコープ外。ボード b554 に分離済み。本 spec は `sdd-forge` 基底クラスの公開に絞る。

- Q: サブパス名は何にするか？
  - A: `sdd-forge/api` のまま。`sdd-forge` はパッケージ名（固定）、`/api` は `exports` マップで定義するサブパス（任意）。

## Alternatives Considered

- **相対 import（`../../node_modules/sdd-forge/src/docs/lib/data-source.js`）**: パスが fragile で、インストール環境により変わる。採用しない。
- `WebappDataSource` の公開: 外部 webapp 系プリセットが内部と同じパターンで書けるが、プリセット層クラスをコア API に含めることになり API が膨らむ。除外。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-10
- Notes: WebappDataSource 除外、engines >=18.19.0 bump、外部プリセット間クロスimportは b554 に分離

## Requirements

優先順位順（上位ほど他の要件に依存される）：

1. **[高] 公開 API エントリポイント** — 外部ファイルが `import { DataSource, Scannable, AnalysisEntry } from 'sdd-forge/api'` を記述したとき、`DataSource`・`Scannable`・`AnalysisEntry` の3クラスのみが得られること（過不足なし）。
2. **[高] exports マップの定義** — `sdd-forge/api` サブパスで公開 API にアクセスできること。`import 'sdd-forge'`（ルートパス）が引き続き機能すること。定義外の内部パスへの直接アクセスはブロックされること。
3. **[高] Node.js バージョン要件の引き上げ** — モジュールローダーフックを利用するため、パッケージの動作保証バージョンが `>=18.19.0` であること。18.19.0 未満では機能が利用不可である旨が明示されること。
4. **[中] モジュールローダーフックの登録** — sdd-forge プロセス起動時に、外部ファイルが `import 'sdd-forge/api'` と記述するだけでグローバルインストールされた sdd-forge のクラスにアクセスできるローダーフックが登録されること。既存コマンドの動作に変化がないこと。
5. **[低] ローダーフックの自動テスト** — CLI の全コマンドパイプラインを起動せずに、ローダーフックの import 解決動作を検証する自動テストが存在すること。

## Acceptance Criteria

1. `import { DataSource, Scannable, AnalysisEntry } from 'sdd-forge/api'` で3クラスがインポートでき、それぞれインスタンス化できること。
2. `import 'sdd-forge'` が引き続き sdd-forge CLI エントリポイントを返すこと（exports 追加後も回帰なし）。
3. `package.json` の `engines.node` が `>=18.19.0` に変更されていること。
4. sdd-forge プロセス内でロードされた外部ファイルが `sdd-forge/api` を import したとき、クラスのインスタンス化に成功すること。
5. ローダーフックの自動テストが `npm test` の実行ターゲットに含まれること。
6. 既存のすべてのテストがパスすること（回帰なし）。

## Test Strategy

- **ユニットテスト（`tests/unit/`）**:
  - 公開 API が `DataSource`・`Scannable`・`AnalysisEntry` の3クラスのみを export していることを検証
  - ローダーフックが `sdd-forge/api` を正しいファイルパスに解決することを検証
- **受け入れテスト（`specs/165-add-api-entry-module-loader/tests/`）**:
  - 外部ファイルから `sdd-forge/api` を import して各クラスをインスタンス化できることを検証

## Open Questions

- (なし)
