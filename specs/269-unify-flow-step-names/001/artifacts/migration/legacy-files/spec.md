# Feature Specification: 269-unify-flow-step-names

**Feature Branch**: `feature/269-unify-flow-step-names`
**Created**: 2026-05-29
**Status**: Draft
**Input**: GitHub Issue #347

## Goal
flow definition の step ID を `<phase>-<concern>-<action>` 規則へ統一し、bare 名（review/gate/gate-impl 等）を解消する。命名規則を src/AGENTS.md に明文化し、コード・プロンプト・テスト・skill の全参照を新名へ更新する。過去 spec データの旧名は src/ 同梱の移行ツールで一括変換し、CHANGELOG に breaking change として記載する。alpha 期間のため旧名互換 alias は追加しない。

## Background
src/flow/definition.js の step 名は impl 実装以降に追加された step が phase 接頭辞なしのまま残り、bare な review / gate / gate-impl が flow / task / phase のどれを指すか文脈依存になっている。これにより skill / docs / 過去 spec とのテキストマッチングが曖昧になり、将来の phase 別 metrics 集計（4d21）でも判別が必要。step 名を `<phase>-<concern>-<action>` 規則へ統一することで、step ID 単体から所属 phase を読めるようにする。改名マッピングは distinct 旧名 10 種・改名エントリ 12 件で、うち 7 種は 1:1、3 種（review/gate-impl/impl）は flow/task scope で 2 新名へ分岐する。step id は公開 CLI 引数・skill 記載インターフェースのため破壊的変更であり、alpha ポリシーに従い旧名 alias は設けず移行ツールと CHANGELOG で移行を支援する。

## Scope
- [must] src/flow/definition.js の step id 改名（distinct 旧名 10 種・改名エントリ 12 件）と branch id (plan/impl)・維持リストの不変保持
- [must] src/flow/draft-review-routes.js / src/flow/registry.js 等の step id 参照更新
- [must] instructionsKey とプロンプトファイル src/flow/prompts/<branch>/<step>.md の新 step id への改名（branch ディレクトリ構造維持）
- [must] tests/unit/flow/** の step id assertion 更新と unit スイート緑化
- [must] skill テンプレートの step 名更新と sdd-forge upgrade による installed skill copies への反映（authored sources + installed copies で旧名 grep 0 件）
- [should] src/AGENTS.md への命名規則明文化
- [must] 破壊的変更の移行計画: src/ 同梱の移行ツール（1:1 の 7 種は値置換、flow.json 衝突名 3 種は構造判別、issue-log 衝突名は据え置き、active flow 除外、dry-run default + --apply、git clean 前提、precondition 失敗時 非0 終了）＋ 本リポジトリ過去 spec への適用コミット ＋ CHANGELOG への breaking change 記載

## Out of Scope
- rename リスト外の legacy step 名（retry-recovery / merge / commit / prelude / review-draft / review-repair 等）の変換
- issue-log.json の衝突名 3 種（review / gate-impl / impl）の変換（scope 情報が無いため据え置き）
- gate / review の評価ロジックそのものの変更
- flow の遷移順序・挙動の変更、新規 step の追加
- 生成済み docs/ の手動 0 件検証（sdd-forge build で再生成）

## Constraints
- alpha 期間ポリシー: 後方互換シム・旧名 alias を追加しない。旧名は完全に廃止する。
- backward-compatible-cli-interface: step id は `sdd-forge flow set step <id> <status>` 等の公開 CLI 引数値かつ skill/docs 記載のインターフェースである。旧名を alias 無しで廃止する破壊的変更だが、移行計画（src/ 同梱の移行ツール + CHANGELOG への旧名廃止・再走手順・merge 前提の記載）を必須対応として提供することで本ガードレールの migration plan 要件を満たす。
- プロンプトファイル改名・instructionsKey 更新・definition 更新は同一コミットで行う（一貫性原則）。
- bounded-resource-usage: 移行ツールはコミット済みの有限な specs/ ファイル集合を 1 パスで走査するのみで、再帰・リトライ・無限ループを持たない。各ファイルは 1 回だけ読み書きする。
- 移行ツールは active flow（.active-flow が指す spec）の flow.json を変換対象から除外する。rename の merge 前提として『他に active flow が無いこと』を要求する。

## Design Principles
-

## Overview
### Modules
- src/flow/definition.js — step id / instructionsKey の単一 source of truth
- src/flow/draft-review-routes.js — draft review 系 step id の集約点
- src/flow/registry.js — review post-hook で step id をハードコード参照
- src/flow/lib/get-step-instructions.js — instructionsKey から prompts/<branch>/<step>.md を解決
- src/flow/prompts/<branch>/<step>.md — step と 1:1 のプロンプト
- src/scripts/ — 新規の過去データ移行ツール（配布対象）

### Data Flow
- definition.js の step id → registry post-hook / routes / instructionsKey → prompts ファイル
- 移行ツール → specs/*/flow.json（構造判別）・issue-log.json（1:1 のみ）・report/retro/review（コードブロック内）

