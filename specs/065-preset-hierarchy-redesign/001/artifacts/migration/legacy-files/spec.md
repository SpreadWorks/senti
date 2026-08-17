# Feature Specification: 065-preset-hierarchy-redesign

**Feature Branch**: `feature/065-preset-hierarchy-redesign`
**Created**: 2026-03-17
**Status**: Draft
**Input**: preset 階層の再設計（合成モジュール方式の導入、parent チェーン化、Node.js 対応）とモノレポ対応（setup でのモノレポ判定、docs スキップ）

## Goal

現行の2層固定プリセット階層（arch → leaf）を、合成モジュール方式による可変長 parent チェーンに再設計する。
これにより Node.js webapp 等の新しい技術スタックに対応し、モノレポプロジェクトでの SDD フロー利用を可能にする。

## Background

- デモ用 Next.js プロジェクトで README の技術スタック（`config.stack`）が空だった
- 原因: webapp プリセットに `config.js` DataSource がなく、PHP 系子プリセット（cakephp2）にしか存在しない
- webapp の data/templates は実質 PHP MVC 向け（controllers, models, routes 等）
- 2層固定（arch → leaf）では中間層（言語層など）を入れられない

## Scope

### 1. 合成モジュール方式の導入（preset.json 構造変更）

- `preset.json` の `arch` フィールドを `parent` に変更
- 新規フィールド `axis` を追加（`"lang"`, `"framework"`, `"platform"`, `"database"`）
- Phase 1 では `lang` + `framework` 軸のみ実装。`platform` / `database` は将来対応

### 2. parent チェーン化（2層固定 → 可変長）

- preset.json の `parent` で宣言的に親を指定
- resolver-factory: 固定2層 → parent チェーンを動的に歩く
- template-merger: 同様に可変長チェーン対応
- scan.js: 同様に可変長チェーン対応

**論理チェーン例:**
```
base → php → webapp → cakephp2
base → php → webapp → laravel
base → php → webapp → symfony
base → node → cli → node-cli
base → node → webapp → nextjs（将来）
```

### 3. 新規プリセット追加

#### `src/presets/php/`
- `preset.json`: `{ "parent": "base", "axis": "lang", "label": "PHP" }`
- `data/config.js`: `config.stack()` — composer.json から PHP バージョン、フレームワーク、主要パッケージを抽出して技術スタックテーブルを返す
- テンプレートは不要（base のテンプレートを継承、stack_and_ops の `{{data: config.stack}}` ディレクティブは既存）

#### `src/presets/node/`
- `preset.json`: `{ "parent": "base", "axis": "lang", "label": "Node.js" }`
- `data/config.js`: `config.stack()` — package.json から Node.js バージョン、フレームワーク、主要パッケージを抽出して技術スタックテーブルを返す
- テンプレートは不要（同上）

### 4. 既存プリセットの parent 移行

| preset | 現行 arch | 新 parent | axis |
|---|---|---|---|
| base | (root) | (なし) | - |
| php | - (新規) | base | lang |
| node | - (新規) | base | lang |
| webapp | webapp | base | - |
| cli | cli | base | - |
| library | library | base | - |
| cakephp2 | webapp | webapp | framework |
| laravel | webapp | webapp | framework |
| symfony | webapp | webapp | framework |
| node-cli | cli | cli | framework |

**言語層の解決**: cakephp2/laravel/symfony の parent チェーンは `FW → webapp → base` だが、PHP 言語層の DataSource も必要。preset.json に `"lang": "php"` フィールドを追加し、resolver-factory が parent チェーンに加えて lang 層の DataSource も自動ロードする。

### 5. config.json の type → 合成モジュール対応

```jsonc
{
  "type": "symfony"           // FW 名だけ指定（言語は自動判定）
}
```

- `type` は leaf プリセット名（現行と同じ）
- parent チェーンは sdd-forge が自動解決
- ユーザーの config.json 変更は不要（後方互換）

