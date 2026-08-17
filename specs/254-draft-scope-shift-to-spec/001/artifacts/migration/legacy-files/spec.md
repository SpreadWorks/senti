# Feature Specification: 254-draft-scope-shift-to-spec

**Feature Branch**: `feature/254-draft-scope-shift-to-spec`
**Created**: 2026-05-09
**Status**: Draft
**Input**: GitHub Issue #318

## Goal
draft-scope-boundary 起因のもぐら叩きループを解消し、guardrail のライフサイクル管理機構 (phase 空配列 = disabled) を導入する。spec-synthesize-not-copy のような検証不能 guardrail を gate ではなく creation-time prompt 指示として運用する設計に切り替える。

## Background
draft phase の guardrail evaluation で reviewer が QA の異なる箇所を毎回違反として cite するため reason 文字列が変動し、(id, reason) 完全一致前提の防御機構がすべて素通りする問題が発生している。さらに spec phase の guardrail のうち、draft 内容との照合を要するものは reviewer に draft が渡らない構造のため、根本的に検証不能な状態となっている。本 spec はこれら 2 種の問題に対し、対象 guardrail を draft / spec gate 評価対象から外して creation-time 指示に移譲する設計変更を行う。

## Impact on Existing Features
- 対象 2 guardrail (draft-scope-boundary / spec-synthesize-not-copy) は guardrail として評価されなくなる (gate 評価対象から消える)
- guardrail loader (src/lib/guardrail.js) の hydrate は phase 空配列の意味解釈が default 適用から disabled に変わる。他に phase 空配列を意図せず書いている guardrail があれば挙動変化 (現状 base/guardrail.json には該当なしと推定)
- spec / draft creation-time prompt (src/flow/prompts/plan/spec.md, draft.md) に creation 指示と verification step / 移譲ルールが追加される
- spec gate prompt (src/flow/prompts/plan/gate.md) は spec.json 修正前提の手順に変わる
- lint 検証経路 (src/lib/lint.js) は phase 空配列の guardrail を skip するよう挙動変化
- 既存 spec の issue-log に残った 2 guardrail への参照は孤立するが過去記録として保持 (現存 spec の挙動には影響なし)
- spec.json overview.decisions[].text に [VERIFY] / [CORRECTION] prefix エントリが新規格納される (rationale エントリと混在、prefix で識別)
- src/lib/skill-rules.js / src/templates/skills/ / src/presets/ の generated 物 / runtime 動作には変更なし

## Scope
- 対象 2 guardrail を gate 評価対象から外す
- draft creation-time prompt に draft-scope-boundary のルール内容 (要件レベル限定 / 許容される code reference 範囲) を creation-time 指示として移植する
- spec creation-time prompt に synthesize ルール / ソース矛盾 carve-out / draft↔source verification step / 方針修正時のユーザー確認指示を組み込む。spec.json 更新後に sdd-forge spec render を必ず実行する手順を明記する
- spec gate prompt (src/flow/prompts/plan/gate.md) を spec.json 修正前提に書き換え、spec.json 編集 → spec render → 再 gate の手順に正す
- guardrail loader の phase 空配列扱いを disabled 解釈に変更する
- lint 検証経路 (validateLintGuardrails / lint 実行) で phase 空配列の guardrail を skip する
- loader / preset / prompt / lint の機械検証可能テストを追加する
- テストは specs/254-draft-scope-shift-to-spec/tests/ 配下に配置し、各 test ファイルに `// spec: R<N> ...` header を付与する

