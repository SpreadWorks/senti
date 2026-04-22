# Feature Specification: 214-datasource-renderable-class

**Feature Branch**: `feature/214-datasource-renderable-class`
**Created**: 2026-04-22
**Status**: Draft
**Input**: GitHub Issue #220

## Goal
- DataSource の resolver メソッドの戻り値型を、Markdown 出力構造を表現する Renderable 値型階層に置き換え、OOP で型安全性と表現構造を同時に獲得する。

## Background
- 現状、DataSource のメソッド（`src/docs/lib/data-source.js` 基底の `toMarkdownTable` ヘルパー経由、および各 preset の data 配下 21+ ファイル）は `string | null` を返しており、戻り値には「表／箇条書き／段落」等の構造情報が残らない。
- 展開層（`src/docs/lib/directive-parser.js` の `resolveDataDirectives`）は結果を単なる文字列として埋め込むのみで、型情報を活用できない。
- 外部レビューで「resolve メソッドの戻り値に型と呼べるものがない」との指摘があった（Issue #220）。
- TypeScript を採用しない方針のため、構造的制約は OOP クラス設計で表現する。

## Scope
- `src/docs/lib/renderable.js` を新規作成し、基底 `Renderable` と 8 具象クラス（`Table`, `BulletList`, `OrderedList`, `Paragraph`, `CodeBlock`, `Blockquote`, `Heading`, `Fragment`）を定義する。
- 基底 `DataSource` の `toMarkdownTable(rows, labels)` ヘルパーを、`new Table(labels, rows).toMarkdown()` への薄い委譲に置換する（DataSource 利用側の呼び出し形式は維持）。
- `src/docs/lib/directive-parser.js` の `resolveDataDirectives` で、resolver 戻り値が Renderable インスタンスの場合は `.toMarkdown()` を呼び、文字列の場合はそのまま使う暫定対応を挟む。
- 既存の全 DataSource メソッド（`src/docs/data/*.js`, `src/presets/*/data/*.js`）の戻り値を Renderable インスタンスに書き換える。
- 全 DataSource 移行完了後、展開層から文字列サポートを削除し、戻り値は Renderable または null のみ許容する。
- `src/lib/container.js` に Renderable 関連クラスを登録し、外部 preset から `container` 経由で取得可能にする。

## Out of Scope
- Markdown 以外の出力フォーマット（HTML 等）の実装。`toHtml()` 等の拡張メソッドは本 spec では追加しない。
- `analysis.json` / `overrides.json` のスキーマ変更。
- CLI サブコマンド体系の変更。
- CLAUDE.md / AGENTS.md / src/AGENTS.md への設計方針文書追加（別作業）。

## Constraints
- **外部依存禁止（CLAUDE.md）**: Node.js 組み込みモジュールのみ。Renderable クラス群は純粋な JS で実装する。
- **alpha 版ポリシー（CLAUDE.md）**: 後方互換コードは書かない。移行完了後は文字列返却サポートを削除する。
- **OOP による型表現（CLAUDE.md）**: discriminated union（`{ type: "table", ... }`）は採用しない。専用クラスで invariant を強制する。
- **過剰な防御コード禁止（CLAUDE.md）**: 内部インターフェースを信頼し、公開 API 境界でのみ invariant を検証する。
- docs の最終 Markdown 出力は移行前後で byte-identical でなければならない。

## Design Principles
- **invariant はコンストラクタで強制**: `Table` は `labels.length > 0` と全行の列数一致を構築時に検査し throw する。
- **振る舞いは型に属す**: `toMarkdown()` を各 Renderable が実装。展開層は `instanceof` や `type` 文字列判別を行わず、`.toMarkdown()` を呼ぶだけでよい。
- **Open/Closed**: 将来 `toHtml()` 等を追加する場合、各 Renderable に新メソッドを追加すれば既存の `toMarkdown()` / DataSource / 展開層は変更不要。
- **合成可能性**: `Fragment(parts)` は `Renderable[]` または `string` を受け取り、`toMarkdown()` で改行連結する。`BulletList` / `OrderedList` は各項目が `string | Renderable` を許容する。

## Overview
### Modules
- **新規 `src/docs/lib/renderable.js`** — 基底 `Renderable` と 8 具象クラスを定義・export する。
- **変更 `src/docs/lib/data-source.js`** — `toMarkdownTable` を `Table` への委譲に置換する。
- **変更 `src/docs/lib/directive-parser.js`** — `resolveDataDirectives` 内で resolver 戻り値が Renderable の場合は `.toMarkdown()` を呼ぶ。移行完了後は文字列サポート削除。
- **変更 `src/lib/container.js`** — Renderable クラス群を container の export に追加。
- **変更 各 DataSource**（`src/docs/data/*.js`, `src/presets/*/data/*.js`）— 文字列返却を Renderable インスタンス返却に置換。

