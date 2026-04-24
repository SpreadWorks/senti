# Feature Specification: 226-complete-task-decomp-wiring

**Feature Branch**: `feature/226-complete-task-decomp-wiring`
**Created**: 2026-04-24
**Status**: Draft
**Input**: GitHub Issue #256

## Goal
spec 215 で着手されながら未配線のまま放置されている「タスク分解機能」の本体を、plan 入口からタスク完了遷移まで production で動作する状態にする。タスク分解の入口強制、タスク個別仕様書の自動生成、forest 構造の運用配線、タスク遷移の自動化、手動制御 CLI、task-scope step の再編を含む。既存 flow.json の救済と dogfood 検証は後続 Issue (board draft 3f91) で実施する 2 spec 分割方針。

## Background
spec 215-flow-task-decomposition は cac6 計画の「誰がタスクを addTask するか」を埋めるメタ spec としてマージされたが、Issue #256 で以下の Critical 欠陥 A-E が指摘された: (A) plan phase で AI に tasks[] を書かせる指示が plan/spec.md / draft.md / SKILL.md のどこにもない、(B) state.currentTaskId を非 null に書く production caller が存在しない (FlowManager.addTask は存在するが呼び出し元なし)、(C) completeTask() も同様に production caller なし、(D) task.spec が指す specs/<spec>/tasks/<id>.md path に markdown を書き込む実装が存在しない、(E) タスクライフサイクル CLI が registry.js に存在しない。加えて、テスト側では specs/215-flow-task-decomposition/tests/scenario-reopen-flow.test.js が task 状態遷移を flow.json 直接編集で代用し、production path の不在を隠蔽していた。さらに、spec 196 (cac6/T2) で Task.parent フィールドが schema に追加されたが運用経路は配線されず、「schema 先行、運用未配線」パターンが spec 215 でも繰り返された。結果として全 300+ spec で flow.json.tasks[] が空のまま運用されている。本 spec 226 はこの系譜の配線完成を担う。関連 spec と詳細な事実確認結果、議論過程は reference.md を参照。

## Scope
- タスク単一責任 guardrail (task-single-responsibility) の新設、phase=[spec, task-spec] で各タスクの concern 単一性を評価
- plan 系 prompt (spec.md, draft.md) へのタスク分解ルールと抽象的予告の追加
- spec.json のタスク定義スキーマを構造化 (goal 必須、acceptance / implementation_notes / test_strategy / parent を optional で新設、description を削除)
- spec render が spec.json のタスク定義から各タスクごとの markdown (specs/<spec-dir>/tasks/<task-id>.md) を自動生成
- forest 構造の運用配線 (sync-spec-tasks が parent を転写、get-next-action が forest を理解、completeTask が親子 propagation)
- タスク遷移の自動化 (spec 承認後の最初タスクの auto-promote、gate-impl PASS 後の次タスク promote、全タスク done での flow-scope 遷移)
- 手動制御 CLI (sdd-forge flow run start-task / complete-task) を registry に追加
- spec gate に新規 spec でタスク定義が空配列または未定義の場合 FAIL する判定ロジックを追加
- task-scope step 構成を 7 step から 5 step に再編 (write-tests, impl, run-tests, review, gate-impl)。approval と task-spec gate と update-overview 独立 step を削除
- update-overview が担っていた parent spec.json.overview への task 貢献追記は `sdd-forge flow run update-overview --json <additions>` CLI として production caller を提供 (persistOverviewUpdate helper の公開経路)

## Out of Scope
- run-impl.js の post-hook 等で overview merge を impl 実行パスに**自動**統合すること (本 spec では CLI として提供、呼び出しは AI に委ねる。完全な自動 wire は board draft 3f91)
- get-next-action.resolveTarget 内での forest traversal の直接呼び出し (本 spec では promoteNextPending で forest 順制御、完全な resolveTarget 側統合は board draft 3f91)
- 本 spec 自身の placeholder テスト (it.todo) の実テストへの展開 (本 spec では scaffolding として placeholder を配置、実テスト展開は board draft 3f91 の forest dogfood に含める)
- 既存 flow.json 261 件の一括マイグレーション (board draft 3f91)
- FlowStore.load の strict 化 (tasks[] 空で throw、board draft 3f91)
- get-next-action の flat fallback 経路の完全廃止 (board draft 3f91)
- spec 215 の scenario-reopen-flow.test.js の削除 (board draft 3f91)
- 新 E2E integration test の追加 (board draft 3f91)
- forest 構造での自 spec dogfood の実施 (board draft 3f91)
- gate-impl REQ-SPEC 甘判定対策 (board draft 212f)
- phaseToSkill dead reference 解消 (board draft fd80)
- 並列 task 実行 (spec 196 方針踏襲、将来破壊的拡張として留保)
- consumer project 側の既存 active flow の新形式への移行 (board draft 3f91 の migration script 適用後に consumer が実施)

