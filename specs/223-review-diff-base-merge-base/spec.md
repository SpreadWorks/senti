# Feature Specification: 223-review-diff-base-merge-base

**Feature Branch**: `feature/223-review-diff-base-merge-base`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #247

## Goal
`flow run review` が評価する diff の起点を、`baseBranch` の tip から「現ブランチ HEAD と `baseBranch` の共通祖先」に変更し、`baseBranch` が現ブランチの分岐点より先行している場合に上流の無関係な変更が review 対象へ混入する現象を除去する。

## Background
auto モード終盤の `flow run review` が、現ブランチが触っていないファイルに対して APPROVED 提案を複数返す事例が観測された（baseBranch が 10 commits 先行、review 対象が 8 ファイルから 21 ファイルに膨張）。原因は、review パイプラインが diff 計算の起点として `baseBranch` の tip を使っており、ブランチ作成後に上流で統合された他 spec のコミット差分が丸ごと評価対象に混入することだった。関連 issue #236 (ac7d) は proposal 層のスコープフィルタ（対症療法）を扱うが、本 spec は diff 層で混入を抑える根本対応であり、スコープが独立している。

## Impact on Existing Features
- 影響あり: `flow run review`（`--phase` 無指定の code review パイプライン）— diff 起点が `baseBranch` tip から共通祖先に変わるため、`baseBranch` が分岐点より先行している場合に review 結果の範囲が狭くなる（本件の要求どおり）。分岐点と `baseBranch` tip が一致する場合は結果は従来と同じ。
- 影響あり: `collectTouchedFiles` を直接呼ぶ既存テスト — 第 2 引数がブランチ名から共通祖先 SHA へ意味が変わるため、テストも追従して更新する（ユーザ承認 = 本 spec 承認で充当）。
- 影響なし: `flow run review --phase test` / `--phase spec` — diff ベースの scoping を行わない別経路。
- 影響なし: その他の flow コマンド（`gate`, `impl-confirm`, `finalize` 等）。
- 影響なし: flow.json / spec.json 等の永続データフォーマット。

## Scope
- When `flow run review` (no `--phase`) is invoked, it shall resolve a single diff base SHA as `git merge-base HEAD <flow.baseBranch>` and shall use that SHA as the starting point for every diff computation in the code-review pass.
- When the diff base SHA cannot be resolved, `flow run review` shall exit with a non-zero status and shall print an error message that identifies the failing git invocation and its stderr, without falling back to the `baseBranch` tip.
- When the code-review pass computes the set of files touched by the current change set, it shall use the same diff base SHA as the starting point, keeping diff content and file-scope sharing one origin.
- When the regression suite runs, it shall include at least one test case that initializes a git repository with `baseBranch` advanced beyond the common ancestor and shall assert that the review evaluation excludes upstream-only commits.

## Out of Scope
- proposal-level の out-of-scope フィルタ（issue #236 / ac7d の担当領域）。
- `flow run review --phase test` / `--phase spec` パイプラインの挙動。これらは diff ベースの scoping を行わない。
- `flow run review` 以外の flow コマンド（`gate`, `impl-confirm`, `finalize` 等）。
- review AI の system prompt やスコア付けロジックの改変。

## Constraints
- 外部依存を追加しない（Node.js 組み込みモジュールのみ）。
- alpha 版ポリシーに従い、`baseBranch` tip への silent fallback を実装しない。
- 既存の `collectTouchedFiles` テストは第 2 引数の意味変更に追従して更新する。テストロジックの検証対象は現行と同質（ブランチ変更分が touched に入ること）を維持する。
- 共通祖先 SHA の解決は review パイプライン内部の file I/O / 外部コマンドで完結し、再帰処理・無制限ループ・無制限データロードを発生させない。
- `flow run review` の失敗時は非ゼロ終了を返す（既存の exit-code 契約を維持）。

