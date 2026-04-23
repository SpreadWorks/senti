# Draft: 215-flow-task-decomposition

**開発種別:** feature
**目的:** タスク分解の single source of truth を spec に持たせ、実装中にタスクが不足した場合は draft に戻って追加する線形フロー（draft-return 方式）を確立する。cac6 計画で未配線の「誰がタスクを addTask するか」の欠落を、spec 内のタスク記述を正として機械的に反映する方式で解消する。

## 背景（Issue #222 再解釈）

当初の Issue は「CLI `flow task add --origin plan|addition` 新設 + plan/impl prompt からの呼び出し」を求めていた。draft フェーズで掘り下げた結果、次の問題が見つかった。

- cac6 計画は addition-origin task のために mini-draft / mini-approval / 専用コマンドを用意していたが、機構が肥大し spec と進行状態の乖離リスクが残る
- 既存 guardrail「Draft Stays at Requirements Level」「spec と実装の乖離は悪」と整合させるなら、追加タスクも本来の draft/approval を経るべき
- 「実装中に追加タスクが必要になれば draft に戻る」線形フローの方がシンプル

本 spec は、Issue #222 の原案（動的 CLI + prompt 注入）ではなく **draft-return 方式** を採用する。

## Scope Verification
- In scope:
  1. spec にタスク分解を持たせる仕組み
  2. 承認時に spec のタスクを進行状態（flow）に反映する仕組み
  3. 実装中に draft へ戻る正式経路の提供
  4. 進行状態のタスク変更に対する制約（追加のみ許可、既存は追跡用属性を不変）
  5. 既存 addition-origin 機構の撤去と移行ガイド
  6. 上記を検証するテストおよび関連ドキュメント更新
- Out of scope:
  - `integration`-origin タスクの取り扱い（既存 integration-* step のルートは維持）
  - 並列タスク実行
  - 報告系ドキュメント（retro.json / report.json）への round 情報追加
  - 旧資産の一括マイグレーション（spec 208 の範囲）

## Impact on Existing Features
- 影響ありの既存機能:
  - **spec の schema と render**: タスクセクションが加わる（追加のみ、既存フィールド不変）
  - **承認手続き**: タスクの差分を進行状態に反映する処理が追加される
  - **タスク origin の種類**: `addition` を廃止し、`plan` のみを有効値とする（破壊的変更、alpha 方針に従う）
  - **既存の addition 系資産**: コマンド・prompt・skill テンプレート・関連テストを削除
  - **skill テンプレート**: draft-return 手順を追記
  - **既存テスト fixture**: 新しい空タスクフィールドを含むよう整合を取る
- 影響なし:
  - docs ビルドパイプライン・preset システム・docs コマンド群
  - `TASK_STEPS_PLAN` と plan-origin タスクの step 構成
  - `integration`-origin と integration-write-tests 等の既存 step

## Q&A

- Q1: タスク分解の記述場所はどこにするか？
  - A: spec 本体（spec.json）にタスクセクションを持たせる。
  - 基盤: [既存コードパターン] spec.schema.json に既に `added_by_task` が存在しており、参照先の task 本体も同じ場所にあるのが自然。
- Q2: 実装中に追加タスクが必要と判明した場合の処理は？
  - A: draft フェーズに戻って spec にタスクを追記する（draft-return 方式）。
  - 基盤: [guardrail 原則] 「Draft Stays at Requirements Level」「承認なしにコードを変更しない」。
- Q3: 永続化形式は単一ファイル追記か、ファイル分割か？
  - A: 単一ファイル追記。ラウンド追跡は Task に `added_round` 属性を持たせる。
  - 基盤: [コード品質ルール] CLAUDE.md「シンプルなインターフェースに十分な実装を隠す」。分割方式はファイル命名・マージ・整合チェックが増える。
- Q4: draft に戻る導線の実装方式は？
  - A: 専用の状態遷移導線を新設し、誤操作防止の guard と操作記録を伴う。
  - 基盤: [既存コードパターン] sdd-forge の他の状態遷移（prepare / finalize）も専用の導線として提供されている。
- Q5: 既存 addition-origin 機構の扱いは？
  - A: 同一 spec で撤去する。
  - 基盤: [project ルール] CLAUDE.md「alpha 版ポリシー: 後方互換コードは書かない。旧フォーマット・非推奨パスは保持せず削除する」。
