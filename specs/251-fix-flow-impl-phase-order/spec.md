# Feature Specification: 251-fix-flow-impl-phase-order

**Feature Branch**: `feature/251-fix-flow-impl-phase-order`
**Created**: 2026-05-06
**Status**: Draft
**Input**: GitHub Issue #310

## Goal
FLOW_DEFINITION の impl phase 配列順を `implement → gate-impl → review → finalize` から `implement → review → gate-impl → finalize` に修正し、TASK_DEFINITION と整合させる。これにより gate 通過後に review がコードを変更する設計矛盾を解消する。

## Background
FLOW_DEFINITION の integration impl phase は `implement → gate-impl → review → finalize` の順で定義されており、最終 PASS/FAIL 判定 + 副作用発火を担う `gate-impl` の後に code を変更し得る `review` が走る。結果として gate 通過後にコードが変更されゲートの意味が壊れる。一方 TASK_DEFINITION は `impl → review → gate-impl` 順で正しく整合している。Issue #310 はこの設計矛盾を解消し、両定義の順序を一致させることを要求する。

## Impact on Existing Features

本変更は以下の既存機能に影響する:

- **flow 進行 (flow-helpers.js, get-next-action.js, registry.js, run-gate.js, gate-step.js, get-check.js, set-step.js, resolve-auto-check-input.js)**: FLOW_DEFINITION 配列順に依存しない汎用 traversal API (collectLeafIds, derivePhaseMap, findFirstPendingLeaf, resolveNodeFor, derivePrereqs) を経由するため、配列 swap で自動追従。runtime ロジック修正は不要。
- **gate-impl の side effects (completeTask / promoteNextTask / mergeOverview)**: 発火タイミングが review 完了後に変わる。これは TASK_DEFINITION 既存挙動 (impl → review → gate-impl) と一致し、mergeOverview が review 反映後の実装スナップショットを捉える正しい挙動になる。
- **gate-impl の phase 自動解決**: `STEP_TO_PHASE["gate-impl"]` が `task-impl` から `integration` に変わる (R9)。flow-level gate-impl は integration phase で実行されるようになり、gate-phase-inference test の assertion 更新 (R13) が必要。
- **PASS_NEXT / next hint の値**: `task-impl` PASS の next が `null` に、`integration` PASS の next が `finalize-commit` に変わる (R8)。impl review の clean 時の next hint も `finalize` から `gate-impl` に変わる (R7)。next hint は表示用であり flow 進行の実体は document order traversal なので進行ロジックは不変。
- **既存の active flow.json (旧順序で初期化された state.steps を持つ)**: alpha 版ポリシーにより migration しない。新規 flow から新順序で初期化される。中断中の flow がある場合は再初期化が必要。
- **user-facing skill / 文書 (SKILL.md, registry.js help, impl/gate-impl prompt, impl/implement prompt, task/review prompt)**: 旧順序を反映した記述を新順序に整合させる。これらは behavior に影響しないが文書整合のため必須。
- **既存テスト (tests/unit/flow/commands/review.test.js, tests/unit/flow/get-next-action.test.js, tests/unit/226-task-decomp-wiring/, tests/unit/227-post-226-forest-integration/, tests/e2e/227-forest-e2e.test.js, tests/e2e/231-task-e2e-full-lifecycle.test.js, tests/unit/flow/gate-phase-inference.test.js)**: ほぼ順序非依存だが旧順序のリテラルを新順序に整合させる。gate-phase-inference test は仕様変更を反映。