### 6. DataSource ロード順の変更

現行: `common → arch → leaf → project`
新規: `common → (parent chain: base → ... → leaf) → lang layer → project`

- parent チェーンを root から leaf へ順に歩き、各層の `data/` から DataSource をロードする
- 子が親を override する点は変わらない
- lang 層は parent チェーンとは別に追加ロード（FW preset が `lang: "php"` を宣言している場合）

### 7. テンプレート・DataSource の検証と調整

#### 現状の分析結果

**webapp DataSource（汎用・変更不要）:**
- `controllers.js` — base class。scan() は scanCfg に依存し FW 非依存
- `models.js` — base class。同上
- `shells.js` — base class。同上
- `tables.js` — base class。scan() は null を返す（models から派生）

**webapp DataSource（PHP ハードコード箇所あり）:**
- `routes.js` — scan() 内の正規表現が `Router::connect|Route::get|...` と PHP 固有。ただし子プリセットが override するため実害は限定的。将来的に lang 層に分離を検討

**FW 固有 DataSource（変更不要・各 FW preset に残す）:**
- cakephp2/data/: config, controllers, models, shells, tables, libs, views, tests, docker, email
- laravel/data/: config, controllers, models, routes, tables, commands
- symfony/data/: config, controllers, entities, routes, tables, commands

**テンプレート（変更不要）:**
- webapp テンプレートの `{{data}}` ディレクティブ（controllers.list, config.stack 等）は DataSource 名.メソッド名で解決されるため、どの層が DataSource を提供しても動作する
- config.stack は現在 cakephp2/data/config.js にのみ存在 → php/ と node/ の lang 層に新設することで全言語で動作

### 8. setup でのモノレポ判定

- setup ウィザードに「単一プロジェクト / モノレポ」の選択肢を追加
- モノレポ選択時: config.json に `projects` フィールドを生成

```jsonc
{
  "lang": "ja",
  "projects": {
    ".": { "type": "node" },
    "apps/web": { "type": "nextjs" },
    "apps/api": { "type": "express" }
  }
}
```

- 各サブプロジェクトが独立した preset チェーンを持つ

### 9. モノレポ時の docs 生成スキップ

- モノレポ（`projects` フィールドあり）の場合、docs 生成は coming soon として無効化
- scan / enrich はサブプロジェクト単位で実行可能
- SDD フロー（spec init, gate, flow）は通常通り使用可能

### 10. E2E 検証

テスト用 fixture を作成し、parent チェーン変更後のパイプラインを検証する：

#### 既存プリセットのリグレッション検証
- sdd-forge 自身（`type: "node-cli"`）で `scan → init → data` を実行
- 既存スナップショットと比較（`sdd-forge snapshot check`）
- チェーン変更後も同一出力であることを確認

#### 新規プリセットの動作検証
- テスト用 Node.js プロジェクト fixture（最小限の package.json + src/）を作成
- `type: "node"` で `scan → init → data` を実行
- `config.stack()` が技術スタックテーブルを正しく返すことを確認

#### ユニットテスト
- `presets.js`: parent チェーン解決のテスト（`resolveChain("cakephp2")` → `["base", "webapp", "cakephp2"]`）
- `resolver-factory.js`: parent チェーンに沿った DataSource ロードのテスト
- `template-merger.js`: 可変長レイヤーでのテンプレートマージのテスト

## Out of Scope

- モノレポの docs 対応（テンプレート合成、AI マージ）→ 別 spec
- `platform` / `database` 軸の実装 → 将来 spec
- `preset install` コマンド → 将来 spec
- `.sdd-forge/templates/` への永続化（モノレポ用テンプレートマージ）→ 別 spec
- 共通章/固有章の判定ロジック → 別 spec
- ディレクティブの project スコープ指定構文 → 別 spec
- webapp/data/routes.js の PHP ハードコード除去（実害なし、将来対応）
- 既存テンプレート .md ファイルの内容変更（ディレクティブは汎用的であり変更不要）