## Design Principles
- 一貫性: diff 内容と touched-files 判定は同一の起点（共通祖先 SHA）から計算する。
- 明示的な失敗: 共通祖先の解決に失敗した場合は非ゼロ終了で停止する。silent fallback は採用しない。
- 単一責務: 共通祖先 SHA の解決は review パイプラインのエントリ（`runReview`）近辺で一度だけ行い、下位ヘルパーには解決済み SHA を引数で渡す。
- Requirements priority order (highest first): REQ-P1 (diff 基点を共通祖先へ) > REQ-P2 (解決失敗時 fail-hard) > REQ-P3 (touched-files も同一起点) > REQ-P4 (回帰テスト追加)。REQ-P1 と REQ-P3 を満たせば本件の主要バグは解消する。REQ-P2 は silent fallback 回帰の防止。REQ-P4 は回帰検知。

## Overview
### Modules
- `src/flow/commands/review.js`: `runReview` の code-review パスで `git merge-base HEAD <baseBranch>` を解決するヘルパーを新設し、解決済み SHA を `resolveReviewTarget` / `collectCommittedAndStagedDiff` / `collectTouchedFiles` に渡す。これら下位関数のシグネチャは `baseBranch` 受け取りから `mergeBase`（解決済み SHA）受け取りへ変更する。
- `tests/unit/flow/commands/review.test.js`: 既存 `collectTouchedFiles` テスト（第 2 引数）の呼び出しを SHA 受け取りへ追従更新。新規テストとして、「`baseBranch` が分岐後に先行している」シナリオ、および「共通祖先が解決できない」シナリオを追加。

### Data Flow
- 1. User invokes `sdd-forge flow run review` (no `--phase`).
- 2. `runReview` resolves `mergeBase = git merge-base HEAD <flow.baseBranch>`. On failure (non-zero exit, empty stdout), throw and exit non-zero.
- 3. `resolveReviewTarget(root, flow, mergeBase)` builds the diff text using `git diff <mergeBase>` (+ staged), scoped by `spec.scope.in` files if present.
- 4. `collectTouchedFiles(root, mergeBase)` builds the touched-files set using `git diff --name-only <mergeBase>` (+ staged).
- 5. The downstream pipeline (draft → final → apply) proceeds as before with the merge-base-based diff and touched set.

### Decisions
- 共通祖先 SHA 解決には `git merge-base HEAD <baseBranch>` を使う。git 標準かつ既存 `runGit` ヘルパーで実行可能。
- 解決失敗（非ゼロ終了、空出力、タイムアウト）はエラーを throw し、`runReview` 経由で非ゼロ終了させる。silent fallback は提供しない。
- 下位ヘルパーには解決済み SHA を引数で渡す。ヘルパー内で再解決しない（`runGit` の重複呼び出しを避ける／同一呼び出し内の結果不整合を排除）。
- `collectTouchedFiles` の export シグネチャは第 2 引数の意味変更（branch 名 → SHA）を伴うが、名前は維持する。テストは追従更新する。

## Clarifications (Q&A)
- Q: 共通祖先を解決できない場合の挙動は？
  - A: fail-hard（非ゼロ終了 + エラーメッセージ）。silent fallback は本件バグの静かな再現経路となるため不採用。プロジェクト規約「過剰な防御コードを書かない／フォールバック値の抑制」に従う。
- Q: テスト戦略は？
  - A: 既存 `collectTouchedFiles` テスト (tests/unit/flow/commands/review.test.js L246-) と同じく、実 git リポジトリを `createTmpDir()` + `initTestRepo()` で作成し、`baseBranch` が分岐後に先行するシナリオを再現する。既存パターンへの追従により学習コストと回帰リスクを下げる。
- Q: diff 計算と touched-files 判定を同じ起点に揃える必要があるか？
  - A: はい。起点がずれると `filterProposalsByScope` が本来通すべき proposal を落とす／落とすべきものを通す不整合が生じる。両方を同一の merge-base SHA に揃える。

