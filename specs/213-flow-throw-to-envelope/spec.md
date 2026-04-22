# Feature Specification: 213-flow-throw-to-envelope

**Feature Branch**: `feature/213-flow-throw-to-envelope`
**Created**: 2026-04-22
**Status**: Draft
**Input**: GitHub Issue #219

## Goal
- flow コマンド群の throw のうち、ユーザー操作で回避可能な 3 カテゴリ計約 28 箇所を ok:false 返却へ移行し、「throw = 復旧不能または想定外のみ」の統一規約を確立する。

## Background
- daf8（ボード）で議論された方針: 「throw は復旧不能 or 想定外のエラーのみ。復旧可能 or ユーザーに聞けば回避できるものは throw しない」。
- 212 finalize 中に `set auto on` が auto-check 拒否時に throw → Exit 1 するため「復旧不能エラー」と区別がつかない事例が顕在化。
- 棚卸しの結果、dispatcher が `err.code` / `err.data` を envelope に載せる仕組みは存在するが、分類 C/B/D の throw はそもそも「判定結果・ユーザー操作で解決可能・引数ミス」であり、例外ではなく正常復路（ok:false envelope）で扱うべき。

## Scope
- 分類 C（判定結果 3 箇所）の throw を ok:false 返却に置換、判定根拠を data に格納
- 分類 B（操作回避可能 2 箇所）の throw を ok:false + hint 付き code 返却に置換
- 分類 D（CLI 引数バリデーション 約 23 箇所）の throw を ok:false + 細粒度 code 返却に置換
- 既存テストの throw 期待 assertion を envelope 期待 assertion に書き換え
- 新規テストで各 code の正常返却を検証

## Out of Scope
- 分類 A（復旧不能: schema 破損、AI response 不正、必須ファイル欠損、git 失敗 等、37+ 箇所）の throw 変更
- dispatcher 内部のエラー伝達構造の全面刷新
- skill 側の契約書き換え（SKILL.md の error-code reference table 整備は別 draft）
- `flow get next-action` の NO_IN_PROGRESS_STEP 系 throw 廃止（skill 契約に深く絡むため別 spec）

## Constraints
- envelope schema（`ok` / `type` / `key` / `data` / `errors[]`）は変更しない
- ok:false 時の exit code は 1 を維持する（既存の `Envelope.output()` 仕様）
- 既存 guardrail JSON schema・preset 継承チェーンは変更しない
- 旧挙動（throw）を残す互換フラグは導入しない（alpha 版ポリシー）
- code は SCREAMING_SNAKE_CASE、発生根拠ごとに別 code を付ける
- retry max の既定値は既存の `config.flow.retry.max`（デフォルト 3）を継承する。本 spec では上限値を変更しない。

## Design Principles
- throw → ok:false 返却という置換で一貫させる
- 専用ヘルパーを新設せず既存の envelope 返却ヘルパーを直接使う（薄いラッパー禁止原則）
- 判定根拠データは errors[] の messages に詰め込まず、`data` に構造化して載せる

## Overview
### Modules
- 有効化 set 系（auto）: 再 check 拒否時の throw を ok:false へ
- gate 系: retry 予算超過・no-progress 検出の throw を ok:false へ
- retro 系: 既存 retro / 差分なしの throw を ok:false へ
- flow set 系（issue, note, request, summary, metric, req, step, test-summary, init, issue-log, gate-retry ほか）: CLI 引数バリデーション throw を ok:false へ
- テスト群: 該当コマンドの assertion を envelope 期待へ書き換え

### Data Flow
- コマンドが発火条件を検出 → `Envelope.fail(type, key, code, messages)` を返却 → stdout に JSON を書き出し、exit 1 で終了 → 呼び出し側（skill / テスト / スクリプト）は `envelope.ok === false` と `envelope.errors[0].code` を見て分岐

