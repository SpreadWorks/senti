# Feature Specification: 225-auto-check-omnibus-fix

**Feature Branch**: `feature/225-auto-check-omnibus-fix`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #255

## Goal
- auto-check の false positive と入力の薄さを解消し、軽微な修正リクエストが妥当な範囲で eligible 判定を通るようにする。

## Background
- Issue #255 は auto-check (flow set auto on / flow run auto-check) の過剰 reject を引き起こす 6 つの観察点をまとめた洗い出しである。
- draft 議論で scope を絞り、本 spec は #1（G_KEYWORDS の過剰 hit）と #4（Issue 本文未参照）のみを扱う。
- 他の観察点（#2 hard-gate zero-tolerance、#3 THRESHOLD 再調整、#5 failed verdict 非キャッシュ + 新機能、#6 reason 表示）は別 board draft（df3f, 05cc, 6a1d）に切り出し、#6 はドロップ。
- 前提: #1 の false positive が軽減し #4 で入力が厚くなれば、#2/#3 の tuning 要件自体が消える可能性がある。

## Scope
- `src/flow/lib/auto-check-static.js` の G_KEYWORDS 縮減（H_KEYWORDS は現状維持）。
- `flow set init --issue <n>` 実行時に gh で Issue 本文を取得し preparing state に保存。
- `flow prepare` 実行時に preparing state の issueBody を `specs/<spec>/issue.md` に書き出し。
- `flow set issue <n>` 実行時に gh で Issue 本文を取得し `specs/<spec>/issue.md` を更新。
- `resolve-auto-check-input.js` の buildBaseInput が Issue 本文を入力に取り込む。preparing 時は state.issueBody、active 時は `specs/<spec>/issue.md` を読む。
- gh fetch 共通ヘルパー `src/flow/lib/fetch-issue.js` を新設し、既存 `get-issue.js` もこれを使う。
- Issue 本文 minify 用に markdown 言語 handler `src/docs/lib/lang/md.js` を新設し `lang-factory.js` の EXT_MAP に `.md` 登録。既存 `minify.js` pipeline を md handler 向けに blank 行保持モードで分岐。

## Out of Scope
- hard-gate zero-tolerance の段階化（別 board: df3f）。
- THRESHOLD 再調整（別 board: 05cc）。
- failed verdict 非キャッシュおよびフェーズ進行に伴う再評価・昇格通知機能（別 board: 6a1d。本 spec の変更が前提となる）。
- auto-check の reason 文字列の表示改善（ドロップ確定）。
- Issue 本文取得失敗時の再試行・サーキットブレーカ（silent fallback 固定）。
- `<details>` ブロックの minify 除去（中身の有用情報を失う可能性のため除外）。
- GitHub 側で Issue 本文が編集された後の自動再取得。ユーザーは手動で issue.md を削除または編集する。

## Constraints
- **外部依存なし**: Node.js 組み込みのみ使用。新規 npm 依存は追加しない。
- **後方互換性不要（alpha 期）**: 旧 verdict 形式や廃止パスを残さない。
- **CLI 互換**: 既存の `flow set init` / `flow prepare` / `flow set issue` の CLI オプション・引数契約は変更しない（挙動の追加のみ）。
- **silent fallback**: gh 未インストール / 認証エラー / ネットワーク失敗時も auto-check 全体を失敗させない。Issue 本文なしの従来挙動で続行する。
- **過剰な防御コード禁止**: 内部インターフェースは信頼しシステム境界（gh 呼び出し、ファイル I/O）でのみバリデーション。

## Design Principles
- **Simple interface, deep module**: Issue 取得の責務は 1 つの共通ヘルパーに集約。呼び出し側は strict / lenient を切り替えるだけ。
- **Static gate は pre-filter**: 明らかなリスクだけ弾く役割に戻す。広範囲カバーは AI スコアリングの責務。
- **キャッシュの単一責任**: Issue 本文の保存先は preparing 時は preparing state、active 時は `specs/<spec>/issue.md` の単一ファイル。状態とファイルの二重管理はしない。
- **minify は md handler に委譲**: 既存の lang-factory パターンに乗せる。専用ヘルパーを別途作らず言語 handler として統一。

