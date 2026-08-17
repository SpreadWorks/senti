## Background

In board 6764 (follow-up to 4142), we added wiring to the skill SKILL.md and finalize envelope, and established a policy to make the `sdd-forge flow report show` execution instruction redundant. However, both of these still rely on "AI reading and executing the instruction," and whether they were actually executed is not observable from flow status.

## Proposal

Add a `show-report` step to flow.steps after `docs-commit` and include it in the dispatcher loop exit condition.

- The finalize post-hook sets `show-report` to `in_progress`.
- `flow get next-action` returns `action: "show-report"` with the instruction "run `sdd-forge flow report show` and present stdout in a fenced code block" when at the `show-report` step.
- Once the AI executes it, `flow set step show-report done` triggers loop exit.

## Benefits

- **Non-execution becomes visible**: `flow get status` leaves `show-report: pending`, allowing both users and AI to detect a forgotten Report display.
- **Observability**: Since it can be treated as a step subject to metrics/retro, we can measure "how many times the Report display was skipped" in the future.
- Skill instruction dependency (6764) and envelope hint dependency are at the "awareness" level. Stepping makes the flow state itself enforce it.

## Scope

- `src/lib/flow-helpers.js` (buildInitialSteps): Add the `show-report` step immediately after `docs-commit`.
- `src/flow/schemas/context-rules.json`: Add an `impl.show-report` entry.
- `src/flow/prompts/impl/show-report.md` (new): Execution instructions.
- `src/flow/lib/run-finalize.js`: Add a post-hook to transition `show-report` to `in_progress` on successful finalize. Arrange state transitions so the loop can pick up `show-report` as the final step after docs-* steps complete.
- Tests: `show-report` is included in `buildInitialSteps` / `next-action` returns the correct instruction / `show-report` becomes `in_progress` after finalize.

## Out of Scope

- Changes to the Report format itself.
- skill/envelope wiring from board 6764 (can coexist in parallel, not a dependency).

## Prerequisites

- It is preferable for board 6764 to be resolved first (short-term safety net). This issue is the higher-level structural measure that formalizes that.

## References

- Related: board 4142 (Issue #212 — CLI foundation), board 6764 (skill/envelope wiring).
- How this surfaced: Report was dropped after spec 216 finalize. During the review of 6764, "inability to observe execution via flow state" emerged as a separate issue.

<details>
<summary>ja</summary>

[ENHANCE] finalize 後の Report 表示を dispatcher ステップ化 (show-report step)

## 背景

board 6764 (4142 フォローアップ) で skill SKILL.md と finalize envelope への配線を追加し、`sdd-forge flow report show` の実行指示を冗長化する方針を立てた。しかしこれらはいずれも「AI が指示を読んで実行する」ことに依存しており、実行したかどうかが flow status から観測できない。

## 提案

flow.steps に `show-report` ステップを `docs-commit` の後に追加し、dispatcher loop 終了条件に含める。

- finalize post-hook で `show-report` を `in_progress` にする。
- `flow get next-action` が `show-report` ステップで `action: "show-report"` と指示「`sdd-forge flow report show` を実行し stdout を fenced code block で提示」を返す。
- AI が実行したら `flow set step show-report done` で loop exit。

## 効果

- **未実行が可視化される**: `flow get status` で `show-report: pending` が残り、ユーザーも AI も「Report 表示忘れ」を検知できる。
- **観測可能性**: metrics / retro の対象ステップとして扱えるため、将来「Report 表示が何回飛ばされたか」を計測できる。
- skill 指示依存 (6764) や envelope hint 依存は "気付き" レベル。ステップ化は flow state 自体が強制する。

## Scope

- `src/lib/flow-helpers.js` (buildInitialSteps): `show-report` ステップを `docs-commit` 直後に追加。
- `src/flow/schemas/context-rules.json`: `impl.show-report` エントリ追加。
- `src/flow/prompts/impl/show-report.md` (新規): 実行指示。
- `src/flow/lib/run-finalize.js`: finalize 成功時に `show-report` を `in_progress` に遷移させる post-hook を追加。docs-* 系のステップ完了後、loop が `show-report` を最終ステップとして拾えるよう状態遷移を整える。
- tests: buildInitialSteps に show-report が含まれる / next-action が正しい指示を返す / finalize 後に show-report が in_progress になる。

## Out of Scope

- Report フォーマット自体の変更。
- board 6764 の skill/envelope 配線 (依存ではなく並行して存在可能)。

## 前提

- board 6764 が先に解決している方が望ましい (短期セーフティネット)。本件はそれを構造化する上位対策。

## 参考

- 関連: board 4142 (Issue #212 — CLI 基盤), board 6764 (skill/envelope 配線)。
- 発覚経緯: spec 216 finalize 後の Report 脱落。6764 の検討中に「実行したかを flow state で観測できない」点が別課題として浮上。

</details>