### Decisions
- [VERIFY] 改名マッピング全 12 エントリ（distinct 旧名 10 種）を definition.js の実構造と突合。FLOW_DEFINITION/TASK_DEFINITION の双方に review・gate-impl が存在し、衝突 3 種（review/gate-impl/impl）は scope で 2 新名へ分岐。残る 7 種は 1:1。result=match。
- [VERIFY] instructionsKey は `<branch>.<step>`、プロンプトは src/flow/prompts/<branch>/<step>.md で 1:1。get-step-instructions.js がファイル名を解決。改名は branch ディレクトリ構造を維持し新 step id へ。result=match。
- [VERIFY] registry.js は plan review(review-spec, spec-review-triage)/test review(review-test)/impl review(review) の post-hook で step id をハードコード参照。draft review 系は draft-review-routes.js 経由で動的参照。改名時は registry.js のリテラルと routes 定義を更新する。result=match。
- 決定: issue-log.json の衝突名は据え置き。エントリが {step,reason,trigger,resolution,timestamp} のフラット構造で scope を持たず、推測変換は誤った属性を歴史データに刻むため。1:1 の 7 種のみ変換し、4d21 metrics は新名前提で旧名残存を集計除外できる。
- 決定: sdd-forge CLI はメインリポジトリへ symlink され、merge 時に旧名が全フローへ即時反映される。移行ツールは active flow の flow.json を除外し、merge 前提を CHANGELOG に明記する。active flow の flow.json を改名すると旧定義で駆動中の CLI が in_progress step を解決できず破壊するため。
- [IMPACT] 影響を受ける既存機能: (1) 公開 CLI `sdd-forge flow set step <id> <status>` の引数値（旧 step id は廃止、新名のみ受理）; (2) `sdd-forge flow run gate/review --phase <p>` 等の phase→step 解決（gate-step.js / registry.js 経由）; (3) `sdd-forge flow get next-action / status` の in_progress step 解決（definition.js の order map）; (4) skill / docs に記載の step 名インターフェース; (5) 過去 spec の flow.json / issue-log 等のデータ（移行ツールで変換）。影響を受けないもの: flow の遷移順序・挙動、gate / review の評価ロジック、step の個数・構造。

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- プロンプトを prompts/<step>.md にフラット化し instructionsKey=step id にする — loader の <branch>.<step> 規約変更と dir 再編で diff が拡大するため不採用。branch ディレクトリ構造を維持し新 step id へ改名する方式を採用（impl.impl-review の phase 二重化は許容）。
- issue-log.json の衝突名を flow scope 新名にデフォルト統一 — issue-log エントリは scope を持たず推測変換は誤属性を刻むため不採用。衝突名は据え置きとし誤変換ゼロを優先。
- 移行ツールを scripts/（非配布）に置く — npm files=src/ のため scripts/ は配布されず、旧名 flow.json を持つユーザーが移行できない。src/ 配下に置き配布する方式を採用。
- backward-compatible-cli-interface: 旧 step 名の互換 alias を残す — alpha ポリシーで後方互換コードを持たないため不採用。旧名は廃止し、移行ツールと CHANGELOG（再走手順・merge 前提）で破壊的変更の移行を支援する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-29T04:31:31.635Z
- Notes: User approved gate-passed spec after interactive draft Q&A (q1-q6) and spec review fixes (cross-scope conflict-id rule, spec-local test coverage, impact listing, diff-verifiable R8).

