# Token Reduction A: Prompt Layer Optimization

## Parent Task
0003: Token Reduction Architecture for SDD Flow (compression, augmentation, granularity control, prompt optimization)

## Overview

Refactor prompt construction in agent.js to maximize prefix cache utilization and improve output stability.

## Background

### Measured Data (Log analysis 2026-04-27/28: see 8cae)

- Scope: 154 agent invocations (10 prompt types)
- **Caching is already working even when system prompt is null for all calls** (cache read rate 38.5%)
  - The old claim "system prompt null → caching disabled" was incorrect
- The actual problem is **inefficient cache sharing due to prefix mismatches**
  - spec/draft/impl-guardrail (69 calls) share FMT + RULES + ARTICLES, but cache cannot be shared across phases because the ROLE sentence at the top differs
  - Variable data (PREV_PASSED_IDS, etc.) splits fixed data (GUARDRAIL_ARTICLES, etc.)
- Cache retention duration varies by agent and is continuously tuned

## Scope (re-organized through discussion)

### 1. ROLE + RULES separation into system prompt
- Move ROLE sentence (~200 chars) + RULES (~200 chars) together into system prompt
- After structured output adoption, RULES contain only evaluation criteria (JSON output constraints removed) and are short
- ~400 chars total fits comfortably in system prompt
- For providers that support system prompt (claude: `--system-prompt`), this can be placed outside the cache
- For unsupported providers (codex), keep at the beginning of user prompt (prioritizing instruction strength)
- This allows user prompt to start directly with shared parts (GUARDRAIL_ARTICLES, etc.), maximizing prefix sharing across phases
- Already supported by the `systemPromptFlag()` pattern in provider.js

### 2. OUTPUT FORMAT → structured output
- Remove FMT parts (OUTPUT FORMAT definition text) from the prompt body
- Externalize as a schema via the provider's structured output feature
- **claude**: `--json-schema '<inline JSON>'` — grammar-constrained token generation, output always matches schema
- **codex**: `--output-schema <file>` — JSON Schema specified by file path (`additionalProperties: false` required)
- **Implementation**: Add `jsonSchemaFlag()` method to provider.js (same pattern as `systemPromptFlag()`)
  - ClaudeProvider: `"--json-schema"` (inline)
  - CodexProvider: `"--output-schema"` (file)
  - UserProvider: read from `profile.jsonSchemaFlag`
- **Effect**: Token reduction + reliable improvement in parse stability + expanded prefix sharing range in user prompt

### 3. Maximize user prompt prefix
- Consolidate shared parts (GUARDRAIL_ARTICLES, etc.) at the top of user prompt (after ROLE + RULES move to system prompt)
- Collect variable parts (PREV_PASSED_IDS, DATA_CONTENT, DATA_DIFF, etc.) at the end
- Enable cache sharing across phases
- Requires rewriting reference expressions ("以下の", "listed below", etc.)
- Enforce ordering via PromptBuilder as a mechanism (guaranteed by code, not guidelines)

### ~~4. Instruction deduplication~~ → Removed
- The original claim "duplicate expansion in instruction sections, duplication rate 35–42%" was a misdiagnosis
- The actual cause is structural redundancy in the data itself (repetition of tasks arrays in spec JSON, same content appearing twice in spec + diff, etc.)
- Outside PromptBuilder's scope. The data passing approach needs revisiting, but the affected prompts (impl-compliance, retro) are on hold for a separate change

### ~~5. Context metadata completeness~~ → Removed
- Missing sddPhase / spec is a logging concern, not within prompt optimization scope

## Design: PromptBuilder + agent.call() Responsibility Separation

### PromptBuilder (new: `src/lib/prompt-builder.js`)

Provider-agnostic. Returns only structured data.

```js
const bp = new PromptBuilder()
bp.setRole("You are a spec compliance checker...")
bp.setJsonSchema({ type: "object", properties: { evaluations: { ... } } })
bp.setRules("- Use skip only when...\n- If inapplicable...")
bp.add("## Guardrail Articles", articleList)
bp.add("## Previously Passed Guardrails", passedIds)
bp.add("## Content", specJson)

const { systemPrompt, userPrompt, jsonSchema } = bp.build()
```