### Decisions
- 分類 C: code は `AUTO_CHECK_INELIGIBLE` / `ESCALATE_RETRY_EXHAUSTED` / `NO_PROGRESS_SINCE_LAST_FAIL`。`data` に判定根拠（score/threshold/breakdown / attempts/max/history / lastFailStateHash 等）を格納。
- 分類 B: code は `RETRO_EXISTS`（hint: `--force` 再指定）/ `NO_CHANGES`（hint: commit 後再実行）。
- 分類 D: 粒度を発生根拠ごとに分ける。例: `INVALID_USAGE` / `INVALID_ARG_VALUE` / `INVALID_PHASE` / `INVALID_STATUS` / `INVALID_JSON`。
- 分類 A: 変更しない。dispatcher の汎用 catch を safety net として残す。

## Clarifications (Q&A)
- Q: exit code は ok:false 時に 1 を維持するか？
  - A: 維持する。envelope 出力ヘルパーが ok フラグから exit code を機械的に付ける既存仕様を踏襲。呼び出し側は `errors[0].code` で分岐する。
- Q: 分類 D の code 粒度は？
  - A: 細分化。同じ "usage" メッセージでも発生根拠が違えば code を分ける。呼び出し側が code から修正方針を決められる粒度が望ましい。
- Q: 新ヘルパーを導入して変更箇所を隠蔽するか？
  - A: しない。既存の ok:false 返却ヘルパーを直接使う。code を隠蔽すると R5 の可視性が下がる。
- Q: auto-check の eligibility 問い合わせコマンドが既に ok:true で結果を返している点との整合は？
  - A: 問い合わせ側は変更不要。本 spec で直すのは「有効化しようとしたが再 check で拒否」された際の有効化 set 側の throw のみ。

## Alternatives Considered
- 案 A: dispatcher 側で「特定 code リスト」を ok:true に書き換える → 却下。呼び出し側の ok/ok:false 判定が失われ意味論が壊れる。
- 案 B: throw 継続したまま `err.code` / `err.data` を強化 → 却下。dispatcher は既に拾う仕組みを持つため現状維持でしかない。ソース可読性の改善が目的のため throw 自体を廃止する。
- 案 C: 互換フラグを設けて段階移行 → 却下。alpha 版ポリシーで後方互換コード禁止。

## Migration Plan
- 既存 CLI インターフェース（コマンド名・オプション名・exit code の 0/非 0 区別）は不変。envelope の `ok` / `errors[0].code` / `data` 形式も既存のまま。
- 振る舞いが変わるのは「例外が CLI クラッシュ風に伝播していた箇所が envelope JSON で帰ってくる」点のみ。既存の envelope パース経路を持つ呼び出し元（skill / テスト）は無改修で受信可能。
- stderr 依存のスクリプトがある場合のみ追従が必要 → PR description で「throw → envelope 化した code 一覧」と「stdout JSON を見るべき旨」を通知する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-22
- Notes: issue #219 / draft 承認済み / autoApprove=true

## Requirements
優先順位 (C: 現行フロー阻害 → B: 運用改善 → D: 一貫性):

- **R1 (must, 分類 C):** When 以下 3 箇所の条件が発火したとき、該当コマンドは `throw` ではなく envelope ok:false を返し、`errors[0].code` を R1a/R1b/R1c の指定値にし、`data` にそれぞれ指定フィールドを含めなければならない (shall):
  - **R1a** `src/flow/lib/set-auto.js` auto-check 再検証が不適格判定 → code `AUTO_CHECK_INELIGIBLE`、`data` に `{ score, maxScore, threshold, breakdown, reason }`
  - **R1b** `src/flow/lib/run-gate.js` 内 `assertRetryBelowMax` の予算超過判定 → code `ESCALATE_RETRY_EXHAUSTED`、`data` に `{ phase, attempts, max }`
  - **R1c** `src/flow/lib/run-gate.js` 内 `checkNoProgressSinceLastFail` の未変更判定 → code `NO_PROGRESS_SINCE_LAST_FAIL`、`data` に `{ phase, previous: { headSha, worktreeHash } }`