## Design Decisions

### なぜ合成モジュール方式か

preset は1本のチェーンではなく、複数の軸（lang, framework, platform, database）の合成で構成する。
各軸が独立した章を提供し、足し算で合成する（掛け算ではない）。

- lang は技術スタック章
- framework はアプリ構造章
- platform はデプロイ章（将来）
- database はデータ層章（将来）

同名章は後勝ち（現行 template-merger と同じ）。
組み合わせ分のテンプレートは不要 → 作成量は軸の数に比例。

### なぜ MVC preset は不要と判断したか

議論の結果、MVC という抽象層は実用上の価値が低いと判断：
- コントローラーの場所やファイル拡張子は言語/FW 毎に異なる
- ディレクトリ構造も FW 毎に違い、共通化する意味がない
- → FW 固有の実装は framework 軸のプリセットに直接置く

ただし webapp は「ウェブアプリケーション」というアーキテクチャ型として残す。

### 言語層の解決方式

parent チェーンを `cakephp2 → php → webapp → base` とする案もあったが、
webapp テンプレートを継承できなくなるため不採用。

代わりに:
- parent チェーン: `cakephp2 → webapp → base`（テンプレート継承用）
- lang 層: preset.json の `"lang": "php"` から自動判定し DataSource を追加ロード

これにより、テンプレート継承と言語固有 DataSource の両方が機能する。

### preset の2つの責務（将来分離の設計指針）

preset は現在2つの責務を1つの parent チェーンで担っている：

| 責務 | 単一プロジェクト | モノレポ |
|---|---|---|
| データ抽出（DataSource） | 1チェーン | プロジェクト毎に独立チェーン |
| docs 構成（templates/chapters） | 同じチェーンから | モノレポレイヤーが担うべき |

今回は分離しないが、将来分離できる設計にしておく。

### フォールバック構造

各層は optional。下位層がなくても上位層だけで動作する：
```
webapp → cakephp2 + lang:php  → 全層あり、最高精度
webapp                + lang:php  → FW 固有なし、PHP webapp として動く
(type: php のみ)                  → webapp かどうかも不明、composer.json ベースで動く
(type: base のみ)                 → 言語不明、最低限動く
```

### 処理の流れ

```
テンプレート確定 → ディレクティブをパース → 必要なデータソースを呼ぶ
```

テンプレートが起点。データソースはテンプレートに従属する。

### テンプレートの変更が不要な理由

webapp テンプレートは `{{data: config.stack("...")}}` のように DataSource 名.メソッド名でディレクティブを記述している。
どの層が `config` DataSource を提供しても、メソッドシグネチャが同じなら動作する。

- 現行: cakephp2/data/config.js が `stack()` を提供 → cakephp2 でのみ動作
- 新規: php/data/config.js が `stack()` を提供 → PHP 系全 FW で動作
- 新規: node/data/config.js が `stack()` を提供 → Node.js 系全 FW で動作

テンプレートのディレクティブはそのままで、DataSource の提供元が変わるだけ。

## Clarifications (Q&A)

- Q: cakephp2/laravel/symfony の parent チェーンはどうなるか？
  - A: `FW → webapp → base` が parent チェーン。言語層は `lang: "php"` フィールドで宣言し、resolver-factory が自動的に php/ の DataSource を追加ロードする。

- Q: config.json の `type` フィールドは変更が必要か？
  - A: 不要。ユーザーは引き続き `"type": "symfony"` と書くだけ。sdd-forge が parent チェーンを自動解決する。

- Q: 複数 DB / 複数 platform はどう扱うか？
  - A: 今回は実装しない。将来的には `"database": ["postgres", "redis"]` のように配列で指定。preset/config の責務は「何の技術を使っているか」の列挙のみ。関係性は scan/enrich → docs（{{text}}）で AI が判断。

