# Feature Specification: 249-spec-header-coverage

**Feature Branch**: `feature/249-spec-header-coverage`
**Created**: 2026-05-01
**Status**: Draft
**Input**: GitHub Issue #305

## Goal
test-map.json (AI が手書きする要件カバレッジ宣言ファイル) を廃止し、spec verification test ファイル先頭の `// spec: R1 R2 ...` (JS) / `# spec: R1 R2 ...` (md/yaml) コメントヘッダーに一本化する。これにより AI のヘッダー手書き整合維持コストが消え、欠落は静的検証で検出される。テスト不要要件は spec.json の requirements[].testable: false で宣言する。

## Background
retro の static 評価は test-map.json (R1, R2, ...) と TAP 出力のテスト名プレフィックス (^R\d+\b) という 2 つの独立したマッピングに依存している。test-map.json は AI が手書きする宣言ファイルでテストコードとの整合性が保証されない。実際に spec 248 で it() 名の R4:/R5: プレフィックスが欠落し retro が 60% に低下した。本 spec ではヘッダー宣言とテスト名の整合を test step 完了時に静的検証することで、宣言と実装の不一致を構造的に防ぐ。

## Scope
- [must] テストファイル先頭の `// spec:` ヘッダー規約導入 (現状の discovery scope は `.{test,spec}.{js,ts,mjs}` のため実用は `// spec:` のみ)
- [must] test ステップ完了時のヘッダー coverage 静的検証 (TAP 実行なし)
- [must] retro の static 評価をヘッダーベースに改修 (run-retro.js)
- [must] review-test の untested 要件警告をヘッダーベースに改修 (review.js loadReqMap の test 分岐 + line 880-895)
- [must] req-map.js から loadTestMap / isTestNotRequired / TEST_MAP_NAME を削除
- [must] spec.schema.json に requirements[].testable (boolean, optional) を追加
- [must] src/flow/prompts/plan/test.md を更新 (test-map.json 指示 → ヘッダー指示、no-test-environment 例外を testable: false 全要件のみに限定)
- [must] src/flow/prompts/plan/spec.md を更新 (testable: false 宣言の用法を AI に教示)
- [must] ヘッダー解析・検証の共通ヘルパー src/flow/lib/test-headers.js を新設
- [must] testable: false 要件を AI prompt builder (requirementsAsText, extractRequirements) で末尾注釈付きで出力 (retro static / AI 両モードに適用、prompt input からは除外しない)

## Out of Scope
- file-map.json (gate-impl の per-requirement diff フィルタリング用) — 残置
- TAP 出力からの R-ID 抽出 (extractReqResults) — retro でテストレベル判定として継続使用
- 既存 spec の test-map.json マイグレーション (新コードは読まないため touch しない)
- `# spec:` ヘッダー記法の実用サポート — parser は `# spec:` を認識可能に設計するが、現状の discovery scope (`.{test,spec}.{js,ts,mjs}`) には `#` がコメント記号となるファイル拡張子は含まれないため、本 spec で valid と判定される `# spec:` の出現は無い。dcb2 (test runner externalization) で .md / .yaml 等が discovery に加わる時点で実用化される。
- 新しい言語のコメント記号サポート (`--`, `;`, `<!--` 等) — 別 spec
- dcb2 (test runner externalization) との結合 + discovery glob 拡張 — 別 spec
- src/flow/prompts/impl/implement.md および test.md の `node --test specs/<spec>/tests/*.test.js` 実行コマンド glob 更新 — 別 spec (実行 runner の glob 拡張は discovery とは独立の concern)
- src/flow/commands/report.js の summary 表示 (testable: false count を含む新フィールドの render) — 別 spec
- spec.md rendering / PR description / 汎用 summary / gate prompt の testable 反映 — 別 spec

