# Feature Specification: 191-add-scannable-match-jsdoc

**Feature Branch**: `feature/191-add-scannable-match-jsdoc`
**Created**: 2026-04-18
**Status**: Draft
**Input**: Issue #172 — Document argument spec of `Scannable.match()` in JSDoc
**Development Type**: documentation (JSDoc only — no runtime behavior change)

## Goal

`Scannable` mixin の `match(relPath)` に渡される相対パス引数の形式を契約として JSDoc に明文化し、プリセット作成者がソースコードを読まずに API 契約を把握できる状態にする。

## Scope

- `src/docs/lib/scan-source.js` の `Scannable` mixin 内 `match()` メソッドの JSDoc を拡充し、`relPath` 引数の以下要素を明記する：
  - 起点：スキャンルート（`SDD_SOURCE_ROOT`）からの相対パス
  - 区切り文字：常に `/`（POSIX 形式）、Windows 上でも `\` に変換されない
  - 先頭記法：`./` を付けない
  - 具体例：1 行の例示（例: `src/controllers/UserController.php`）
- 戻り値 `boolean` の意味（このソースがファイルを処理対象とするか）を JSDoc に添える。
- JSDoc 記述は英語（既存 JSDoc と統一）。
- spec 検証用の軽量テスト（JSDoc 文字列検査）を spec 配下に配置する。

## Out of Scope

- 基底 `DataSource` クラスへの `match()` 追加（契約は Scannable に閉じる）。
- 各プリセットの `match()` override への JSDoc 追加。
- `parse(absPath)` 側 JSDoc の同等拡充（将来別 spec）。
- 日本語 JSDoc／i18n 対応。
- プロダクトコードの挙動変更。

## Clarifications (Q&A)

- Q: 基底 `DataSource` 側にも `match()` の JSDoc を追加すべきか？
  - A: 追加しない。`match()` は Scannable 固有の契約であり、data-only DataSource には存在しない。基底に置くと契約境界が曖昧化する。
- Q: Windows 上での区切り文字の扱いをどう書くか？
  - A: 「Windows 上でも `\` に変換されず、常に `/`」と明示する（Issue #172 の提案に一致）。
- Q: プロダクトコードの挙動テストは必要か？
  - A: 不要。挙動変更がないため既存テストで回帰は検知される。JSDoc 文字列検査のみ行う。
- Q: 記述言語は？
  - A: 英語。既存 JSDoc が英語統一のため。

## Alternatives Considered

- 案A: 基底 `DataSource` に抽象 `match()` を追加し契約を基底に書く。  
  却下：Scannable 固有の契約であり、data-only DataSource との境界が曖昧になる。
- 案B: `docs/` のガイド（creating_presets.md）にのみ記述する。  
  却下：IDE 一次情報源は JSDoc であり、そこに置くのが自然。ガイドとの二重管理を避ける。
- 採用案: Scannable mixin 内 `match()` の JSDoc に集約。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-18 (autoApprove mode)
- Notes: Tier 1 バッチ処理の一環として auto mode で承認。挙動変更のない JSDoc 加筆のみ。

## Requirements

優先度 P1（必須）> P2（必須だが影響小）> P3（nice-to-have）。各要件は `When/If ... shall ...` 形式で記述する。

### P1 — 契約情報の明文化

- R1: **When** `src/docs/lib/scan-source.js` の `Scannable` mixin 内 `match()` の JSDoc を読んだ時、**shall** `relPath` がスキャンルート（`SDD_SOURCE_ROOT`）からの相対パスである旨が明記されていなければならない。
- R2: **When** 同 JSDoc を読んだ時、**shall** `relPath` の区切り文字が常に `/`（POSIX 形式）である旨が明記されていなければならない。
- R3: **If** 実行環境が Windows である場合でも、**shall** `relPath` の区切り文字が `\` に変換されない旨が同 JSDoc 上で明示されていなければならない。
- R4: **When** 同 JSDoc を読んだ時、**shall** `relPath` の先頭に `./` が付かない旨が明記されていなければならない。
- R5: **When** 同 JSDoc を読んだ時、**shall** `relPath` の具体例が 1 つ以上含まれていなければならない（例: `src/controllers/UserController.php`）。
- R6: **When** 同 JSDoc の `@returns {boolean}` を読んだ時、**shall** 真偽値の意味（このソースが当該ファイルを処理対象とするか）の説明が添えられていなければならない。

### P2 — 検証可能性

- R7: **When** spec 検証用テストを実行する時、**shall** 追加した JSDoc に必須キーワード `SDD_SOURCE_ROOT`, `POSIX`, `./` の全てが含まれることを機械的に検証するテストが `specs/191-add-scannable-match-jsdoc/tests/` 配下に配置されていなければならない。
- R8: **When** `npm test` を実行した時、**shall** R7 の spec 検証テストが同コマンドの実行対象に含まれていてはならない（spec 配下に限定配置し、`specs/<spec>/tests/README.md` に独立した実行手順を記載する）。

### P3 — 拡張性

- R9: **When** JSDoc ブロックを執筆する時、**shall** `parse(absPath)` 側への転用を見据えて (a) 起点、(b) 区切り文字、(c) 先頭記法、(d) 具体例 の 4 要素を、この順で列挙した構造で記述しなければならない。

## Acceptance Criteria

- AC1: `src/docs/lib/scan-source.js` の `Scannable` mixin の `match()` JSDoc に R1〜R6 の全要素が反映されている。
- AC2: spec 検証テスト（R7）を実行すると PASS する。必須キーワード全てが JSDoc 内に検出されること。
- AC3: `npm test` の既存テストスイートが全て PASS する（挙動変更なしの担保）。
- AC4: コミット差分が `src/docs/lib/scan-source.js` の JSDoc コメント範囲と `specs/191-add-scannable-match-jsdoc/` 配下のみで、プロダクトコード挙動を変更する行が含まれていない。

## Open Questions

なし。