## Overview
### Modules
- **`src/flow/lib/auto-check-static.js`** — G_KEYWORDS 縮減。
- **`src/flow/lib/fetch-issue.js`**（新規）— gh issue view 呼び出しの共通ヘルパー。strict/lenient モード対応。
- **`src/flow/lib/get-issue.js`**（更新）— 新ヘルパーを使用。外部契約は不変。
- **`src/flow/lib/set-init.js`**（更新）— `--issue` 付きで呼ばれた場合、lenient fetch を実行し preparing state に issueBody を保存。
- **`src/flow/lib/set-issue.js`**（更新）— active mode での issue 紐付け/変更時、lenient fetch で `specs/<spec>/issue.md` を書き出し。
- **`src/flow/lib/run-prepare-spec.js`**（更新）— preparing state の issueBody を `specs/<spec>/issue.md` に書き出し。
- **`src/flow/lib/resolve-auto-check-input.js`**（更新）— buildBaseInput が Issue 本文（minify 済み）を入力に含める。preparing / active で取得ソース切替。
- **`src/docs/lib/lang/md.js`**（新規）— markdown minify handler（HTML コメント除去、画像 → alt、水平線除去、連続空行を 1 行に、末尾空白除去、`<details>` は保持）。
- **`src/docs/lib/lang-factory.js`**（更新）— `.md` extension を md handler にディスパッチ。
- **`src/docs/lib/minify.js`**（更新）— md handler 向けに blank 行保持モードで generic pipeline を分岐。

### Data Flow
```
flow set init --issue N
  └─ fetch-issue(N, lenient) → body
     └─ preparing state (.active-flow.<runId>).issueBody = minify(body)

flow prepare
  └─ preparing state.issueBody → specs/<spec>/issue.md

flow set issue N (active mode)
  └─ fetch-issue(N, lenient) → body
     └─ specs/<spec>/issue.md = minify(body)

flow run auto-check (preparing mode)
  └─ resolveAutoCheckInput → buildBaseInput
     └─ state.request + state.issueBody (if present)

flow run auto-check (active mode)
  └─ resolveAutoCheckInput → buildBaseInput
     └─ state.request + read specs/<spec>/issue.md (if exists)
```

### Decisions
- Issue 本文は取得時点で minify して保存する（保存後の生サイズを小さく保つ）。再読み込み時は追加の minify を行わない。
- minify は言語 handler 経由。専用の `minify-issue.js` は作らない。
- `<details>` は中身に有用情報（背景情報、原言語版本文等）がある可能性があるため保持する。
- G_KEYWORDS の縮減は word-boundary 化やペアリング判定より優先。実装が単純で保守コストが低く、新機能 6a1d 導入後に false negative が増えても再評価で救えるため許容可能。

## Clarifications (Q&A)
- Q1: Issue #255 の 6 項目をどうスコープ分割するか
  - A: #1 と #4 + Issue 本文 minify のみ本 spec。#2/#3/#5/新機能は別 board、#6 はドロップ。
- Q2: #5 failed verdict 非キャッシュの責務
  - A: 新機能 6a1d（フェーズ進行に伴う昇格提案）の前提として統合。本 spec 対象外。
- Q3: #6 reason 表示改善の必要性
  - A: 不要（ユーザーは NG 理由を読まないため）。
- Q4: G_KEYWORDS 修正の手法選定
  - A: キーワード縮減。word-boundary / ペア条件 / 動詞辞書は採用しない。
- Q5: Issue 本文の取得・保存タイミング
  - A: init で fetch → preparing state → prepare で issue.md 書き出し。active mode での `flow set issue` でも fetch・更新。
- Q6: Issue 本文 minify の適用範囲
  - A: HTML コメント除去 / 画像 → alt / 水平線除去 / 連続空行を 1 行 / 末尾空白除去。`<details>` は除外。実装は md 言語 handler として lang-factory に乗せる。

