# Draft: sdd-forge/api 公開エントリポイントとモジュールローダーフック

**開発種別:** 機能追加
**目的:** 外部プリセット（`~/.sdd-forge/presets/`、`.sdd-forge/data/`）が `DataSource`・`Scannable`・`AnalysisEntry` の基底クラスを `import 'sdd-forge/api'` で参照できるようにする

## 背景

外部プリセットや `.sdd-forge/data/` の DataSource は sdd-forge の基底クラスを継承する必要がある。しかし現在これらは相対 import でのみ参照されており、外部ファイルからは利用できない。Node.js ESM はファイル自身の場所を起点に `node_modules` を探索するため、グローバルインストールされた sdd-forge のパスには到達しない。

## スコープ

**今回対応する:**
- 基底クラス（`DataSource`・`Scannable`・`AnalysisEntry`）の公開 API エントリポイントの作成
- パッケージ exports マップへの `sdd-forge/api` サブパスの追加
- モジュールローダーフックの実装と起動時登録
- Node.js 動作保証バージョンを `>=18.19.0` に引き上げ

**今回対応しない（b554 に分離）:**
- 外部プリセット間のクロスimport（`sdd-forge/preset/*` 名前空間）

## Q&A

**Q1: Node.js version 要件はどうするか？**
モジュールローダーフック機能の安定版は Node.js 18.19+ が必要。現 engines は `>=18.0.0`。
→ **A: `>=18.19.0` に bump する。** alpha 期間は後方互換不要。

**Q2: `WebappDataSource` を `src/api.js` に含めるか？**
`WebappDataSource` は `Scannable(DataSource)` の薄いラッパー。外部 webapp 系プリセットが内部と同じパターンで書けるメリットがある。
→ **A: 除外する。** API を最小に保つ。外部プリセットは `Scannable(DataSource)` を自分で組み合わせる。

**Q3: 外部プリセット間のクロスimportは今回の範囲か？**
→ **A: 範囲外。** ボード b554 に分離済み。#129 は `sdd-forge/api`（基底クラス）のみ。

**Q4: サブパス名は何にするか？**
→ **A: `sdd-forge/api` のまま。** `sdd-forge` はパッケージ名（固定）、`/api` は `exports` マップで定義（任意）。

## 実装要件

優先順位順（上位ほど依存されるため先に実装する）：

1. **[高] 公開 API エントリポイントの作成** — `DataSource`・`Scannable`・`AnalysisEntry` の3クラスを公開 API としてまとめて export する。外部ファイルはこのエントリポイント1か所から必要なクラスをインポートできる。
2. **[高] パッケージ exports マップの定義** — `sdd-forge/api` というサブパスで公開 API にアクセスできるよう、パッケージの exports マップを定義する。定義外の内部パスへの直接アクセスはブロックされる（ビルトインプリセットは相対 import を使用しており影響なし）。`import 'sdd-forge'`（ルートパス）も引き続き機能するよう、既存のエントリポイントをマップに明示する。
3. **[高] Node.js バージョン要件の明示** — モジュールローダーフック（要件4）を利用するには Node.js 18.19+ が必要なため、パッケージの動作保証バージョン範囲を `>=18.19.0` に引き上げる。これ以前のバージョンではフックが使用できず、外部ファイルからの `sdd-forge/api` import が機能しない。
4. **[中] モジュールローダーフックの登録** — sdd-forge プロセス起動時に、外部ファイルが `import 'sdd-forge/api'` と記述するだけでグローバルインストールされた sdd-forge のクラスにアクセスできるよう、ローダーフックを登録する。既存コマンドの動作に変化はない。
5. **[低] ローダーフックの自動テスト** — ローダーフックの import 解決動作を、CLI の全コマンドパイプラインを起動せずに検証する自動テストを用意する。

## 既存機能への影響

- ビルトインプリセット: 相対 import を使用しており、`exports` 追加の影響を受けない
- テストコード: ソースを相対パスで直接 import しており、影響なし
- `sdd-forge` CLI ユーザー: ローダーフックは透過的で既存コマンドの動作に変化なし
- Node.js バージョン: 18.0.0–18.18.x 環境は利用不可になる（alpha 期間のため許容）

## テスト方針

- パッケージの exports マップに `sdd-forge/api` サブパスが定義されており、かつルートパス（`import 'sdd-forge'`）が引き続き機能すること
- 公開 API が `DataSource`・`Scannable`・`AnalysisEntry` の3クラスのみを export していること（過不足なし）
- sdd-forge プロセス内から外部ファイルが `sdd-forge/api` を import したとき、クラスのインスタンス化に成功すること

---

- [x] User approved this draft (2026-04-10)
