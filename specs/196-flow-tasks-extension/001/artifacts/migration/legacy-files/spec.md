# Feature Specification: 196-flow-tasks-extension

**Feature Branch**: `feature/196-flow-tasks-extension`
**Created**: 2026-04-19
**Status**: Ready for Review
**Input**: GitHub Issue #183 (cac6/T2)

## Goal

cac6「親 spec + task 分解モデル」の実装基盤として、`specs/<NNN>/flow.json` のスキーマに task 群を保持する構造を導入し、`FlowManager` / `FlowStore` / `flow-helpers.js` を task スコープ対応に拡張する。cac6 全 11 タスクのうち 2 番目（T2）で、T1（spec.json 化）と依存なし・並列可能。

本 spec は **状態管理レイヤのデータ構造とプリミティブ API のみ** を扱い、CLI / gate / run 等の配線は後続 task（T3〜T7）に委ねる。

## Scope

1. flow.json スキーマ拡張（破壊的変更、alpha 方針で後方互換なし）。
2. `FlowManager` に task 操作 API を追加。
3. `FlowStore` の mutator を scope 対応に拡張。
4. `flow-helpers.js` の `derivePhase` / `buildInitialSteps` を flow 用 / task 用の 2 系統化（task 用 `buildInitialTaskSteps(origin)` を追加）。
5. `PreparingFlowStore.create()` の初期値を新形式に揃える。
6. 既存 `flow set *` 系 CLI（`flow/lib/set-*.js`）が `FlowManager` を経由する範囲で scope 推論が透過的に効くよう最小配線。
7. `tests/unit/` に task API と scope 推論のユニットテストを追加。
8. 本 spec 自身の active flow.json を実装開始時に新形式へ整合させる。

## Out of Scope

- 旧 flow.json の一括マイグレーションスクリプト（T11 / 053d）
- CLI / gate / run / review / finalize の広範な書き換え（T3〜T7 で段階対応）
- skill 統合（T7 / a7b4）
- next-action CLI 新設（T5 / 49df）
- guardrail 3 層化（T3 / 8377）
- spec.md → spec.json プライマリ化（T1 / 4b8e, T8 / 865c）
- 並列 task 実行（9c3c で別途検討）

## Clarifications (Q&A)

- Q: T2 のスコープ境界は？
  - A: issue #183 本文記載の全範囲を T2 で実装。gate / run / skill 等の広範再配線は後続 task。
- Q: 旧形式の flow.json（`tasks` フィールド無し）はどう扱うか？
  - A: strict モード — load 時に throw。実装初手で自身の flow.json を新形式に正規化する（他 active flow は事前確認）。
- Q: current task の保持方法は？
  - A: flow.json に `currentTaskId: string | null` を追加。単一 task 前提。将来並列化時は破壊的にリネーム／拡張する（alpha 方針許容）。
- Q: task の初期 step 構成は？
  - A: cac6 記載の 2 パターン（plan 由来 6 step / addition 由来 8 step）。test-first 分解は T4 担当。
- Q: テスト配置は？
  - A: `tests/unit/` に正式テストとして追加（公開 API 契約）。

## Alternatives Considered

1. **旧形式を load 時に暗黙正規化** — 却下。alpha 方針「旧フォーマットを保持しない」と緊張し、未移行 active flow を早期検出できない。
2. **current task を `status === "in_progress"` から毎回推論（永続化なし）** — 却下。状態解決が実装分散し、呼び出し側の推論コード重複を招く。
3. **最初から `currentTaskIds: string[]`（複数 task 並列前提）** — 却下。cac6 本文「並列化用の拡張点を事前に作らない」に抵触。将来 alpha 内で破壊的拡張で対応可能。
4. **T2 内で CLI / gate / run を全部書き換え** — 却下。T3〜T11 とコンフリクトし、段階実装の恩恵が失われる。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-19
- Notes: 全 21 要件・Out of Scope・マイグレーション計画を含めた仕様を User が承認。

## Requirements

要件は優先度順（P1 = 必須基盤、P2 = 必須 API、P3 = 必須派生、P4 = 必須運用）で整理。全 20 件中 P1=REQ-1..3、P2=REQ-4..11、P3=REQ-12..14、P4=REQ-15..20。