## Scope
- src/flow/definition.js の FLOW_DEFINITION impl branch children 配列で `gate-impl` と `review` の位置を入れ替える
- src/flow/definition.js の FLOW gate-impl ノード `gatePhase` 配列を `["task-impl", "integration"]` から `["integration", "task-impl"]` に reorder し、`STEP_TO_PHASE["gate-impl"]` が flow scope で `"integration"` を返すようにする
- src/flow/lib/gate-step.js の `TASK_STEP_TO_PHASE` に `"gate-impl": "task-impl"` を追加し、task scope での gate-impl in_progress 時に phase 自動解決が `task-impl` を返すようにする
- src/flow/prompts/impl/gate-impl.md の `--phase task-impl` 固定指定を撤去し、`--phase` を省略する形に変更する (CLI が scope に応じて自動解決: flow=integration, task=task-impl)
- src/flow/lib/run-review.js の impl review 結果で `next: "finalize"` を `next: "gate-impl"` に変更する
- src/flow/lib/run-gate.js の PASS_NEXT マッピングで `"task-impl": "review"` を `"task-impl": null` に、`"integration": "review"` を `"integration": "finalize-commit"` に変更する
- src/flow/registry.js の `flow run gate` help text の `--phase <draft|pre|post|impl>` を `--phase <draft|spec|task-spec|task-impl|integration>` (VALID_GATE_PHASES と整合) に更新する
- src/templates/skills/sdd-forge.flow/SKILL.md の (a) frontmatter description `code → gate → review` を `code → review → gate` に、(b) Hard Stops 文言 `re-PASSed after review auto-corrections` を削除、(c) Commands reference の `--phase <draft|spec|task-impl>` を `--phase <draft|spec|task-spec|task-impl|integration>` に更新する
- src/flow/prompts/impl/implement.md の test-only autoApprove path で `gate-impl skipped` を残しつつ `Skip to step 3 (review)` を新順序整合の文言に修正する (test-only path では implement と gate-impl をスキップして review のみ走らせる semantics を明示)
- src/flow/prompts/task/review.md line 14 の `the next-action CLI advances to task.update-overview` を `the next-action CLI advances to gate-impl` に修正する
- FLOW_DEFINITION impl children の exact order を assert する unit test を追加する
- GetNextActionCommand の実経路で implement done → review、review done → gate-impl、gate-impl done → finalize-commit の 3 段階遷移を検証する unit test を追加する
- tests/unit/flow/gate-phase-inference.test.js の flow-level gate-impl が `task-impl` に解決されるという assertion を `integration` に解決される assertion に更新する
- tests/e2e/flow/gate-impl-integration.test.js (または同等) で `--phase` 省略時の flow-level gate-impl が integration phase で実行され PASS_NEXT が `finalize-commit` を返すことを検証する
- tests/e2e/227-forest-e2e.test.js, tests/e2e/231-task-e2e-full-lifecycle.test.js, tests/unit/flow/get-next-action.test.js, tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js, tests/unit/227-post-226-forest-integration/t-a3-no-flat-fallback.test.js の旧順序リテラル `"implement", "gate-impl", "review"` を `"implement", "review", "gate-impl"` に更新する
- テンプレート更新を反映するため `sdd-forge upgrade` を実行し `.claude/skills/sdd-forge.flow/SKILL.md` および `.agents/skills/sdd-forge.flow/SKILL.md` を同期する

## Out of Scope
- TASK_DEFINITION children 配列の順序変更 (既に正しい)
- gate-impl / review ノードの sideEffects, maxAttempts, contextKinds の変更
- registry.js の post-hook ロジック (副作用発火順) の変更
- review / gate コマンドの主処理ロジック変更 (PASS_NEXT / next hint の値更新と help text 更新は in scope だが、AI 呼び出しや state transition 機構自体の変更は out)
- 既存の active flow.json (旧順序で初期化された state) の migration (alpha 版ポリシーに従い旧 state は再初期化を許容)
- docs/ 内のローカライズドキュメント本文更新 (現状 grep で旧順序を直接記述している箇所は無し。docs build で追従)

## Constraints
- alpha 版ポリシーに従い後方互換コードを書かない。旧順序の state.steps を持つ flow.json の migration は行わない
- 外部依存を追加しない (Node.js 組み込みのみ)
- テストを通すためにテストコードを修正してはならない。プロダクトコード (definition.js) の修正で対応する

## Design Principles
- 順序の修正は配列上の position の入れ替えに閉じる。consumer 側のロジック変更を伴わない最小スコープを保つ
- user-facing なテンプレート (SKILL.md) と内部 definition の整合性を同一 spec で完結させ、リリース時の文書実装乖離を生まない

## Overview
### Modules
- src/flow/definition.js — FLOW_DEFINITION impl branch children 配列で gate-impl と review の位置を入れ替える。各ノード属性は不変。
- src/templates/skills/sdd-forge.flow/SKILL.md — frontmatter description および Hard Stops 文言を新順序に整合させる。
- 新規 unit test (FLOW_DEFINITION impl children の exact order assertion) — 旧順序への回帰を検知する。
- 新規 unit test (state-based progression) — buildInitialNestedSteps で生成した state を進行させ next-action.step が implement → review → gate-impl の順で遷移することを検証する。

### Data Flow
- FLOW_DEFINITION の document order → buildInitialNestedSteps() → flow.json state.steps → findFirstPendingLeaf / promoteNextPendingLeaf → next-action.step
- gate-impl PASS → registry.js post-hook → executeGateSideEffects(phase) → completeTask / promoteNextTask / mergeOverview

