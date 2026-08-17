# Draft: 218-fix-auto-check-persist

**開発種別:** bugfix
**目的:** `run auto-check` と `set auto on` の split-brain（異なる入力で AI を二重呼出し、結果不一致で常に reject される問題）を解消し、Issue 起点フローで auto mode を実質利用可能にする。

## Requirements (Priority Ordered)

Shall-style 要件。全項目は「トリガー条件 → 期待される振る舞い」の形で記載。優先度: P1 = 必須 / P2 = 強推奨 / P3 = 品質向上。

- **P1-R1** When the user invokes `sdd-forge flow run auto-check` against a preparing flow (i.e., `flow prepare` has not yet run), the CLI **shall** persist the computed eligibility verdict to the preparing state so that the next command reading it sees the same result.
- **P1-R2** When the user invokes `sdd-forge flow set auto on` and a prior eligibility verdict already exists in the current state (preparing or active), the CLI **shall** use that verdict directly as the gate outcome and **shall not** invoke the AI again.
- **P1-R3** When the user invokes `sdd-forge flow set auto on` and no prior verdict exists in the current state, the CLI **shall** fall back to the existing behavior of building input from the recorded request/issue and invoking the AI.
- **P1-R4** When the resolved verdict indicates ineligibility, the CLI **shall** exit non-zero with an ineligibility error and **shall not** enable auto mode.
- **P2-R5** When the active flow state shows the spec has been user-approved, the CLI **shall** bypass the eligibility check entirely (preserve the existing shortcut).
- **P2-R6** When a user reads the flow skill documentation to understand `set auto on`, the doc **shall** describe the command as trusting the prior eligibility verdict rather than re-verifying it.
- **P3-R7** When the test suite runs the set-auto paths, tests **shall** assert that no additional AI invocation occurs once a verdict has been persisted, catching regressions of the split-brain behavior.

## Scope Verification
- In scope:
  - CLI-side change to the auto-check and set-auto flow commands so the verdict is persisted once and trusted thereafter (P1-R1 ~ P1-R4, P2-R5)
  - Skill / documentation copy update reflecting the new trust semantics (P2-R6)
  - Test additions for persistence and trust behavior (P3-R7)
- Out of scope:
  - 案 A（`set-auto` 側から `gh issue view` で issue body を fetch し入力を揃えるアプローチ）
  - 案 C（skill 層で `--request` に issue body を詰めるアプローチ）
  - 入力ハッシュ一致チェック（G2）
  - 時間ベースの staleness 無効化（G3）
  - `sdd-forge.flow-auto` skill（今回のバグ経路外）

## Impact on Existing Features
- 影響ありの既存機能:
  - `flow run auto-check`: preparing mode でも verdict を state に保存する（従来は active flow のみ）。冪等・副作用拡大なし。
  - `flow set auto on`: 保存済み verdict があればそれを信頼し AI 呼出をスキップ。無ければ従来通り。
- 影響なし:
  - `flow set auto off`（no-op のまま）
  - `sdd-forge.flow-auto` skill の active flow 経路
  - auto-check スコアリングロジック本体（スコア算出・ハードゲート判定・静的ゲート）

## Migration / Compatibility
- alpha 版のため後方互換コードは追加しない（CLAUDE.md alpha ポリシー）。
- CLI フラグ・サブコマンド名の追加・削除は一切なし。既存呼出し (`sdd-forge flow set auto on/off`, `run auto-check`) はそのまま動作する。
- 外形的な振る舞いの変化は: **連続して `run auto-check` → `set auto on` を叩いた場合、従来は AI を 2 回呼び結果が揃わず reject されていたのが、1 回目の結果が trust されるようになる**。これはバグ修正であり、非互換ではない（従来動作はそもそも機能していなかった）。
- 既存の state ファイル（active flow の flow.json、preparing flow の .active-flow.*）に verdict フィールドが無い場合は fallback 経路が同じ挙動を提供するため、移行手順は不要。

## Q&A
- Q: 修正方針は A / B / C のどれか
  - A: **B**。
  - 根拠:
    - 既存コードパターン: auto-check ロジックは既に active flow には verdict を保存している。preparing flow にも対称に保存するのは既存パターンの完成であり、新規例外ではない。
    - CLAUDE.md コーディングルール: 「シンプルなインターフェースに十分な実装を隠す」「深いモジュールを作る」。validator の結果を action が trust する設計は、action 側から外部 CLI を呼ぶ A や skill 層に責務を漏らす C より責務境界が明確。
    - alpha 版ポリシー: 後方互換コードを避けるため、split-brain を構造的に排除できる B が望ましい。
- Q: stale 対策のガードは
  - A: **G1**（verdict があれば trust、無ければ再検証）。
  - 根拠:
    - CLAUDE.md コーディングルール: 「過剰な防御コードを書かない。内部インターフェースは信頼する」。flow state は CLI 自身が書くので内部インターフェース扱いで良い。
    - 運用: 対応する flow skill の auto-mode 提示ステップは `run auto-check` → `set auto on` を連続実行するため、間に手動介入が入る余地は実質ゼロ。
- Q: テスト戦略
  - A: **AI が再呼出されないこと**を観測可能にするテストを追加。
  - 根拠:
    - split-brain の構造的再発検知には「AI 呼出が起きなかった」ことの保証が必要であり、状態検査（verdict の存在）だけでは不十分。
    - CLAUDE.md: 「既存パターンから逸脱する場合はその理由を明記」。既存 unit test が備える stub 基盤の範囲内で観測可能な挙動として記述する（具体手段は spec/実装で決定）。
- Q: 周辺ファイル更新
  - A: **flow skill の説明テンプレートのみ更新**。derived ファイルは `sdd-forge upgrade` で同期される。
  - 根拠:
    - CLAUDE.md 開発ワークフロー: 「`src/templates/` を変更した場合は `sdd-forge upgrade` を実行」。templates を source of truth として編集し、derived ファイルは手動編集しない方針。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: ドラフトフェーズに入る前に「これはブレストではなく最終判断フェーズである」ことを確認済み。ユーザーが候補 A / B / C の比較（品質観点）を明示的に求め、B を選択。stale 対策は G1、テスト観点は「AI が再呼出されないこと」を観測する方針まで。具体的なテスト実装手段は spec で決定する。
