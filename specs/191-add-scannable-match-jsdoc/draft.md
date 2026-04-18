---
issue: 172
runId: e23e4407-74f3-4aa5-a73c-92a6b04a9b31
mode: decision  # ブレストではなく、Issue #172 の方針を踏まえた決定段階。
---

# Draft: Scannable.match() 引数仕様の JSDoc 明記

**開発種別:** documentation / OTHER（ドキュメントのみの変更。プロダクトコード挙動は変更しない）

**目的:** `Scannable` mixin の `match(relPath)` に渡される相対パス引数の形式を契約として JSDoc に明文化し、プリセット作成者がソースを読まずに仕様を把握できる状態を作る。

**議論段階:** Decision（意思決定）。本 draft は Issue #172 にて方針が合意済みの事項を要件化するフェーズであり、ブレインストーミング段階ではない。代替案の評価は方針確定のためのレビュー目的で記載している。

## Impact on Existing Features

- 既存機能への挙動上の影響は **なし**（JSDoc コメント追記のみ）。
- API 契約の文言が変わるだけで、ランタイム挙動・ビルド・テスト合否・CLI インタフェースは変化しない。
- 既存プリセット実装（webapp / laravel / symfony 等）の `match(relPath)` override は現契約を既に満たしているため修正不要。
- 後方互換性への影響なし。

## Requirements（優先順）

優先度は P1（必須）> P2（必須だが影響小）> P3（nice-to-have）。

### P1 — 契約情報の明文化（必須）

- **When** プリセット作成者が IDE で `Scannable.match()` の JSDoc を参照した時、**shall** その JSDoc から `relPath` の起点・区切り文字・先頭記法を判別できなければならない。
- **When** `relPath` が関数に渡される時、**shall** その値はスキャンルート（`SDD_SOURCE_ROOT`）からの相対パスであり、区切り文字は `/`（POSIX）であり、先頭の `./` は付かないことが JSDoc 上に明記されていなければならない。
- **If** Windows 上で実行された場合でも、**shall** 区切り文字は `\` に変換されないことが JSDoc 上で明示されなければならない。
- **When** 戻り値 `boolean` が記述される時、**shall** その真偽値の意味（このソースが当該ファイルを処理対象とするか）が JSDoc に添えられていなければならない。

### P2 — 検証可能性の担保（必須）

- **When** 本 spec の受け入れ判定を行う時、**shall** 契約に含める必須キーワード（起点の識別、POSIX、`./`）が対象 JSDoc に含まれていることを機械的に検証できなければならない。
- **When** テスト方針を決める時、**shall** JSDoc の文字列検査ベースの spec 検証のみを採用し、プロダクトコードの挙動テストは新規追加しないものとする。

### P3 — 拡張性（nice-to-have）

- **When** 本 spec で追加する JSDoc ブロックを執筆する時、**shall** 以下の 4 行要素（(a) 起点の識別子、(b) 区切り文字（POSIX/Windows の言及含む）、(c) 先頭記法、(d) 具体例）をこの順で列挙した構造で記述しなければならない。これは将来 `parse(absPath)` 側にも同じ 4 行構造を転用できるようにするためである。

## Constraints

プロジェクトルール（CLAUDE.md）由来：

- alpha 版ポリシー：後方互換コード追加禁止（本 spec は該当なし／挙動変更なし）。
- `src/` に特定プロジェクト固有情報を書かない（本 spec の記述は汎用契約のみで遵守）。
- 過剰な防御コード禁止／シンプルなインターフェースを優先（JSDoc は契約明文化に留め、実行時検証や型分岐は追加しない）。
- 既存 JSDoc が英語統一であるため、本件も英語で記述する（日本語併記はしない）。

## Edge Cases / Out of Scope

- 入力が OS ネイティブ区切りで渡されるケースは scan パイプライン側の契約（POSIX 正規化済みで渡す）で担保されており、Scannable 側での変換や防御は行わない。
- 基底 `DataSource` への `match()` 追加は行わない（契約は Scannable mixin に閉じる）。
- 各プリセット override の `match()` への JSDoc 追加は行わない（契約は基底で定義し override 側は実装のみ）。
- 日本語 JSDoc／i18n 対応は別 spec で扱う。
- `parse(absPath)` の JSDoc 拡充は本 spec のスコープ外。

## Alternatives Considered

- 案A：基底 `DataSource` クラスに抽象 `match()` を追加し契約をそこに書く。  
  却下理由：`match()` は Scannable 固有の契約であり、Scannable を mix-in しない data-only DataSource には存在しない。基底に置くと Scannable／data-only の契約差が曖昧化し、CLAUDE.md の「シンプルなインターフェースに十分な実装を隠す」方針に反する。
- 案B：`docs/` 配下のガイド文書（creating_presets.md など）にのみ記述する。  
  却下理由：プリセット開発者の一次接点は IDE の JSDoc 補完であり、一次情報は JSDoc に置く方が発見性が高い。ガイド文書と JSDoc の二重管理による陳腐化リスクも避けたい。
- 採用案：Scannable mixin 内 `match()` の JSDoc に集約する（Issue #172 の提案に合致）。

## Q&A

各回答は Issue #172 の記述、`src/docs/lib/scan-source.js` の現状コード、CLAUDE.md の原則を根拠に導出している。

### Q1 記述言語は英語・日本語どちらか？
回答：英語。  
根拠：`src/docs/lib/scan-source.js` の既存 JSDoc が英語統一。文体統一のため日本語併記はしない。

### Q2 基底 `DataSource` 側にも `match()` を追加するか？
回答：追加しない。  
根拠：Scannable mixin を mix-in しない data-only DataSource には `match()` 契約自体が存在しない（`src/CLAUDE.md` の DataSource 分類に基づく）。基底に置くと契約境界が崩れる。

### Q3 各プリセットの `match()` override にも JSDoc を書くか？
回答：書かない。  
根拠：契約は基底で一元定義する方が保守負荷が低く、CLAUDE.md「シンプルなインターフェース」原則に合致。override 側は実装のみ。

### Q4 Windows での区切り文字の扱いを契約にどう書くか？
回答：「Windows 上でも `\` に変換されない、常に `/`」と明示する。  
根拠：Issue #172 本文で明示された要請、かつ既存 scan パイプラインの実挙動と整合。

### Q5 プロダクトコードのテストは必要か？
回答：不要。JSDoc 文字列検査ベースの spec 検証のみで十分。  
根拠：挙動変更なしのため既存テストで回帰は拾える。新規挙動テストは過剰で、CLAUDE.md「過剰な防御コードを書かない」に反する。

### Q6 将来の拡張余地として何を残すか？
回答：`parse(absPath)` 側に同等スタイルの JSDoc を揃える余地。  
根拠：今回 `match` のみに限定するが、同じ書式で後続拡張できる構造にしておくことで、将来の一貫性を担保できる。

### Q7 影響範囲の再確認
回答：既存プリセットは現契約を満たしており変更不要。挙動・ビルド・CI・CLI に影響なし。  
根拠：プリセット実装は既に POSIX 区切りの相対パスを前提に動作しており、JSDoc 追記は契約の文書化のみ。

## 確認

- [x] User approved this draft (autoApprove)
- 承認日: 2026-04-18