### Data Flow
- テンプレート内の `{{data: preset.source.method("L1|L2|...")}}` は `directive-parser.js` でパースされ、`resolveFn(preset, source, method, labels)` 経由で `resolver-factory.js` が当該 DataSource のメソッドを呼ぶ。
- DataSource メソッドは `Renderable | null` を返す。`null` は既存の `ignoreError` / unresolved ハンドリングで処理される。
- 展開層は Renderable に対し `.toMarkdown()` を呼んで文字列を取得し、`header` / `footer` と連結してテンプレート本文に埋め込む。

### Decisions
- **クラス階層は継承なし、ダックタイピング**: 基底 `Renderable` は `toMarkdown()` を持つマーカー的役割。具象クラスは `Renderable` を継承するが、展開層は `instanceof Renderable` チェックで Renderable を識別し、`.toMarkdown()` を呼ぶ。
- **`null` 返却は既存通り維持**: 「該当データなし」の意味論を保つ。Renderable 側で「空テーブル」等を返す設計にはしない。
- **`Table` の空データ扱い**: `labels.length === 0` は throw、`rows.length === 0` は許容（ラベル行のみの空テーブルを出力）。現行 `toMarkdownTable` と互換。
- **`BulletList` / `OrderedList` は string と Renderable 両対応**: ネスト表現（箇条書き内の表等）を可能にする。項目が文字列の場合は単に出力、Renderable の場合は `.toMarkdown()` を呼び、必要なインデントを施す。

## Clarifications (Q&A)
- Q: 移行中、展開層は文字列と Renderable の両方をサポートするか？
  - A: 暫定サポートする。同一 PR 内で全 DataSource を Renderable に移行完了後、文字列サポートを削除する。
- Q: `BulletList` の項目が Renderable の場合、どのようにインデントするか？
  - A: `toMarkdown()` の出力を `  ` (2 スペース) でインデントし、項目マーカー `- ` の後に配置する。改行を含む場合は各行をインデントする。
- Q: `Fragment` の用途は？
  - A: 1 つの DataSource メソッドが「説明段落 + テーブル」のように複数ブロックを返したいケース用。`parts` を `\n\n`（ブロック区切り）で連結する。
- Q: 既存の `toMarkdownTable(rows, labels)` ヘルパーの引数順は変更するか？
  - A: 維持する。`Table` クラスは `new Table(labels, rows)` だが、`toMarkdownTable` は引数順 `(rows, labels)` のまま内部で `new Table(labels, rows)` に変換する。呼び出し箇所 21+ の機械的書き換えを避け、移行リスクを最小化する。

## Alternatives Considered
- **Object literal + discriminated union** (`{ type: "table", labels, rows }`): TS を使わない以上、`type` 文字列での型判別は実行時エラーに弱く、IDE 補完も効きにくい。クラスの `instanceof` より劣るため採用しない（Issue #220 でも明記）。
- **基底 `Renderable` なし、ダックタイピングのみ**: `.toMarkdown()` を持つ任意オブジェクトを許容する案。シンプルだが、展開層で「Renderable なのか他のオブジェクトなのか」を区別できず、文字列／Renderable 判別が曖昧になる。`instanceof Renderable` チェックの確実性を優先し採用しない。
- **基底 `Renderable` を abstract class として `toMarkdown()` の実装を必須化**: JS に abstract 構文がないため、基底で `throw new Error("abstract")` する形になる。具象クラスが実装漏れした場合のみ検知できるが、実質的に同等。簡潔さのため採用する（基底は `toMarkdown()` を throw するメソッドとして定義）。
- **部分移行（基盤のみ、全移行は別 spec）**: alpha 版ポリシーに反し、移行期間中の string/Renderable 両対応ロジックが恒久化するリスクがある。採用しない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-22
- Notes: 対話フローで spec 内容を確認し承認。auto モードは auto-check（score 0/24, G/H gate）で非 eligible のため手動承認。

## Requirements

優先度順（必須 → 重要）:

