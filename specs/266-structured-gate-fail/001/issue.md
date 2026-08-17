## Background

In recent spec runs, repeated similar FAILs in gate-impl are being detected, but identifying which missing evidence to look at next and which targets to fix depends on prose descriptions, making it easy to repeat the same failures.

Currently, FAILs are ultimately flattened into a single natural-language line (`${title} — ${v.target} — ${v.why_violates} (at ${v.where})`). AI/humans must read this and reconstruct "what to fix" and "what is missing," requiring re-reading of the spec and guardrails.

Additionally, for guardrails like `no-overengineering` / `code-placement`, blocking conditions are abstract ("single-caller helper," "missing design-confirmation evidence," "module that owns the data," etc.), leading to false positives that become blocking without diff-verifiable substance.

## Goal

Ensure that when an AI/human receives a gate-impl FAIL, the **next action is unambiguous without re-reading any spec or guardrail**.

Simultaneously, address the root causes of repeated similar FAILs:

- **Detection side**: Replace natural-language FAILs with structured Observations
- **Origin side**: Pass prior FAIL context into the AI prompt, and rewrite abstract guardrail text into diff-verifiable conditions

## Root Causes of Repeated FAILs and Response Policy

During brainstorming, 5 causes were identified; 2 were selected as in-scope for ca7e:

| Cause | Description | ca7e treatment |
|---|---|---|
| 1. Fix exposes related violation | Legitimate new FAIL | Should be detected. No action needed |
| 2. AI evaluation non-determinism | Evaluation variance on identical code | Absorbed by retry. Out of scope |
| 3. Prior judgment not carried forward | Prior FAIL decisions not passed to the next round within a flow | **Address** (introduce gate-impl prior memory) |
| 4. Abstract guardrail text | Descriptions at the level of "appropriately~" cause AI to apply different concrete examples each round | **Address** (rewrite `no-overengineering` / `code-placement` into diff-verifiable conditions) |
| 5. Code change introduces new violation | Legitimate new FAIL | Should be detected. No action needed |

Cross-flow learning (inheriting decisions from other specs/flows) is a future task and out of scope for ca7e.

## Design Agreements

### A. Data Structure

Introduce NextAction as a common wire format across all phases.

```
nextAction = {
  diagnosis: {
    summary: string,
    observations: Observation[]
  },
  prescription: <phase id>   // existing phase vocabulary only. no special tokens
}
```

Observation is a single monomorphic shape common to all phases:

```
observation = {
  kind:           "violation",            // fixed
  failureMode:    string,                 // selected from enum
  requirementRef: string,                 // guardrail_id or spec REQ-XX
  where:          { file, locator? } | null,
  observed:       string,                 // AI-authored (actual state observed in diff/artifact)
  severity:       "blocking" | "advisory", // auto-derived on the code side
  refs:           []                       // escape hatch for future use
}
```

Design decisions:

- `expected` field is removed (derivable from the `requirementRef` body text; having AI write it risks hallucination)
- `severity` is not judged by AI; auto-determined by `failureMode` × policy
- AI outputs only 4 fields: `failureMode`, `requirementRef`, `where`, `observed`
- `kind` is fixed for now, but room for future extension is retained
- Reason for monomorphic: single schema validation suffices, and per-phase branching in consumers disappears

### B. gate-impl failureMode Enum

| failureMode | Description | Severity policy |
|---|---|---|
| `spec-impl-mismatch` | A spec REQ is not satisfied in the diff | Always blocking |
| `guardrail-violation` | Violates a condition in the guardrail body | Always blocking |
| `process-evidence-missing` | Missing process evidence such as issue-log / review artifacts | Blocking only when diff-verifiable, otherwise advisory |

Test-related issues are the responsibility of the test phase and are not included in gate-impl failureModes.

### C. nextAction as Single Source of "Next Action"

Design philosophy: grounded in the recognition that "every phase is basically the automation of a human judgment phase." No dedicated escalate phase is created.

| Axis | Where it lives | Values |
|---|---|---|
| What to consider next | `nextAction` (inside envelope `data`) | phase id + diagnosis |
| Whether auto-continuation is possible | envelope `ok` / `errors[].code` | `OK` / `ESCALATE_RETRY_EXHAUSTED` / `ESCALATE_REPEATED_FAIL` / `NO_PROGRESS_SINCE_LAST_FAIL` |

