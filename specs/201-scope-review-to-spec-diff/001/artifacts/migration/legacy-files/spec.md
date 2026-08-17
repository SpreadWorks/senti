# Feature Specification: 201-scope-review-to-spec-diff

**Feature Branch**: `feature/201-scope-review-to-spec-diff`
**Created**: 2026-04-20
**Status**: Draft
**Input**: Issue #193 (ee86) — `flow run review` が spec の diff スコープを無視して無関係な提案を生成する

## Goal

- `sdd-forge flow run review` が出力する改善提案を、今回の変更が実際に touch したファイル集合に拘束する。スコープ外ファイルへの提案が review.md に残らないようにする。

## Scope

- `src/flow/commands/review.js` — draft フェーズのシステムプロンプト、提案パース、scope 判定・post-filter 処理
- `tests/unit/flow/commands/review.test.js` — scope 拘束の振る舞いを検証するユニットテスト

## Out of Scope

- gate-impl の pre-existing 過検出（issue #180, 別タスク）
- final（検証）フェーズの verdict ロジック
- review 以外の `flow run` サブコマンド（impl-confirm, gate, sync, finalize）
- 行単位の拘束（ファイル単位で拘束する）
- review のアーキテクチャ変更（tool-level guard 等）

## Clarifications (Q&A)

- Q: スコープ判定の真実は spec.md の `## Scope` 宣言か、今回の diff か？
  - A: 今回の diff が touch したファイル集合。spec.md の Scope 宣言の有無に依存しない。
- Q: 拘束の粒度はファイル単位か行単位か？
  - A: ファイル単位。行単位はプロジェクト規約（同一ファイル内の一貫性修正は spec スコープ外でも許容）と衝突する。
- Q: 提案からファイル情報が抽出できなかった場合はどう扱うか？
  - A: 保守的に除外。除外件数は観測可能にする。
- Q: プロンプトだけでの拘束で十分か？
  - A: 不十分。複数 spec で再発している事実から、プロンプト制約と post-filter の両層で拘束する。

## Impact on Existing Features

- 影響する振る舞い: `sdd-forge flow run review` draft フェーズの提案集合が縮小する方向（スコープ外ファイルへの提案が除外される）。review.md のフォーマット（見出し、verdict 記法）は既存互換を維持する。
- 影響しない領域: `flow run impl-confirm`, `flow run gate` (impl フェーズ), `flow run sync`, `flow run finalize`, `flow run review` final フェーズの verdict ロジック、他の `docs` / `spec` サブコマンド。review.md を下流で参照するコマンドは存在しないため連鎖影響はない。
- 既存テスト: review 関連テスト 4 ファイル（R-P5 列挙）は期待値の一部を更新する可能性がある。更新が必要なケースはスコープ外提案を期待していた古い fixture に限定される。
- docs / README: 生成物に影響なし（review の内部挙動変更のみのため）。
- CLI インターフェース: サブコマンド・オプションの削除や意味変更なし。ユーザー向けの後方互換は保たれる。

## Alternatives Considered

- プロンプト制約のみ: LLM の確率的挙動で再発リスク。過去 3 spec で観測済み。却下。
- post-filter のみ: LLM 側で提案生成が続くため入出力トークンの浪費が止まらない。却下。
- tool-level guard（review を write-tool 駆動化）: アーキテクチャ書き換えが必要。過剰。却下。
- spec.md の `## Scope` 必須化: ユーザー側に強い制約。既存 spec 非準拠との相性が悪い。却下。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-20
- Notes: Issue #193 の review scope 逸脱修正方針について承認。auto モードで進行。

## Requirements

優先順位付き（P1 が必須・最優先、P5 が補助）。

- R-P1: When `flow run review` の draft フェーズが提案を生成した場合、今回の変更が実際に touch したファイル集合に含まれないファイルを対象とする提案は、最終出力 `review.md` に残さないものとする。
- R-P2: When review draft のシステムプロンプトが構築される時、「提案は今回の diff 対象ファイルのみを対象とせよ」旨の指示を含めるものとする。
- R-P3: If 提案からファイル情報（`**File:** <path>`）が抽出できない場合、その提案は最終 `review.md` から除外し、除外件数をユーザーが事後確認できる形（標準エラー出力またはログ）で出力するものとする。
- R-P4: When spec.md に `## Scope` セクションがない、または抽出できるファイルが 0 件の状態で `flow run review` を実行した場合、対象ファイル集合は「今回の変更（committed diff + staged diff）が実際に touch したファイル」で決定し、R-P1 の振る舞いが成立するものとする。
- R-P5: When 本 spec の変更を適用した後、既存 review 関連テスト（`tests/unit/flow/commands/review.test.js`, `tests/unit/flow/phases-review.test.js`, `tests/unit/docs/lib/review-parser.test.js`, `tests/e2e/docs/commands/review.test.js`）は引き続きパスするものとする。また、R-P1 / R-P3 / R-P4 の振る舞いを検証する単体テストを `tests/unit/flow/commands/review.test.js` に追加するものとする。

## Acceptance Criteria

- AC1 (R-P1): 今回 touch したファイル集合外のファイルに言及する提案が draft から返っても、最終 `review.md` には出力されない。ユニットテストで検証可能であること。
- AC2 (R-P2): review draft のシステムプロンプトを検査すると「提案は diff 対象ファイルのみ」相当の指示が含まれている。
- AC3 (R-P3): ファイル情報が欠落した提案が draft から返っても、最終 `review.md` には出力されない。かつ、除外件数が stderr またはログに可観測な形で出る。
- AC4 (R-P4): `## Scope` が空または抽出 0 件の spec で review を実行しても、対象ファイル集合は「今回の diff が touch したファイル」になり、それ以外のファイルへの提案は出力されない。
- AC5 (R-P5): `node tests/run.js` 相当で既存 review 関連テストがグリーン。新規追加テストも合わせてグリーン。

## Open Questions

なし