### P1 — 新 flow.json スキーマ

**追加フィールド:**

- `tasks: Task[]`（必須）
- `currentTaskId: string | null`（必須）

**`Task` オブジェクト:**

```
{
  "id": string,           // "001", "002" etc. 3桁ゼロパディングのファイル名数字部
  "spec": string,         // tasks/<id>-<slug>.md への相対パス
  "origin": "plan" | "addition" | "integration",
  "parent": string | null, // 親 task id（tree 構造用）
  "status": "pending" | "in_progress" | "done" | "skipped",
  "steps": Array<{id: string, status: "pending"|"in_progress"|"done"|"skipped"}>,
  "requirements": Array<{desc: string, status: "pending"|"done"}>,
  "summary": string | null
}
```

**要件:**

- **REQ-1** When 新規 flow を作成する時 (`PreparingFlowStore.create`)、shall 初期値に `tasks: []` および `currentTaskId: null` を含む。
- **REQ-2** When `FlowStore.load()` を呼ぶ時、shall 読み込んだ状態に `tasks` フィールドが存在しない場合は `Error` を throw する（明示的失敗）。`loadReadOnly()` も同じ検査を行う。
- **REQ-3** When `FlowStore.save()` を呼ぶ時、shall 保存する状態は常に `tasks` と `currentTaskId` を含む形で書き込まれる。

### P2 — `FlowManager` 新規メソッド

- **REQ-4** `addTask(task)`: When 呼ばれた時、shall `task` オブジェクト全属性のバリデーションを行い、`state.tasks` に追加し、`state.currentTaskId = task.id` を設定する。既に同 `id` の task が存在したら throw。
- **REQ-5** `completeTask(taskId)`: When 呼ばれた時、shall 該当 task の `status` を `"done"` に更新し、`currentTaskId === taskId` の場合は `currentTaskId = null` にする。存在しない `taskId` は throw。
- **REQ-6** `getCurrentTask()`: When 呼ばれた時、shall `currentTaskId` から解決した `Task` オブジェクトを返す。`currentTaskId === null` の時は `null` を返す。
- **REQ-7** `getCurrentTaskStep()`: When 呼ばれた時、shall 現在 task の steps のうち `status === "in_progress"` のものを返す。現在 task が無い／進行中 step が無い場合は `null`。
- **REQ-8** `setCurrentTaskStep(stepId, status)`: When 呼ばれた時、shall 現在 task の当該 step の `status` を更新する。現在 task が無い場合は throw。存在しない `stepId` も throw。

### P2 — `FlowStore` / `FlowManager` 既存メソッドの scope 対応

対象メソッド: `addNote`, `setRequirements`, `updateRequirement`, `updateStepStatus`, `incrementMetric`, `setTestSummary`, `accumulateAgentMetrics`。

- **REQ-9** When 上記メソッドを第 2 引数（オプション）無しで呼んだ時、shall 現在 task が存在すれば task スコープに、そうでなければ flow 直下（親スコープ）に更新を書き込む。
- **REQ-10** When `{ taskId }` を明示指定した時、shall 指定された task を対象に更新する。`taskId: null` を明示した場合は親スコープ。存在しない task id は throw。
- **REQ-11** scope 推論は共有ヘルパ `resolveMutationScope(state, opts)` に集約し、各メソッドはそれを呼ぶ（DRY）。

**各メソッドの scope 別挙動:**

| メソッド                    | flow 直下                  | task スコープ                        |
| --------------------------- | -------------------------- | ------------------------------------ |
| `addNote`                   | `state.notes.push(...)`    | `task.notes.push(...)`               |
| `setRequirements`           | `state.requirements = ...` | `task.requirements = ...`            |
| `updateRequirement`         | `state.requirements[i]`    | `task.requirements[i]`               |
| `updateStepStatus`          | `state.steps[i]`           | `task.steps[i]`                      |
| `incrementMetric`           | `state.metrics[phase]`     | `task.metrics[phase]`                |
| `setTestSummary`            | `state.test.summary`       | `task.test.summary`                  |
| `accumulateAgentMetrics`    | `state.metrics[phase]`     | `task.metrics[phase]`                |

### P3 — `flow-helpers.js` の 2 系統化