- Even on retry exhaustion / repeated FAIL, `prescription` points to the same phase (assumes a human takes over that phase)
- The value domain of `prescription` is fixed to existing phase id enums. Special tokens like `escalate-user` are not introduced
- The skill uses `ok` for stop decisions and `prescription` to get the next resume point

### D. Class Design (in-memory layer)

Following the project's OOP representation rules, Observation / Diagnosis / NextAction are defined as classes.

`src/flow/lib/observation.js` (new):

- `class Observation` — constructor enforces invariants (severity within enum, observed non-empty, where.file is string, etc.)
- `class Diagnosis` — aggregates observations, holds summary
- `class NextAction` — aggregates diagnosis + prescription

Each class has `toJSON()` / `fromJSON()` / `signature()` (for similarity) / `toMarkdown()` (for display).

Layer separation:

```
[Wire / Persistence layer] stdout JSON, issue-log.json, AI output — JSON only
       ↑↓ toJSON() / fromJSON()
[In-memory layer] processing inside run-gate.js, skill, CLI consumer — classes
```

`src/flow/schemas/next-action/gate.schema.json` remains a minimal wire-format document; detailed invariants are consolidated in the class (avoiding double-definition between schema and class).

### E. AI Prompt Revision Policy

The target for revision is the eval-layer prompt (around `buildGuardrailArticleEvalPrompt` in `run-gate.js`). The skill-layer prompt (`gate-impl.md`) requires no changes.

Revisions:

- Narrow AI output fields to 4: `failureMode`, `requirementRef`, `where`, `observed`
- Embed **JSON template + 2 example entries** in the prompt (a filled example / an example where fields can be empty)
- Based on the empirical rule that JSON sketch + examples produce more stable AI understanding than prose explanations or full JSON Schema

Example (filled):

```json
{
  "kind": "violation",
  "failureMode": "guardrail-violation",
  "requirementRef": "no-duplicate-helpers",
  "where": { "file": "src/foo.js", "locator": "formatX()" },
  "observed": "formatX() is defined in src/foo.js but src/bar.js already exports an identical formatX()."
}
```

Example (when locator cannot be provided):

```json
{
  "kind": "violation",
  "failureMode": "process-evidence-missing",
  "requirementRef": "issue-log-required",
  "where": { "file": "specs/X/issue-log.json" },
  "observed": "issue-log.json contains no entry for the latest gate-impl FAIL → fix → retry cycle."
}
```

### F. gate-impl Prior Memory (mitigation for Cause 3)

Reuse the `previous review memory` from 125b (`toPromptMemory()` at `review.js:1912-1918` in spec review) for gate-impl:

- Collect prior FAIL observations for the same flow / same phase from issue-log
- Aggregate the resolution status of each observation (fixed / acknowledged-as-exception / unresolved)
- Inject into the AI prompt on the next gate-impl invocation
- AI either does not re-flag the same violation, or explicitly states "I'm flagging this from a different angle"

Open questions (to be resolved before implementation):

- **(F-i) Memory granularity**: All observations / failureMode summary only / signature only — token efficiency vs. AI comprehension tradeoff
- **(F-ii) Resolution status source**: issue-log `reason / resolution` fields / spec.constraints / both
- **(F-iii) Pruning**: All entries from same flow/phase / most recent N rounds / all entries + aggregation

### G. Making Abstract Guardrails Diff-Verifiable (mitigation for Cause 4)

Rewrite the following 2 items in the base preset. Applying this across all presets (120 items) is a separate future task outside ca7e scope.

#### G-1. Decomposing `no-overengineering`

Decompose the current body into 3 independent violation conditions:

```
violation 1: single-caller indirection
  diff-verification condition: helper function is defined and call sites in the entire diff number only 1
  severity policy: blocking

violation 2: duplicate code shape
  diff-verification condition: code of the same shape exists in 2 or more places and has not been extracted into a helper
  severity policy: blocking

violation 3: design-confirmation evidence missing
  diff-verification condition: non-trivial change (lines ≥ N, new module added, etc.) with no design discussion recorded in issue-log / qa.md
  severity policy: blocking for non-trivial changes, advisory for minor ones
```