## Alternatives Considered
- **word-boundary + キーワード維持**: false positive を部分的にしか減らせず（`delete a test` 等は残る）、複雑度の割に効果が薄い。
- **動詞+目的語ペア辞書**: 効果は大きいが辞書メンテの負担が重く、alpha 期の投資として見合わない。
- **Issue 本文を毎回 gh fetch**: 実装は最短だが、`flow run auto-check` を複数回呼ぶたびにサブプロセス起動コスト（~500ms）と GitHub レート制限消費が発生する。
- **flow.json に Issue 本文を保存**: spec.json / flow.json の肥大化を招く。ファイル（issue.md）としてユーザーが目視・編集できる方が UX がよい。
- **別ヘルパー `minify-issue.js` を新規作成**: 既存 lang-factory パターンを外れ、将来の他形式（HTML ヘルプ文等）追加時に再設計が必要。言語 handler に統一する方が Open/Closed 原則に沿う。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23
- Notes: draft Q&A 6 ラウンドと spec プレゼンを経て承認。

## Requirements
優先度順（P1 が最高）。

- **R1 (P1)** [bugfix]: `auto-check-static.js` の G_KEYWORDS から以下を削除する。削除後の配列は以下のみを含むこと:
  - 残す: `password`, `credential`, `secret`, `token`, `authentication`, `npm publish`, `破壊的`, `パスワード`, `認証情報`
  - 削除: `security`, `auth`, `migration`, `migrate`, `delete`, `drop`, `destructive`, `release`, `認証`, `トークン`, `資格情報`, `マイグレーション`, `削除`, `リリース`
  - H_KEYWORDS / I_INVERSIONS は変更しない。
- **R2 (P1)** [feature]: `src/flow/lib/fetch-issue.js` を新設し、`fetchIssue(number, root, { strict })` を export する。
  - `strict: true` の場合、gh 失敗時は例外を throw する。
  - `strict: false` の場合、gh 失敗時は null を返し stderr に 1 行の warning を出力する（errors は呑み込まない）。
  - 戻り値は `{ title, body, labels, state }` または null（lenient 失敗時）。
- **R3 (P1)** [refactor]: `src/flow/lib/get-issue.js` は `fetchIssue(..., { strict: true })` を用いて実装する。外部契約（戻り値・エラー挙動）は不変。
- **R4 (P1)** [feature]: `src/docs/lib/lang/md.js` を新設し `minify(text)` を export する。以下の操作を行う:
  - HTML コメント `<!-- ... -->` を除去する（複数行コメントにも対応）。
  - Markdown 画像参照 `![alt](url)` を `alt` テキストに縮約する（alt が空の場合は空文字）。
  - 水平線（`---` / `***` / `___` 単独行、前後空白許容）を除去する。
  - 連続する空行（2 行以上）を 1 行の空行に集約する。
  - 末尾空白を除去する。
  - `<details>...</details>` ブロックは保持する（何もしない）。
- **R5 (P1)** [feature]: `src/docs/lib/lang-factory.js` の EXT_MAP に `.md` → md handler の対応を追加する。
- **R6 (P1)** [feature]: `src/docs/lib/minify.js` は handler が `preserveBlankLines === true` を export している場合、generic pipeline の `removeBlankLines` を適用せず、`removeTrailingWhitespace` のみ適用してから `handler.minify` を呼ぶ。他言語 handler の挙動は変えない。md handler は `preserveBlankLines === true` を export する。
- **R7 (P2)** [feature]: `flow set init --issue <n>` は、gh 取得に成功した場合、Issue 本文を md handler で minify した文字列を preparing state (`.active-flow.<runId>`) の `issueBody` フィールドに格納する。gh 失敗時は issueBody を格納せず従来通り処理を続行する。
- **R8 (P2)** [feature]: `flow prepare` は、preparing state に `issueBody` が存在する場合、生成する spec ディレクトリ配下に `issue.md` として書き出す。preparing state に issueBody がなければ issue.md は作成しない。
- **R9 (P2)** [feature]: `flow set issue <n>` は active mode で呼ばれた場合、gh で Issue 本文を取得し minify して `specs/<spec>/issue.md` に書き出す。gh 失敗時は issue.md を更新せず従来通り state.issue のみ設定する。
- **R10 (P2)** [feature]: `resolve-auto-check-input.js` の `buildBaseInput(state, paths)` は以下の入力を連結する:
  - preparing mode かつ `state.issueBody` が存在する場合: `state.request` + `state.issueBody`。
  - active mode かつ `specs/<spec>/issue.md` が存在する場合: `state.request` + ファイル内容。
  - いずれも存在しない場合は `state.request` + `Issue #<n>`（従来挙動）。
  - 読み込み失敗（権限 / I/O エラー）時は silent fallback（従来挙動）。