## Out of Scope
- Issue 末尾派生論点 (spec-test-coverage / prioritize-requirements / complete-context への横展開)
- 防御機構自体の改修 (assertNoRepeatedFail / flip override / previouslyPassedIds の reason 一致前提を緩和する変更)
- spec gate に draft 文書を渡す変更 (creation-time 移譲で代替するため不要)
- 既存 spec の issue-log への過去参照書き換え
- flow CLI 側に draft↔spec 差分検出ロジックを入れる対応
- プロジェクトローカル .sdd-forge/guardrail.json の override 経路の制限 (同 id を override すれば disabled を再有効化できるが、これは override 機構の本来の自由度として保持する)
- src/lib/skill-rules.js の persistent skill rules システム (別の phase 配列体系で empty array は invalid。本 spec の disabled semantics は guardrail.json の meta.phase のみに適用)
- spec step の next-action contextKinds 変更 (source 読みは verification 必要時のみ flow get context --raw を on-demand で使う既存経路を流用)

## Constraints
- alpha 期間ポリシーに従い後方互換コードは書かない
- 外部依存を追加しない
- src/ 配下にプロジェクト固有情報を含めない
- コミットメッセージは英語で書く

## Design Principles
- guardrail のライフサイクル管理を loader 側で支えることで、定義削除なしに無効化できる経路を確立する
- 検証不能な guardrail は gate ではなく creation-time prompt に移し、enforcement timing を明示的に変える
- ユーザー確認は AI の Choice Format で実現し、CLI runtime に確認機構を持ち込まない
- テストは機械検証可能な範囲 (loader semantics / preset 値 / prompt 必須文言) に限定し、AI 挙動 e2e は対象外とする

## Overview
### Modules
- guardrail loader: phase 空配列を disabled として解釈する経路を追加する
- preset guardrail 定義: 対象 2 guardrail の phase を空配列にする
- spec creation prompt: synthesize ルール / carve-out / verification step / ユーザー確認指示を creation-time 指示として記述する
- テストスイート: loader 動作 / preset 値 / prompt 必須要素を機械検証する
- 生成物更新: implementation 完了後 sdd-forge upgrade で .claude/skills 等を再生成する

### Data Flow
- guardrail loader は preset から guardrail 定義を読み込む。phase 空配列のエントリは『どの phase でも評価されない』状態を保持する
- spec creation 時、AI は draft.json を読み込み spec.json を生成する。creation-time prompt の指示に従い synthesize / verification / 必要時のユーザー確認を行う
- verification 結果は spec.json の overview.decisions に記録される (rationale エントリと識別可能な形式で)

### Decisions
- draft-scope-boundary を draft phase で評価しない方針を採る。reason 毎回変動による fail ループを原理的に解消するため、guardrail の機能を放棄して spec の verification step に保険を移譲する。これは『やむを得ず』の選択で、構造側対策が見つかれば revert を検討する
- spec-synthesize-not-copy は spec gate 評価対象から外し、ルール本体と carve-out を spec creation prompt に移植する。spec gate reviewer が draft 文書を持たない構造により、guardrail として書かれている『draft に存在しない内容を捏造するな』が原理的に検証不能であるため、enforcement を creation-time に明示的に変える
- guardrail loader の hydrate を変更し、phase 空配列を disabled として解釈する経路を新設する。これにより guardrail のライフサイクル管理 (有効 → 廃止予定 → 削除) が定義保持のまま可能になる
- ユーザー確認は AI の Choice Format で実現し、CLI runtime に確認機構を持ち込まない。autoApprove 時は既存の auto-select [1] convention により承認扱いとなる。spec creation prompt に autoApprove 分岐ロジックは書かない
- テスト範囲は loader 動作 / preset 値 / prompt 必須要素の 3 軸に限定する。AI 挙動 e2e は対象外
- verification step の出力先は spec.json の overview.decisions[].text とし、verification 完了エントリと correction エントリは prefix で識別可能にする。schema 拡張は行わない
- 本 spec で disable する 2 guardrail 以外で同型ループが再発した場合の follow-up 経路は experimental/workflow.js board に切り出して別 issue 化する。本 spec のスコープは 2 guardrail に限定
- spec step の next-action contextKinds は ['draft', 'guardrail'] のまま変更しない。R5 の verification step で source 読みが必要な場合は flow get context --raw の on-demand 経路を使う。これにより既存の supplement-first context-gathering pattern を壊さない
- phase 空配列 = disabled の semantics は guardrail.json の meta.phase のみに適用する。src/lib/skill-rules.js の persistent skill rules システム (別の phase 配列体系で空配列は invalid な構造) には触らない