- **REQ-12** When 新たに task step 列挙を必要とする時、shall `TASK_STEPS_PLAN` および `TASK_STEPS_ADDITION` が定数として定義されている。
  - `TASK_STEPS_PLAN = ["gate", "approval", "impl", "test", "review", "update-overview"]`
  - `TASK_STEPS_ADDITION = ["draft", "approval", "gate", "approval-2", "impl", "test", "review", "update-overview"]`（2 度目の approval は ID 衝突回避のため `approval-2`）
- **REQ-13** When `buildInitialTaskSteps(origin)` を呼ぶ時、shall `origin === "plan"` または `"integration"` なら `TASK_STEPS_PLAN` を返し、`"addition"` なら `TASK_STEPS_ADDITION` を返す。未知 `origin` は throw する。`buildInitialSteps()` は flow レベル用として現状維持。
- **REQ-14** When `derivePhase(state)` を呼ぶ時、shall `state.currentTaskId != null` かつ 現在 task の step に in_progress があれば、task 内 step を `TASK_PHASE_MAP` で phase 解決する。それ以外の時は flow レベル step を `PHASE_MAP` で phase 解決する。
  - `TASK_PHASE_MAP`:
    - `gate` / `approval` / `draft` / `approval-2` → `"task-plan"`
    - `impl` / `test` / `review` / `update-overview` → `"task-impl"`
  - 現状シグネチャ `derivePhase(steps)` から `derivePhase(state)` へ破壊的変更。呼び出し箇所は同一コミットで更新する。

### P4 — テスト

- **REQ-15** When FlowManager の task API 群を PR に含める時、shall `tests/unit/lib/flow-manager-tasks.test.js` が以下をカバーする:
  - addTask / completeTask の正常系・異常系
  - getCurrentTask / getCurrentTaskStep / setCurrentTaskStep
  - scope 推論（taskId 省略時）
  - scope 明示指定（`{ taskId }`）
  - 旧形式 flow.json load 時の throw
- **REQ-16** When flow-helpers の 2 系統化を PR に含める時、shall `tests/unit/lib/flow-helpers-tasks.test.js` が以下をカバーする:
  - `buildInitialTaskSteps("plan")` / `buildInitialTaskSteps("addition")` / `buildInitialTaskSteps("integration")`
  - 未知 origin の throw
  - `derivePhase(state)` の task / flow 両パス
- **REQ-17** When 既存の `tests/unit/flow-*.test.js` が新 schema 下で動作する必要が生じた時、shall 状態モックに `tasks: []`, `currentTaskId: null` を追加する整合修正を行う。テスト期待値の変更は行わない。
- **REQ-18** When `npm test` を実行した時、shall 全ユニットテストが終了コード 0 で PASS する。

### P4 — 本 spec の active flow の整合

- **REQ-19** When 本 spec の実装が含む diff を確認した時、shall `specs/196-flow-tasks-extension/flow.json` に `tasks: []` および `currentTaskId: null` が含まれており、かつ `FlowStore.load()` の strict 検査を通過する形で保存されている。
- **REQ-20** When 本 spec の実装を開始する時、shall `.sdd-forge/.active-flow` には本 spec のみが登録されていることが事前確認されている。確認は spec 内および flow.json の notes で記録されていれば十分。

### Exit Code Contract

- **REQ-21** When 本変更の影響を受ける `sdd-forge` CLI コマンドが load / save / 明示 scope 解決（`{ taskId }` 指定）のいずれかで失敗した時、shall プロセスは非ゼロ終了コードで終了し、エラー内容を stderr または JSON envelope の `errors` に記録する。成功時は 0 を返す。ambient な best-effort メトリック更新（明示 scope なし・active flow 不在時）は、flow 状態ファイルが存在しないことを事前判定した上で何もせずに成功扱いとする（設計意図：SDD 外のコマンドで metric hook が呼ばれる正常ケース）。

## Acceptance Criteria

