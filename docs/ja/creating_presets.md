# プリセット作成ガイド

このドキュメントは、sennel のプリセットを**ビルトイン（`src/presets/<key>/`）**または**プロジェクトローカル（`.sennel/presets/<key>/`）**として新規作成する際の手順書である。AI エージェントが本ドキュメントだけを読んでプリセットを最後まで組み立てられるように、仕様・手順・落とし穴・検証コマンドを網羅している。

対象読者は、sennel 本体のアーキテクチャ（`src/CLAUDE.md` / `src/AGENTS.md`）を把握した上で、新しいフレームワーク・プロジェクト構造に対応するプリセットを作る開発者・AI である。

---

## 1. プリセットとは

プリセットはフレームワーク固有の「スキャン設定 + DataSource + テンプレート」を一束にしたパッケージである。`preset.json` の `parent` フィールドによる**単一継承チェーン**で構成し、子プリセットが親の設定・DataSource・テンプレートを上書きする。

継承チェーンの例:

```
base → webapp → php-webapp → symfony
base → webapp → js-webapp → nextjs
base → cli → node-cli
base → api → graphql
```

`.sennel/config.json` の `type` 配列に複数プリセットを並べると、各プリセットの継承チェーンが**独立に**解決され、チャプター・DataSource・テンプレートが合成される（プリセット間に parent 関係は不要）。

```json
{ "type": ["spread-commerce", "graphql", "monorepo"] }
```

---

## 2. 作成判断フロー

実装を始める前に以下を確認し、どこにどの種類のプリセットを作るかを決める。

### 2.1 ビルトインか、プロジェクトローカルか

| 条件 | 配置先 |
|---|---|
| 汎用フレームワーク・ライブラリ対応（再利用される） | `src/presets/<key>/`（ビルトイン） |
| 特定プロジェクトのディレクトリ構造・カスタマイズに特化 | `.sennel/presets/<key>/`（プロジェクトローカル） |

**プロジェクトローカルはリーフ専用**。`parent` チェーンは常にビルトインを使用する（プロジェクトローカル同士の継承は非対応）。

### 2.2 既存プリセットを継承するか、新規作成するか

1. `src/presets/` に対象フレームワークの親候補があるか確認する（`webapp`, `php-webapp`, `js-webapp`, `symfony`, `laravel`, `cakephp2`, `nextjs`, `hono`, `node-cli`, `database`, `api/graphql` 等）。
2. 最も近いプリセットを `parent` に指定する。近いものがなければ `base` / `webapp` / `cli` 等の上位プリセットから始める。
3. 親プリセットに同名 DataSource・テンプレートがある場合、子で override される（後勝ち）。

---

## 3. ディレクトリ構造

```
<preset-root>/<key>/
├── preset.json              必須: メタデータ・チャプター・scan パターン
├── guardrail.json           任意: スペック／実装ガードレールルール
├── data/                    DataSource モジュール群（scan と resolve を兼ねる）
│   └── <category>.js        1 ファイル = 1 カテゴリ（default export が Source クラス）
├── templates/
│   ├── ja/                  各言語のチャプターテンプレート
│   │   ├── overview.md
│   │   ├── controller_routes.md
│   │   └── ...
│   └── en/
└── tests/                   ビルトインプリセットは必須
    ├── unit/                scan パーサー I/O テスト
    ├── e2e/                 フルスキャンパイプラインテスト
    └── acceptance/          fixture ベースのアクセプタンステスト
        └── test.js
```

プロジェクトローカル（`.sennel/presets/<key>/`）では `tests/` は必須ではない。

**注意**: 以前は `scan/` ディレクトリに scan パーサーを分離する構成だったが、現行では廃止されている。scan ロジックは `data/<category>.js` の `Scannable` DataSource（`match` / `parse` / `scan` メソッド）に統合する。

---

## 4. preset.json スキーマ

