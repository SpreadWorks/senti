# Clarification Q&A

- Q: difficulty 計算は簡易版か確定式フル実装か？
  - A: board 8690 の確定式をフル実装し、必要データ欠損時は N/A。
- Q: phase×date 行の difficulty の集約方法は？
  - A: 寄与 spec の difficulty 平均値。
- Q: `reviewCount`/`redoCount` 欠損への対応は？
  - A: `specs/<spec>/fill-flow-counts.js` で補完可能にする。

## Confirmation
- Before implementation, ask the user:
  - "この仕様で実装して問題ないですか？"
- If approved, update `spec.md` -> `## User Confirmation` with checked state.