## Clarifications (Q&A)
- Q: Issue #318 のスコープを (1)〜(4) の 4 要件として展開するか
  - A: そうする。Issue body は具体策を spec で詰める方針を明記しており、派生論点は別タスク扱い
- Q: Issue (4) の『flow / prompt』の flow とは何を指すか
  - A: 本 spec では spec creation-time prompt を指す。flow CLI の動作変更は行わない
- Q: draft-scope-boundary の緩和方針として完全 disable を採る根拠は
  - A: 文言緩和では reason 毎回変動が止まらずループが解消しないため。Issue 末尾に『保険を spec へ移譲すれば draft 緩和可能』と明記されており、保険を spec verification step に移譲する設計と整合する
- Q: spec-synthesize-not-copy をどう扱うか
  - A: spec gate での guardrail 評価は無効化し、ルール本体と carve-out を spec creation prompt に creation-time 指示として移植する。reviewer に draft が渡らない構造のため、guardrail としては原理的に検証不能であるため
- Q: verification step の検証粒度・出力先・失敗時挙動は
  - A: 実装方針言及部分のみを対象に source 突き合わせを行い、結果を spec.json overview.decisions に prefix 付きで記録する。不一致時は AI が Choice Format でユーザー確認を起動する
- Q: ユーザー確認 prompt の trigger 条件は
  - A: draft の実装方針を spec で別アプローチに置き換える / draft 要件を reject または重大変更する / draft 未記載要件を spec で新規追加する場合に trigger する。文言改善・タイポ修正・rationale 追記・曖昧点の具体化は trigger しない
- Q: ユーザー確認の mechanism と autoApprove での挙動は
  - A: AI の Choice Format で実装する。autoApprove 時は既存 convention により auto-select [1] で承認扱いとなる。CLI runtime に確認機構を追加しない
- Q: テスト戦略は
  - A: loader 動作 / preset 値 / prompt 必須要素の 3 軸を機械検証する。AI 挙動 e2e は対象外
- Q: phase を空配列にできない loader 制約をどう扱うか
  - A: loader hydrate を変更して phase 空配列を disabled として解釈する経路を追加する
- Q: Issue #318 が指摘する構造側問題 (reason 毎回変動で防御機構が効かない) は本 spec で扱うか
  - A: 扱わない。Issue 末尾で派生論点・別タスク扱いと明記されている。再発時の follow-up 経路は board に切り出して記録する
- Q: presets/templates 変更後 sdd-forge upgrade の実行は必要か
  - A: 必要。CLAUDE.md で明示された project rule に準拠する
- Q: decisions.text に rationale (既存) と verification / correction (新規) を混在させる識別方法は
  - A: VERIFY / CORRECTION の prefix を付ける規約を spec creation prompt に明示する。schema 拡張は行わない

## Alternatives Considered
- Issue (1) 単独の先行実装 — Issue が 4 つを一体提案しているため不採用
- flow CLI に draft↔spec 差分検出機構を追加 — 差分判定が複雑、false positive/negative リスクが高い
- draft-scope-boundary の answer field を carve-out 追加 — 実態として QA 長文の cite が続く可能性があり形骸化懸念
- reviewer 評価軸を全体トーン binary 判定に変更 — Issue 末尾派生論点として本 spec のスコープ外
- spec gate に draft 文書を渡して guardrail を機能させる — verification step と二重チェック、redundant
- guardrail エントリ完全削除 — revert 可能性と相性悪い、思想自体を失う
- decisions に kind 等の field 追加 — schema 拡張で additionalProperties false 制約に抵触、影響範囲広い
- 全件突き合わせ verification — 汎用要件まで照合すると AI コスト増
- AI 挙動 e2e テスト — コスト過大

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-09T00:43:26.787Z
- Notes: User approved after spec gate PASS. review-spec was skipped per user decision (3/3 attempts used; 3 latest proposals fully addressed but not reviewed).