```json
{
  "parent": "symfony",
  "label": "Spread Commerce (EC-CUBE 4.x + Next.js)",
  "aliases": ["eccube"],
  "chapters": [
    { "chapter": "overview.md", "desc": "概要" },
    { "chapter": "controller_routes.md", "desc": "コントローラとルーティング" }
  ],
  "scan": {
    "include": ["src/backend/app/Customize/**/*.php"],
    "exclude": ["src/backend/app/Plugin/*/vendor/**"]
  }
}
```

| フィールド | 必須 | 説明 |
|---|---|---|
| `parent` | 任意 | 親プリセットの key。省略時は独立プリセット |
| `label` | 推奨 | 表示名 |
| `aliases` | 任意 | `config.json` の `type` に書ける別名 |
| `chapters` | 任意 | チャプターの順序と説明。文字列配列 `["overview.md", ...]` または `{chapter, desc}` オブジェクト配列が使える。省略時は親の `chapters` を継承 |
| `scan.include` | 任意 | スキャン対象の glob（POSIX 区切り） |
| `scan.exclude` | 任意 | 除外 glob |

### 4.1 `chapters` の扱い

- `chapters` に宣言したチャプター名は、自プリセットか親プリセットの `templates/<lang>/` に対応ファイルが存在する必要がある（無ければ gate で FAIL）。
- `config.json` の `type` が複数プリセットを並べる場合、チャプター順は**配列の先頭プリセットから union** される。**先頭に最も具体的な（leaf）プリセットを置く**こと。

### 4.2 `scan` パターン

- 区切り文字は `/` 固定（Windows でも `/`）。
- `**` は任意階層、`*` は 1 階層内の任意文字。
- 親プリセットの `scan` はマージされる（追加方向）。子で除外したい場合は `exclude` に書く。

### 4.3 guardrail.json（任意）

プリセット固有の設計原則・禁止事項を宣言するファイル。SDD フローの `plan.gate` / `impl.review` で AI がチェックに使う。docs 生成パイプラインとは独立。

```json
{
  "guardrails": [
    {
      "id": "use-parameterized-queries",
      "title": "Use Parameterized Queries",
      "body": "DQL and QueryBuilder shall use parameter bindings. String concatenation in queries is prohibited.",
      "meta": { "phase": ["spec", "impl"] }
    }
  ]
}
```

| フィールド | 必須 | 説明 |
|---|---|---|
| `id` | ✅ | 一意な識別子（kebab-case） |
| `title` | ✅ | 短い見出し |
| `body` | ✅ | 具体的なルール本文（推奨は英語。SDD フローで他言語に翻訳される） |
| `meta.phase` | ✅ | ルールが適用されるフェーズ。`"spec"`（仕様策定ゲート）/ `"impl"`（実装レビュー）の配列 |

**ルール作成の指針:**

- 「何をすべきか」ではなく「何を禁止するか／必ずどうするか」で書く（AI が違反検知しやすい）
- フレームワーク軸（symfony の DTO 利用等）と原則軸（principle preset の SOLID 等）を分離する。同じルールを複数プリセットで重複させない
- 親プリセットの guardrail は継承される（マージされる）ため、親にあるルールは子に書かない
- lint 可能なレベルの機械的ルール（インデント、命名規則）は書かない。AI レビューで判断が必要なルールのみ

### 4.4 overrides.json（プロジェクト直下・任意）

**プリセット配下ではなく `.sennel/overrides.json` に置く**、プロジェクト全体で 1 つの辞書ファイル。DataSource が返すエントリの説明文を手動で確定したい場合に使う（enrich の AI 生成結果より優先される）。

```json
{
  "tables": {
    "contents": "コンテンツ（動画エピソード単位）",
    "contracts": "権利元との契約情報"
  },
  "controllers": {
    "UserController": "ユーザー認証・プロフィール管理"
  }
}
```

- 第 1 階層 = **セクション名**（通常は DataSource カテゴリ名）
- 第 2 階層 = **エントリキー**（クラス名・テーブル名等、DataSource の `keyField` で指定する項目の値。既定は `className`）
- 値 = **文字列**（説明文。オブジェクトではない）