Violation 3 is the canonical example of the ca7e original text "don't always treat single-caller helpers or missing design-confirmation evidence as blocking," splitting severity conditionally.

#### G-2. Concretizing `code-placement`

Rewrite the judgment of "module that owns the data" into conditions that can be mechanically verified from the diff:

```
violation: derivation logic placed in consumer module
  diff-verification conditions:
    - diff adds a new export or new module
    - that export operates on data within the responsibility domain of an existing data-owner module
    - no changes to the data-owner module are included in the diff
  severity policy: blocking
```

#### G-3. Making the Rewrite Pattern Reusable

**Record the pattern** obtained from rewriting these 2 base items as a **reusable rubric**, enabling future tasks to apply it to guardrails in each preset. Storage location is `docs/` or within `src/presets/base/` (to be decided at implementation time).

### H. Phased Migration Strategy

- **Start with impl** (migration priority 1)
- Other phases remain unmigrated for now. To avoid multiplying consumer-side branching, **unmigrated phases convert old format → NextAction via adapter** before writing to wire
- Migration = "rewrite that phase's AI prompt to emit rich Observation output, then delete the adapter"

```
[impl phase (migrated)]
  AI → rich Observation directly → NextAction → envelope.artifacts.nextAction

[other phases (unmigrated)]
  AI → old evaluations[] → legacyToNextAction() adapter → NextAction → envelope.artifacts.nextAction
```

This achieves a state where only NextAction exists at the wire boundary immediately:

- Consumer-side branching disappears immediately
- Migration unit is clear (AI prompt and internal evaluation concern; wire is unified from the start)
- Loss from unmigrated phases is acceptable (adapter does not fabricate missing info; fills with empty string / null)

Expected migration order: impl → integration → spec / task-spec → draft / approval / retro

Note: Do not allow adapter logic to become "quasi-spec." Do not add phase-specific if statements; always keep it thin.

## Completion Criteria

- On gate-impl FAIL, Observation[] is returned and AI/humans can identify the target to fix next without re-reading anything
- gate-impl failureModes are explicitly enumerated as 3 types and AI output conforms to them
- No old-format / new-format branching appears on the consumer side (wire is unified as NextAction)
- The severity policy for `process-evidence-missing` as "blocking only when diff-verifiable" is explicitly documented and applied in code
- Prior FAIL memory is injected into the gate-impl AI prompt, reducing repeated FAILs within the same flow
- `no-overengineering` / `code-placement` body text is rewritten into diff-verifiable conditions
- Recurrence of similar FAILs decreases (as a direct result of addressing Causes 3 and 4)

## Impact Scope

### New

- `src/flow/lib/observation.js` — Observation / Diagnosis / NextAction classes, legacy adapter function
- Persistence / restore logic for gate-impl prior memory (expected to reference existing issue-log)

### Major Modifications

- `src/flow/lib/run-gate.js`
  - Change output contract of `parseGuardrailArticleEvaluation` (narrow to 4 fields)
  - Replace `reasonsFromEvaluations` → build `Observation[]`
  - Add `nextAction` to result structure in `gateFail` / `gatePass`
  - Similarity detection (`assertNoRepeatedFail`) input field rename (`guardrail_id → requirementRef`, `reason → observed`). Algorithm itself unchanged (reuse Jaccard + stopword removal from spec 253)
  - Embed JSON template + examples in eval-layer prompt (around `buildGuardrailArticleEvalPrompt`)
  - Logic to inject prior memory into AI prompt
- Minimal extension to `src/flow/schemas/next-action/gate.schema.json`
- Update issue-log persistence format (migrate `failedEvaluations` → `observations`. Discard old format per alpha period policy)
- `src/presets/base/guardrail.json`
  - Decompose `no-overengineering` body (3 violation conditions + severity policy)
  - Concretize `code-placement` body (with diff-verification conditions)

### Consumer Impact

- Skill read point: change to `result.artifacts.nextAction` as primary read path
- Unify references to old `result.artifacts.reasons` / `evaluations` / `issues` via `nextAction.diagnosis.observations`

### Adapter for Unmigrated Phases