## Requirements
- R1 [must]: guardrail loader は phase が明示的に空配列で指定されたエントリをデフォルト値に書き換えず、空配列のまま保持する。phase が undefined / 未指定の場合は従来通り DEFAULT_PHASE (= ['spec']) を適用する。filterByPhase は phase 空配列のエントリを どの phase でも include しない
- R2 [must]: preset の draft-scope-boundary 定義の phase は空配列であり、draft phase の gate で評価されない
- R3 [must]: preset の spec-synthesize-not-copy 定義の phase は空配列であり、spec gate で評価されない
- R4 [must]: spec creation-time prompt に synthesize ルール (整理・抽象化、直接コピー禁止、draft に存在しない内容の捏造禁止、ただしソース矛盾に基づく修正は correction として許可) が含まれる
- R5 [must]: spec creation-time prompt に draft 方針 (実装方針言及部分) を source code に突き合わせる verification step が含まれる。draft 評価を primary input とする既存ガイドラインを踏まえ、verification 必要時のみ minimal な source 読み込みを許可する例外を明示する。verification 結果と correction は spec.json overview.decisions に [VERIFY] / [CORRECTION] prefix を付けた text で記録する (schema 拡張なし、prefix で識別可能化)。text フィールドは schema 上 maxLength 500 のため、prefix + 短文 summary に留め、詳細 (参照ファイル / 矛盾内容) は evidence (maxLength 1000) に記録、それでも収まらない場合は複数 decision エントリに分割する旨を prompt に明記する
- R6 [must]: spec creation-time prompt に draft 方針修正時の AI による Choice Format でのユーザー確認指示が含まれる。autoApprove 時は既存の auto-select [1] convention により承認扱いとする (新たな分岐ロジックを書かない)
- R8 [must]: loader の phase 空配列 disabled 解釈動作が unit test で検証される
- R9 [should]: 対象 2 guardrail が disabled であることが preset test で検証される
- R10 [should]: spec creation-time prompt と draft creation-time prompt に必須要素 (R4 / R5 / R6 / R12 の文言、[VERIFY] / [CORRECTION] prefix 規約) が含まれることが fixture test で検証される
- R11 [must]: lint 検証経路 (validateLintGuardrails と lint 実行) で phase が空配列の guardrail は skip され、warning も出さない
- R12 [must]: draft creation-time prompt に draft-scope-boundary のルール内容 (draft は要件レベルに留める、許容される code reference 範囲を明記) が creation-time 指示として含まれる
- R13 [must]: sdd-forge flow get guardrail <phase> の出力 (markdown / JSON 両形式) は phase 空配列の guardrail を含まない (filterByPhase 経由で自動的に除外される。R1 の loader 改修により担保されるが、明示的に test で確認する)
- R14 [must]: spec creation-time prompt に spec.json 更新後 sdd-forge spec render を必ず実行する手順が明記される (spec.md と spec.json の整合確保)
- R15 [must]: spec gate prompt (src/flow/prompts/plan/gate.md) は『FAIL 時は spec.json を編集 → spec render → 再 gate』の手順を明記する (現状は spec.md を直接編集する記述になっており gate 評価ソース spec.json と乖離)

