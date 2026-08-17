# Draft: flow 引数バリデーションの厳密化

**開発種別:** Enhancement
**目的:** flow コマンドの入力バリデーションを厳密化し、不正入力の暗黙フォールバックを排除する。実装・エラーメッセージ・docs を一致させる。

## 背景

一部の flow コマンドでバリデーションが不足しており、不正な入力が暗黙に受け入れられる。例えば `flow set issue 0` が通る、`flow run gate --phase invalid` が暗黙に `pre` にフォールバックする、等。

## スコープ

### 対象コマンド（9箇所）

| # | コマンド | 現状の問題 |
|---|---|---|
| 1 | `flow set issue <number>` | `parseInt` + `isNaN` のみ。`0`, `-1`, `1.5` が通る |
| 2 | `flow set summary <json>` | 配列チェックのみ。要素型（string/object）の契約が未定義 |
| 3 | `flow run gate --phase` | 不正値が暗黙に `pre` フォールバック |
| 4 | `flow set step <id> <status>` | status の enum 検証なし |
| 5 | `flow set req <index> <status>` | index の範囲チェックなし、status の enum 検証なし |
| 6 | `flow run review --phase` | enum 未検証、暗黙フォールバック |
| 7 | `flow run impl-confirm --mode` | enum 未検証、暗黙フォールバック |
| 8 | `flow run finalize --merge-strategy` | ハードコード検証、定数なし |
| 9 | `flow set auto` | ハードコード検証、定数なし |

### 定数集約

- `src/lib/constants.js` を新設し、全 enum 定数を集約する
- 既存の `src/flow/lib/phases.js` は廃止し、import 先を変更する
- 各コマンドファイル内の散在定数（`VALID_COUNTERS`, `VALID_TARGETS` 等）も移動する

## 方針

- エラーメッセージは現行形式を踏襲（`throw new Error("メッセージ")` で許容値を含める）
- エラーコード体系の新設は行わない
- 暗黙フォールバックは全て排除し、不正入力時は明示的にエラーを返す

## Q&A

### Q1: スコープは issue 記載の3箇所のみか？
A: 全箇所（LOW含む計9箇所）を対象とする。

### Q2: エラーメッセージの方針は？
A: 現行形式踏襲。`throw new Error()` でメッセージ内に許容値を含める。

### Q3: enum 定数の配置先は？
A: `src/lib/constants.js` に全定数を集約。既存の `phases.js` は廃止。

### Q4: `src/lib/` vs `src/flow/lib/` のどちらに置くか？
A: `src/lib/constants.js`。`flow-state.js` が同階層にあり参照しやすく、将来 docs/spec 側からも参照可能。

## 影響範囲

- `src/lib/flow-state.js` — 定数を参照してバリデーション強化の可能性
- `src/flow/lib/phases.js` — 廃止、`constants.js` に移行
- `src/flow/lib/set-metric.js` — `VALID_COUNTERS` を `constants.js` から import に変更
- `src/flow/lib/get-check.js` — `VALID_TARGETS` を `constants.js` から import に変更
- `src/flow/lib/get-guardrail.js` — import 先変更
- `src/flow/registry.js` — import 先変更
- `src/flow/commands/review.js` — import 先変更
- 対象9コマンドファイル — バリデーション追加

## 既存機能への影響

- 正常入力のみを使用している既存ワークフローには影響なし
- 不正入力が暗黙に受け入れられていたケースはエラーになる（意図的な破壊的変更）

## 破壊的変更の移行計画

本プロジェクトは alpha 版（`0.1.0-alpha.N`）であり、後方互換コードは書かないポリシーを採用している（CLAUDE.md「alpha 版ポリシー」参照）。

- **移行期間・警告期間:** 設けない。alpha 版のため即時適用。
- **バージョン:** 次の alpha リリースに含める。
- **影響:** 不正入力に依存していた自動化スクリプトがあればエラーになるが、そのような使用は想定外であり修正が妥当。

- [x] User approved this draft