- Insert `legacyResultToNextAction()` immediately before wire output in spec / task-spec / draft / approval / retro / integration
- Adapter carries no phase-specific logic; mechanically converts old `evaluations[]` to Observations

### Impact on Preset Inheritance

- Rewriting `base/guardrail.json` propagates to all presets. Test impact scope must be verified
- Behavior of `no-overengineering` / `code-placement` may change in e2e / acceptance tests for each preset

## Unresolved (to be decided before implementation start)

Items raised during brainstorming but not discussed:

### (e) Similarity Detection Key

Resolved: ca7e's goal (FAIL structuring + repeat reduction) **can be satisfied with field rename alone**. Algorithm enhancements (using `where` in conjunction, hierarchical judgment) are secondary precision improvements and are placed outside ca7e scope. Implementation will reuse Jaccard + stopword removal from spec 253 as-is.

### (f) Fallback on AI Output Error

Behavior when AI returns:

- `failureMode` value outside the enum (e.g., non-existent mode name)
- Non-existent `requirementRef` (id that is neither a guardrail_id nor a spec REQ)
- Missing required field (`observed` is empty, `where` is absent, etc.)

Options:

- **Re-retry**: Request AI to regenerate (consumes retry budget)
- **Force advisory**: Remove blocking from unverifiable observations
- **Envelope.fail**: Immediately return Envelope.fail and hand back to human judgment

Since the `Observation` class constructor enforces invariants, invalid values are detected at parse time. The open question is how to behave after detection.

### (F-i, F-ii, F-iii) Prior Memory Details

The 3 sub-questions listed in section F (granularity / source / pruning) are to be resolved before implementation begins.

### (G-3) Location for Reusable Rubric

Storage location for the rewrite pattern record (`docs/` or `src/presets/base/`) is to be decided at implementation time.

## Related

- 125b: blocking failure mode enumeration in impl review (applying the same "failureMode enumeration" approach to a different target) + previous review memory pattern (reference for ca7e Cause 3 mitigation)
- spec 253: Jaccard similarity detection for repeated similar FAILs (ca7e reuses with field rename only)
- spec 255: violations[] structure (target / where / why_violates)
- spec 212: FAIL → fix → PASS trace persistence (issue-log)

<details>
<summary>ja</summary>

[ENHANCE] gate-impl FAIL reason 構造化

## 背景

最近の spec 実行で、gate-impl の repeated similar FAIL は検出できているが、次に見るべき不足 evidence や修正対象が文章依存で、同じ失敗を繰り返しやすいことが確認された。

現状の FAIL は最終的に 1 行の自然文に flatten される（`${title} — ${v.target} — ${v.why_violates} (at ${v.where})`）。AI / 人間はこれを読んで「どこを直すか」「何が足りないか」を再構成する必要があり、spec や guardrail の再読を要求される。

加えて、`no-overengineering` / `code-placement` のような guardrail で blocking 条件が抽象的（「単一呼び出し helper」「設計確認 evidence 不足」「データを所有するモジュール」等）なため、diff で実体検証できないまま blocking 扱いになる false positive が発生している。

## 目的

gate-impl の FAIL を受け取った AI / 人間が、**追加で spec や guardrail を再読しなくても次に取るべき行動が一意に決まる**状態にする。

同時に、類似 FAIL が繰り返される根本原因を断つ：

- **検出側**: 自然文 FAIL を構造化された Observation に置き換える
- **発生源側**: AI prompt に prior FAIL の文脈を渡し、抽象的な guardrail 本文を diff 検証可能な形に書き換える

## 類似 FAIL の根本原因と対応方針

ブレスト中の議論で 5 つの原因を特定し、ca7e のスコープ内で対応する原因を 2 つに絞った：

| 原因 | 説明 | ca7e での扱い |
|---|---|---|
| 1. 修正が別の関連 violation を露呈 | 正当な新規 FAIL | 検出すべきもの。対応不要 |
| 2. AI 評価の非決定性 | 同一コードに対する評価揺れ | retry で吸収。対応外 |
| 3. 過去判断の継承漏れ | flow 内で prior FAIL の判断が次 round に伝達されない | **対応する**（gate-impl prior memory 導入） |
| 4. guardrail 本文が抽象的 | "適切に〜"レベルの記述で AI が round ごとに違う具体例を当てはめる | **対応する**（`no-overengineering` / `code-placement` を diff 検証可能な形に書き換え） |
| 5. コード変更が新規 violation を生む | 正当な新規 FAIL | 検出すべきもの。対応不要 |