使い方は `DataSource` 基底クラスの `mergeDesc(items, section, keyField)` が各 item の `summary` にマージする。`desc(section, key)` で個別取得も可能（未定義時は `"—"`）。

プリセット作成時に必須ではなく、プロジェクト運用の中で AI 生成結果を人間が確定値に置き換えていくためのファイル。

---

## 5. DataSource の実装

### 5.1 2 種類の DataSource

**(A) Scannable DataSource（scan と data を兼用）**

`match()` でファイルを拾い、`parse()` で解析結果を返す。scan パイプラインが戻り値を `analysis[category].entries` に書き、共通フィールド（`file` / `hash` / `lines` / `mtime`）を自動付与する。resolve メソッド（`list()` 等）で `analysis` を読んで出力する。

```javascript
import { DataSource, Scannable, AnalysisEntry } from "sennel/api";

export class ControllerEntry extends AnalysisEntry {
  className = null;
  route = null;
  action = null;
  static summary = {};
}

export default class MyControllersSource extends Scannable(DataSource) {
  static Entry = ControllerEntry;

  match(relPath) {
    return relPath.startsWith("src/Controller/") && relPath.endsWith(".php");
  }

  parse(absPath) {
    const entry = new ControllerEntry();
    // 解析してフィールドを埋める
    return entry;
  }

  list(analysis, labels) {
    const items = analysis.controllers?.entries ?? [];
    if (items.length === 0) return null;
    const rows = this.toRows(items, (c) => [c.className, c.file, c.action ?? "—"]);
    return this.toMarkdownTable(rows, labels);
  }
}
```

**(B) Data-only DataSource（他の scan が書いた analysis を読むだけ）**

`match()` / `parse()` を持たず、resolve メソッドのみ実装する。**読む analysis キーを書く scan DataSource がチェーン内に必ず存在する必要がある**（存在しないなら作ってはならない）。

```javascript
import { DataSource } from "sennel/api";

export default class SchemaSource extends DataSource {
  tables(analysis, labels) {
    const tables = analysis.schemas?.tables ?? [];
    if (tables.length === 0) return null;
    const rows = tables.map((t) => [t.name, t.columns.length]);
    return this.toMarkdownTable(rows, labels);
  }
}
```

### 5.2 `match(relPath)` の契約

- `relPath` はスキャンルート（`SDD_SOURCE_ROOT`）からの相対パス。
- 区切りは常に `/`（POSIX）。Windows 上でも `\` には変換されない。
- 先頭の `./` は付かない（例: `src/Controller/UserController.php`）。
- 戻り値は boolean。

### 5.3 `parse(absPath)` の契約

- 引数は絶対パス。`fs.readFileSync(absPath, "utf8")` で読む。
- 戻り値は `new this.constructor.Entry()` を返すか `null`。
- `Entry` のフィールドは `null` で初期化する（`isEmptyEntry` 判定のため）。

### 5.4 resolve メソッドの戻り値

戻り値は **Markdown 文字列または `null`**。データが無いときは必ず `null` を返す（空テーブルで壊れた表を描かない）。

基底クラスが提供するヘルパー:

| メソッド | 用途 |
|---|---|
| `toRows(items, mapper)` | items 配列を行配列に変換 |
| `toMarkdownTable(rows, labels)` | 行配列と見出し配列から Markdown テーブル文字列を生成（パイプ文字は自動エスケープ、`null`/`undefined` は `—` になる） |
| `mergeDesc(items, section, keyField)` | `.sennel/overrides.json` の該当セクションから説明文を読み、item の `summary` にマージした新配列を返す |
| `desc(section, key)` | `.sennel/overrides.json` から個別に説明文を取得（未定義時は `"—"`） |

### 5.5 resolve メソッドの呼び出し規約

テンプレートの `{{data("<preset>.<category>.<method>", {labels: "A|B|C"})}}` は、`dataSources.get(category).method(analysis, labels)` を呼ぶ。

- `labels` は `"A|B|C"` のパイプ区切り文字列が渡される前に配列 `["A", "B", "C"]` に分解され、resolve メソッドには**配列**として渡る（`toMarkdownTable` にそのまま渡せる）。
- カテゴリ名 = `data/<category>.js` のファイル名（`.js` 抜き）。

---

## 6. import ルール（厳守）

sennel は `package.json` の `exports` で公式公開ルートを提供している:

```json
{
  "exports": {
    ".": "./src/sennel.js",
    "./api": "./src/api.js",
    "./presets/*": "./src/presets/*"
  }
}
```

DataSource ファイルからの import は以下のみ:

```javascript
// 基底クラス
import { DataSource, Scannable, AnalysisEntry } from "sennel/api";