### Decisions
- 配列順入れ替えのみで足りる。FLOW_DEFINITION の consumer はすべて document order ベースのトラバース (collectLeafIds, derivePhaseMap, findFirstPendingLeaf, resolveNodeFor, derivePrereqs) を経由するため、配列 position の入れ替えで全 consumer が自動追従する。
- side effects (completeTask / promoteNextTask / mergeOverview) のタイミングは review 完了後に発火する。これは TASK_DEFINITION 既存挙動と一致し、mergeOverview が review 反映後の実装スナップショットを捉えることが意図通り。
- phase 解決は不変。STEP_TO_PHASE は collectGatePhaseEntries が gate-impl の gatePhase 配列 (["task-impl", "integration"]) を順に展開した entries を first-wins で reduce する。配列内 review/gate-impl の swap は phase 解決に影響しない。
- 既存テスト (tests/unit/flow/commands/review.test.js の implIdx < reviewIdx < finalIdx) は旧順序でも PASS するため Issue #310 の回帰検知に機能しない。exact-order と state-based の 2 軸で固定する新規テストを追加する。

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- review ノードを移動させずに gate-impl の post-hook で review を呼ぶ — 却下。副作用を gate に集約し責務が膨らむ。review は独立したステップとして扱うべき。
- 順序を保ったまま gate-impl の sideEffects を別ノード (review 後) に移す — 却下。sideEffects は gate PASS 判定と論理的に一体であり、ゲートと分離するのは設計の劣化。
- review の auto-correction を抑制し read-only にする — 却下。review がコード品質を保つ機能であり、無効化は既存機能の喪失。順序を直す方が根本対応。
- 既存 active flow.json への migration スクリプト追加 — 却下。alpha 版ポリシー (CLAUDE.md: 後方互換コードは書かない) に違反。
- テンプレート更新を別 spec に分離 — 却下。実装と user-facing 文書がリリース時にズレる期間が発生する。同一 spec で完結させる方が安全。

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: src/flow/definition.js の FLOW_DEFINITION (line 220-244 周辺) で、impl branch の children 配列内の `gate-impl` ノードと `review` ノードの位置を入れ替える。結果として children の id 順が `["implement", "review", "gate-impl", "finalize"]` になる。各ノードの属性 (id, label, action, instructionsKey, contextKinds, outputSchemaRef, maxAttempts, sideEffects, gatePhase) は変更しない。
- R2 [must]: tests/unit/ 配下に FLOW_DEFINITION impl branch children の id 順が `["implement", "review", "gate-impl", "finalize"]` であることを exact に assert する unit test を追加する。`resolveNodeFor(FLOW_DEFINITION, "impl").children.map(c => c.id)` を期待値と deep equal で比較する。
- R3 [should]: tests/unit/ 配下に新規 flow state ベースの進行検証 unit test を追加する。CLI envelope (`sdd-forge flow get next-action`) または `GetNextActionCommand.execute` を経由する実経路で検証する。state を impl phase まで進め (a) `implement` を done にした次の next-action.data.step が `review`、(b) `review` を done にした次が `gate-impl`、(c) `gate-impl` を done にした次が `finalize-commit` の 3 段階遷移を assert する。`findFirstPendingLeaf` 単独 import ではなく save/reload を含む実経路を使う。
- R4 [should]: src/templates/skills/sdd-forge.flow/SKILL.md の frontmatter description 内 `implementation (code → gate → review)` を `implementation (code → review → gate)` に置換し、Hard Stops 項 (line 157) `Do not finalize before the impl-phase gate has PASSed (and re-PASSed after review auto-corrections).` を `Do not finalize before the impl-phase gate has PASSed.` に置換する (旧順序の workaround 文言削除)。
- R5 [should]: src/flow/prompts/impl/implement.md の test-only autoApprove path で参照されている旧順序 (`Skip to step 3 (review)`) を新順序に整合する形に修正する (review は新順序で 2 番目のため、参照番号 / 文言を更新する)。
- R6 [should]: src/flow/prompts/task/review.md line 14 の `the next-action CLI advances to task.update-overview` を `the next-action CLI advances to gate-impl` に修正する。TASK_DEFINITION の review の次は gate-impl のため。
- R7 [must]: src/flow/lib/run-review.js の impl review 結果 (line 159 周辺) で `next: "finalize"` を `next: "gate-impl"` に変更する。review の次は finalize ではなく gate-impl のため。
- R8 [must]: src/flow/lib/run-gate.js の PASS_NEXT マッピングを新順序に整合させる: `"task-impl": "review"` → `"task-impl": null` (gate-impl は task の最後のステップで PASS 後は task 完了)、`"integration": "review"` → `"integration": "finalize-commit"` (gate-impl の次は finalize-commit)。
- R9 [must]: src/flow/definition.js の FLOW gate-impl ノード `gatePhase` 配列を `["task-impl", "integration"]` から `["integration", "task-impl"]` に reorder し、`STEP_TO_PHASE["gate-impl"]` (first-wins) が flow scope で `"integration"` を返すようにする。同時に src/flow/lib/gate-step.js の `TASK_STEP_TO_PHASE` に `"gate-impl": "task-impl"` を追加し、task scope で gate-impl 自動解決が `task-impl` を返すようにする。これにより flow-level gate-impl は integration phase、task-level gate-impl は task-impl phase で実行される。
- R10 [must]: src/flow/prompts/impl/gate-impl.md から `--phase task-impl` の固定指定を撤去し、`sdd-forge flow run gate` (--phase 省略) の形に変更する。CLI の auto-resolve が R9 の変更により scope に応じた phase を返すため、AI は phase を意識せずに済む。
- R11 [should]: src/flow/registry.js の `flow run gate` help text 内 `--phase <draft|pre|post|impl> Gate phase (default: pre)` を `--phase <draft|spec|task-spec|task-impl|integration>` (VALID_GATE_PHASES と整合) に更新し、デフォルトは `auto-resolve` 旨を明記する。
- R12 [should]: src/templates/skills/sdd-forge.flow/SKILL.md の Commands reference セクション内 `sdd-forge flow run gate [--phase <draft|spec|task-impl>]` を `sdd-forge flow run gate [--phase <draft|spec|task-spec|task-impl|integration>]` に更新する。
- R13 [must]: tests/unit/flow/gate-phase-inference.test.js の flow-level gate-impl が phase `task-impl` に解決されるという assertion を `integration` に解決される assertion に更新する (R9 の挙動変更を反映)。task-level の gate-impl 解決テストがあれば `task-impl` を返すことを検証する。
- R14 [should]: flow-level gate-impl が `--phase` 省略時に integration phase で実行され、PASS 時の envelope `next` が `"finalize-commit"` を返すことを検証する e2e/integration テストを追加する。
- R15 [should]: tests/e2e/227-forest-e2e.test.js, tests/e2e/231-task-e2e-full-lifecycle.test.js, tests/unit/flow/get-next-action.test.js, tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js, tests/unit/227-post-226-forest-integration/t-a3-no-flat-fallback.test.js の旧順序リテラル `"implement", "gate-impl", "review"` を `"implement", "review", "gate-impl"` に更新する。
- R16 [should]: テンプレート更新後に `sdd-forge upgrade` を実行し、`.claude/skills/sdd-forge.flow/SKILL.md` および `.agents/skills/sdd-forge.flow/SKILL.md` の両方を最新テンプレートと同期する。

