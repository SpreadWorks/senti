# Draft: 168-fix-flow-status-spec-mismatch

**Development Type:** BUG
**Goal:** `sdd-forge flow get status` を「現在の作業コンテキスト自身の flow 状態確認」専用コマンドとして明確化し、エージェントが未定義オプションを付与して暴走する再発を防ぐ。

## Context

- Issue #132 は、`flow get status --spec` を前提にした運用で情報不整合が発生し、再試行ループからクラッシュに至る再発防止が目的。
- 現実装では `flow get status` に `--spec` は定義されておらず、付与しても無視される。
- この「未定義オプション黙認」が、エージェントの誤った試行錯誤を通して問題を増幅させる。
- `flow resume` は別責務（active flow の探索・復旧コンテキスト提示）であり、`flow get status` と用途を分離すべき。

## Q&A

1. Q: 修正スコープは最小か拡張か？
   A: 拡張寄りで進める。ただし第一優先はエージェントが正しいコマンドを実行すること。
2. Q: 他の `flow get` に同種リスクはあるか？
   A: ある。未定義オプションが黙って無視されるため、誤用を検知できない。
3. Q: 根本原因はどこか？
   A: エージェント側の誤ったオプション付与と、CLI 側の未定義オプション黙認の複合。
4. Q: 未定義オプション時は help を返すべきか？
   A: はい。ただし成功扱いではなく ERROR とし、エラーメッセージ内で help/正しいコマンドを案内する。
5. Q: `flow get status` の責務はどう定義するか？
   A: オプションで対象 spec を切り替えるのではなく、現在の作業コンテキスト「自身」の状態を返す専用コマンドとする。
6. Q: `resume` との関係は？
   A: `resume` は探索・復旧、`get status` は現在状態確認。役割を明確に分離する。
7. Q: エラー時の終了コードは？
   A: 1。

## Requirement Checklist Coverage

- Goal & Scope: `get status` の責務明確化、未定義オプション対策、エージェント運用ルール修正を対象化。
- Impact on existing: flow 系コマンドのオプション取り扱いとスキル運用文言に影響。
- Constraints: 既存の正常フロー（active flow 利用）は維持。
- Edge cases: 未定義オプション付与時、flow 未存在時、resume 使用時の責務混同。
- Test strategy: 未定義オプションで ERROR + help 表示 + exit code 1 を検証。
- Alternatives considered: `get status --spec` 正式追加案は不採用（責務混在を招くため）。
- Future extensibility: spec 指定探索は `resume` / `resolve-context` 側に集約。

## Prioritized Requirements

- P1: `flow get status` は「自身状態専用」であることを仕様・ヘルプ・スキルで明確化。
- P1: 未定義オプションは ERROR とし、正しい使い方（help）を必ず案内。
- P1: 未定義オプション時の終了コードは 1。
- P1: エージェント側に「許可コマンド/許可オプション厳守」を明記し、勝手なオプション付与を禁止。
- P2: `resume` との責務分離（探索 vs 状態確認）をドキュメント化。

## Open Questions

- なし

## Approval

- [x] User approved this draft
- Notes: approved by user in flow-plan Q&A on 2026-04-13.