## Constraints
- 外部依存禁止 — Node.js 組み込みモジュールのみ使用 (project CLAUDE.md)
- alpha 版ポリシー — 後方互換 shim を書かない。旧フォーマット・非推奨パスは保持せず削除
- src/ にプロジェクト固有情報を埋め込まない (project CLAUDE.md)
- 過剰防御コード禁止 — 内部インターフェースは信頼。バリデーションはシステム境界でのみ行う
- OOP による型表現 — TypeScript 非採用方針のため、意味のある値は専用クラスで invariant を強制する
- テストを通すためにテストコードを修正してはならない (project CLAUDE.md)
- Bounded resource usage — タスク forest の深さ上限は 10 階層。深さ 10 を超える階層構造の spec.json は spec gate が FAIL する
- Bounded resource usage — forest traversal / completeTask の親子 propagation の反復および再帰の上限は tasks[] の maxItems=200 を超えない。schema の maxItems=200 により自然に bounding される
- Bounded resource usage — sync-spec-tasks の auto-promote loop は tasks[] を一度スキャンするだけの線形処理であり、tasks の maxItems=200 で bounding される

## Design Principles
- Single Source of Truth — spec.json がタスク情報の正。tasks/<id>.md は spec render の生成物 (手動編集禁止)
- Forest structure for decomposition — 親 task = concern 境界 (review/test が閉じる単位)、子 task = 作業単位 (1 diff に集中)
- Single Responsibility per task — 1 task 1 concern。guardrail で proactive (prompt) と reactive (gate) の両輪で強制
- Append-only task history — 承認済みタスクの識別属性 (id / origin / added_round) は不変 (spec 215 踏襲)。spec.json からの task 削除は発生しない
- Production path wiring — schema 先行パターンを避け、production caller を同一 spec 内で配線する
- Staged migration — 破壊的変更は既存データへの影響を段階的に (本 spec では新規 spec のみ新スキーマ、既存 flow は flat fallback 維持、完全移行は board draft 3f91)
- Separation of state mutation and lifecycle promotion — completeTask は自身の状態遷移 (status=done) と親子 propagation に限定し、次タスクへの auto-promote は独立関数として分離する。これにより手動 CLI で「完了するが次は起動しない」ケースを表現可能にする
- Single auto-promote caller boundary — auto-promote 関数は単一実装とし、呼び出し箇所は (1) sync-spec-tasks の末尾 (初回 promote)、(2) gate-impl PASS post-hook (次 task promote) の 2 箇所のみ。completeTask からは呼ばない
- Thin CLI wrapper — start-task / complete-task CLI は flow-store primitive と auto-promote 関数の薄い wrapper。validation は primitive 側 (throw) に委譲し、CLI は envelope 整形のみを担う

## Overview
### Modules
- src/presets/base/guardrail.json: task-single-responsibility guardrail エントリ追加 (phase=[spec, task-spec])
- src/flow/prompts/plan/spec.md: Task Decomposition Rules セクション追加、タスク構造化フィールドの記入指示
- src/flow/prompts/plan/draft.md: 後続 spec 段階でのタスク分解前提を抽象的に予告
- src/flow/schemas/spec.schema.json: tasks[*] の description 削除、goal/acceptance/implementation_notes/test_strategy/parent 新設
- src/flow/lib/sync-spec-tasks.js: spec.json の parent を flow.json.tasks[*] に転写、sync 末尾で currentTaskId auto-promote (forest leaf 優先)
- src/flow/lib/get-next-action.js: flat fallback 経路は維持 (完全廃止は 3f91)。forest 順の遷移は promoteNextPending 経由で制御 (resolveTarget 内での forest traversal 直接呼び出しは 3f91 の scope)
- src/lib/flow-store.js: completeTask に親子 propagation 追加 (全子 done で親 done)
- src/spec/commands/render.js: spec.json.tasks[*] から tasks/<id>.md を自動生成
- src/flow/lib/run-gate.js: spec gate が tasks[] 空配列を FAIL に判定
- src/lib/flow-helpers.js: TASK_STEPS_PLAN を 7 step から 5 step に再編
- src/flow/schemas/context-rules.json: task scope から approval/gate/update-overview を削除、gate-impl を追加
- src/flow/registry.js: start-task / complete-task コマンド登録
- 新規 src/flow/lib/run-start-task.js, run-complete-task.js: CLI 実体
- src/flow/prompts/task/: approval.md, gate.md, update-overview.md を削除、impl.md に overview 追記指示を統合