cross-flow 学習（別 spec / 別 flow の決定を継承する仕組み）は将来課題として ca7e のスコープ外。

## 設計合意

### A. データ構造

全 phase 共通の wire 形式として NextAction を導入する。

```
nextAction = {
  diagnosis: {
    summary: string,
    observations: Observation[]
  },
  prescription: <phase id>   // 既存 phase 語彙のみ。特殊トークン無し
}
```

Observation は全 phase 共通の単一形状（monomorphic）：

```
observation = {
  kind:           "violation",            // 固定
  failureMode:    string,                 // 列挙型から選択
  requirementRef: string,                 // guardrail_id または spec REQ-XX
  where:          { file, locator? } | null,
  observed:       string,                 // AI が記述（diff/artifact で観測した実態）
  severity:       "blocking" | "advisory", // コード側で自動導出
  refs:           []                       // 将来用エスケープハッチ
}
```

設計判断：

- `expected` field は廃止（`requirementRef` が指す本文から導出可能なため、AI に書かせると hallucination リスク）
- `severity` は AI に判断させず、`failureMode` × policy で自動決定
- AI が出すのは `failureMode`, `requirementRef`, `where`, `observed` の 4 つだけ
- `kind` は将来的な拡張余地を残すが当面は固定値
- monomorphic にする理由: schema validation が 1 つで済み、consumer 側の phase 別分岐が消える

### B. gate-impl の failureMode 列挙

| failureMode | 内容 | severity policy |
|---|---|---|
| `spec-impl-mismatch` | spec の REQ が diff で満たされていない | 常に blocking |
| `guardrail-violation` | guardrail 本文の条件に違反 | 常に blocking |
| `process-evidence-missing` | issue-log / review artifact など process evidence の欠落 | diff で検証可能なケースのみ blocking、それ以外は advisory |

test 関連は test phase の責任で扱うため、gate-impl の failureMode には含めない。

### C. 「次の行動」を nextAction が一元管理

設計思想：「どの phase も基本的に人間判断 phase を自動化したもの」という認識に立脚。専用の escalate phase は作らない。

| 軸 | 担う場所 | 値 |
|---|---|---|
| 次は何を考えるべきか | `nextAction`（envelope `data` 内） | phase id + diagnosis |
| 自動継続可能か | envelope `ok` / `errors[].code` | `OK` / `ESCALATE_RETRY_EXHAUSTED` / `ESCALATE_REPEATED_FAIL` / `NO_PROGRESS_SINCE_LAST_FAIL` |

- リトライ尽き / repeated FAIL でも `prescription` は同じ phase を指す（人間がその phase を引き継ぐ前提）
- `prescription` の値域は既存 phase id の enum で固定。`escalate-user` のような特殊トークンは導入しない
- skill は `ok` で停止判断、`prescription` で次回再開起点を取得

### D. クラス設計（in-memory 層）

プロジェクトの OOP 表現ルールに従い、Observation / Diagnosis / NextAction はクラスとして定義する。

`src/flow/lib/observation.js`（新規）:

- `class Observation` — constructor で invariant 強制（severity が enum 内、observed 非空、where.file が string 等）
- `class Diagnosis` — observations を集約、summary を保持
- `class NextAction` — diagnosis + prescription を集約

各クラスは `toJSON()` / `fromJSON()` / `signature()`（similarity 用）/ `toMarkdown()`（表示用）を持つ。

層分け：

```
[Wire / Persistence 層] stdout JSON, issue-log.json, AI 出力 — JSON 一択
       ↑↓ toJSON() / fromJSON()
[In-memory 層] run-gate.js 内処理, skill, CLI consumer — クラス
```

`src/flow/schemas/next-action/gate.schema.json` は wire 形式の最小外形ドキュメントに留め、詳細 invariant はクラス側に集約する（schema と class の二重定義を避ける）。

### E. AI prompt 改訂方針

改修対
... (truncated)