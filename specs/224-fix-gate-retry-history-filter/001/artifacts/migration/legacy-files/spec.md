# Feature Specification: 224-fix-gate-retry-history-filter

**Feature Branch**: `feature/224-fix-gate-retry-history-filter`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #248

## Goal

gate escalation が retry 予算切れを返すとき、返却される `Previous FAIL reasons` 履歴に escalating phase 自身の FAIL 理由のみが含まれるようにする。現状は別 phase の履歴が混入するため、デバッグ時にエスカレーション原因を誤認させる。

## Background

`src/flow/lib/run-gate.js` の `formatRetryHistory` は issue-log エントリを filter して `Previous FAIL reasons` 表示用の履歴を組み立てる。現行実装は step 値のみで絞り込み、しかも `startsWith("gate-")` を用いるため以下の問題を抱える。

- step 値は phase ごとに以下のようにマッピングされる（`resolveGateStepId` による）:
  - draft → `gate-draft`
  - spec / task-spec → `gate`
  - task-impl / integration → `gate-impl`
- `startsWith("gate-")` は `gate-draft` / `gate-impl` に一致するが `gate` 単体には一致しない。
- step が一致しても phase 二次フィルタが無いため、task-impl escalation 時に draft phase の `gate-draft` 履歴が混入する。

retry 予算カウンタ（`gateRetry` metric）の増減・reset・threshold 判定は正しく動作しており、本件は escalation メッセージの**表示内容のみの修正**である。

## Scope

- gate escalation 経路における retry 履歴の絞り込みロジック。
- escalation 自己記録エントリ（retry 予算切れ escalation が自身を issue-log に書き戻すエントリ）の履歴からの除外。
- 回帰テスト（step × phase の組み合わせ、escalation 自己記録の扱い）。

## Out of Scope

- retry 予算カウンタの増減・reset・threshold 判定ロジック（既に正しく動作）。
- phase 情報欠落の古いエントリに対する救済・マイグレーション（alpha 版ポリシーに従い後方互換は追わない）。
- `checkNoProgressSinceLastFail` など別 escalation 経路の振る舞い（独立した経路で本件対象外）。

## Constraints

- プロジェクト方針（CLAUDE.md）に従い、後方互換コードは書かない。
- 外部依存は追加しない（Node.js 組み込みモジュールのみ）。
- 既存テストは改変しない（本件の挙動変化に直接関連する部分を除く）。
- 既存の `appendIssueLogFromGateResult` / `appendIssueLogFromGateError` の書き込みフォーマットは変更しない。

## Design Principles

- filter は単一の責務に限定: step/phase の一致判定と「価値のあるエントリ」の選別のみ行う。
- 表示層の変更に閉じる。retry 予算機構・issue-log 書き込み層は変更しない。
- 回帰テストは既存の `tests/unit/flow/gate-envelope-issue-log.test.js` のパターン（tmp ディレクトリと実ファイル issue-log を使う方式）に合わせる。

## Overview

### Modules

- `src/flow/lib/run-gate.js` — `formatRetryHistory` および呼び出し元 `checkRetryBelowMax`。

### Data Flow

- `checkRetryBelowMax(ctx, phase)` が retry 予算切れを検出し `formatRetryHistory` を呼び出す。
- `formatRetryHistory` は escalating phase を受け取り、issue-log エントリから (a) step が gate 相当であり (b) phase が escalating phase と一致し (c) 自己記録でない ものを抽出する。
- 抽出した履歴は `Previous FAIL reasons` 行として Envelope.fail の `messages` に組み込まれる。

### Decisions

- step 判定は「gate 系 step（`gate`, `gate-draft`, `gate-impl`）」として扱う。単純な prefix 判定ではなく、妥当な gate step 集合との照合を行う。
- phase 絞り込みは必須とし、履歴エントリに phase 情報が無い場合は除外する（alpha 版ポリシー）。
- escalation 自己記録の識別は issue-log エントリの既存メタ情報（書き込み元を特定できるフィールド）を用いる。新規メタフィールドの追加はしない。

## Clarifications (Q&A)

- Q1: 履歴エントリに phase 情報が欠落している場合の扱い
  - A: 除外する。alpha 版ポリシーに従い後方互換は追わない。