## Requirements
- R1 [must]: src/flow/definition.js の step id を改名マッピング全 12 エントリ通り更新する: review[impl]→impl-review, gate→spec-gate, gate-draft→draft-gate, gate-impl[flow]→impl-gate, review-draft-questions→draft-questions-review, review-draft-coverage→draft-coverage-review, review-spec→spec-review, review-test→test-review, impl[task]→task-impl, review[task]→task-review, gate-impl[task]→task-gate, spec-review-triage→spec-triage。branch id (plan/impl) と維持リスト（draft, spec, test, draft-refine, draft-questions-triage/repair, draft-coverage-triage/repair, spec-repair, test-execute, test-result-review, finalize-*, prepare-spec, branch, approval, scenario-validity, implement, retro, final-regression）は不変。
- R2 [must]: src/flow/lib/draft-review-routes.js の route 定義と src/flow/registry.js の review post-hook、および src/flow/lib/ 配下で旧 step id を bare 文字列参照する全箇所を新名へ更新する。衝突 id（review/gate-impl/impl）が混在する cross-scope コード箇所は、その site が属する scope で新名を解決する: (a) src/flow/lib/task-scope.js の BROAD_STEPS（flow 非 task の broad 実装パス）→ ["implement"(維持), "impl-review", "impl-gate"]; (b) src/flow/lib/gate-step.js の TASK_STEP_TO_PHASE（task gate map）→ {"spec-gate":"task-spec", "task-gate":"task-impl"}、および resolveGateStepId の fallback "gate" → "spec-gate"; (c) src/flow/registry.js の REVIEW_RUNTIME_STEP_BY_PHASE → {spec:"spec-review", test:"test-review", impl:"impl-review"}。一般規則: flow path の衝突 id は impl-*/spec-gate、task cursor path の衝突 id は task-* に解決する。完了判定として src/flow 配下の旧 step id bare リテラル（rename リスト対象 10 種）の grep が 0 件であること。
- R3 [must]: instructionsKey を新 step id へ更新し、対応する src/flow/prompts/<branch>/<step>.md を新 step id のファイル名へ改名する（<branch> ディレクトリ構造は維持）。get-step-instructions.js が新ファイル名を解決し、instructions-coverage 系テストが全 step で対応プロンプトを見つけられる。
- R4 [must]: tests/unit/flow/** の step id assertion を新名へ更新し、npm test の unit スイートが全て pass する。
- R5 [must]: skill テンプレート（src/skills/ 配下）の旧 step 名を新名へ更新し、sdd-forge upgrade で installed skill copies（.claude/skills, .agents/skills）へ反映する。authored sources（src/ コード/skill/prompts）と installed skill copies に対する旧 step 名の grep が 0 件になる（rename リスト外 legacy 名・issue-log 据え置き衝突名は対象外）。
- R6 [should]: src/AGENTS.md に `<phase>-<concern>-<action>` 命名規則（phase/concern/action の定義と例、phase 接頭辞必須）を明文化する。
- R7 [must]: src/ 配下（src/scripts/rename-phase-steps.js）に移行ツールを実装する。仕様: 1:1 の 7 種は step 値の完全一致で置換; flow.json の衝突 3 種（review/gate-impl/impl）は steps[]（flow scope）と tasks[].steps[]（task scope）の構造位置で新名を判別; issue-log.json の衝突 3 種は据え置き; report.json/retro.json/review.md はコードブロック・パス文字列内のみ置換; active flow（.active-flow が指す spec）の flow.json を除外。ユーザー向け引数は --apply（boolean, 省略時 dry-run で diff のみ表示）。終了コード規約: 成功（dry-run 含む）は 0、git 作業ツリーが clean でない/不正な引数/書込みエラーは非0。--apply は実行前に git clean を検証する。
- R8 [must]: 移行ツールを本リポジトリ specs/ に --apply で実行し、specs/*/flow.json・report.json・retro.json・review.md 内の rename 対象旧名（1:1 の 7 種、および flow.json の衝突名は構造判別による新名）が新名へ変換されていること。active flow 269 の flow.json は変換されず旧名のまま残ること。issue-log.json の衝突名は据え置かれること。変換有無は適用後の各ファイル内容（diff）で検証できる。
- R9 [must]: CHANGELOG.md に breaking change を記載する: 旧 step 名を alias 無しで廃止したこと、移行ツールの使用方法、『他に active flow が無いこと』という merge 前提、flow.json を含む既存 PR/branch は merge 後にツール再走が必要なこと。