### Data Flow
- plan phase: AI が spec.json.tasks[*] に構造化フィールド (goal, acceptance, implementation_notes, test_strategy, parent) を記入
- spec render: spec.json を入力として spec.md と各 tasks/<id>.md を deterministic に生成
- spec gate: tasks[] 空配列または未定義を FAIL と判定
- flow approval: spec.json.tasks[] と flow.json.tasks[] の差分を sync-spec-tasks が反映し、parent を転写、sync 末尾で最初の pending task を currentTaskId に auto-promote
- task-scope loop: write-tests → impl (実装 + spec.json.overview 追記) → run-tests → review → gate-impl
- gate-impl PASS post-hook: completeTask(current) → 親子 propagation (全子 done で親 done) → 次 pending を auto-promote (forest 順)
- 全 task done: currentTaskId = null、flow-scope の finalize step へ遷移

### Decisions
- 本 spec は forest 配線の本体のみを担う (226)。既存 flow 救済と dogfood 検証と新 E2E test は後続 Issue (board draft 3f91) に分離
- spec.schema.json の tasks[*] を新スキーマに変更。description を削除し構造化フィールドを追加。既存 326 spec.json は全件 tasks undefined のため影響なし
- task-scope step を 7 → 5 に再編。approval は spec 全体の approve 意味を重複させるため削除。task-spec gate は生成物 (tasks/<id>.md) を評価する SSOT 違反のため削除。update-overview 独立 step は boilerplate のため impl に統合
- completeTask 発火契機は gate-impl PASS post-hook (現行の update-overview done から変更)
- task.spec は tasks/<id>.md パスを指す (cac6 原設計復元)。途中で検討した spec.md アンカー形式は撤回
- 本 spec 226 自身の spec.json.tasks[] は現行 schema (description 形式) で記述し、flat list (parent=null) とする。実装完了後の自 spec 書き直しは 3f91 で実施
- spec 196 から続く「schema 先行、運用未配線」パターンを避けるため、新規 field / API を追加するときは production caller を同一 spec 内で配線する設計原則を遵守
- forest traversal のアルゴリズムは deterministic: 深さ優先 (DFS、pre-order)、兄弟は spec.json.tasks[] の配列記述順。leaf 判定は「children が存在しない」または「全 children が status=done」。同一入力で結果が変わらないことを保証する
- spec gate の tasks 空 FAIL 判定は pre-AI の structural check 層に追加する。JSON schema の required には追加しない (既存 326 spec.json は tasks undefined のため影響を受けないため)。guardrail 評価層 (AI) にも入れない (決定的検証のため)
- spec gate の適用対象は active flow (flow.json が存在する spec) のみ。既存 merged spec (flow.json cleanup 済み) は gate の呼び出し対象外のため、226 の破壊的変更は影響しない
- spec render の tasks/<id>.md 生成は additive only。spec.json にあるタスクに対応する md のみ書き込み、spec.json から削除されたタスクの md (orphan) は物理削除しない。spec 215 の append-only 原則により task 削除は想定外なので orphan は発生しない

## Clarifications (Q&A)
- Q: この理解で進めるか (Q1)
  - A: 提示した Goal + Scope の要約で合意。詳細は reference.md セクション 3 を参照
- Q: flat implementation 経路の扱い (Q2)
  - A: 必須化する方針で合意。ただし既存 flow.json 救済を含む破壊的適用は後続 Issue 3f91 に分離し、本 spec では新規 spec のみを spec gate で reject する形にする