- **R11 (P3)** [test]: 以下のテストを追加する:
  - `tests/unit/flow/auto-check-static.test.js`: 削除キーワードが hit しない、残存キーワードが hit することを検証。
  - `tests/unit/flow/fetch-issue.test.js`: strict / lenient の挙動、gh 成功・失敗パス。
  - `tests/unit/docs/lang-md.test.js`: md handler の各 minify 操作、`<details>` 保持、`preserveBlankLines` エクスポート。
  - `tests/unit/flow/resolve-auto-check-input.test.js`: preparing の issueBody、active の issue.md、fallback ケース。
  - `tests/integration/flow/issue-body-flow.test.js`: init → prepare → auto-check のフロー全体で Issue 本文が入力に現れる（gh を mock またはテスト用プロキシで代替）。

## Acceptance Criteria
以下の成果物・テストがすべて PASS することで合格とする。

- AC1: `npm test` がすべて PASS する（既存テスト + 本 spec で追加したテスト）。
- AC2: `sdd-forge flow run auto-check` に `request = "削除関連のバグ修正"` を入力しても G_KEYWORDS hit せず AI スコアリングに進む（R1 実装後、該当入力で staticGates.G が false）。
- AC3: 単体テストで以下の minify 変換が PASS する:
  - `"<!-- x -->\n本文"` → `"本文"`
  - `"![alt](http://x)"` → `"alt"`
  - `"本文\n\n\n\n本文"` → `"本文\n\n本文"`
  - `"前\n---\n後"` → `"前\n後"`
  - `"<details><summary>s</summary>中身</details>"` は変化なし
- AC4: `flow set init --issue <n>` 後、preparing state ファイルに `issueBody` が保存されている（gh 成功時）。
- AC5: `flow prepare` 後、`specs/<spec>/issue.md` が存在する（issueBody がある場合）。
- AC6: auto-check 実行時の AI prompt 入力（log やテスト用フックで確認）に Issue 本文が含まれる。
- AC7: gh 呼び出しを失敗させる mock 下でも auto-check が完走する（Issue 本文なしで従来入力）。

## Implementation Targets
- `src/flow/lib/auto-check-static.js`
- `src/flow/lib/fetch-issue.js`（新規）
- `src/flow/lib/get-issue.js`
- `src/flow/lib/set-init.js`
- `src/flow/lib/set-issue.js`
- `src/flow/lib/run-prepare-spec.js`
- `src/flow/lib/resolve-auto-check-input.js`
- `src/docs/lib/lang/md.js`（新規）
- `src/docs/lib/lang-factory.js`
- `src/docs/lib/minify.js`
- `tests/unit/flow/auto-check-static.test.js`（新規または拡充）
- `tests/unit/flow/fetch-issue.test.js`（新規）
- `tests/unit/docs/lang-md.test.js`（新規）
- `tests/unit/flow/resolve-auto-check-input.test.js`（新規または拡充）
- `tests/integration/flow/issue-body-flow.test.js`（新規）

## Open Questions
- [ ] `fetch-issue.js` の lenient モードの warning 出力先: stderr 直書き / 専用 logger 経由 / 完全に silent。既存 log 方針との整合で実装時に確定する。
- [ ] `minify.js` の分岐シグナル名: `preserveBlankLines` / `skipGenericBlankRemoval` 等。実装時に命名確定。
- [ ] Issue 本文が大規模（10KB 超等）の場合の truncate。現状は実測ベースで不要と判断するが、実装時にデフォルト上限を置くか再判断。