## Acceptance Criteria
- guardrail loader は phase 空配列のエントリをそのまま空配列で保持する (R1)
- filterByPhase は phase 空配列のエントリをどの phase でも include しない (R1)
- preset 上で draft-scope-boundary と spec-synthesize-not-copy の phase が空配列である (R2 / R3)
- spec creation-time prompt に R4 / R5 / R6 で定義した必須文言と [VERIFY] / [CORRECTION] prefix 規約が機械検証可能な形で含まれる
- draft creation-time prompt に R12 で定義した draft-scope-boundary 内容が機械検証可能な形で含まれる
- lint 検証経路で phase 空配列の guardrail が skip される (R11)
- spec creation prompt に spec render 実行手順が明記される (R14)
- spec gate prompt が spec.json 修正前提に書き換えられる (R15)
- loader / preset / prompt / lint / get-guardrail を検証するテストがすべて pass する (R8 / R9 / R10 / R11 / R13)
- テストは specs/254-draft-scope-shift-to-spec/tests/ 配下に配置され、各 test ファイルに `// spec: R<N> ...` header が付与されている

## Implementation Targets
- src/lib/guardrail.js
- src/lib/lint.js
- src/presets/base/guardrail.json
- src/flow/prompts/plan/spec.md
- src/flow/prompts/plan/draft.md
- src/flow/prompts/plan/gate.md
- specs/254-draft-scope-shift-to-spec/tests/loader-disabled.test.js
- specs/254-draft-scope-shift-to-spec/tests/preset-disabled.test.js
- specs/254-draft-scope-shift-to-spec/tests/prompts-required.test.js
- specs/254-draft-scope-shift-to-spec/tests/lint-skip.test.js
- specs/254-draft-scope-shift-to-spec/tests/get-guardrail-exclusion.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Extend guardrail loader to support phase=[] as disabled
  - guardrail loader が phase 空配列を disabled として解釈する経路を追加し、定義保持のまま評価から外せるようにする
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Disable draft-scope-boundary by setting phase to empty
  - draft-scope-boundary の guardrail 定義の phase を空配列にし、draft phase で評価されない状態にする
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Disable spec-synthesize-not-copy by setting phase to empty
  - spec-synthesize-not-copy の guardrail 定義の phase を空配列にし、spec gate で評価されない状態にする
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Add creation-time guidance to spec creation prompt
  - spec creation prompt に synthesize ルール / ソース矛盾 carve-out / draft↔source verification step / 方針修正時のユーザー確認指示 / spec render 実行手順を creation-time 指示として組み込む
  - see `tasks/T-4.md` for full spec
- **T-12** [pending]: Update spec gate prompt to target spec.json
  - spec gate prompt (src/flow/prompts/plan/gate.md) を『FAIL 時は spec.json を編集 → spec render → 再 gate』の手順に書き換える (現状は spec.md を直接編集する記述で gate 評価ソース spec.json と乖離)
  - see `tasks/T-12.md` for full spec
- **T-5** [pending]: Add unit test for loader phase=[] disabled semantics
  - loader の phase 空配列 disabled 解釈動作を unit test で検証する
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Add preset test asserting target guardrails are disabled
  - 対象 2 guardrail が preset 上で disabled であることを preset test で確認する
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Add fixture test for prompt required content
  - spec creation prompt と draft creation prompt に必須要素が含まれることを fixture test で検証する
  - see `tasks/T-7.md` for full spec
- **T-9** [pending]: Skip phase=[] guardrails in lint validation
  - lint 検証経路 (validateLintGuardrails と lint 実行) で phase 空配列の guardrail を skip するよう変更する
  - see `tasks/T-9.md` for full spec
- **T-11** [pending]: Add integration test for flow get guardrail phase=[] exclusion
  - sdd-forge flow get guardrail <phase> の出力が phase 空配列の guardrail を含まないことを integration test で検証する
  - see `tasks/T-11.md` for full spec
- **T-10** [pending]: Move draft-scope-boundary content to draft creation prompt
  - draft creation prompt に draft-scope-boundary のルール内容を creation-time 指示として組み込む
  - see `tasks/T-10.md` for full spec
