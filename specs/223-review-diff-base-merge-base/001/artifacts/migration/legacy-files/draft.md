# Draft: 223-review-diff-base-merge-base

**開発種別:** bugfix
**目的:** `flow run review` が評価する diff の起点を `baseBranch` の tip から「現ブランチと `baseBranch` の共通祖先」へ変更し、`baseBranch` が現ブランチより先行している場合に混入する無関係な上流コミット差分を評価対象から除外する。

## Requirements

優先度の高い順に列挙する。

- **[P1]** When `flow run review` executes, it shall compute the diff using the common ancestor between the current branch HEAD and `baseBranch` as the starting point, rather than the tip of `baseBranch`.
- **[P1]** When the common ancestor cannot be resolved (e.g. shallow clone without the ancestor, no common history), `flow run review` shall exit with a non-zero status and print an error message identifying the failing git command and its stderr, and shall not silently fall back to the previous `baseBranch` tip behavior.
- **[P2]** The set of files considered "touched by the current change set" (used by scope filtering) shall be computed against the same common-ancestor starting point, keeping diff content and file-scope computation consistent.
- **[P3]** When the regression suite runs, it shall exercise a scenario where `baseBranch` has advanced beyond the common ancestor and shall assert that the review scope contains only changes introduced by the current branch.

## Scope Verification
- In scope:
  - Diff starting-point resolution behavior of `flow run review` (no-phase form)
  - Regression test coverage for the new behavior
- Out of scope:
  - Proposal-level out-of-scope filtering (already addressed by issue #236 / ac7d)
  - Behavior of `flow run review` phase variants that do not rely on diff-based scoping

## Impact on Existing Features
- 影響ありの既存機能:
  - `flow run review` （`--phase` 無指定の code review パイプライン）: `baseBranch` が現ブランチの分岐点より先行している場合、review 結果の範囲が狭くなる。分岐点と `baseBranch` tip が一致する場合は従来と同一の結果となる。
- 影響なし:
  - `flow run review` の phase 指定形態（diff ベースの scoping を行わない変種）
  - その他の flow コマンド（`gate` / `impl-confirm` / `finalize` 等）

## Migration / Transition
- 本変更はバグ修正であり、従来挙動は誤り（無関係な上流コミットを review 対象に含める）であったため、移行期間や互換モードは設けない。
- ユーザー側の操作変更は不要。review 実行時に common-ancestor 解決に失敗する環境（共通祖先を欠く shallow clone 等）では、明確なエラーメッセージでその旨を示し、fetch を深めるなどの対処を促す。
- spec / task / issue-log 等の永続ファイルフォーマットには影響しない。

## Q&A
- Q: 共通祖先を解決できない場合の挙動は？
  - A: fail-hard（非ゼロ終了でエラー出力）。
  - 根拠: プロジェクト guardrail「過剰な防御コードを書かない／フォールバック値の抑制」（必須値が欠落したら黙ってデフォルトで動かさない）、および本件の発生動機（silent な誤挙動を防ぐ）。
- Q: テスト戦略は？
  - A: 実 git リポジトリを一時ディレクトリに構築し、`baseBranch` が分岐後に先行するシナリオを再現して review 評価範囲を検証する。
  - 根拠: 既存の review 関連 unit test が同一パターン（実 git repo を tmp に init してシナリオ再現）を採用しており、パターン揃えが guardrail「既存のコードパターン・命名規約・モジュール構造に合わせる」に従う。
- Q: diff 計算と file-scope（touched files）の両方を同じ起点に揃える必要があるか？
  - A: 両方を同一の共通祖先に揃える。
  - 根拠: 現実装が diff 出力と touched files 判定を独立に `baseBranch` から計算している構造上、片方だけ merge-base 化するとスコープフィルタと diff 内容がずれ、proposal 落ち／通過の不整合を生む。同一起点に揃えることが整合性の最小条件。

## Open Questions
-

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: Q1 (要望要約), Q2 (fail-hard), Q3 (test strategy) 承認済み
