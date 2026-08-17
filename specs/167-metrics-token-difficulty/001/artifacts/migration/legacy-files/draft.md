# Draft: 167-metrics-token-difficulty

**Development Type:** ENHANCE
**Goal:** `sdd-forge metrics token` の difficulty を board 8690 の確定式で計算し、`N/A` 固定状態を解消する。

## Context

- issue #125 / board 8690 で difficulty 算出式は確定済み。
- 現状実装は `difficulty: null` 固定で、すべて `N/A` 表示。
- `reviewCount` / `redoCount` が未整備な既存 flow.json が多く、補完手段が必要。

## Q&A

1. Q: difficulty は簡易版か確定式フル実装か？
   A: 確定式フル実装。必要データ欠損時は `N/A`。
2. Q: phase×date 行の difficulty はどう集約するか？
   A: 寄与 spec の difficulty 平均値。
3. Q: 必須指標の一部欠損時に部分計算するか？
   A: しない。1つでも欠損なら `N/A`。
4. Q: review/redo データ不足への対応は？
   A: `specs/<spec>/` 配下に補完スクリプトを置き、`flow.json` に設定する。
5. Q: 補完の算出元は？
   A: `reviewCount` は `review.md` 項目数、`redoCount` は `issue-log.json` 件数。

## Requirement Checklist Coverage

- Goal/Scope: difficulty 計算導入と不足データ補完の2点を対象化。
- Data contract: `flow.json` を唯一の集計ソースとし、欠損は `N/A`。
- Regression: 既存 token/cache/cost 集計と format 互換を維持。
- Test strategy: difficulty 数値化ケース + 欠損 `N/A` ケースを e2e で追加。

## Prioritized Requirements

- P1: difficulty 計算式実装（board 8690 準拠）
- P1: 欠損時 `N/A`（部分計算禁止）
- P1: phase×date difficulty は寄与 spec 平均
- P1: `fill-flow-counts.js` で reviewCount/redoCount 補完
- P2: 既存集計ロジック非破壊

## Open Questions

- None.

## Approval

- [x] User approved this draft
- Notes: ユーザーが「flowに沿って進める」前提で本ドラフト方針を承認。
