## Background

In the R1 finalize-merge/finalize-sync tests for spec 251 (#308), a fundamentally impossible assertion sneaked in: `String.prototype.split` removes the separator, yet the downstream regex was requiring that separator string as a literal. It quietly passed the test phase/review-test and was only discovered after implementation. The root cause is that review-test is a static AI review, making it unable to detect logically broken assertions that are only revealed by actual execution.

## Additional Investigation Notes (2026-05-17)

Even in the current state, phrases like "Tests should fail initially" and "expected to fail before implementation" appear frequently. `src/flow/prompts/plan/test.md` also states `Tests should fail initially (before implementation).`

However, the same `src/flow/prompts/plan/test.md` contains `Do NOT run tests here.`, meaning the test step in the plan phase only writes tests and does not execute them. The actual common execution point is `test-execute` in the impl phase, and `src/flow/prompts/impl/test-execute.md` explicitly states it is the `Single execution point` — the only step that runs tests.

Therefore, what currently exists is a declaration/expectation that "tests should fail before implementation," not a common flow that "executes tests before every implementation, confirms FAIL, and records it as an artifact." Some specs/issue-logs contain records of `verified failing before implementation`, but these are manual, session-local evidence, not a standard step.

Additionally, `plan/test.md` contains wording that could be read as "initial failure confirmation is done by impl-phase test-execute," but since `test-execute` runs after `implement`, it does not strictly confirm pre-impl failure. This ambiguity in the prompts also needs to be resolved in this task.

## Proposal Overview

Add a step (tentatively named: scenario-validity) to the test stage in the plan phase that "executes tests in the absence of implementation and verifies that they FAIL as expected." A two-layer defense of runtime verification and static review prevents tautological/impossible assertions from sneaking in.

## Prior Investigation (Open Questions Identified After Running SDD Flow in Issue #317)

After running the flow up to the draft stage starting from Issue #317, discrepancies between the issue description and the current code, as well as undefined items, were identified. These have been organized in this draft before re-starting work. Issue #317 is closed.

### 1. Interpretation of gate-test

The original issue mentions "before gate-test," but there is no gate-test step in the current flow (only `gate-draft` / `gate (spec)`). One of the following needs to be decided:
- (a) scenario-validity doubles as the gate
- (b) Align to a 3-stage sequence: review-test → scenario-validity → gate-test
- (c) Rename review-test to gate-test

### 2. How to Create an "Implementation-Absent State"

- (a) Use the current worktree at the end of the plan phase as-is (no additional git operations needed, but a precondition to detect already-edited impl files is required)
- (b) Execute in a detached worktree of the base branch (consistent with the worktree boundary convention)

### 3. Pass Conditions and Failure Semantics

- Granularity: Per testable R-N, "all R-N tests must fail" vs. "at least one failure is OK"
- Failure types: Classify assertion fail / syntax error / runner crash / skip / todo into `expected_fail` / `unexpected_pass` / `invalid_test` / `skipped` / `not_run`
- Handling of cases where scenario assertions and supporting checks are mixed within a single R-N

### 4. Test Discovery and Execution Strategy

Spec-local tests are excluded from `npm test`. Decide whether to run them directly with `node --test specs/<spec>/tests/...` or reuse the project runner with a spec-local filter. Also clarify how to handle `.ts` files.

### 5. Relationship with test-execute

The current prompt explicitly states "test-execute is the single execution point." Adding scenario-validity breaks this premise, so a decision is needed: update the rule to "single execution point per phase," or explicitly document scenario-validity as an exception.

### 6. Content of Anti-pattern Guidance

The content of the anti-pattern section to be added to the review-test prompt. Should be written in terms of the essence of tautology (not going through production code / returning input as-is, etc.) since a simple "constant toBe" would be a false positive. Candidates:
- Assertion does not go through production code (asserting mock results or setup values)
- Round-trip that returns input directly as expected
- Regex that always matches (`/.*/`, `/[\s\S]*/`)
- Existence-only check (only `typeof`)
- Catch-all that swallows all errors and judges as PASS
- Requiring a separator (removed by split) as a literal in downstream regex (the originating case)

### 7. Failure Behavior and Retry

Blocking behavior on failure, artifact (`scenario-validity-result.json`) schema, user-facing summary, fix→re-run cycle, and maxAttempts are all undefined.

### 8. Affected Scope

- `src/flow/definition.js` (add FLOW_DEFINITION leaf)
- `src/flow/registry.js` (command + post-hook)
- `src/flow/lib/run-scenario-validity.js` (new) and `runTestsCapture` common helper
- `src/flow/prompts/plan/scenario-validity.md` (new) and `plan/review-test.md` (add anti-pattern section)
- `src/flow/prompts/plan/test.md`, `impl/test-execute.md` (single-execution-point wording)
- schemas (`scenario-validity.schema.json`, `scenario-validity-result.schema.json`)
- `run-finalize-commit.js` (artifact list)
- `src/templates/skills/sdd-forge.flow/SKILL.md`
- tests and `sdd-forge upgrade`

## References

- Issue #317 (closed as prior investigation for this draft)
- R1 finalize-merge/sync test contamination case in spec 251 (#308)

<details>
<summary>ja</summary>

[ENHANCE] impl 前に scenario-validity step を入れて impl 不在で fail することを検証する

## 背景

spec 251 (#308) の R1 finalize-merge / finalize-sync 用テストで、`String.prototype.split` が separator を除去するのに、その separator 文字列を後段 regex の literal として要求する原理的に不可能な assertion が混入。test phase / review-test を quietly に通過し、impl 後に初めて発覚した。review-test は静的 AI レビューのため、実行しないと露呈しない原理破綻を検出できないことが根本原因。

## 追加調査メモ (2026-05-17)

現状でも「Tests should fail initially」「expected to fail before implementation」のような文言は多数存在する。`src/flow/prompts/plan/test.md` にも `Tests should fail initially (before implementation).` と書かれている。

ただし、同じ `src/flow/prompts/plan/test.md` には `Do NOT run tests here.` とあり、plan phase の test step はテストを書くのみで実行しない。実際の共通実行点は impl phase の `test-execute` であり、`src/flow/prompts/impl/test-execute.md` は `Single execution point` として「この step だけがテストを実行する」と明記している。

したがって、現在あるのは「実装前に失敗するべき」という宣言・期待であって、「実装前に毎回実行して FAIL を確認し artifact として残す」共通フローではない。一部 spec / issue-log に `verified failing before implementation` の記録はあるが、これは個別セッションの手動・局所的な証跡であり、標準 step ではない。

また `plan/test.md` は「初期失敗の確認は impl-phase test-execute で行う」と読める文言を持つが、`test-execute` は `implement` の後に走るため、厳密には impl 前 FAIL の確認にならない。この prompt 上の曖昧さも本タスクで整理する必要がある。

## 提案概要

plan phase の test 段に「テストを impl 不在状態で実行し、期待通り FAIL することを検証する」step (仮称: scenario-validity) を追加。runtime 検証と静的レビューの二段構えで tautological / impossible assertion の混入を防ぐ。

## 先行調査 (Issue #317 で SDD flow を回した結果判明した未確定論点)

Issue #317 を起点に flow を draft 段階まで回したところ、Issue 文と現コードのズレ・未定義事項が判明。本ドラフトに整理してから着手し直す。Issue #317 は close。

### 1. gate-test の解釈
元 Issue は「before gate-test」と書くが、現フローに gate-test step は無い (`gate-draft` / `gate (spec)` のみ)。下記いずれかを確定する必要:
- (a) scenario-validity が gate を兼ねる
- (b) review-test → scenario-validity → gate-test の 3 段に揃える
- (c) review-test を gate-test に改名

### 2. 「impl 不在状態」の作り方
- (a) plan 末尾の現 worktree をそのまま使う (追加 git 操作不要だが、impl ファイル既編集を検出する precondition が必要)
- (b) base branch の detached worktree で実行 (worktree 境界規約と整合)

### 3. 合格条件と failure semantics
- 粒度: 各 testable R-N で「全 R-N: テスト fail」要求 vs.「1 件 fail で OK」
- 失敗種別: assertion fail / syntax error / runner crash / skip / todo を `expected_fail` / `unexpected_pass` / `invalid_test` / `skipped` / `not_run` に細分化
- R-N 内に scenario assertion と supporting check が混在する場合の扱い

### 4. テスト発見・実行戦略
spec-local tests は `npm test` 対象外。直接 `node --test specs/<spec>/tests/...` で動かすか、project runner を spec-local filter で再利用するか。`.ts` の扱いも明確化。

### 5. test-execute との関係
現行 prompt が「test-execute は単一実行点」と明記。scenario-validity 追加で前提が崩れるので、ルールを「phase ごとの単一実行点」に更新するか、scenario-validity を例外として明文化するか決める。

### 6. anti-pattern guidance の内容
review-test prompt に追加する anti-pattern セクションの中身。tautology の本質 (production code を経由しない / 入力をそのまま返す等) で書く必要 (単純な「定数 toBe」は false-positive)。候補:
- assertion が production code を経由しない (mock 結果や setup 値を assert)
- 入力をそのまま expected として返す round-trip
- 常時 match する regex (`/.*/`, `/[\s\S]*/`)
- existence-only check (typeof のみ)
- catch-all で全エラーを吞んで PASS 判定
- split で消える separator を後段 regex で literal 要求 (発端事例)

### 7. 失敗時の挙動・retry
fail 時の blocking 挙動、artifact (scenario-validity-result.json) schema、ユーザー向け要約、修正→再実行サイクル、maxAttempts が未定義。

### 8. 影響範囲
- `src/flow/definition.js` (FLOW_DEFINITION leaf 追加)
- `src/flow/registry.js` (command + post-hook)
- `src/flow/lib/run-scenario-validity.js` (新規) と `runTestsCapture` 共通ヘルパー
- `src/flow/prompts/plan/scenario-validity.md` (新規) と `plan/review-test.md` (anti-pattern 追加)
- `src/flow/prompts/plan/test.md`, `impl/test-execute.md` (single-execution-point 文言)
- schema (`scenario-validity.schema.json`, `scenario-validity-result.schema.json`)
- `run-finalize-commit.js` (artifact 一覧)
- `src/templates/skills/sdd-forge.flow/SKILL.md`
- tests と `sdd-forge upgrade`

## 参照
- Issue #317 (本ドラフトの先行調査として close)
- spec 251 (#308) の R1 finalize-merge/sync テスト混入事例

</details>