- `setRole()`: system prompt candidate (ROLE sentence)
- `setJsonSchema()`: JSON Schema object for structured output
- `setRules()`: task-specific evaluation criteria (JSON output constraints removed)
- `add(header, content)`: variable data, stacked in user prompt in declaration order
- `build()`: returns `{ systemPrompt, userPrompt, jsonSchema }`

### agent.call() (existing extension)

Handles all provider-specific branching.

```js
agent.call(userPrompt, { systemPrompt, jsonSchema, commandId })
```

Inside `_buildInvocation()`:
- `systemPrompt`: if provider.systemPromptFlag() exists, pass via CLI flag; otherwise prepend to userPrompt (existing behavior)
- `jsonSchema`: if provider.jsonSchemaFlag() exists, pass via CLI flag (claude: inline, codex: via temp file); otherwise the provider does not support structured output, so a fallback such as including FMT text in userPrompt is needed

### provider.js (existing extension)

Add `jsonSchemaFlag()` method:
- ClaudeProvider: `"--json-schema"` (inline JSON string)
- CodexProvider: `"--output-schema"` (file path)
- UserProvider: read from `profile.jsonSchemaFlag`

### Call sites (each command)

```js
// Before: manually assembling a string
const prompt = [role, fmt, rules, articles, content].join("\n")
agent.call(prompt, { commandId })

// After: structured via PromptBuilder
const bp = new PromptBuilder()
bp.setRole(role)
bp.setJsonSchema(guardrailEvalSchema)
bp.setRules(rules)
bp.add("## Guardrail Articles", articles)
bp.add("## Previously Passed Guardrails", passedIds)
bp.add("## Content", content)
const { systemPrompt, userPrompt, jsonSchema } = bp.build()
agent.call(userPrompt, { systemPrompt, jsonSchema, commandId })
```

## Target Prompts (reviewed, reflecting spec 241)

| Type | Action | Notes |
|---|---|---|
| spec-guardrail | In scope | Migrate to PromptBuilder |
| draft-guardrail | In scope | Same structure as spec-guardrail |
| impl-guardrail | On hold | Separate diff-related change planned; no impact in spec 241 |
| impl-compliance | On hold | No prompt structure changes in spec 241 |
| retro | Out of scope | spec 241 (R6) migrates to static evaluation via test-map.json; AI call itself will be gone (existing prompt only as fallback) |
| auto-check | In scope | Structured output for FMT only |
| enrich | On hold | docs-related items on hold |
| review-diff | Out of scope | Markdown output; spec 241 (R7) switches to per-requirement partial diff, reducing token count, but not a prompt structure optimization target |
| validate-proposals | Out of scope | Markdown output |
| translate | In scope | Structured output for FMT only |

## Source Files to Modify

- `src/lib/prompt-builder.js` — new; PromptBuilder class
- `src/lib/provider.js` — add `jsonSchemaFlag()` method
- `src/lib/agent.js` — add jsonSchema handling to `_buildInvocation()`
- `src/flow/lib/run-gate.js:buildGuardrailPromptFromFiltered()` (L538–586) — migrate to PromptBuilder

## Related Research
- 8cae: Structural analysis for prompt cache optimization (parts list, composition matrix, sharing relationships, post-change ordering)

## Dependencies
- Prerequisite for the other 0003 sub-tasks (B, C, D)

<details>
<summary>ja</summary>

[ENHANCE] トークン削減 A: プロンプト層最適化（system prompt 分離・instruction 重複排除・OUTPUT FORMAT 標準化・メタデータ補完）

# トークン削減 A: プロンプト層最適化

## 親タスク
0003: SDD フローのトークン削減アーキテクチャ（圧縮・増強・粒度制御・プロンプト最適化）

## 概要

agent.js のプロンプト構築を改修し、プレフィックスキャッシュの最大化と出力安定性の向上を図る。

