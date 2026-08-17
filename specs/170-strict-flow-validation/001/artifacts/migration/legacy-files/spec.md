# Feature Specification: 170-strict-flow-validation

**Feature Branch**: `feature/170-strict-flow-validation`
**Created**: 2026-04-13
**Status**: Draft
**Input**: GitHub Issue #138

## Goal

flow コマンドの引数バリデーションを厳密化し、不正入力の暗黙フォールバックを排除する。
enum 定数を `src/lib/constants.js` に集約し、実装・エラーメッセージ・docs の一貫性を確保する。

## Scope

- 9箇所の flow コマンドにバリデーション追加/強化
- `src/lib/constants.js` の新設と enum 定数の集約
- `src/flow/lib/phases.js` の廃止と import 先変更
- 各コマンドファイル内の散在定数の移動

## Out of Scope

- エラーコード体系の新設
- `flow-state.js` 内部でのバリデーション追加（コマンド層で実施）
- registry.js の help テキスト更新（既に許容値が記載されているため）
- 自由テキスト引数（`set note`, `set request`）の長さ制限
- `run prepare-spec --title` のフォーマット検証（slug 生成は別の関心事）

## Clarifications (Q&A)

- Q: スコープは issue 記載の3箇所のみか？
  - A: 全箇所（LOW含む計9箇所）を対象とする。調査により追加6箇所を発見。
- Q: エラーメッセージの方針は？
  - A: 現行形式踏襲。`throw new Error()` でメッセージ内に許容値を含める。
- Q: enum 定数の配置先は？
  - A: `src/lib/constants.js` に全定数を集約。`flow-state.js` と同階層で参照しやすく、将来 docs/spec 側からも参照可能。
- Q: 既存の `phases.js` はどうするか？
  - A: 廃止。`constants.js` に移行し、全 import 先を変更する。

## Alternatives Considered

- **enum 定数を各コマンドファイル内に定義（既存パターン踏襲）**: 既存パターンだが散在しやすく、一貫性が維持しにくい。ユーザーが集約を希望。
- **`src/flow/lib/constants.js` に集約**: flow 固有の定数だが、`flow-state.js` が `src/lib/` にあるため距離が遠い。将来 docs/spec から参照する可能性も考慮し `src/lib/` を選択。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-13
- Notes: 全12要件を承認。alpha版ポリシーに基づき即時適用。

## Requirements

以下の優先順位で実装する（P1: issue 記載の核心、P2: 追加発見）。

### R1 [P1]: `src/lib/constants.js` の新設

- `src/lib/constants.js` を新規作成し、以下の定数を `Object.freeze` で定義する:
  - `VALID_PHASES` — `["draft", "spec", "gate", "impl", "test", "lint", "review"]`（既存 `phases.js` から移動）
  - `VALID_STEP_STATUSES` — `["pending", "in_progress", "done", "skipped"]`
  - `VALID_GATE_PHASES` — `["draft", "pre", "post", "impl"]`
  - `VALID_METRIC_COUNTERS` — `["question", "redo", "docsRead", "srcRead"]`（既存 `set-metric.js` から移動）
  - `VALID_CHECK_TARGETS` — `["impl", "finalize", "dirty", "gh"]`（既存 `get-check.js` から移動）
  - `VALID_REVIEW_PHASES` — `["test", "spec"]`
  - `VALID_IMPL_CONFIRM_MODES` — `["overview", "detail"]`
  - `VALID_MERGE_STRATEGIES` — `["squash", "pr"]`
  - `VALID_AUTO_VALUES` — `["on", "off"]`
  - `VALID_REQ_STATUSES` — requirement の status として許容される値

### R2 [P1]: `src/flow/lib/phases.js` の廃止

- `src/flow/lib/phases.js` を削除する
- 全 import 先を `src/lib/constants.js` に変更する（`registry.js`, `set-metric.js`, `get-guardrail.js`, `commands/review.js`）
- **テストファイルの修正を承認する:** `phases.js` を import しているテストファイル（例: `tests/unit/flow/phases-review.test.js`）の import パスも `constants.js` に変更する。これはテストロジックの変更ではなく、定数の移動に伴う機械的な import パス更新である。