## Alternatives Considered
- proposal 層のみでフィルタする（issue #236 / ac7d 方針） — 診断の根本原因は diff 層の混入であり、生成される proposal そのものを減らすことで AI 呼び出しコストとレビュー精度の両方を改善できる。proposal 層フィルタと本件は相補的・独立に適用可能で、排他ではない。本 spec のスコープではない。
- silent fallback（merge-base 解決失敗時は `baseBranch` tip を使う） — 本件のバグが静かに再現する経路となる。却下。
- diff 計算だけ merge-base 化し、touched-files は `baseBranch` tip のまま — scope フィルタと diff 内容のずれが生じ、proposal の取りこぼし／過剰通過が発生する。却下。
- 共通祖先 SHA をヘルパーごとに都度 `git merge-base` で再解決する — 外部コマンドの重複呼び出しが発生し、同一 review 内の結果が理論上ずれる可能性がある。単一呼び出しで解決して引数で渡す方が堅牢。却下。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23T12:48:12.121Z
- Notes: User approved via /sdd-forge.flow

## Requirements
- REQ-P1 [must]: When `flow run review` is invoked without a `--phase`, the code-review pass shall resolve a single merge-base SHA via `git merge-base HEAD <flow.baseBranch>` and shall use that SHA as the starting point for the `git diff` invocations that build the review diff text.
- REQ-P2 [must]: When `git merge-base HEAD <flow.baseBranch>` exits non-zero or produces an empty SHA, `flow run review` shall terminate with a non-zero exit status and shall emit an error message that names the failing git command and includes its captured stderr, and shall not fall back to using the `baseBranch` tip.
- REQ-P3 [must]: When the code-review pass computes the touched-files set (the input of `filterProposalsByScope`), it shall use the same merge-base SHA resolved in REQ-P1 as the starting point of `git diff --name-only`, so that the diff text and the touched-files set share one origin.
- REQ-P4 [should]: When the regression suite in `tests/unit/flow/commands/review.test.js` runs, it shall include at least one test that: (a) initializes a git repository where `baseBranch` has one or more commits beyond the common ancestor with the feature branch, (b) creates changes on the feature branch only, and (c) asserts that the touched-files set (or equivalent diff scope) computed from the merge-base SHA excludes files changed only upstream.

## Acceptance Criteria
- AC-1 (REQ-P1, REQ-P3): Given a git fixture where `main` has 2 commits beyond the branch-point and the feature branch has 1 commit that changes file `a.js`, when the review pipeline is exercised against this fixture, the diff text and touched-files set both contain only `a.js` (files changed only on `main` are excluded).
- AC-2 (REQ-P2): Given a git fixture where `git merge-base HEAD main` fails (e.g., an unrelated orphan branch with no common ancestor), when `flow run review` is invoked, the command exits with non-zero status and prints an error message containing the substring `merge-base` and the captured stderr from git.
- AC-3 (REQ-P1, REQ-P3): A unified diff of the implementation shall show that `collectCommittedAndStagedDiff` and `collectTouchedFiles` receive a merge-base SHA (not `flow.baseBranch`) from their callers, and that the merge-base SHA is resolved exactly once per `flow run review` invocation.
- AC-4 (REQ-P4): `npm test` passes, and the updated `tests/unit/flow/commands/review.test.js` includes at least one new test case whose name or description references the `baseBranch advanced beyond merge-base` scenario and asserts the scope exclusion.

## Implementation Targets
- src/flow/commands/review.js
- tests/unit/flow/commands/review.test.js

## Authorized Existing Test Modifications
- **tests/unit/flow/commands/review.test.js** — Spec 223 changes the second-arg semantics of collectTouchedFiles from a branch name ref to a merge-base SHA; existing tests are updated to resolve and pass a SHA via git rev-parse so the same semantic assertion (branch-local change is in touched) still holds under the new contract.

## Open Questions
- [ ]