## 背景

### 実測データ（2026-04-27/28 ログ分析: 8cae 参照）

- 分析対象: 154 件の agent 呼び出し（10 プロンプトタイプ）
- **system prompt が全件 null でもキャッシュは既に効いている**（cache read rate 38.5%）
  - 旧記述「system prompt null → caching 無効」は誤り
- 問題は **プレフィックス不一致によるキャッシュ共有の非効率**
  - spec/draft/impl-guardrail（69 calls）は FMT + RULES + ARTICLES を共有するが、先頭の ROLE 文が異なるためフェーズ間キャッシュが効かない
  - 可変データ（PREV_PASSED_IDS 等）が固定データ（GUARDRAIL_ARTICLES 等）を分断している
- キャッシュ保持期間はエージェントごとに異なり常にチューニングされている

## スコープ（議論により再整理）

### 1. ROLE + RULES の system prompt 分離
- ROLE 文（~200 chars）+ RULES（~200 chars）をセットで system prompt に移動
- structured output 導入後の RULES は判定基準のみ（JSON 出力制約は除去）で短い
- 合計 ~400 chars で system prompt に十分収まる
- system prompt 対応 provider（claude: `--system-prompt`）ではキャッシュ外に出せる
- 非対応 provider（codex）では user prompt 先頭に残す（指示力を優先）
- これにより user prompt は共有パーツ（GUARDRAIL_ARTICLES 等）からいきなり始まり、フェーズ間のプレフィックス共有が最大化される
- provider.js の `systemPromptFlag()` パターンで既に対応可能

### 2. OUTPUT FORMAT の structured output 化
- FMT パーツ（OUTPUT FORMAT 定義テキスト）をプロンプト本文から除去
- provider の structured output 機能でスキーマとして外出しする
- **claude**: `--json-schema '<inline JSON>'` — トークン生成時に文法制約、出力が必ずスキーマに一致
- **codex**: `--output-schema <file>` — ファイルパスで JSON Schema 指定（`additionalProperties: false` 必須）
- **実装方針**: provider.js に `jsonSchemaFlag()` メソッドを追加（`systemPromptFlag()` と同じパターン）
  - ClaudeProvider: `"--json-schema"` (インライン)
  - CodexProvider: `"--output-schema"` (ファイル)
  - UserProvider: `profile.jsonSchemaFlag` から読む
- **効果**: トークン削減 + パース安定性の確実な向上 + user prompt プレフィックスの共有範囲拡大

### 3. user prompt プレフィックス最大化
- 共有パーツ（GUARDRAIL_ARTICLES 等）を user prompt の先頭に集約（ROLE + RULES は system prompt へ移動済み）
- 可変パーツ（PREV_PASSED_IDS, DATA_CONTENT, DATA_DIFF 等）を末尾にまとめる
- フェーズをまたいだキャッシュ共有を実現
- 参照表現（「以下の」「listed below」等）の書き換えが必要
- 仕組みとして PromptBuilder で順序を強制する（ガイドラインではなくコードで保証）

### ~~4. instruction 重複排除~~ → 削除
- 元の記述「instruction セクションの重複展開、重複行率 35-42%」は誤診
- 実態はデータ自体の構造的冗長性（spec JSON 内の tasks 配列の繰り返し、spec + diff で同じ内容が二重に含まれる等）
- PromptBuilder の範囲外。データの渡し方の見直しが必要だが、該当プロンプト（impl-compliance, retro）は別件改修で保留中

### ~~5. コンテキストメタデータ完全性~~ → 削除
- sddPhase / spec の欠落はログの問題であり、プロンプト最適化のスコープ外

## 設計: PromptBuilder + agent.call() の責務分離

### PromptBuilder（新規: `src/lib/prompt-builder.js`）

provider を知らない。構造化データを返すだけ。