## Acceptance Criteria
- R1 適用後、`resolveNodeFor(FLOW_DEFINITION, "impl").children.map(c => c.id)` が `["implement", "review", "gate-impl", "finalize"]` と deep equal で一致する
- R2 の新規 unit test が PASS する
- R3 の新規 unit test が PASS する (実経路 next-action 経由で 3 段階遷移)
- R4 適用後、SKILL.md の旧文言が grep で 0 hit
- R5 適用後、`grep "Skip to step 3" src/flow/prompts/impl/implement.md` が 0 hit
- R6 適用後、`grep "task.update-overview" src/flow/prompts/task/review.md` が 0 hit
- R7 適用後、`run-review.js` の impl review 経路で `next: "gate-impl"` を返す
- R8 適用後、`PASS_NEXT["task-impl"]` が null、`PASS_NEXT["integration"]` が `"finalize-commit"`
- R9 適用後、`STEP_TO_PHASE["gate-impl"]` が `"integration"`、`TASK_STEP_TO_PHASE["gate-impl"]` が `"task-impl"`
- R10 適用後、`grep "--phase task-impl" src/flow/prompts/impl/gate-impl.md` が 0 hit
- R11 適用後、registry.js の `flow run gate` help text に `integration` が含まれる
- R12 適用後、SKILL.md Commands reference の `flow run gate` 行に `integration` が含まれる
- R13 適用後、gate-phase-inference test が新仕様 (flow=integration, task=task-impl) を assert している
- R14 適用後、新規 e2e/integration テストが PASS する (--phase 省略 + flow-level + integration phase で next=finalize-commit)
- R15 適用後、対象 5 ファイル内の旧順序リテラルが新順序に更新されている
- R16 実行後、`.claude/skills/sdd-forge.flow/SKILL.md` および `.agents/skills/sdd-forge.flow/SKILL.md` の該当箇所がテンプレートと一致する
- 既存テスト (tests/unit/flow/commands/review.test.js, tests/unit/flow/get-next-action.test.js, tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js, tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js, tests/unit/227-post-226-forest-integration/t-a3-no-flat-fallback.test.js, tests/e2e/231-task-e2e-full-lifecycle.test.js, tests/e2e/227-forest-e2e.test.js, tests/unit/flow/gate-phase-inference.test.js) が全て PASS する

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Swap gate-impl and review in FLOW_DEFINITION impl children
  - src/flow/definition.js の FLOW_DEFINITION impl branch children 配列で gate-impl ノードと review ノードの位置を入れ替え、各ノードの属性は不変に保つ。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add exact-order unit test for FLOW_DEFINITION impl children
  - FLOW_DEFINITION impl branch children の id 順が `["implement", "review", "gate-impl", "finalize"]` であることを assert する unit test を spec ローカルテストとして追加し、旧順序への回帰を検知する。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add state-based progression unit test via real next-action path
  - GetNextActionCommand の実経路 (state save/reload + findActiveNode 経由) で implement done → review、review done → gate-impl、gate-impl done → finalize-commit の 3 段階遷移を検証する unit test を spec ローカルテストとして追加する。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Update SKILL.md template wording for new impl phase order
  - src/templates/skills/sdd-forge.flow/SKILL.md の frontmatter description および Hard Stops 文言を新順序に整合させる。
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Update impl prompt and task review prompt for new order
  - src/flow/prompts/impl/implement.md の test-only autoApprove path および src/flow/prompts/task/review.md の next-action advance 記述を新順序に整合させる。
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Update PASS_NEXT and impl review next mappings
  - src/flow/lib/run-gate.js の PASS_NEXT および src/flow/lib/run-review.js の impl review 結果の `next` フィールドを新順序に整合させる。
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Reorder gatePhase and add TASK_STEP_TO_PHASE entry for gate-impl auto-resolution
  - FLOW gate-impl の gatePhase 配列を `["integration", "task-impl"]` に並べ替え、TASK_STEP_TO_PHASE に `"gate-impl": "task-impl"` を追加することで、scope に応じた phase 自動解決を実現する。
  - see `tasks/T-7.md` for full spec