- **R2 (must, 分類 B):** When 以下 2 箇所の条件が発火したとき、該当コマンドは `throw` ではなく envelope ok:false を返し、指定 code と hint を `errors[0].messages` に含めなければならない (shall):
  - **R2a** `src/flow/lib/run-retro.js` の retro.json 既存検出 → code `RETRO_EXISTS`、messages に `--force` 再指定の hint
  - **R2b** `src/flow/lib/run-retro.js` の diff なし検出 → code `NO_CHANGES`、messages に commit 後再実行の hint
- **R3 (should, 分類 D):** When 以下のファイルに含まれる CLI 引数バリデーション throw（現状 23 箇所）が発火したとき、それぞれ envelope ok:false を返し、`errors[0].code` が `INVALID_USAGE` / `INVALID_ARG_VALUE` / `INVALID_PHASE` / `INVALID_STATUS` / `INVALID_JSON` のいずれか、または発生根拠ごとに新設する SCREAMING_SNAKE_CASE 定数でなければならない (shall)。対象: `src/flow/lib/set-auto.js`, `set-gate-retry.js`, `set-init.js`, `set-issue.js`, `set-note.js`, `set-request.js`, `set-summary.js`, `set-metric.js`, `set-req.js`, `set-step.js`, `set-test-summary.js`, `set-issue-log.js`。
- **R4 (should, 既存挙動の保持):** When 本 PR の diff が対象 14 ファイル以外の `throw new Error` を追加・削除・変更したとき、その変更は分類 A の該当箇所以外に及んではならない (shall not)。すなわち Implementation Targets 節に列挙されたファイル外の既存 throw は diff で変更されないこと。
- **R5 (should, エコシステム整合):** When テストが R1/R2/R3 の各 code を検証するとき、各 code について「envelope.ok === false」「envelope.errors[0].code === 期待値」「（R1 のみ）envelope.data が期待構造を持つ」を assert するユニットテストが存在しなければならない (shall)。

## Acceptance Criteria
- 分類 C の 3 箇所で ok:false envelope が返り、`errors[0].code` が `AUTO_CHECK_INELIGIBLE` / `ESCALATE_RETRY_EXHAUSTED` / `NO_PROGRESS_SINCE_LAST_FAIL` のいずれかであり、`data` に判定根拠が含まれる
- 分類 B の 2 箇所で ok:false envelope が返り、`errors[0].code` が `RETRO_EXISTS` / `NO_CHANGES` であり、`errors[0].messages` に hint を含む
- 分類 D の約 23 箇所で ok:false envelope が返り、`errors[0].code` が発生根拠ごとに細分化されている
- 分類 A の throw は挙動変更なし（回帰テストが PASS）
- `npm test` が全 PASS する（既存テストの throw assertion は envelope 期待に書き換え済み）
- 新規 / 既存のユニットテストで各 code の正常返却が検証されている

## Implementation Targets
- src/flow/lib/set-auto.js
- src/flow/lib/run-gate.js
- src/flow/lib/run-retro.js
- src/flow/lib/set-init.js
- src/flow/lib/set-issue.js
- src/flow/lib/set-note.js
- src/flow/lib/set-request.js
- src/flow/lib/set-summary.js
- src/flow/lib/set-metric.js
- src/flow/lib/set-req.js
- src/flow/lib/set-step.js
- src/flow/lib/set-test-summary.js
- src/flow/lib/set-issue-log.js
- src/flow/lib/set-gate-retry.js

## Authorized Existing Test Modifications

- `tests/unit/flow/gate-noop-rerun-guard.test.js` — `assertNoProgressSinceLastFail` を `checkNoProgressSinceLastFail` にリネームし、throw から Envelope 返却へ契約変更。テストは新しい契約（null / Envelope 返却値の assertion）に合わせて書き換えた。

## Open Questions
- [x] (なし)