## Acceptance Criteria
- definition.js の leaf step id が R1 のマッピング通りに更新され、維持リストと branch id が不変である（flow-steps 系テストで検証）。
- draft-review-routes.js / registry.js / lib の step id 参照が新名に揃い、flow get next-action が新 step を正しく解決する。
- 全 step の instructionsKey が prompts/<branch>/<新step>.md に解決され、instructions-coverage テストが pass する。
- npm test の unit スイートが全て pass する。
- authored sources + installed skill copies への旧 step 名 grep が 0 件（rename リスト外 legacy 名・issue-log 据え置き衝突名を除く）。
- src/AGENTS.md に命名規則セクションが存在する。
- 移行ツールが fixture に対し dry-run/--apply で期待通り動作する（1:1 値置換、flow.json 構造判別、issue-log 衝突名据え置き、active flow 除外）ことを spec-local テストで検証し、git not clean / 不正引数で非0 終了する。
- 本リポジトリ specs/ への移行が適用コミットされ、active flow 269 の flow.json が変換されていない。
- CHANGELOG.md に旧名廃止・移行ツール・merge 前提・再走手順が記載されている。

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Rename step identities in the flow definition layer
  - src/flow/definition.js の step id・instructionsKey と src/flow/draft-review-routes.js の route step id を改名マッピング通り更新し、対応するプロンプトファイルを新名へリネームする（step の identity を一括改名する単一 concern）。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Update step-id references in registry and lib consumers
  - src/flow/registry.js の review post-hook と src/flow/lib/ 配下で旧 step id を文字列参照している箇所を新名へ更新する。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Update flow unit test assertions to new step ids
  - tests/unit/flow/** の step id assertion を新名へ更新し unit スイートを緑化する。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Update skill templates and propagate to installed copies
  - src/skills/ 配下の skill テンプレートの旧 step 名を新名へ更新し、sdd-forge upgrade で installed skill copies へ反映する。
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Document naming convention in src/AGENTS.md
  - `<phase>-<concern>-<action>` 命名規則（定義・例・phase 接頭辞必須）を src/AGENTS.md に明文化する。
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Implement historical-data migration tool under src/scripts
  - src/scripts/rename-phase-steps.js を実装する。1:1 の 7 種は値置換、flow.json 衝突名は構造判別、issue-log 衝突名は据え置き、report/retro/review はコードブロック内のみ、active flow 除外、dry-run default + --apply、git clean 前提、終了コード規約。
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Apply migration to this repo's historical specs and commit
  - 移行ツールを本リポジトリ specs/ に --apply で実行し（active flow 269 除外）、変換結果を 1 コミットで記録する。
  - see `tasks/T-7.md` for full spec
- **T-8** [pending]: Record breaking change in CHANGELOG.md
  - 旧名廃止（alias なし）・移行ツール使用方法・『他に active flow 無し』merge 前提・既存 PR/branch の再走手順を CHANGELOG.md に記載する。
  - see `tasks/T-8.md` for full spec