- Q2: escalation 自身の自己記録エントリを履歴に含めるか
  - A: 含めない。自己参照的で情報価値を持たない。
- Q3: retry 予算機構自体への変更は行うか
  - A: 行わない。本件は表示のみの修正。

## Alternatives Considered

- **step フィルタのみ拡張（phase フィルタ無し）**: `step === "gate"` も含めれば task-impl escalation のケースで gate-impl は拾えるが、他 phase の `gate-draft` や task-spec の `gate` エントリが依然混入する。Issue の症状が残るため不採用。
- **step フィルタを完全に撤廃し phase のみで絞る**: step も gate 系以外（例えば将来的に追加される非 gate エントリ）を混在させる可能性が残るため不採用。step + phase の AND が安全。
- **escalation 自己記録を issue-log 書き込み時に抑止する**: 書き込み履歴自体は監査目的で有用（いつ escalation が発生したか残す価値がある）。除外は表示層で行うのが自然。

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements

- **REQ-1 (最優先)**: When gate が task-impl phase で retry 予算切れ escalation (`ESCALATE_RETRY_EXHAUSTED`) を返すとき、`Previous FAIL reasons` には `phase === "task-impl"` の履歴エントリのみが含まれるものとする。他 phase（draft / spec / task-spec / integration）のエントリは含まれない。
- **REQ-2**: When gate が integration phase で retry 予算切れ escalation を返すとき、`Previous FAIL reasons` には `phase === "integration"` の履歴エントリのみが含まれるものとする。
- **REQ-3**: When 履歴エントリが retry 予算切れ escalation 自身の自己記録（trigger が onError 経路である旨を示すエントリ）であるとき、そのエントリは `Previous FAIL reasons` の出力には含めないものとする。
- **REQ-4**: When 履歴エントリに `phase` フィールドが欠落している（undefined / 空文字列）とき、そのエントリは `Previous FAIL reasons` に含めないものとする。
- **REQ-5**: When 履歴エントリの step が gate 系（`gate` / `gate-draft` / `gate-impl`）でないとき、そのエントリは `Previous FAIL reasons` に含めないものとする。
- **REQ-6**: retry 予算カウンタ（`gateRetry` metric）の増減・reset・threshold 判定、および issue-log への書き込みフォーマットは変更しないものとする。

## Acceptance Criteria

- **AC-1 (REQ-1 / REQ-5)**: issue-log に `{step:"gate-impl", phase:"task-impl", reason:"task-impl fail A"}` と `{step:"gate-draft", phase:"draft", reason:"draft fail B"}` の両方が存在し、task-impl phase の retry 予算切れを再現したとき、Envelope.fail の messages にある `Previous FAIL reasons` は `"task-impl fail A"` のみを含み、`"draft fail B"` を含まない。
- **AC-2 (REQ-2)**: issue-log に `{step:"gate-impl", phase:"integration", reason:"integration fail"}` と `{step:"gate-impl", phase:"task-impl", reason:"taskimpl fail"}` の両方が存在し、integration phase の retry 予算切れを再現したとき、`Previous FAIL reasons` は `"integration fail"` のみを含む。
- **AC-3 (REQ-3)**: issue-log に通常 FAIL エントリと escalation 自己記録エントリ（trigger が onError 経路であることを示すもの）の両方が存在するとき、`Previous FAIL reasons` には通常 FAIL エントリのみが含まれる。
- **AC-4 (REQ-4)**: issue-log に phase フィールド欠落のエントリが存在するとき、そのエントリは `Previous FAIL reasons` に含まれない。
- **AC-5 (REQ-6 / 回帰)**: 本件修正の前後で、gate PASS / FAIL 時の `gateRetry` metric 増減、reset、`ESCALATE_RETRY_EXHAUSTED` を返す閾値、issue-log エントリの書き込み内容が同一である。これを既存の `tests/unit/flow/gate-envelope-issue-log.test.js` 相当テスト群が PASS することで担保する。
- **AC-6 (テスト)**: AC-1〜AC-4 を網羅する unit test が新規に追加され、`npm test` で PASS する。

## Implementation Targets

- `src/flow/lib/run-gate.js`

## Open Questions
- なし
