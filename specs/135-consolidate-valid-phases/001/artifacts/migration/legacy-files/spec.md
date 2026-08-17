# Feature Specification: 135-consolidate-valid-phases

**Feature Branch**: `feature/135-consolidate-valid-phases`
**Created**: 2026-04-04
**Status**: Draft
**Input**: GitHub Issue #79

## Goal

VALID_PHASES が `src/flow/lib/get-guardrail.js`、`src/flow/lib/set-metric.js`、`src/flow/commands/review.js` にそれぞれ独立定義されドリフトしている問題を解消する。共有定数を1箇所に定義し、全コマンドがそこから参照する構造にする。

## Scope

- `src/flow/lib/phases.js` を新規作成し、`VALID_PHASES` 配列を export する
- `src/flow/lib/get-guardrail.js` のローカル `VALID_PHASES` を共有定数の import に置換
- `src/flow/lib/set-metric.js` のローカル `VALID_PHASES` を共有定数の import に置換
- `src/flow/commands/review.js` の `REVIEW_PHASES` キーが `VALID_PHASES` の subset であることのバリデーションを追加
- `src/flow/registry.js` のヘルプテキスト内フェーズリストを統合後のリストに合わせて更新する
- 統合後の正しいフェーズリスト: `["draft", "spec", "gate", "impl", "test", "lint"]`（全ファイルの union）

## Out of Scope

- フェーズの追加・削除（union を取るだけ）
- flow.json のステップ ID との統合（ステップとフェーズは別概念）
- review.js の REVIEW_PHASES 構造変更（オブジェクト形式は維持）
- `src/flow/lib/get-context.js` のフェーズマッピング — ステップ ID からフェーズへの変換ロジックであり、バリデーション用の `VALID_PHASES` とは用途が異なる
- `src/flow/lib/run-review.js` のフェーズリテラル — review 結果オブジェクトに埋め込まれるフェーズ値であり、`VALID_PHASES` を参照するユースケースではない

## Clarifications (Q&A)

- Q: 統合後のフェーズリストは何か？
  - A: `["draft", "spec", "gate", "impl", "test", "lint"]` — get-guardrail (`gate` 欠落) と set-metric (`lint` 欠落) の union
- Q: review.js の REVIEW_PHASES はどう扱うか？
  - A: REVIEW_PHASES は review コマンドがサポートするフェーズの記述（オブジェクト形式）であり構造が異なる。キーが VALID_PHASES の subset であることをランタイムで検証する
- Q: 共有定数の配置先は？
  - A: `src/flow/lib/phases.js` — flow モジュール内のバリデーション用定数であるため flow/lib に配置する。lib/ 直下ではなく flow/lib に置く理由は、VALID_PHASES が flow フェーズ固有の概念であるため

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-04
- Notes: Gate PASS (all 12 guardrails) + spec review applied

## Requirements

1. `src/flow/lib/phases.js` を新規作成し、`VALID_PHASES` を `Object.freeze(["draft", "spec", "gate", "impl", "test", "lint"])` として export する
2. `src/flow/lib/get-guardrail.js` は `phases.js` から `VALID_PHASES` を import し、ローカル定義を削除する
3. `src/flow/lib/set-metric.js` は `phases.js` から `VALID_PHASES` を import し、ローカル定義を削除する
4. `src/flow/commands/review.js` は `phases.js` から `VALID_PHASES` を import し、`REVIEW_PHASES` のキーが `VALID_PHASES` の subset であることをモジュールロード時に検証する。違反時は即座にエラーを throw する
5. `src/flow/registry.js` のヘルプテキスト内フェーズリストを統合後のリスト `"draft, spec, gate, impl, test, lint"` に合わせて更新する
6. 既存の CLI インターフェース（コマンド引数・出力形式・終了コード）に変更がないこと

## Acceptance Criteria

- `sdd-forge flow get guardrail gate` が正常に動作すること（従来は gate フェーズ未対応でエラー）
- `sdd-forge flow set metric lint srcRead` が正常に動作すること（従来は lint フェーズ未対応でエラー）
- `sdd-forge flow get guardrail draft` が従来通り動作すること
- `sdd-forge flow set metric draft question` が従来通り動作すること
- `sdd-forge flow run review --phase test` が従来通り動作すること
- 不正なフェーズ（例: `sdd-forge flow get guardrail unknown`）がエラーになること

## Test Strategy

配置先: `specs/135-consolidate-valid-phases/tests/` — バグ再発防止の spec 検証テスト。

テスト手法: Node.js の `node:test` + `node:assert` を使用したユニットテスト。

テストケース:
1. **共有定数の内容検証** — `VALID_PHASES` が `["draft", "spec", "gate", "impl", "test", "lint"]` を含むこと
2. **Object.freeze の検証** — `VALID_PHASES` が凍結されており変更不可であること
3. **get-guardrail がすべての VALID_PHASES を受け入れること** — 各フェーズでエラーなく実行できること
4. **set-metric がすべての VALID_PHASES を受け入れること** — 各フェーズでエラーなく実行できること
5. **不正フェーズの拒否** — `VALID_PHASES` に含まれないフェーズ（例: `"unknown"`）を渡した場合に get-guardrail, set-metric がエラーを throw すること
6. **review.js の REVIEW_PHASES キーが VALID_PHASES の subset であること** — `REVIEW_PHASES` のキーが全て `VALID_PHASES` に含まれること

## Open Questions

(none)
