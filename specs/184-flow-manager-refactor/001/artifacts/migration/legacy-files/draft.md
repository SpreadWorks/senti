**開発種別:** リファクタリング

**目的:** `src/lib/flow-state.js` の責務を Container 配下のサービス (`container.flowManager`) に統合し、現状バイパスされている Container キャッシュを実態として有効化する。CLI 出力・flow.json スキーマ・.active-flow フォーマットなど外部から観測できる振る舞いは一切変更しない。

## 背景

GitHub Issue #163 (Phase 2B) — 1877 シリーズの Container 化リファクタの一部。

- `src/lib/flow-state.js` は 989 行・35+ exports を持つ「神モジュール」状態
- 22 ファイルが `flow-state.js` から import している
- 全 export 関数が `workRoot` を第 1 引数で受け取る手続き型 API
- `container.register("flowState", loadFlowState(root))` で snapshot は Container に登録済みだが、全 mutation (`mutateFlowState(workRoot, ...)`) が Container を完全にバイパスし、毎回 disk + git を直接叩く → Container キャッシュが死んでいる

## 要件 (優先順)

### P1 (必須・本リファクタの本質)

- **R1**: `flow-state.js` の状態管理機能を呼ぶ全ての箇所で、Container 経由 (`container.get("flowManager")`) のサービス参照を通じて状態の読み書きが行われる shall。Container をバイパスした直接呼び出しは残らない shall。
- **R2**: 状態管理サービスを呼ぶ際、呼び出し側は `workRoot` 引数を渡さない shall。サービスは Container.paths から必要なパスを内部解決する shall。
- **R3**: `container.get("flowManager")` で取得できるサービスは、現 `flow-state.js` が提供している全ての公開機能 (flow.json I/O, .active-flow 管理, preparing flow 管理, mutation 系全般) を完全にカバーする shall。

### P2 (品質・保守)

- **R4**: 既存テスト (`tests/` 配下で `flow-state` を import している ~20 ファイル) が、新 API に書き換えた状態で全て pass する shall。テストの期待値・カバー範囲は変更しない shall。
- **R5**: 状態管理サービスの内部は、責務別に複数のクラスに分割される shall。外部からは単一のファサードとしてのみ観測される shall (内部分割の自由度を将来も保持する)。

### P3 (副次効果)

- **R6**: 1 CLI コマンド実行内で同一 flow.json に対する複数の mutation が発生する場合 (例: hook 連鎖、agent metric 集約)、Container 既解決の worktree/mainRoot 値が再利用され、git spawn が重複しない shall。

## Q&A

### Q1: 範囲
**A: [1] 一括** — 1 spec で完了。alpha 期間で後方互換不要、Container 化は途中状態に意味がない、22 ファイルの import 書換は機械的。

### Q2: Container での公開形式
**A: [1] ファサード** — `container.get("flowManager")` のみ公開。pure helper (`derivePhase`, `FLOW_STEPS`, `PHASE_MAP` 等) はモジュール export のまま据え置き。

### Q3 + Q4: キャッシュの正体
**A:** 「キャッシュ」は新しい仕組みを足すのではなく、Container にすでに寄せられている解決結果を実際に使うこと。`workRoot` 引数削除によって `paths.root` 経由になり、git 再解決が自然に消える。意図的に追加するキャッシュ層は不要。

### Q5: 既存テストの扱い
**A: [1] 全テスト書換** — 互換シムは alpha ポリシー違反 (CLAUDE.md「後方互換コードは書かない」)。

### Q6: 新規ユニットテスト
**A: [1] 追加しない** — 既存テストが振る舞いをカバー。リファクタは振る舞い不変が要件で、内部分割の単体テストを足すと実装詳細に結合し将来の再分割を阻害する。

## 影響範囲

- **既存機能**: 振る舞い不変。CLI コマンド出力・flow.json スキーマ・.active-flow フォーマット全て変更なし
- **production code**: `flow-state.js` を import している 22 ファイルは新 API への呼び出し書換が必要
- **tests**: `flow-state` を import している ~20 テストファイルは新 API への呼び出し書換が必要
- **Container init**: 既存の `flowState` snapshot 登録を、状態管理サービス本体の登録に置換

## 制約・ガードレール

- alpha ポリシー: 互換シム・旧 API 残置禁止 (CLAUDE.md)
- 振る舞いを変えない: 既存テストの期待値はそのまま、API 呼び出し形式のみ書換
- 並行 flow (worktree 並行運用) を壊さない: サービスインスタンスは Container 寿命 = CLI 1 プロセス内に閉じる
- 設計詳細 (具体的なクラス名・関数移管リスト) は spec フェーズで詰める

## エッジケース

- worktree 内実行 vs main repo 実行: Container が既に `inWorktree` / `mainRoot` を解決済みなのでサービスは paths を信頼する
- flow.json 未生成のケース (help/setup 等): Container 初期化は best-effort パターン継続。サービスも null state を許容する
- 並行 mutation (同一 flow.json への複数プロセス書込): 現状の atomic write 振る舞いを維持する

## 代替案の検討

| 案 | 不採用理由 |
|---|---|
| 段階分割 (Phase 2B-1/2/3) | Container 化は途中状態に意味がない。22 ファイルの書換は機械的で一括が安全 |
| 個別公開 (`flowManager` / `activeFlows` 等を別 register) | Issue 指定外。呼び出し点が分散し内部分割の自由度を失う |
| 互換シム (`flow-state.js` を re-export) | alpha ポリシー違反 |
| サブクラス個別ユニットテスト追加 | 実装詳細に結合し将来の再分割を阻害 |
| 追加キャッシュ層導入 | Container 既存解決結果で十分。新規キャッシュは並行 flow 干渉リスクを生む |

## 将来の拡張性

- ファサードパターンにより内部分割の再構成は外部影響なしで可能
- 別 storage backend (例: SQLite) への移行余地あり

## Q&A

(上記「Q&A」セクションを参照)

## User Confirmation

- [x] User approved this draft