### R3 [P1]: `flow set issue` — 正の整数バリデーション

- When `flow set issue <number>` に `0`, 負数, 小数, 非数値が渡された場合、エラーを throw する
- エラーメッセージに「正の整数が必要」と許容条件を含める

### R4 [P1]: `flow set summary` — 要素型バリデーション

- When `flow set summary <json>` の配列要素が string でも `{text, status}` 形式の object でもない場合、エラーを throw する
- 空配列は許容する

### R5 [P1]: `flow run gate --phase` — enum バリデーション

- When `flow run gate --phase <value>` に `VALID_GATE_PHASES` 以外の値が渡された場合、エラーを throw する
- エラーメッセージに許容値一覧を含める
- デフォルト値 `"pre"` は維持する（`--phase` 省略時）

### R6 [P2]: `flow set step` — status enum バリデーション

- When `flow set step <id> <status>` に `VALID_STEP_STATUSES` 以外の status が渡された場合、エラーを throw する
- エラーメッセージに許容値一覧を含める

### R7 [P2]: `flow set req` — index 範囲チェックと status バリデーション

- When `flow set req <index> <status>` の index が負数の場合、エラーを throw する
- When status が `VALID_REQ_STATUSES` 以外の場合、エラーを throw する

### R8 [P2]: `flow run review --phase` — enum バリデーション

- When `flow run review --phase <value>` に `VALID_REVIEW_PHASES` 以外の値が渡された場合、エラーを throw する
- エラーメッセージに許容値一覧を含める

### R9 [P2]: `flow run impl-confirm --mode` — enum バリデーション

- When `flow run impl-confirm --mode <value>` に `VALID_IMPL_CONFIRM_MODES` 以外の値が渡された場合、エラーを throw する
- エラーメッセージに許容値一覧を含める

### R10 [P2]: `flow run finalize --merge-strategy` — 定数参照化

- 既存のハードコード `["squash", "pr"]` を `VALID_MERGE_STRATEGIES` 定数参照に置き換える

### R11 [P2]: `flow set auto` — 定数参照化

- 既存のハードコード `"on"`, `"off"` チェックを `VALID_AUTO_VALUES` 定数参照に置き換える

### R12: 散在定数の移動

- `set-metric.js` の `VALID_COUNTERS` を `constants.js` の `VALID_METRIC_COUNTERS` に移動
- `get-check.js` の `VALID_TARGETS` を `constants.js` の `VALID_CHECK_TARGETS` に移動

## Acceptance Criteria

- [ ] `src/lib/constants.js` が存在し、全 enum 定数が `Object.freeze` で定義されている
- [ ] `src/flow/lib/phases.js` が削除されている
- [ ] `flow set issue 0` → エラー、`flow set issue -1` → エラー、`flow set issue 1` → 成功
- [ ] `flow set summary '[123]'` → エラー、`flow set summary '["a"]'` → 成功
- [ ] `flow run gate --phase invalid` → エラー、`flow run gate --phase draft` → 成功
- [ ] `flow set step approach invalid` → エラー、`flow set step approach done` → 成功
- [ ] `flow set req -1 done` → エラー
- [ ] `flow run review --phase invalid` → エラー
- [ ] `flow run impl-confirm --mode invalid` → エラー
- [ ] 全 enum 検証のエラーメッセージに許容値一覧が含まれている
- [ ] 既存テスト（`npm test`）が全て PASS する
- [ ] 正常入力での既存動作に変更がない

## Test Strategy

- **specs テスト (`specs/170-strict-flow-validation/tests/`)**: 各コマンドの正常系・異常系の境界値テスト。不正入力時のエラーメッセージ内容の検証。
- **既存テスト**: `npm test` で既存テストの回帰がないことを確認。

## Breaking Change Migration

本プロジェクトは alpha 版（`0.1.0-alpha.N`）であり、後方互換コードは書かないポリシーを採用している（CLAUDE.md「alpha 版ポリシー」参照）。
移行期間・警告期間は設けず即時適用する。不正入力に依存していた自動化スクリプトがあればエラーになるが、そのような使用は想定外であり修正が妥当。

## Open Questions

(なし)