## Constraints
- alpha 版方針に従い、後方互換コードは書かない (旧 test-map.json 読み込み経路は完全削除)
- 外部依存追加禁止 (Node.js 組み込みのみ)
- src/ 配下に特定プロジェクト固有情報を含めない
- Envelope.fail API のシグネチャ (type, key, code, messages, data) を変更しない
- retro.json schema (run-retro.js:60-87 の requirements item enum [done|partial|not_done]) を変更しない
- 既存 spec の retro.json と互換性を保つ (testable: false 要件は requirements[] 外で集計)

## Design Principles
- ヘッダーは言語非依存の文字列パターン (`//` または `#` コメント記号) として設計する
- test step 検証は静的 (TAP 実行なし)、retro は動的 (TAP 実行あり) に責務分離
- 妥当性違反は AI / CLI が個別に識別可能な形で報告する (silent skip 禁止)
- ヘッダー検証ロジックは set-step / retro / review-test の 3 箇所から共有利用する (重複実装禁止)
- consumer は `requirement.testable !== false` で testable 判定する (default 値の埋め込みなし)

## Overview
### Modules
- src/flow/lib/test-headers.js (新規): ヘッダーパース・カバレッジ集計・妥当性検査の共通ヘルパー
- src/flow/lib/set-step.js (改修): test step done 時の pre-validation を追加
- src/flow/lib/run-retro.js (改修): tryStaticEvaluation をヘッダーベースに、unverified status のバグ修正
- src/flow/commands/review.js (改修): untested 要件警告をヘッダーベースに
- src/flow/lib/req-map.js (改修): TEST_MAP 系 export 削除 (file-map 系は残置)
- src/flow/schemas/spec.schema.json (改修): requirements[].testable (boolean, optional) を追加
- src/flow/prompts/plan/test.md (改修): test-map.json 指示をヘッダー指示に置換

### Data Flow
- test step done: set-step → test-headers.validateTestHeaders(specDir) → 失敗時 Envelope.fail で flow state 更新を阻止
- retro static: run-retro → test-headers.collectFileHeaders(specDir) → ヘッダー宣言マップ取得 → TAP 実行 → status 判定
- review-test untested 警告: review.js → test-headers.evaluateCoverage(spec, specDir) → 未カバー testable 要件を警告
- AI prompt builder (requirementsAsText, extractRequirements): testable === false の要件は末尾に ` (testing not required)` 注釈付きで出力

### Decisions
- ヘッダー記法は `// spec:` (JS 系) と `# spec:` (md/yaml 系) の 2 形のみ。.js/.mjs/.ts では `# spec:` を MISMATCHED_MARKER として拒否。
- test step 検証は静的 (TAP 実行なし)。per-file mismatch (ヘッダー宣言 R-N + 同ファイルに R-N: テストなし、または逆) は同ファイルのテキスト regex スキャンで検出する。
- set-step.js での pre-validation 方式。post-hook ではなく updateStepStatus 呼び出し前に検証を行い、失敗時は flow state を更新しない (原子性)。
- testable フラグは spec.json の requirements[].testable (boolean, optional) として宣言。consumer は `requirement.testable !== false` で判定する (default 値の埋め込みなし)。
- testable: false 要件は retro.json の requirements[] 配列に含めず、summary に件数のみ反映する。retro.json schema enum [done|partial|not_done] と整合させる。
- 現行 evaluateReqByResults が null counts で 'unverified' を返す経路は schema 違反のバグ。本 spec のリファクタで 'not_done' に統一する。
- 既存 spec の test-map.json は touch しない (新コードは読まないため事実上無視される)。req-map.js から loadTestMap / isTestNotRequired / TEST_MAP_NAME のみ削除。
- 本 spec で更新する testable: false consumer は『test 関連の path』に限定する (header 検証、retro、review-test、test 設計に関わる AI prompt builder)。spec.md rendering / PR description / 汎用 summary / gate prompt 等は別 spec で監査する。
- Discovery 対象は `specs/<spec>/tests/` 配下の `.{test,spec}.{js,ts,mjs}` (review.js:680 collectTestsRecursive と同じ集合)。project tests/ 配下は対象外 (spec とは独立した formal tests)。

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- test-map.json を残し AI のヘッダー手書き整合チェックを別途追加する — 二重宣言の根本原因が解消されない。AI の手書きミスは依然発生する。
- test step で TAP 実行を行い it() の R-N: 整合まで検証する — Issue #305 のスコープ外。test 失敗状態で step done が阻止され write-tests の正常フローと矛盾する。
- ヘッダー一本化 (extractReqResults を廃止) — 失敗テスト数による partial / not_done 判定ができなくなる。
- testable: false を draft.json で宣言する — 要件 ID を 2 ファイル (draft + spec) で参照することになり ID 変更時の整合維持コストが上がる。
- 既存 test-map.json を一括削除またはマイグレーション — alpha 版方針 (後方互換コード禁止) と矛盾しないが、新コードは読まないため不要な diff が発生するだけ。
- spec.md rendering / PR description / gate prompt 全 path で testable: false を audit する — 本 spec のスコープが拡大、Issue #305 主目的 (test-map.json 廃止) と無関係な path も触る。別 spec で扱う。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-01T03:24:29.416Z
- Notes: autoApprove: gate PASS 後の自動承認