- Q6: エッジケース方針:
  - A: (1) タスクの id / origin / added_round は承認後不変。title / description は可変。(2) draft への復帰は既に完了済みタスクが 1 つ以上あり、かつ最終化前のときのみ許可。(3) 復帰後も実装ステップは継続、新規タスクのみ差分反映。
  - 基盤: [guardrail 原則] 「Unambiguous Requirements」— 変更可/不変のフィールドを明示することで曖昧さを排除。

## Requirements（優先度順）

### P1 — 必須基盤

- **R1** When spec に `tasks[]` フィールドが存在する時、shall 各 task は id / title / description / origin（値は `plan`）/ added_round / status を持つ。
- **R2** When 承認ステップが完了した時、shall spec の `tasks[]` と進行状態（flow）の `tasks[]` の差分を検出し、進行状態に存在しない新規タスクのみが進行状態へ追加される。
- **R3** When spec の `tasks[]` を検証する時、shall 承認済みタスクの id / origin / added_round は不変であり、変更されていれば gate が FAIL する。title / description の変更は許可する。

### P2 — draft-return 導線

- **R4** When 実装中に追加タスクが必要と判断された時、shall ユーザーは公式の導線で draft ステップに戻ることができ、その操作の事実が記録される。
- **R5** When 完了済みタスクが存在しない、または最終化以降の状態で draft への復帰を試みた時、shall 当該操作は拒否され、理由がユーザーに提示される。
- **R6** When draft へ復帰して spec に新規タスクを追記し再承認する時、shall 新規タスクの `added_round` は現在の最大 `added_round` + 1 になる。既存タスクの状態・属性は保持される。

### P2 — 既存機構の撤去

- **R7** When 本 spec の実装を含む diff を確認した時、shall タスク origin の有効値から `addition` が除かれ、addition 専用の機構（step 定義・draft 生成経路・対応する skill 記述・テスト）も併せて除去されている。
- **R8** When 撤去対象のテストを除去した時、shall 残存する全テストが PASS する。

### P3 — ドキュメントと skill

- **R9** When skill テンプレート（`sdd-forge.flow` / 関連 flow 系 skill）を更新する時、shall draft-return 手順が記述され、addition 関連手順は削除されている。
- **R10** When 本 spec を公開する時、shall Migration Plan セクションにより `addition` 除去の影響と推奨対応が明示されている。

### P3 — テスト

- **R11** When 本 spec の実装を PR に含める時、shall `tasks[]` schema 検証・差分反映・単調増加制約・新 CLI の guard 動作を検証する unit テストが追加されている。
- **R12** When 本 spec の受け入れ確認を行う時、shall 「plan フェーズで tasks を 2 件定義 → 承認 → 実装中に draft 復帰 → tasks を 1 件追記 → 再承認 → 進行状態に新規タスクのみ反映される」シナリオが手動または統合テストで PASS する。

## Alternatives Considered

1. **Issue #222 原案（動的 CLI + plan/impl prompt 注入）** — 却下。
   - 基盤: [guardrail 原則] spec と進行状態の乖離を許容し、「Unambiguous Requirements」「Draft Stays at Requirements Level」と緊張する。
2. **ファイル分割方式（round ごとに別ファイル）** — 却下。
   - 基盤: [コード品質ルール] CLAUDE.md「シンプルなインターフェースに十分な実装を隠す」「3 回目の出現を待たずに共通化」— 分割は file 管理コストが高くメリット薄。git history で原状態は復元可能。
3. **addition-origin と draft-return の共存** — 却下。
   - 基盤: [project ルール] alpha 方針「後方互換コードは書かない」。運用面でも skill が経路選択を判断する必要があり複雑化。

## Migration Plan

- 本変更は破壊的変更（タスク origin の enum から `addition` を除去）。alpha 方針に従い後方互換 shim は提供しない。
- 既存の active flow で `origin === "addition"` のタスクが存在するものがあれば、spec.json の新 schema 下では再読込が失敗する可能性がある。該当する active flow は本 spec 公開前に finalize するか、手動で `addition` タスクを削除する。
- 使われていない関連資産（コマンド・prompt・テスト）は同一 PR で削除する。

## Open Questions
- なし（実装中に判明した論点は issue-log.json に記録する）

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: 全 7 質問を経て draft-return 方式に合意。Issue #222 原案（動的 CLI）は取り下げ、本 spec は draft-return 方式で進める。