```js
const bp = new PromptBuilder()
bp.setRole("You are a spec compliance checker...")
bp.setJsonSchema({ type: "object", properties: { evaluations: { ... } } })
bp.setRules("- Use skip only when...\n- If inapplicable...")
bp.add("## Guardrail Articles", articleList)
bp.add("## Previously Passed Guardrails", passedIds)
bp.add("## Content", specJson)

const { systemPrompt, userPrompt, jsonSchema } = bp.build()
```

- `setRole()`: system prompt 候補（ROLE 文）
- `setJsonSchema()`: structured output 用 JSON Schema オブジェクト
- `setRules()`: タスク固有の判定基準（JSON 出力制約除去済み）
- `add(header, content)`: 可変データ。宣言順で user prompt にスタック
- `build()`: `{ systemPrompt, userPrompt, jsonSchema }` を返す

### agent.call()（既存拡張）

provider 固有の分岐を一手に引き受ける。

```js
agent.call(userPrompt, { systemPrompt, jsonSchema, commandId })
```

`_buildInvocation()` 内で:
- `systemPrompt`: provider.systemPromptFlag() があれば CLI フラグで渡す。なければ userPrompt 先頭に結合（既存動作）
- `jsonSchema`: provider.jsonSchemaFlag() があれば CLI フラグで渡す（claude: インライン、codex: 一時ファイル経由）。なければ provider が structured output 非対応ということなので、FMT テキストを userPrompt に含める等のフォールバックが必要

### provider.js（既存拡張）

`jsonSchemaFlag()` メソッド追加:
- ClaudeProvider: `"--json-schema"` (インライン JSON 文字列)
- CodexProvider: `"--output-schema"` (ファイルパス)
- UserProvider: `profile.jsonSchemaFlag` から読む

### 呼び出し側（各コマンド）

```js
// Before: 文字列を手で組み立て
const prompt = [role, fmt, rules, articles, content].join("\n")
agent.call(prompt, { commandId })

// After: PromptBuilder で構造化
const bp = new PromptBuilder()
bp.setRole(role)
bp.setJsonSchema(guardrailEvalSchema)
bp.setRules(rules)
bp.add("## Guardrail Articles", articles)
bp.add("## Previously Passed Guardrails", passedIds)
bp.add("## Content", content)
const { systemPrompt, userPrompt, jsonSchema } = bp.build()
agent.call(userPrompt, { systemPrompt, jsonSchema, commandId })
```

## 対象プロンプト（精査結果、spec 241 反映）

| タイプ | 対応 | 備考 |
|---|---|---|
| spec-guardrail | 対象 | PromptBuilder 移行 |
| draft-guardrail | 対象 | spec-guardrail と同一構造 |
| impl-guardrail | 保留 | diff 関連の別件改修予定あり。spec 241 では影響なし |
| impl-compliance | 保留 | spec 241 ではプロンプト構造に変更なし |
| retro | 対象外 | spec 241 (R6) で test-map.json による静的判定に移行。AI 呼び出し自体がなくなる（フォールバック時のみ既存プロンプト） |
| auto-check | 対象 | FMT を structured output に出すのみ |
| enrich | 保留 | docs 関連は保留 |
| review-diff | 対象外 | Markdown 出力。spec 241 (R7) で要件単位の部分 diff に変わりトークン量は減るが、プロンプト構造最適化の対象ではない |
| validate-proposals | 対象外 | Markdown 出力 |
| translate | 対象 | FMT を structured output に出すのみ |

## 修正対象ソースコード

- `src/lib/prompt-builder.js` — 新規。PromptBuilder クラス
- `src/lib/provider.js` — `jsonSchemaFlag()` メソッド追加
- `src/lib/agent.js` — `_buildInvocation()` に jsonSchema ハンドリング追加
- `src/flow/lib/run-gate.js:buildGuardrailPromptFromFiltered()` (L538-586) — PromptBuilder 移行

## 関連調査
- 8cae: プロンプトキャッシュ最適化のための構造分析（パーツ一覧・構成マトリクス・共有関係・変更後の順序）

## 依存関係
- 他の 0003 サブタスク（B, C, D）の前提となる

</details>