## Requirements
- R1 [must]: spec verification test files (specs/<spec>/tests/ 配下の `.{test,spec}.{js,ts,mjs}`) の先頭付近に `// spec: R1 R2 ...` (JS) または `# spec: R1 R2 ...` (md/yaml) 形式のコメントヘッダーが書かれていれば valid header として受理される。`#!` shebang は許容、`spec` キーワードを含まない通常コメント (license header, タスクコメント等) との共存も許容する。
- R2 [must]: `sdd-forge flow set step test done` は spec verification test files にヘッダー欠落・testable 要件未カバー・不正 R-ID・per-file mismatch のいずれかが検出された場合、Envelope.fail を返し flow state の test step status を更新しない (pre-validation 原子性)。検証 PASS 時のみ done が永続化される。
- R3 [must]: spec.json の requirements[] 各要素は optional な testable (boolean) フィールドを持てる (src/flow/schemas/spec.schema.json の requirements item properties に追加、現行 additionalProperties: false)。consumer は `requirement.testable !== false` で testable 判定する (missing / true / undefined → testable, false のみ → not testable)。default 値の埋め込みは行わない。
- R4 [must]: ヘッダー妥当性検査は以下 10 種の違反を検出可能で、AI / CLI が個別に識別できる形で報告する: (a) ヘッダー欠落、(b) testable 要件未カバー、(c) 未知 R-ID (spec.json.requirements[].id 集合に無い ID)、(d) malformed (spec を含むが strict 形式に合致しないコメント、コロン抜け / 記号過多 / 不正 R-ID 形式)、(e) 同一ファイル R-ID 重複、(f) 同一ファイル複数 valid ヘッダー、(g) testable: false 要件のヘッダー宣言、(h) JS 系拡張子で `# spec:` を使用、(i) ヘッダー宣言 R-N + 同ファイルに `R-N:` で始まるテスト名なし、(j) 同ファイルに `R-N:` で始まるテスト名あり + ヘッダー未宣言。複数ファイル間で同一 R-ID をカバーするのは正常。**(i) (j) のテスト名検出ルール**: ファイル全体を行単位でスキャンし、`(it|test)\s*\(\s*['"\\`]R(\d+):` 正規表現にマッチした行から R-ID を抽出する (テスト関数 `it()` / `test()` の第 1 引数 string literal の先頭が `R<N>:`)。Comment 行 (parser が判定済) と template literal 内のネスト等は対象外。`describe()` 内の `it()` も対象。false-positive (テスト関数以外で同パターンが偶然出現) は許容する (現行 extractReqResults と同レベルの保守的 regex)。
- R5 [must]: retro の static 評価 (run-retro.js:tryStaticEvaluation) はヘッダーから収集したマッピングをファイル→要件の対応として使う (test-map.json は読まない)。マッピングが空の場合は現行同様 null を返して AI 評価フォールバックする。
- R6 [must]: retro の評価結果 (retro.json) において、testable === false の要件は requirements[] 配列に含めず summary 集計に分離する。これは static / AI fallback の両モードに適用する。AI モードでは buildRetroPrompt の入力からは除外せず R9 と整合する形で末尾注釈付きで含める (AI が non-testable 要件にテスト結果を期待しないように誘導)。parseRetroResponse は AI が返す requirements[] から testable: false を除外して retro.json に書き込む (defensive)。retro.json の requirements item status enum [done|partial|not_done] と整合させる。現行 evaluateReqByResults が null counts で 'unverified' を返す箇所は 'not_done' に統一する (schema 違反バグ修正)。retro.json の summary に testable: false 件数を表す新フィールドを追加する (フィールド名は実装フェーズで決定、report.js での render は別 spec)。
- R7 [must]: review.js の untested-requirement 警告 (line 880-895) はヘッダーから取得したカバレッジに基づき、ヘッダー宣言が無い testable 要件のみを警告対象とする (testable === false は除外)。同時に loadReqMap (review.js 上部) の test 分岐は loadTestMap への依存から test-headers のカバレッジ評価に置き換え、loadFileMap への依存は impl review 用途で残置する。
- R8 [must]: src/flow/lib/req-map.js から loadTestMap / isTestNotRequired / TEST_MAP_NAME を削除する。loadFileMap / parseTapOutput / extractReqResults / evaluateReqByResults / reconcileFileMap は残置する。
- R9 [must]: AI prompt builder (run-retro.js:requirementsAsText、review.js:extractRequirements) は testable === false の要件を出力末尾に ` (testing not required)` 注釈付きで含める (要件自体を除外しない、AI が non-testable に対するテスト設計を提案しないように誘導)。
- R10 [must]: src/flow/prompts/plan/test.md を更新する: (a) 現行の test-map.json 作成指示 (line 12-26) を削除し、ヘッダー記述指示 (構文・拡張子別ルール・testable 除外・`R-N:` テスト名規約・バリデーションエラー種別) に置換する。(b) 現行の『If no test environment』エスケープ経路 (line 27-29) を testable: false が全要件に設定されている場合のみ有効とし、それ以外では spec verification test files (ヘッダー必須) の作成を要求する旨に書き換える。
- R11 [must]: ヘッダー解析・カバレッジ集計・妥当性検査の共通ヘルパー src/flow/lib/test-headers.js を新設し、set-step (test, done) の pre-validation、run-retro.js:tryStaticEvaluation、review.js:880-895 の 3 箇所から共有利用する (重複実装禁止)。
- R12 [must]: Edge case 動作: (a) `specs/<spec>/tests/` ディレクトリ不在またはテストファイル 0 件で、testable 要件が 1 つでもある場合は uncoveredRequirements に該当全件が含まれ test step done は失敗する。(b) 全要件 testable: false (testable 要件 0 件) なら spec verification test files が無くても step done は成功する。(c) retro: 全要件 testable: false の spec で retro を実行した場合、static 評価は決定的な結果を返す (requirements[] は空、summary は total=0 と testable: false 件数を含む)、AI 評価フォールバックは行わない。(d) review-test: 全要件 testable: false の spec で review-test を実行した場合、untested 警告は発生しない。AI test 設計を呼ぶか否かは現行動作維持 (本 spec のスコープ外)。
- R13 [must]: src/flow/prompts/plan/spec.md を更新する: spec 作成時に AI が requirements[] のうち文書 / プロンプト / 設定変更のみで構成されるような要件には optional な testable: false フィールドを設定するよう教示する。default は testable === true 扱いで未設定なら省略可能、設定する場合の判定基準 (テスト可能 / 不可能) と表示時の意味 (review-test / retro でカバレッジ・テスト要求から除外される) を記述する。
- R14 [must]: src/flow/prompts/plan/test.md は AI に対し、spec.md ではなく spec.json を参照して requirements[].testable の値を取得するよう明示する (spec.md rendering は本 spec で testable を表示しないため、test 設計時には spec.json 参照が必須)。

## Acceptance Criteria
- spec verification test file に valid なヘッダーがある状態で `flow set step test done` が成功する
- ヘッダー欠落 / 未カバー / 未知 R-ID / malformed / 重複 / testable: false 宣言 / マーカー不一致 / per-file mismatch のいずれかで `flow set step test done` が Envelope.fail を返す (flow state は更新されない)
- spec.schema.json validate が requirements[].testable (boolean) を受理する (additionalProperties: false の制約下で)
- retro static 評価がヘッダーベースで動作し、retro.json の requirements item の status は [done|partial|not_done] のみ含む
- testable: false 要件は retro.json の requirements[] に含まれず summary 集計に反映される
- review-test untested 警告がヘッダーベースで動作し、testable === false 要件は警告対象から除外される
- src/flow/lib/req-map.js に loadTestMap / isTestNotRequired / TEST_MAP_NAME が存在しない (grep で検出されない)
- requirementsAsText / extractRequirements の出力で testable: false 要件に ` (testing not required)` 注釈が付く
- test.md prompt が test-map.json への言及を含まず、ヘッダー記述指示を含む
- 全 Node.js 組み込みのみ使用 (npm 依存追加なし)
- `npm test` が成功する (test-headers.js のユニットテスト含む)

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add testable field to spec.schema.json
  - spec.json の requirements[] が optional な testable (boolean) フィールドを受理できるよう、src/flow/schemas/spec.schema.json の requirements item properties に追加する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Create test-headers.js helper
  - ヘッダーパース・カバレッジ集計・妥当性検査の共通ヘルパー src/flow/lib/test-headers.js を新設する。set-step / retro / review-test から共有利用される。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Wire validateTestHeaders into set-step pre-validation
  - src/flow/lib/set-step.js の SetStepCommand.execute() で id='test' かつ status='done' を受け取った時、updateStepStatus 呼び出し前に test-headers のバリデーションを実行し、失敗時は Envelope.fail を return して flow state を更新しない。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Refactor run-retro.js to header-based and apply testable filter to all modes
  - src/flow/lib/run-retro.js の tryStaticEvaluation を test-map.json 読み込みからヘッダーベースに書き換える。同時に testable: false を requirements[] から除外して summary 集計に分離 (static / AI fallback の両モードで適用)、'unverified' status バグを 'not_done' に修正する。
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Refactor review.js untested warning to header-based
  - src/flow/commands/review.js:880-895 の untested-requirement 警告を test-map.json ベースから test-headers.js のカバレッジ評価ベースに書き換える。
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Annotate testable: false in AI prompt builders
  - run-retro.js の requirementsAsText (line 25) と review.js の extractRequirements (line 665) を更新し、testable === false の要件出力末尾に ` (testing not required)` 注釈を付ける。
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Remove TEST_MAP exports from req-map.js
  - src/flow/lib/req-map.js から loadTestMap / isTestNotRequired / TEST_MAP_NAME を削除する。loadFileMap / parseTapOutput / extractReqResults / evaluateReqByResults / reconcileFileMap は残置する。
  - see `tasks/T-7.md` for full spec
- **T-8** [pending]: Update test.md prompt to header-based
  - src/flow/prompts/plan/test.md の test-map.json 作成指示 (line 12-26) を削除し、ヘッダー記述指示 (構文・拡張子別ルール・testable 除外・R-N: テスト名規約・バリデーションエラー種別) に置換する。
  - see `tasks/T-8.md` for full spec
- **T-10** [pending]: Update spec.md prompt to teach testable: false
  - src/flow/prompts/plan/spec.md を更新し、spec 作成時に AI が requirements[].testable: false の使い分けを理解できるようにする。
  - see `tasks/T-10.md` for full spec
- **T-9** [pending]: Add spec-local integration tests
  - spec verification 用の統合テストを specs/249-spec-header-coverage/tests/ に追加する。set-step pre-validation、retro static 評価、review-test 警告のヘッダーベース動作を検証する。
  - see `tasks/T-9.md` for full spec