// preset 内部クラス（継承用）
import SymfonyControllersSource from "sennel/presets/symfony/data/controllers";
import { ControllerEntry } from "sennel/presets/webapp/data/controllers";
import WebappDataSource from "sennel/presets/webapp/data/webapp-data-source";
```

**重要ルール:**

1. **`.js` 拡張子を付けない**。`sennel/presets/*` は wildcard subpath exports で、`.js` を付けると二重拡張子 `.js.js` で `ENOENT` になる。`sennel/api` も静的マッピングのため拡張子不要。
2. **`sennel/src/...` を直接参照しない**（exports に含まれない）。
3. **`sennel/presets/<key>/templates/...` を参照しない**（非公開）。
4. api.js に必要なクラスが含まれていない場合は、sennel 本体の `src/api.js` への追加を検討する（prs / issue 経由）。

---

## 7. テンプレートの設計

### 7.1 ディレクティブ一覧

```markdown
<!-- {%extends%} -->                 親テンプレートを継承（同じファイル名）
<!-- {%extends: layout%} -->         別名で継承
<!-- {%block "name"%} -->...<!-- {%/block%} --> ブロック定義・override

<!-- {{data("<preset>.<category>.<method>", {labels: "A|B|C", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{text({prompt: "説明文を書く", mode: "deep"})}} -->

プリセットは、フレームワーク固有の scan 設定・DataSource・テンプレートをまとめた構成です。
`preset.json` の `parent` による単一継承で、親の設定を子で上書きできます。
作成時は、ビルトイン（`src/presets/<key>/`）かプロジェクトローカル（`.sennel/presets/<key>/`）かを先に判断します。
実装はテンプレートから先に作り、次に DataSource、最後に scan パーサーを実装します。
検証は `sennel docs scan --dry-run`、`sennel docs scan`、`sennel docs build` の順で実行します。
<!-- {{/text}} -->
```

- `{{data}}` と `{{/data}}` は**解決後もファイルに残り**、次回 build の目印になる。間に解決結果が挿入される。
- 空テンプレートファイルは「削除マーク」として親のブロックを消す。

### 7.2 `{{data}}` と `{{text}}` の使い分け

| 条件 | ディレクティブ |
|---|---|
| 正規表現／パーサーで機械的に抽出可能 | `{{data(...)}}`（scan データから正確なテーブルを出力） |
| フレームワーク固有すぎて構造化不能 | `{{text(...)}}`（AI 生成） |

### 7.3 親テンプレートは `{{text}}`、子が `{{data}}` で override

webapp 等の上位プリセットは `{{text}}` + `{%block%}` で定義し、子プリセットが block override で `{{data}}` に差し替える。これにより：

- 親単体（scan データなし）でも AI 生成で動く
- 子プリセットは scan データから正確なテーブルを出力
- 新規プリセットは override テンプレートを追加するだけ

```markdown
<!-- webapp/templates/ja/auth_and_session.md -->
<!-- {{text({prompt: "認証設定を説明してください。"})}} -->

認証設定の記述は、取得可能なデータがある場合は `{{data(...)}}` を優先して構成します。
たとえば Symfony では `{{data("symfony.config.auth", {labels: "項目|内容"})}}` の形式で設定一覧を出力できます。
一方、構造化しにくい情報は `{{text({prompt: "認証設定を説明してください。"})}}` で補います。
上位プリセットで `{{text}}` を定義し、子プリセットで `{{data}}` に差し替えると、親単体でも子でも破綻せず運用できます。
データが存在しない場合、resolve メソッドは空表ではなく `null` を返す必要があります。
<!-- {{/text}} -->
```

```markdown
<!-- symfony/templates/ja/auth_and_session.md -->
<!-- {{data("symfony.config.auth", {labels: "項目|内容"})}} -->
<!-- {{/data}} -->
```

### 7.4 テンプレート解決の優先順位（高→低）

1. プロジェクトローカル `.sennel/templates/<lang>/docs/`
2. プロジェクトローカルプリセット `.sennel/presets/<key>/templates/<lang>/`
3. リーフプリセット `src/presets/<leaf>/templates/<lang>/`
4. 親プリセット（root まで）

---

## 8. MUST: scan と data のペアリング規則

data DataSource が `analysis.X` を読むなら、チェーン内に `X` を書く scan DataSource が必ず存在すること。

```
✅ 正しい:
  scan DataSource "modules" → analysis.modules を書く
  data DataSource modules.list() → analysis.modules を読む

❌ 違反:
  data DataSource schema.tables() → analysis.schemas を読む
  → 対応する scan DataSource が存在しない
```

scan を実装できない場合は data DataSource も作らず、該当テンプレートは `{{text}}` にする。

---

## 9. enrich の制約

enrich フェーズは scan が収集したエントリに `summary` / `chapter` / `role` を付与するのみ。**新しい analysis カテゴリの生成や、scan が見つけていないデータの創出は行わない**。scan できないデータはテンプレートの `{{text}}` で AI 生成させる。

---

## 10. 実装手順（トップダウン）

### 10.1 作成順序（MUST）

**テンプレート → DataSource → scan パーサー** の順で作る。消費者から逆算することで不要なパーサーを書かず、必要なデータの漏れも防ぐ。

### 10.2 ステップバイステップ

1. **preset.json を作る** — `parent` / `scan.include` / `chapters` を最低限定義
2. **config.json の `type` に追加** — これをやらないとロードされない（leaf を配列先頭に）
3. **`sennel docs scan --dry-run` で scan パターン検証** — ファイルが正しく収集されるか
4. **テンプレートを配置** — まず `{{text}}` だけで骨格を作る
5. **DataSource を 1 つずつ実装** — 書くたびに `sennel docs scan` を実行し、`.sennel/output/analysis.json` の `<category>.entries.length` が期待通りか確認
6. **テンプレートの該当ブロックを `{{data}}` に差し替える**
7. **`sennel docs build` で全パイプライン確認**
8. **guardrail.json を追加**（build が通ってから改善）。プロジェクト運用中に必要になれば `.sennel/overrides.json` で説明文を確定化
9. **ビルトインプリセットの場合は `tests/` を整備し、`npm test` で整合性を確認**

### 10.3 最小動作セット

以下を揃えれば scan は通る（プロジェクトローカル想定）:

```
.sennel/
├── config.json                    # "type": ["mypreset", ...] を追加
└── presets/mypreset/
    ├── preset.json                # {"parent": "webapp", "scan": {"include": ["src/**/*.js"]}}
    └── data/
        └── simple.js