1. **[必須 / REQ-01] Renderable クラス階層の提供** — When テスト実行時、`src/docs/lib/renderable.js` から `Renderable`, `Table`, `BulletList`, `OrderedList`, `Paragraph`, `CodeBlock`, `Blockquote`, `Heading`, `Fragment` の 9 クラスが export されており、各具象クラスは `toMarkdown()` メソッドを実装していなければならない。
2. **[必須 / REQ-02] 構築時 invariant の強制** — When `Table` が `labels.length === 0` または `rows` 内に `labels.length` と異なる列数を持つ行を含む状態で構築されたとき、コンストラクタは `Error` を throw しなければならない。`Heading` が level 1-6 以外の値で構築されたとき、同様に throw しなければならない。
3. **[必須 / REQ-03] 基底 `DataSource.toMarkdownTable` の委譲化** — When `DataSource.prototype.toMarkdownTable(rows, labels)` が呼び出されたとき、内部で `new Table(labels, rows).toMarkdown()` を呼び出してその戻り値を返さなければならない。独自の Markdown 組み立てロジックを保持してはならない。
4. **[必須 / REQ-04] 展開層の Renderable 対応** — When `resolveDataDirectives` が resolver から `Renderable` インスタンスを受け取ったとき、`.toMarkdown()` を呼び出してその戻り値を展開テキストとして用いなければならない。
5. **[必須 / REQ-05] 全 DataSource の Renderable 返却化** — When 全移行完了時点で、`src/docs/data/*.js` および `src/presets/*/data/*.js` 内のすべての DataSource メソッドの戻り値は `Renderable インスタンス` または `null` でなければならない。文字列を直接返すメソッドが残存してはならない（grep で検証可能）。
6. **[必須 / REQ-06] 文字列サポート削除** — When 全 DataSource 移行完了後、`resolveDataDirectives` は resolver 戻り値が `null` でも `Renderable` でもない場合に例外を throw するか、unresolved と同等に扱わなければならない。文字列を受け入れてはならない。
7. **[必須 / REQ-07] 出力互換性（スナップショット）** — When 本移行 PR の前後で、同一の `analysis.json` に対して docs を生成したとき、生成される全 `.md` ファイルの内容は byte-identical でなければならない。
8. **[重要 / REQ-08] container 経由の公開** — When 外部 preset コードが `container.Renderable`, `container.Table` 等を参照したとき、対応するクラスを解決できなければならない。
9. **[重要 / REQ-09] `BulletList` / `OrderedList` のネスト** — When `BulletList` または `OrderedList` が項目として `Renderable` を含むとき、`.toMarkdown()` は該当項目の出力を 2 スペースインデントし、箇条書きマーカー（`- ` / `1. `）の下にネスト表示しなければならない。

## Acceptance Criteria
- **AC-01 (REQ-01, REQ-02)**: `tests/unit/renderable.test.js` が以下を検証する:
  - 9 クラスが export されている（import で取得できる）。
  - 各具象クラスの `toMarkdown()` が期待される Markdown 文字列を返す。
  - `Table(labels=[], rows=[...])` / `Table(labels=["A"], rows=[["x","y"]])` / `Heading(text, 0)` / `Heading(text, 7)` が throw する。
- **AC-02 (REQ-03)**: `DataSource` の既存テストで `toMarkdownTable(rows, labels)` の出力が変わらないこと、または新規テストで `toMarkdownTable` の出力が `new Table(labels, rows).toMarkdown()` と等しいことを検証する。
- **AC-03 (REQ-04, REQ-06)**: `tests/unit/directive-parser.test.js` に、resolver が `Renderable` を返す場合に `.toMarkdown()` 結果が展開されることを検証するテストを追加する。さらに移行完了後、resolver が string を返す場合は unresolved 扱い / throw になることを検証する。
- **AC-04 (REQ-05)**: `grep -rn "toMarkdownTable\|return \`.*\`\|return .*\\.join" src/docs/data/ src/presets/*/data/` の結果のうち、戻り値が文字列となるパターンが残っていないことを確認する（CI で機械チェック）。
- **AC-05 (REQ-07)**: 既存の docs 出力回帰テスト（`tests/acceptance/fixtures` 等）を全 preset で実行し、生成 Markdown が移行前と同一であることを確認する。差分が出た場合は移行の不完全 / バグとして修正する。
- **AC-06 (REQ-08)**: `tests/unit/container.test.js` または `src/lib/container.js` の既存テストで、`container` から Renderable クラスを取得できることを検証する。
- **AC-07 (REQ-09)**: `tests/unit/renderable.test.js` でネストリストの Markdown 出力を検証する（例: `new BulletList(["a", new Table(...)]).toMarkdown()` が期待通りインデントされる）。

## Implementation Targets
- `src/docs/lib/renderable.js`（新規作成）
- `src/docs/lib/data-source.js`（`toMarkdownTable` を `Table` 委譲に置換）
- `src/docs/lib/directive-parser.js`（`resolveDataDirectives` 内の Renderable 対応、最終的に文字列サポート削除）
- `src/lib/container.js`（Renderable 系 export 追加）
- `src/docs/data/*.js`（戻り値を Renderable に移行）
- `src/presets/*/data/*.js`（戻り値を Renderable に移行、21+ ファイル）
- `tests/unit/renderable.test.js`（新規、REQ-01/02/09 検証）
- `tests/unit/directive-parser.test.js`（Renderable ハンドリング追加）

## Test Strategy
- **Unit tests**: `tests/unit/renderable.test.js` を新規作成し、9 クラスの正常系と invariant 違反時の throw を網羅する。
- **Integration tests**: `tests/unit/directive-parser.test.js` を拡張し、resolver 戻り値が Renderable の場合・null の場合・（移行完了後）不正な型の場合を検証する。
- **Regression (snapshot)**: 既存の docs 出力回帰テスト（acceptance fixtures）を全 preset で実行し、移行前後で byte-identical であることを確認する。
- **Grep-based verification**: AC-04 に示した grep コマンドを CI に組み込むか、手動確認で REQ-05 の完了を保証する。

## Open Questions
- 外部 preset（npm 配布利用側）への破壊的変更の告知方法: CHANGELOG.md への記載を行うか、README.md の migration section に追記するか。alpha 期間のため必須ではないが、外部利用者が存在する場合の配慮を implement フェーズ終了時に決定する。