- Q: MVC preset は作るのか？
  - A: 議論の結果、不要と判断。webapp プリセットから直接 FW プリセットへチェーンする。

- Q: 既存テンプレート（.md ファイル）の修正は必要か？
  - A: 不要。テンプレートの `{{data}}` ディレクティブは DataSource 名.メソッド名で汎用的に記述されており、DataSource の提供層が変わっても動作する。新たに必要なのは php/ と node/ の `data/config.js`（config.stack メソッド）のみ。

- Q: 品質検証はどうするか？
  - A: 3段階で検証する。(1) ユニットテスト: parent チェーン解決、DataSource ロード順、テンプレートマージ。(2) リグレッション: sdd-forge 自身で snapshot check。(3) 新規プリセット E2E: fixture プロジェクトで scan→init→data パイプラインを通す。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-17
- Notes: テンプレート・DataSource の検証計画を含めた上で承認

## Requirements

1. **preset.json 構造変更**: `arch` → `parent` フィールドに変更。`axis` フィールド追加（optional）。`lang` フィールド追加（optional、言語層プリセット名）
2. **presets.js 更新**: `discoverPresets()` が parent チェーンを解決できるようにする。`resolveChain(leafKey)` を新設し、root → leaf の順でプリセット配列を返す
3. **resolver-factory.js 更新**: 固定2層ロード → parent チェーン + lang 層を動的に歩いて DataSource をロード
4. **template-merger.js 更新**: `buildLayers()` が parent チェーンを歩いてレイヤー配列を構築
5. **scan.js 更新**: parent チェーン + lang 層に沿って DataSource をロード
6. **types.js 更新**: `buildTypeAliases()` が parent ベースで動作するよう更新
7. **新規プリセット `php/` 作成**: preset.json + `data/config.js`（config.stack: composer.json から技術スタック抽出）
8. **新規プリセット `node/` 作成**: preset.json + `data/config.js`（config.stack: package.json から技術スタック抽出）
9. **既存プリセット移行**: 全 preset.json の `arch` → `parent` + `lang` 書き換え
10. **setup.js 更新**: モノレポ判定の選択肢追加、`projects` フィールド生成
11. **docs 生成スキップ**: モノレポ時に build コマンドが projects を検出して docs 生成を無効化（scan/enrich は動作）
12. **presets-cmd.js 更新**: `sdd-forge presets list` が parent チェーンツリーを正しく表示
13. **ユニットテスト作成**: parent チェーン解決、DataSource ロード順、テンプレートマージの可変長対応
14. **E2E 検証**: sdd-forge 自身での snapshot check + Node.js fixture での scan→init→data パイプライン実行

## Acceptance Criteria

1. `sdd-forge presets list` が parent チェーンベースのツリーを表示する
2. 既存の `type: "cakephp2"` / `"laravel"` / `"symfony"` / `"node-cli"` が引き続き動作する（後方互換）
3. `type: "php"` や `type: "node"` のような言語層だけの指定で scan → init → data が動作する
4. `type: "node"` で `config.stack()` が package.json ベースの技術スタックテーブルを返す
5. `type: "cakephp2"` で `config.stack()` が cakephp2 固有の結果を返す（php 層の stack を cakephp2 層が override）
6. `sdd-forge scan` が parent チェーン + lang 層に沿って DataSource をロードする
7. `sdd-forge data` が parent チェーン + lang 層に沿って resolver を構築する
8. `sdd-forge init` が parent チェーンに沿ってテンプレートをマージする
9. `npm test` で既存テストが全て PASS する
10. sdd-forge 自身の `snapshot check` でリグレッションなし（または意図的な差分のみ）
11. setup ウィザードでモノレポ選択時に `projects` 付き config.json が生成される
12. モノレポ時に `sdd-forge build` が docs 生成をスキップし、メッセージを表示する

## Open Questions

(議論で全て解決済み — 残る未決事項なし)