```

```javascript
// data/simple.js
import { AnalysisEntry } from "sennel/api";
import WebappDataSource from "sennel/presets/webapp/data/webapp-data-source";

export class SimpleEntry extends AnalysisEntry {
  name = null;
  static summary = {};
}

export default class SimpleSource extends WebappDataSource {
  static Entry = SimpleEntry;
  match(relPath) { return relPath.endsWith(".js"); }
  parse(absPath) {
    const entry = new SimpleEntry();
    entry.name = absPath.split("/").pop();
    return entry;
  }
  list(analysis, labels) {
    const items = analysis.simple?.entries ?? [];
    if (items.length === 0) return null;
    const rows = items.map((e) => [e.name, e.file]);
    return this.toMarkdownTable(rows, labels);
  }
}
```

---

## 11. 検証コマンド

```bash
# カテゴリ別エントリ件数の summary を標準出力に出す（analysis.json を書き換えない）
# 出力は単層 JSON: { カテゴリ名: 整数件数, ... }
# scan DataSource が登録済みかつマッチ 0 件のカテゴリも値 0 で含まれる
sennel docs scan --dry-run

# 全 analysis JSON を標準出力に出す（analysis.json を書き換えない）
sennel docs scan --stdout

# 本実行（.sennel/output/analysis.json を更新）
sennel docs scan