- Q: 既存 flow.json の migration 方式 (Q3)
  - A: spec 208 パターン踏襲 (一度きり script)。ただし本 spec の scope 外 (3f91 に移動)
- Q: Acceptance Criteria の定義 (Q4)
  - A: E2E integration test と dogfood の両輪を当初予定していたが、Q12 の 2 spec 分割により E2E と dogfood は 3f91 に移動。本 spec では unit + 最小 integration で検証
- Q: タスク遷移の配線設計 (Q5)
  - A: 完全自動化。spec 承認時の auto-promote、タスク完了時の次タスク遷移、親子 propagation、全タスク完了時の後続フェーズ移行、手動制御 CLI も併設
- Q: tasks[] 生成指示の配置 (Q6)
  - A: spec.md prompt を強化 + draft.md に抽象的予告のみ追加。guardrail Draft Stays at Requirements Level と整合
- Q: 既存 spec 215 scenario test の扱い (Q7)
  - A: 削除。ただし本 spec の scope 外 (3f91 に移動)。個別関数の unit test は tests/unit/flow/ 配下で既存カバレッジあり
- Q: gate-impl 甘判定対策 (Q8)
  - A: 本 spec の scope 外 (board draft 212f で独立追跡)
- Q: タスク粒度 guardrail の導入 (Q9)
  - A: task-single-responsibility guardrail を spec / task-spec phase で新設。reactive (gate) + proactive (prompt) の両輪で運用
- Q: タスク粒度の設計思想 (Q10)
  - A: タスクは品質が担保される最小単位として設計。1 task 完了で 1 concern が閉じる粒度
- Q: forest 構造の現状 (Q11)
  - A: schema には parent フィールドが存在 (spec 196) だが運用未配線。本 spec で forest traversal と親子 propagation を実装
- Q: bootstrap 問題と 2 spec 分割 (Q12)
  - A: 2 spec に分割。spec 226 = forest 配線の本体、board draft 3f91 = 既存 flow 救済と forest dogfood と新 E2E test
- Q: schema 変更の後方互換性 (Q13)
  - A: 既存 326 spec.json は全件 tasks undefined のため schema 変更の影響なし。tasks 必須化は spec gate 側の判定ロジックで行い、schema の required には追加しない
- Q: 他 worker の作業中 flow との衝突 (Q14)
  - A: 本プロジェクト内に並行 worktree は存在せず。本 spec は flat fallback 経路を維持するため既存 active flow への影響なし
- Q: sdd-forge upgrade の consumer 影響 (Q15)
  - A: 本 spec は skill テンプレートを変更しないため、consumer の追加 upgrade 不要。npm update のみで反映
- Q: prompt 変更の AI agent への影響 (Q16)
  - A: 既存 agent test は plan 系 prompt を参照しないため壊れない。本 spec では prompt への追加指示の存在を静的に検証する unit test のみ行う。実効性検証は 3f91 の forest dogfood
- Q: 並列 task 実行のスタンス (Q17)
  - A: 現 task id は単数を維持 (spec 196 方針踏襲)。並列化は将来の独立 spec で破壊的拡張として扱う
- Q: phaseToSkill dead reference (Q18)
  - A: 本 spec の scope 外 (board draft fd80 で独立追跡)
- Q: task-level 仕様書と spec.json の構造化 (Q19)
  - A: spec.json SSOT 原則に従い、spec render で tasks/<id>.md を自動生成。spec.json.tasks[*] を構造化 (goal/acceptance/implementation_notes/test_strategy/parent)、description 削除
- Q: task-scope step の再設計 (Q20)
  - A: 7 step → 5 step に再編 (write-tests, impl, run-tests, review, gate-impl)。approval / task-spec gate / update-overview 独立 step を削除。completeTask 発火契機は gate-impl PASS

