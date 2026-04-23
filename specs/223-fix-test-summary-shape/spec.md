# Feature Specification: 223-fix-test-summary-shape

**Feature Branch**: `feature/223-fix-test-summary-shape`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #251

## Goal
- `flow set test-summary` の partial 入力時に baseline と shape 不一致が生じ、gate-impl の AI 評価が「regression evidence incomplete」と誤判定する問題を解消する。

## Background
- `flow run tests --baseline` は `{unit, integration, acceptance, exitCode}` の full shape を記録する。
- `flow set test-summary` の legacy flag モードと `--json` モードはユーザーが指定したフィールドのみを保存するため、`--unit 10` 等の partial 入力で head 側の shape が baseline と食い違う。
- gate-impl の評価プロンプトは baseline と head を両方 AI に渡し、AI は shape 差分を「evidence incomplete」と判定して FAIL を返す。
- 結果として auto モードで retry budget が浪費される（spec 221 の attempt 1 で発生）。

## Scope
1. `flow set test-summary` が baseline (`test.baseline`) の shape を参照し、未指定の count フィールドを baseline 値で補完して保存する機能を追加する。
2. 対象は legacy flag モード (`--unit/--integration/--acceptance`) と `--json` モードの `counts` の両経路。
3. baseline が存在しない場合は現行動作（指定フィールドのみ保存）を維持する。
4. exitCode は継承対象外とする。
5. 継承挙動を検証する unit test を追加する。

## Out of Scope
- gate-impl の評価プロンプト (`buildImplCheckPrompt`) の変更。
- skill / `src/flow/prompts/*.md` の文言変更。
- `flow run tests` 経由の書き込み（すでに full shape）。
- `--mode fallback` のパス（counts を書かない）。
- `--baseline` ターゲット書き込みでの継承（継承元が存在しない）。
- tool monopoly (`TEST_SUMMARY_LOCKED`) ロジックの変更。

## Constraints
- 外部依存追加禁止（CLAUDE.md）。
- alpha 期間のため後方互換シム追加禁止。
- `src/` 配下にプロジェクト固有情報を書かない。
- テストを通すためにテストコードを修正しない。

## Design Principles
- 「シンプルなインターフェースに十分な実装を隠す」(CLAUDE.md): 入力経路ごとに差をつけず、保存直前の共通パスで shape 補完を行う。
- DRY: legacy/json 経路で継承ロジックを共通化する。

## Overview
### Modules
- `flow set test-summary` サブコマンド: shape 継承ロジックを追加する。

### Data Flow
1. ユーザが partial 入力で `flow set test-summary` を実行。
2. CLI は `flowState.test.baseline` を参照。
3. baseline が存在し count フィールドを持つ場合、head 側で未指定のフィールドを baseline 値で補完する。
4. 補完済みの summary を `flow.json` の `test.summary` に保存する。

### Decisions
- D1: 継承対象は count フィールド (`unit`, `integration`, `acceptance`) のみ。`exitCode` / `failed[]` は継承しない。
- D2: baseline 側に count フィールドが存在しない（未定義）場合、その特定フィールドは head でも未定義のままとする。
- D3: `--mode fallback` / `--baseline` 経由は継承を適用しない。

## Clarifications (Q&A)
- Q: 対応案 A/B/C のどれを採用するか
  - A: A（baseline shape 継承）。CLI 内部で解決しユーザ負担を増やさないため。
- Q: baseline が無い場合の挙動
  - A: 現行通り partial 保存。gate-impl が baseline 無しで head-only 評価するため問題が発生しない。
- Q: `--json` モードも対象か
  - A: 対象とする。経路で挙動を分けると再発リスクが残る。

## Alternatives Considered
- 案 B (CLI shape mismatch warn): 警告のみで手動対応が必要。同じミスを繰り返すリスクがある。
- 案 C (skill instructions で全フィールド指定を強制): ドキュメント依存で構造的解決にならない。
- 案 D (gate-impl プロンプト側で shape 差分を無視): AI の挙動を制御しきれず、プロンプトの修正箇所が増える。

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- **REQ-1** [P0]: `flow set test-summary` は baseline shape 継承ロジックを持つこと。`flowState.test.baseline` が存在し、`unit`/`integration`/`acceptance` のいずれかを含む場合、head 側で未指定の count フィールドを baseline の同名フィールド値で補完する。トリガ: `flow set test-summary` 実行かつ `--mode fallback` / `--baseline` 以外。
- **REQ-2** [P0]: 継承は legacy flag モード (`--unit/--integration/--acceptance`) と `--json` モードの `counts` の両方に適用されること。トリガ: legacy flag または `--json` の `counts` 経由でのみ。
- **REQ-3** [P0]: baseline が存在しない、または `test.baseline.<field>` が未定義の場合、当該フィールドは head でも未定義のままとすること。トリガ: baseline 未記録または baseline 側の該当 count フィールド欠落時。
- **REQ-4** [P1]: `exitCode` は継承対象に含めないこと。baseline に exitCode があっても head に伝播させない。トリガ: shape 継承処理実行時。
- **REQ-5** [P1]: `--mode fallback` と `--baseline` ターゲットへの書き込みでは継承を適用しないこと。トリガ: `--mode fallback` または `--baseline` フラグ指定時。
- **REQ-6** [P1]: unit test が次を検証すること: (a) baseline あり + legacy partial 入力 → baseline shape にマージ保存。(b) baseline あり + `--json counts` partial → 同じくマージ保存。(c) baseline なし + partial 入力 → 指定フィールドのみ保存。(d) `--mode fallback` → 継承適用されず failed[] のみ保存。(e) exitCode が継承されない。

## Acceptance Criteria
- AC-1 (REQ-1, REQ-2): baseline に `{unit: 100, integration: 20, acceptance: 0, exitCode: 0}` が保存された状態で `flow set test-summary --unit 10` を実行すると、`test.summary` は `{unit: 10, integration: 20, acceptance: 0}` を含む shape になる。
- AC-2 (REQ-2): 同条件下で `flow set test-summary --json '{"counts":{"unit":10}}'` を実行しても、`test.summary` が `{unit: 10, integration: 20, acceptance: 0}` を含む shape になる。
- AC-3 (REQ-3): baseline が未記録の状態で `flow set test-summary --unit 10` を実行すると、`test.summary` は `{unit: 10}` のみで `integration`/`acceptance` フィールドが存在しない。
- AC-4 (REQ-4): baseline が `{unit: 100, exitCode: 0}` の状態で `flow set test-summary --unit 10` を実行しても、`test.summary.exitCode` は未定義のまま。
- AC-5 (REQ-5): baseline ありの状態で `flow set test-summary --json '{"failed":[{"id":"t","reason":"r"}]}' --mode fallback` を実行すると、継承は適用されず `test.summary.failed` のみが書き込まれる。
- AC-6 (REQ-6): 上記 AC-1〜AC-5 に対応する unit test が追加され、`npm test` で PASS する。
- AC-7: 既存の `flow run tests` / `TEST_SUMMARY_LOCKED` / `--baseline` 経由のパスの挙動が本修正前と同一であること（既存 test が全て PASS）。

## Implementation Targets
- `src/flow/lib/set-test-summary.js`
- `tests/unit/flow/` 配下の既存または新規テストファイル

## Open Questions
- [ ]