# 全パイプライン
sennel docs build

# ビルトインプリセットの整合性テスト
npm test
npm test -- --preset <key>            # プリセット別
node tests/acceptance/run.js <key>    # acceptance 個別実行
```

---

## 12. 落とし穴チェックリスト

### 12.1 JSDoc 内の `*/` がコメントを閉じる

ドキュメントコメントにファイルパスの `*/` を書くとコメントが途中で終わる。

```javascript
/**
 * src/app/Plugin/*/PluginManager.php を解析する。   ← "*/" でコメント終了 → SyntaxError
 */
```

**対応**: パスのワイルドカードを `{name}` 等に置換する。
ESM 検証は `node --input-type=module --check <file>`（`node --check` 単体は ESM/CJS 判定が曖昧で誤検知する）。

### 12.2 import 拡張子

`sennel/api` / `sennel/presets/*` は**拡張子 `.js` を付けない**。

### 12.3 loader のルール

`src/docs/lib/data-source-loader.js` は `data/` 配下の `.js` を全て動的 import する。**default export がクラス/関数のときだけ** sources Map に登録される。副作用のあるヘルパーを置きたい場合は default export を持たないようにすれば loader から無視される（通常は `sennel/api` があるので不要）。

### 12.4 `chapters` の厳格性

`chapters` で宣言したチャプターは、自プリセットか親プリセットにテンプレートが必要。override しないチャプターは `{%extends%}` で薄いテンプレートを置くのが無難。

### 12.5 `[init] ERROR:` は情報メッセージ

`sennel docs init` の `[init] ERROR: N 件のファイルが docs/ に既に存在します` は **failure ではなく情報メッセージ**（`--force` 案内）。exit code で判定すること。

### 12.6 bash テストスクリプト

`set -uo pipefail` + `echo "$big" | grep -q` は SIGPIPE (exit 141) になりやすい。bash の `[[ "$x" == *"pat"* ]]` を使う。

### 12.7 ありがちなエラー一覧

| エラー | 原因 |
|---|---|
| `[datasource] failed to load DataSource X: Unexpected identifier ...` | JSDoc の `*/` でコメント終了、または import パスの拡張子誤り |
| `<category>.entries.length === 0` | `match()` が常に false、または `scan.include` に対応パターンがない |
| `Preset not found: <key>` | `config.json` の `type` に未記載 |
| `[data] UNRESOLVED {{data}} in foo.md: <cat>.<sub>.<method>` | DataSource が存在しない、または resolve メソッド未定義 |
| 二重拡張子 `.js.js` ENOENT | import 文で `sennel/presets/.../foo.js` のように `.js` を付けた |

---

## 13. ビルトインプリセット向けの追加要件

### 13.1 テスト（MUST）

- `tests/unit/` — scan パーサーの I/O テスト（`createTmpDir()` で最小 fixture）
- `tests/e2e/` — preset.json の scan 設定検証・フルスキャン
- `tests/acceptance/test.js` — preset ローカル fixture を使う acceptance。共有処理は `tests/acceptance/lib/`
- `npm test -- --preset <name>` で単独実行できること

### 13.2 整合性テスト

`tests/unit/presets/preset-scan-integrity.test.js` が以下を自動検証する。**新規追加・変更後に必ず `npm test` を通すこと。**

1. scan パターンを持つプリセットは、チェーン内に scan DataSource を持つ
2. テンプレートの `{{data}}` が参照するメソッドが DataSource に存在する
3. `analysis.X` を読む data DataSource があれば、`X` を書く scan DataSource がチェーン内に存在する

### 13.3 プロジェクト固有情報禁止

`src/presets/` には特定プロジェクトの値（プロジェクト名・ホスト・ポート・コンテナ名等）を書かない。汎用的な解析ロジックのみ。固有値は `.sennel/config.json` で外部化する。

---

## 14. プロジェクトローカルプリセット向けの追加要件

- リーフ専用。`parent` はビルトインキーを指す。
- `preset.json` の省略が可能（省略時はビルトインのデフォルトを継承）。
- `.sennel/templates/<lang>/docs/` のファイルは最優先（プリセットテンプレートより強い）。
- 落とし穴: プロジェクトローカルに `package.json` は不要。sennel が DataSource を動的 import した時点で sennel 自身のパッケージ解決コンテキストが使われるため、bare specifier (`sennel/api` 等) が解決できる。

---

## 15. AI 向け実行チェックリスト

プリセット作成を依頼されたら、以下を順に実行する:

1. [ ] 対象プロジェクトのディレクトリ構造・フレームワークを `ls` / `fd` で把握
2. [ ] 既存プリセットの中で最も近い親を選択（`src/presets/` を読む）
3. [ ] `<preset-root>/<key>/preset.json` を作成（`parent`, `scan.include`, `chapters` 最小セット）
4. [ ] `.sennel/config.json` の `type` 配列先頭に `<key>` を追加
5. [ ] `sennel docs scan --dry-run` でファイル収集確認
6. [ ] `templates/<lang>/` に骨格テンプレート配置（まず `{{text}}` のみ）
7. [ ] 必要な DataSource を 1 つずつ実装（`sennel/api` / `sennel/presets/*` のみ import、拡張子なし）
8. [ ] 各 DataSource 追加後に `sennel docs scan` 実行 → `.sennel/output/analysis.json` の `<category>.entries.length` を確認
9. [ ] `match()` の `relPath` は `/` 区切り・`./` なしで判定
10. [ ] resolve メソッドは `toMarkdownTable(rows, labels)` の戻り値（Markdown 文字列）か `null` を返す。データ無しは必ず `null`
11. [ ] `analysis.X` を読むなら `X` を書く scan がチェーン内にあるか確認
12. [ ] テンプレートの `{{text}}` を段階的に `{{data}}` に差し替え
13. [ ] `sennel docs build` で全パイプライン完走を確認
14. [ ] ビルトインなら `tests/` 整備 → `npm test` で整合性 PASS
15. [ ] （任意）`guardrail.json` を追加。説明文の確定化が必要なら `.sennel/overrides.json` をプロジェクト直下に作成

---

## 16. 参考ファイル

sennel 本体:

| ファイル | 内容 |
|---|---|
| `src/api.js` | 外部公開基底クラス（`DataSource`, `Scannable`, `AnalysisEntry`） |
| `src/lib/presets.js` | プリセット検出・チェーン解決 |
| `src/docs/lib/data-source.js` | `DataSource` 基底クラス |
| `src/docs/lib/scan-source.js` | `Scannable` mixin（`match`, `parse`） |
| `src/docs/lib/analysis-entry.js` | `AnalysisEntry` 基底クラス |
| `src/docs/lib/data-source-loader.js` | DataSource 動的ロード |
| `src/docs/lib/template-merger.js` | テンプレート継承・ブロックマージ |
| `src/presets/webapp/data/webapp-data-source.js` | `WebappDataSource = Scannable(DataSource)` |
| `src/presets/symfony/data/*.js` | PHP フレームワーク実装の参考 |
| `src/presets/cakephp2/data/*.js` | PHP の別実装（PHP パーサーユーティリティ） |
| `src/presets/nextjs/data/*.js` | フロントエンド DataSource の参考 |

プロジェクトルール:

- `src/CLAUDE.md` / `src/AGENTS.md` — sennel 内部アーキテクチャと MUST ルール
- プロジェクトルート `CLAUDE.md` — `src/` への書き込み禁止事項