## Alternatives Considered
- task.spec を spec.md のアンカー形式 (#task-<id>) にする — 却下。description 2000 文字では task 詳細を十分に書けず、cac6 原設計 (spec 196 の tasks/<id>.md) を壊す。spec.json を構造化して tasks/<id>.md を自動生成する方が SSOT 原則と整合する
- 226 を 1 spec 内の 2 phase で実装 (phase1 で forest 配線、phase2 で forest 自己適用) — 却下。spec.json.tasks[] は静的な spec で時系列概念を持たないため、phase 概念は reopen-draft 経由でしか表現できず、schema と運用が再度乖離する (spec 215 パターン再発)
- flat で実装、最後に forest を反映 (1 spec 単独) — 却下。実装中に forest 運用を体験せず、dogfood が形骸化する。Acceptance が E2E test 頼みになり、forest の実運用検証ができない
- task-scope に独立した task-spec gate を残す — 却下。tasks/<id>.md は spec render の生成物で SSOT は spec.json。gate で markdown 修正すると SSOT 違反。task 仕様の検証は親 spec gate で済む
- task-scope に独立した approval step を残す — 却下。spec 全体で task 粒度を含め approve 済み。task 毎の再 approve は spec approve の semantics を解体し、UX 負担 (タスク数分の approval)。粒度見直しは reopen-draft で対応 (spec 215 機構)
- update-overview を独立 step として残す (spec 207 設計通り) — 却下。step 分離すると boilerplate (実装 → 追記 JSON → merge の 2 度手間)。impl step 内で AI が spec 207 ヘルパー (applyOverviewAdditions) を呼ぶ方が自然
- task-single-responsibility guardrail を spec phase のみ (task-spec は除外) — 却下。タスク粒度は task 単位で評価しないと意味が薄れる。spec 全体の Single Responsibility (unrelated changes bundle 禁止) と task 単位の粒度制約は異なる concern
- spec.json.tasks[*] に description を残しつつ goal 等を追加する — 却下。description 2000 文字は task 詳細を書くには足りず、構造化もされていない。ユーザー指示で description を削除して構造化のみで表現する方針に合意
- 226 scope に既存 flow.json migration と 215 test 削除と新 E2E test を含める — 却下。226 self-dogfood の bootstrap 問題が生じる (forest 経路を実装中に forest で動かすことができない)。Single Responsibility guardrail にも抵触。board draft 3f91 に分離
- 並列 task 実行を 226 で導入する — 却下。並列化は gate / review / merge / lock 等に波及する大きな変更で、本 spec の concern (forest 配線) と独立。spec 196 方針踏襲で将来破壊的拡張として留保
- gate-impl REQ-SPEC 甘判定対策を 226 scope に含める — 却下。gate 機構の本質的強化は本 spec の concern (タスク分解配線) と独立。board draft 212f で独立追跡
- phaseToSkill dead reference 解消を 226 scope で片付ける — 却下。skill 名マッピング bug は 226 の concern と独立。他にも legacy reference 調査が必要な可能性があり、board draft fd80 で追跡

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-24T02:59:42.550Z
- Notes: Q1-Q20 の議論 + 他 AI レビュー 8 項目の対応を経て承認

## Requirements
- REQ-1: [P1] When 新規 spec の spec.json にタスク定義が空配列または未定義の状態で spec gate が実行される時、shall spec gate は FAIL verdict を返し、non-zero exit code で終了する
- REQ-2: [P1] When AI が plan フェーズで spec.json のタスク定義を記入する時、shall 各タスクは構造化されたフィールド群 (goal, acceptance, implementation_notes, test_strategy, parent) で記述される
- REQ-3: [P1] When spec.json のタスク定義スキーマが検証される時、shall goal フィールドは必須であり、acceptance / implementation_notes / test_strategy / parent は optional として受け入れられる
- REQ-4: [P2] When spec の approval post-hook が実行された時、shall 最初に実行すべき pending タスク (forest 構造の leaf を優先) が currentTaskId として自動的に設定される
- REQ-5: [P2] When 実行中のタスクが完了判定の契機 (task-scope の gate-impl step が PASS) に達した時、shall 次の pending タスクが currentTaskId として自動的に設定される
- REQ-6: [P2] When 親タスクを持つ子タスク群の全てが done 状態になった時、shall 親タスクも done 状態に自動遷移する
- REQ-7: [P2] When 全てのタスクが done 状態になった時、shall currentTaskId は null になり、後続の flow-scope step (finalize) へ遷移する
- REQ-8: [P3] When spec.json のタスク定義スキーマが検証される時、shall parent フィールドは string または null を受け入れる (optional)
- REQ-9: [P3] When spec 承認時に spec.json のタスク定義が flow.json に差分反映される時、shall spec.json 側の parent が flow.json 側のタスク定義にそのまま転写される
- REQ-10: [P3] When sdd-forge spec render が実行された時、shall 各タスクごとの仕様 markdown (specs/<spec-dir>/tasks/<task-id>.md) が spec.json のタスク定義から自動生成される
- REQ-11: [P3] When タスク個別の仕様 markdown が生成された時、shall 生成物は手動編集禁止であり (spec.md と同じ SSOT 原則)、再生成で上書きされる
- REQ-12: [P4] When spec gate または task-spec gate が実行された時、shall task-single-responsibility guardrail が各タスクの concern 単一性を評価し、違反時は FAIL verdict を返す
- REQ-13: [P4] When plan/spec 系 prompt の内容が検証される時、shall プロンプト内に以下の要素が明示的に記述されている: タスク分解の 1 concern 原則、title は 1 verb phrase で表現可能であること、無関係な actions を 1 task に束ねない制約、各タスクの必須フィールド (goal) と任意フィールド (acceptance / implementation_notes / test_strategy) の役割
- REQ-14: [P4] When plan/draft 系 prompt の内容が検証される時、shall プロンプト内に以下が記述されている: 要件を concern 単位に整理すべき旨、後続の spec 段階で concern 単位にタスク分解する前提で要件整理すべき旨
- REQ-15: [P5] When task-scope の step 構成が検証される時、shall 現行の 7 step 構成が 5 step 構成 (write-tests, impl, run-tests, review, gate-impl) に再編されている
- REQ-16: [P5] When 既存の task 単位の再承認 (approval) / task 仕様書の gate (task-spec) / 独立した overview 更新 step (update-overview) が検索される時、shall それらは task-scope の step 構成から削除されている
- REQ-17: [P5] When task 実装が完了した時、shall 当該タスクによる parent spec の overview への貢献追記を行うための CLI (`sdd-forge flow run update-overview --json <additions>`) が production caller として提供され、persistOverviewUpdate helper を経由して spec.json.overview に append-only で merge できる。impl step 実行パスへの自動統合 (run-impl.js post-hook) は本 spec の scope 外とし board draft 3f91 に委ねる
- REQ-18: [P6] When ユーザーが sdd-forge flow run start-task --task-id <id> を実行した時、shall 指定タスクが currentTaskId として設定され、当該タスクが in_progress 状態に遷移する
- REQ-19: [P6] When ユーザーが sdd-forge flow run complete-task [--task-id <id>] を実行した時、shall 現 task または指定タスクが done 状態に遷移し、親子 propagation と次 pending タスクの auto-promote が適用される
- REQ-20: [P7] When 本 spec の実装完了後に npm test を実行した時、shall 既存テストを含む全ユニット・integration テストが終了コード 0 で PASS する

## Acceptance Criteria
- spec.schema.json のタスク定義で goal が required、acceptance / implementation_notes / test_strategy / parent が optional として validation 可能
- description フィールドが spec.schema.json.tasks[*] から削除されている
- 新 guardrail task-single-responsibility が src/presets/base/guardrail.json に存在し、meta.phase=[spec, task-spec]
- src/flow/prompts/plan/spec.md に Task Decomposition Rules セクションが存在し、1 concern 原則と各フィールドの意味が記述されている
- src/flow/prompts/plan/draft.md に concern 単位のタスク分解を予告する記述が存在する
- sdd-forge spec render を tasks を含む spec.json に対して実行した時、specs/<spec-dir>/tasks/<task-id>.md が生成される
- sync-spec-tasks の完了後、currentTaskId が非 null になる (pending タスクがある場合)
- 親タスクの全子タスクを done にすると親も done になる (completeTask 経由)
- task-scope step は write-tests, impl, run-tests, review, gate-impl の 5 要素のみ
- context-rules.json の task scope から approval / gate / update-overview エントリが削除されている
- src/flow/prompts/task/ 配下に approval.md / gate.md / update-overview.md が存在しない
- sdd-forge flow run start-task / complete-task が registry.js に登録され、実行可能
- spec gate が tasks 未定義または空配列の新規 spec を FAIL と判定する
- 既存 326 spec.json (tasks undefined) が spec.schema.json validation で引き続き valid
- 既存 261 active flow.json (tasks 空) が FlowStore.load() で引き続き throw せずに load できる (flat fallback 維持のため)
- forest traversal が deterministic (DFS pre-order、兄弟は spec.json.tasks[] 配列順、同一入力で同一結果)
- completeTask の単体実行では auto-promote が呼ばれない (責務分離の unit test が PASS)
- auto-promote 関数の呼び出し箇所が sync-spec-tasks 末尾と gate-impl post-hook の 2 箇所のみ (grep / static 検証)
- start-task / complete-task CLI が primitive と auto-promote 関数の薄い wrapper として実装されている (validation の重複なし)
- spec gate の tasks 空 FAIL 判定が pre-AI の structural check 層に実装されている (JSON schema required ではなく、guardrail AI 層でもない)
- spec render が tasks/<id>.md の orphan (spec.json にない既存 md) を削除しない (additive only)
- npm test が全 PASS
- gate-draft および spec gate が本 spec の draft.md / spec.md / spec.json に対して PASS

## Implementation Targets
-

## Authorized Existing Test Modifications
- **tests/unit/flow/approval-task-sync.test.js** — spec 226: task fixture の description を goal に置換 (新スキーマ対応)
- **tests/unit/flow/instructions-coverage.test.js** — spec 226: task-scope step 数 7→5 により instructions_key 合計 21→19 に更新
- **tests/unit/lib/flow-helpers-tasks.test.js** — spec 226: TASK_STEPS_PLAN 5 step 化、gate step 削除に伴う derivePhase 期待値を gate-impl/task-impl に変更
- **tests/unit/spec/render-tasks-section.test.js** — spec 226: description → goal に置換、render 出力文字列の expected も更新
- **tests/unit/spec/spec-tasks-schema.test.js** — spec 226: task fixture の description を goal に置換 (新スキーマ対応)
- **tests/unit/specs/commands/gate.test.js** — spec 226: spec gate が tasks 必須化したため、validSpecJson helper に tasks[] を 1 件追加

## Open Questions
- [ ] 新 CLI start-task / complete-task の envelope data 形状の詳細 (impl 時に決定)
- [ ] tasks/<id>.md の具体的な見出し構成と metadata の表現形式 (impl 時に決定)
- [ ] get-next-action の forest traversal アルゴリズムの選択 (深さ優先か幅優先か、兄弟順の決定、impl 時に決定)
- [ ] spec gate の tasks[] 空 FAIL 判定の実装箇所 (spec gate のどの evaluator に組み込むか、impl 時に決定)
- [ ] plan/spec.md prompt の Task Decomposition Rules セクションの具体文言 (impl 時に確定)
- [ ] run-update-overview.js の機能を impl step 内に統合する際のインターフェース (既存 helper を直接呼ぶか、impl コマンドに委譲するか、impl 時に決定)

## Tasks
### Round 0
- **T-1** [pending]: タスク必須化の入口強制
  - 新規 spec でタスク定義の記述を強制し、雑なタスク分解を guardrail で reject する。REQ-1 / REQ-12 / REQ-13 / REQ-14 を満たす。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: spec.json タスク定義スキーマの構造化
  - spec.json.tasks[*] を description 単一フィールドから構造化フィールド群 (goal 必須、acceptance / implementation_notes / test_strategy / parent を optional) に再設計する。REQ-2 / REQ-3 / REQ-8 を満たす。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: spec render による tasks/<id>.md 自動生成
  - sdd-forge spec render が spec.json.tasks[*] から各タスクごとの markdown (specs/<spec-dir>/tasks/<task-id>.md) を自動生成する。REQ-10 / REQ-11 を満たす。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: forest 構造の運用配線 (sync + traversal + propagation)
  - spec.json の parent を flow.json に転写し、タスク遷移が forest を理解し、親タスクは全子タスク完了で自動的に done になる。REQ-9 / REQ-6 を満たす。
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: タスク遷移の自動化と auto-promote
  - spec 承認後の最初タスクの auto-promote、gate-impl PASS 後の次タスク promote、全タスク完了時の flow-scope 遷移を production path で配線する。REQ-4 / REQ-5 / REQ-7 を満たす。
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: task-scope step 再編と手動制御 CLI
  - TASK_STEPS_PLAN を 7 step から 5 step に再編し、approval / task-spec gate / update-overview を削除、update-overview 機能を impl に統合し、手動制御 CLI (start-task, complete-task) を追加する。REQ-15 / REQ-16 / REQ-17 / REQ-18 / REQ-19 / REQ-20 を満たす。
  - see `tasks/T-6.md` for full spec