- `npm test` が PASS する（既存テスト + 新規テスト全て）。
- `sdd-forge flow get status` が本 spec の active flow に対し正常終了する。
- `sdd-forge flow set note "test"` が成功し、flow.json の親スコープ `notes[]` に記録される（現在 task が無い状態）。
- 旧形式の flow.json（手動で tasks を削ったコピー）を load しようとすると明示的な Error が throw される。
- `FlowManager.addTask({...})` 後に `getCurrentTask()` が当該 task を返す。
- `completeTask(id)` 後に `currentTaskId === null`、task status === "done"。
- `setCurrentTaskStep("impl", "in_progress")` 後、`getCurrentTaskStep()` が該当 step を返し、`derivePhase(state)` が `"task-impl"` を返す。
- scope 推論: 現在 task ありの状態で `addNote("x")` を呼ぶと task.notes に追加、無しの状態では state.notes に追加される。

## Test Strategy

**配置:** `tests/unit/lib/flow-manager-tasks.test.js` および `tests/unit/lib/flow-helpers-tasks.test.js`。正式テストとする（公開 API 契約のため将来の破壊検出に価値）。

**対象:**

1. **unit(FlowManager)** — addTask / completeTask / getCurrentTask / getCurrentTaskStep / setCurrentTaskStep の happy path + error path
2. **unit(scope inference)** — 既存 mutator 群の scope 推論・明示指定の両経路
3. **unit(flow-helpers)** — buildInitialTaskSteps / derivePhase (state 受取り版) の全 origin・両経路
4. **unit(schema strict)** — 旧形式 flow.json の load 時 throw

**フィクスチャ方針:** テスト内で `createTmpDir()` と `FlowStore` の直接インスタンス化で最小 fixture を作る。既存テストの fixture 作成パターンに合わせる。

**既存テスト更新:** 既存 flow-*.test.js のモック state は `tasks: []`, `currentTaskId: null` を足す。テスト期待値の変更は行わない（行う場合は該当 REQ の誤りなので spec 修正）。

## Why This Approach

1. **strict 失敗を選ぶ理由**: alpha 方針「旧フォーマット・非推奨パスは保持せず削除」と整合。未移行 active flow を早期検出でき、T11 マイグレーションスクリプト実装までの間の silent-error を防ぐ。
2. **`currentTaskId` を永続化する理由**: 呼び出し側の推論ロジック重複を防ぎ、scope 解決を状態管理レイヤに集約。cac6 本文「CLI 推論」合意と整合。
3. **単数 `currentTaskId` を選ぶ理由**: cac6「並列化用の拡張点を事前に作らない」方針に従う。並列化は 9c3c 案件で改めて設計する際、alpha 方針で破壊的拡張可能。
4. **scope 推論 + 明示引数の両対応を選ぶ理由**: 通常フローは推論で簡潔に、例外操作（`flow task <id> set ...` 将来拡張やテスト）は明示で厳密に。cac6 本文「CLI 推論: active task あり → task note、なし → 親 note」と整合。
5. **task step 定数を 2 系統に分ける理由**: cac6 記載の plan/addition 由来の step 列を忠実に表現。test-first 分解は T4 で拡張。
6. **`derivePhase(state)` に変更する理由**: 現在 task の判定に state 全体が必要。internal utility のため破壊的シグネチャ変更は呼び出し箇所更新で対応可能。
7. **既存テストの state モック更新方針**: テスト目的を変えず schema 整合のためだけに field を足す。これは「テストを通すためのテスト修正」ではなく「schema 変更に伴う fixture 整合」なので CLAUDE.md のテスト方針に違反しない。

## Migration Plan

### 実装内部の破壊的変更

1. 実装第 1 コミット: 本 spec の flow.json に `tasks: []`, `currentTaskId: null` を追記（strict 化が入る前）。
2. 以降のコミットで FlowStore strict 化、FlowManager API 追加、scope 対応、flow-helpers 2 系統化、テスト追加。
3. PR 本文に他 active flow 所有者向けの移行手順を記載:
   - 当該 flow.json に `"tasks": []`, `"currentTaskId": null` を追加
   - その後 `sdd-forge flow get status` が動作することを確認
4. T11（053d）でマイグレーションスクリプトが提供されるまでは手作業ガイド。

### CLI インターフェース互換性

- 既存 `sdd-forge flow set *` コマンドの外部挙動（引数・終了コード・出力 JSON 形式）は変更しない。
- scope 推論は内部で透過的に適用される。ユーザーからは「active task がある時は task に書かれる」点だけが差分。

## Open Questions

なし。実装中に判明した追加論点は issue-log.json に記録する。