- **T-8** [pending]: Remove --phase task-impl from gate-impl prompt
  - src/flow/prompts/impl/gate-impl.md の `sdd-forge flow run gate --phase task-impl` から `--phase task-impl` を撤去し、CLI 自動解決に委ねる形に変更する。
  - see `tasks/T-8.md` for full spec
- **T-9** [pending]: Update gate-phase-inference test for new auto-resolution mapping
  - tests/unit/flow/gate-phase-inference.test.js の既存 assertion を新仕様に更新し、加えて spec ローカルテスト `specs/251-fix-flow-impl-phase-order/tests/gate-phase-inference.test.js` を追加して flow=integration / task=task-impl の双方を独立に検証する。
  - see `tasks/T-9.md` for full spec
- **T-10** [pending]: Update CLI help texts and SKILL.md command reference for gate phases
  - src/flow/registry.js の `flow run gate` help text と src/templates/skills/sdd-forge.flow/SKILL.md の Commands reference を VALID_GATE_PHASES (`draft|spec|task-spec|task-impl|integration`) と整合させる。
  - see `tasks/T-10.md` for full spec
- **T-11** [pending]: Add integration gate test for omitted --phase + flow-level + finalize-commit next
  - flow-level gate-impl が `--phase` 省略で integration phase に解決され PASS 時の envelope `next` が `"finalize-commit"` を返すことを検証するテストを spec ローカル `specs/251-fix-flow-impl-phase-order/tests/gate-impl-integration.test.js` として追加する。
  - see `tasks/T-11.md` for full spec
- **T-12** [pending]: Update stale order literals in e2e and unit tests
  - 5 ファイル (tests/e2e/227-forest-e2e.test.js, tests/e2e/231-task-e2e-full-lifecycle.test.js, tests/unit/flow/get-next-action.test.js, tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js, tests/unit/227-post-226-forest-integration/t-a3-no-flat-fallback.test.js) の旧順序リテラル `"implement", "gate-impl", "review"` を `"implement", "review", "gate-impl"` に更新する。
  - see `tasks/T-12.md` for full spec
- **T-13** [pending]: Run sdd-forge upgrade to sync both skill deploy targets
  - テンプレート更新を `.claude/skills/sdd-forge.flow/SKILL.md` および `.agents/skills/sdd-forge.flow/SKILL.md` の両方に反映する。
  - see `tasks/T-13.md` for full spec
