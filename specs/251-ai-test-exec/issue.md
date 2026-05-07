## Background

`run-retro.js`'s `tryStaticEvaluation()` hardcodes test execution via `execFileSync("node", ["--test", "--test-reporter", "tap", ...])` at L374 and has a `.test.js` / `.spec.js` / `.mjs` extension filter at L367. Even after spec 249 (a00f) migrated to header-declaration-based approach, the Node.js project assumption remains on the retro side, causing the static path to fail for PHP/Python projects and falling back to AI evaluation.

Additionally, having retro parse TAP output to verify requirement coverage is a duplication of responsibilities. Test execution and result judgment are the responsibility of dedicated steps; retro should simply trust those results and aggregate them.

## Design Decisions (Agreed Upon After Discussion)

For language-agnostic test execution, a runner-declaration approach via preset/config was considered, but the final decision was to **delegate execution to an AI agent**. Reasons:
- AI can absorb any test framework and output format
- No need to maintain runner definitions on the preset side
- No language-dependent logic in the sdd-forge core

Hallucination countermeasures are **separated by failure point**:
- Failure point 1: Was the test correctly written? → test-review (existing)
- Failure point 2: Was the test result correctly judged? → test-result-review (new)
- Failure point 3: Was the test actually executed? → test-result-review verifies raw output logs, addressing this integrally

Canary injection and agent transcript verification are unnecessary (consolidated into test-result-review).

## Separation of Concerns Rule

**MUST: Test execution MUST only occur in the dedicated step of the impl phase. Subsequent steps such as retro / review-impl / gate-impl MUST only read the result file and MUST NOT re-run tests.**

Reasons:
- Minimize execution cost by consolidating into a single step (one AI agent call per spec)
- Structurally eliminate "diverging results from multiple evaluations of the same code"
- Clear responsibility for each step (execution / verification / review / aggregation)

Retro MUST NOT execute when the result file is absent, and MUST return an explicit error stating "test-execute has not been run". Fallback AI evaluation is abolished.

## Changes

### 1. New `test-execute` Step

Added as a flow step (after impl → done, before review-impl). AI agent handles test execution:
- Agent determines the project's test runner and executes it via Bash tool
- Writes results to a result file using a custom minimal schema
- Raw output (stdout/stderr) is saved **as-is** to a separate file (AI summarization prohibited)

**Result file schema** (custom, minimal):
```json
{
  "version": "1",
  "raw_output_path": ".tmp/test-execution-<spec>.log",
  "summary": [
    { "id": "R1", "result": "pass" },
    { "id": "R4", "result": "fail", "error": "<concise error description>" }
  ]
}
```

Does not conform to existing formats like JUnit / TAP (to maintain language/framework independence).
No caching/invalidation: test-execute always runs when called. The flow controls execution timing.

### 2. New `test-result-review` Step

Added as a flow step (after test-execute).

**Inputs**:
- Result file (schema above)
- Raw output file (raw stdout/stderr)
- Actual test files
- spec.json (requirement definitions)

**Required verification items in the reviewer prompt**:
- Do file paths and line numbers appearing in raw output exist in the actual code?
- Do requirement IDs reported as passing appear in the raw output?
- Is the test count consistent with the number of test occurrences in raw output?
- Does the stack trace for reported failures point to the correct line in actual code?
- Is the sum of durations consistent with the reported total duration?

**Design constraints**:
- Raw output must not be AI-summarized; saved as-is
- Reviewer is invoked in a separate agent session from the executor
- Model differentiation (executor=Claude / reviewer=Codex, etc.) is recommended but not required

### 3. Enhanced Header Coverage Check in `test-review`

Elevate the warning at review.js:893-912 to a FAIL condition:
- If even one testable requirement lacks a header declaration, test-review FAILs
- Add header lie detection to `buildGapAnalysisPrompt` (detect cases where header declares R4 but the content does not verify R4)

### 4. Simplify `retro tryStaticEvaluation`

- Remove dependencies on `node --test` execution, TAP parsing, `extractReqResults`, `parseTapOutput`, `evaluateReqByResults`
- **Retro performs no test execution whatsoever**
- Role: read the result file output by test-execute and aggregate pass/fail per requirement
- When result file is absent: explicit error "test-execute step has not been run" (no fallback)
- Remove `.test.js` / `.spec.js` extension filter
- Abolish AI fallback evaluation

### 5. Clean Up Unused Functions in `req-map.js`

Verify other consumers of `parseTapOutput` / `extractReqResults` / `evaluateReqByResults` (no longer called by retro), and delete if none exist.

## Flow Step Order (After Changes)

```
impl → done
  ↓
test-execute    ← AI agent runs tests (sole execution point)
  ↓
test-result-review    ← Cross-reference raw output with actual code for hallucination detection
  ↓
review-impl    ← Read result file only
  ↓
gate-impl    ← Read result file only
  ↓
retro    ← Read result file only
```

## Benefits

- Retro becomes language-agnostic (no test execution logic)
- Test execution is truly language-agnostic (AI agent absorbs any framework)
- Clear separation: test-execute=execution, test-result-review=result judgment+execution verification, retro/review-impl/gate-impl=read only
- Test execution occurs **exactly once** per spec (cost efficiency and consistency)
- Hallucination countermeasures consolidated into a single step (test-result-review), no additional mechanisms (canary, etc.) needed

## Assumptions and Limitations

**Assumptions**:
- Agent uses Claude / Codex CLI or similar with actual Bash tool calls
- Relies on transparency of agent infrastructure (tool call fabrication is rare)
- Test execution environment is pre-configured (dependencies installed, DB running, etc.)

**Remaining limitations** (accepted):
- Cases where AI fabricates results after execution are detected via raw output consistency checks, but coherent fabrication is theoretically possible though difficult
- CI-only tests (requiring production DB / API keys) cannot run in the agent environment → separate CI integration needed
- Long-running e2e tests (30+ minutes) require agent timeout configuration
- Future agent diversification (low-transparency lightweight LLMs, etc.) may become problematic — canary injection etc. can be considered then

## Scope Split Consideration

Due to implementation size, can be split into 2 specs:
- **dcb2-A**: test-execute step + result file spec + test-result-review new addition
- **dcb2-B**: retro tryStaticEvaluation simplification + test-review enhancement + req-map.js cleanup

A is a prerequisite and must come before B.

<details>
<summary>ja</summary>

[ENHANCE] テスト実行を AI agent 委託化し、結果検証を test-result-review に集約、retro static 評価を簡素化

## 背景

run-retro.js の tryStaticEvaluation() は L374 で execFileSync("node", ["--test", "--test-reporter", "tap", ...]) によりテスト実行をハードコードし、L367 で .test.js / .spec.js / .mjs 拡張子フィルタを持つ。spec 249 (a00f) でヘッダー宣言ベースに移行した後も Node.js プロジェクト前提が retro 側に残っており、PHP / Python 等のプロジェクトでは static パスが機能せず AI フォールバックに頼る。

加えて retro が TAP 出力をパースして要件カバレッジを検証するのは責務の重複。テスト実行・結果判定は専用ステップの責務であり、retro はその結果を信頼して集計するだけで足りる。

## 設計判断（議論を経た合意）

テスト実行系の言語非依存化は、preset / config でランナーを宣言する案も検討したが、最終的に **AI agent に実行を委託する方針を採用**。理由:
- 任意のテストフレームワーク・出力形式を AI が吸収できる
- preset 側にランナー定義を持つ必要がなくなる
- sdd-forge コアに言語依存ロジックを持ち込まない

ハルシネーション対策は **発生地点別に責務分離**:
- 失敗点 1: テストが正しく作れたか → test-review（既存）
- 失敗点 2: テスト結果が正しく判断できているか → test-result-review（新設）
- 失敗点 3: テストが本当に実行されたか → test-result-review が raw output ログを検証することで統合的に対応

canary 注入や agent transcript 検証は不要（test-result-review に統合）。

## 責務分離の鉄則

**MUST: テスト実行は impl フェーズの専用ステップでのみ行う。retro / review-impl / gate-impl 等の後続ステップは結果ファイルを読むだけで、テストを再実行してはならない。**

理由:
- 単一ステップに集約することで実行コストを最小化（AI agent 呼び出しは spec ごとに 1 回）
- 「同じコードに対する複数評価結果のズレ」を構造的に排除
- 各ステップの責務が明確化（実行 / 検証 / レビュー / 集計）

retro は結果ファイル不在時には実行せず、明示的なエラーで「test-execute が未実行である」旨を返す。fallback の AI 評価は廃止。

## 変更点

### 1. test-execute ステップの新設

flow ステップとして追加（impl → done 後、review-impl 前）。AI agent がテスト実行を担当:
- agent はプロジェクトのテストランナーを判断し Bash tool で実行
- 実行結果を独自最小スキーマで結果ファイルに書き出す
- raw output（stdout/stderr）は別ファイルに**そのまま**保存（AI 要約禁止）

**結果ファイルスキーマ**（独自・最小）:
```json
{
  "version": "1",
  "raw_output_path": ".tmp/test-execution-<spec>.log",
  "summary": [
    { "id": "R1", "result": "pass" },
    { "id": "R4", "result": "fail", "error": "<簡潔なエラー内容>" }
  ]
}
```

JUnit / TAP 等の既存フォーマットに合わせない（言語・framework 非依存を保つため）。
キャッシュ・invalidation は持たない: test-execute が呼ばれたら必ず実行する。実行のタイミングは flow が制御する。

### 2. test-result-review を新設

flow ステップとして追加（test-execute 後）。

**入力**:
- 結果ファイル（上記スキーマ）
- raw output ファイル（生 stdout/stderr）
- 実テストファイル
- spec.json（要件定義）

**reviewer プロンプトに必須の検算項目**:
- raw output に登場するファイルパス・行番号が実コードに存在するか
- pass 報告された要件 ID が raw output に出現するか
- テスト件数と raw output 中のテスト出現数が整合するか
- 失敗報告のスタックトレースが実コードの該当行を指しているか
- duration の合計が報告 total duration と整合するか

**設計制約**:
- raw output は AI 要約禁止、生のまま保存
- reviewer は executor と別 agent session で invoke
- モデル差異化（executor=Claude / reviewer=Codex 等）は推奨だが必須ではない

### 3. test-review のヘッダーカバレッジチェック強化

review.js:893-912 の警告止まりを FAIL 条件に昇格:
- 「ヘッダー宣言が無い testable 要件」が一つでもあれば test-review FAIL
- buildGapAnalysisPrompt にヘッダー嘘検出を追加（ヘッダーで R4 宣言だが R4 を verify する内容が無いケースを gap として検出）

### 4. retro tryStaticEvaluation の簡素化

- node --test 実行、TAP パース、extractReqResults、parseTapOutput、evaluateReqByResults への依存を削除
- **retro はテスト実行を一切しない**
- 役割: test-execute が出力した結果ファイルを読み、要件ごとの pass/fail を集計するだけ
- 結果ファイル不在時は "test-execute step has not been run" として明示的エラー（fallback 無し）
- .test.js / .spec.js 拡張子フィルタも削除
- AI フォールバック評価も廃止

### 5. req-map.js の不要関数整理

retro から呼ばれなくなった parseTapOutput / extractReqResults / evaluateReqByResults の他消費者を確認し、無ければ削除。

## flow ステップの並び（変更後）

```
impl → done
  ↓
test-execute    ← AI agent がテスト実行（唯一の実行ポイント）
  ↓
test-result-review    ← raw output と実コードを照合してハルシネーション検出
  ↓
review-impl    ← 結果ファイルを読むだけ
  ↓
gate-impl    ← 結果ファイルを読むだけ
  ↓
retro    ← 結果ファイルを読むだけ
```

## 効果

- retro が言語非依存になる（テスト実行系を持たない）
- テスト実行が真に言語非依存（AI agent が任意の framework を吸収）
- 責務分離: test-execute=実行、test-result-review=結果判定+実行検証、retro/review-impl/gate-impl=読むだけ
- テスト実行が spec ごとに **1 回のみ**（コスト・一貫性確保）
- ハルシネーション対策が単一ステップ（test-result-review）に集約され、追加機構（canary 等）不要

## 前提と限界

**前提**:
- agent は Claude / Codex CLI など実 Bash tool 呼び出しを行うものを使用
- agent インフラの透明性に依拠（tool 呼び出し捏造は稀）
- テスト実行環境は事前に整っている（dependencies インストール済み、DB 起動済み等）

**残る限界**（許容）:
- AI が実行後に結果を改竄するケースは raw output 整合性で検出を試みるが、整合的捏造は困難ながら理論上可能
- CI 専用テスト（本番 DB / API キー必須）は agent 環境で実行不能 → 別途 CI 連携が必要
- 長時間 e2e テスト（30 分超等）は agent timeout 設定が必要
- 将来 agent の多様化（透明性の低い軽量 LLM 利用等）が問題化したら、canary 注入等を追加検討

## スコープ分割の検討

実装規模が大きいため 2 spec に分割可能:
- **dcb2-A**: test-execute ステップ + 結果ファイル仕様 + test-result-review 新設
- **dcb2-B**: retro tryStaticEvaluation 簡素化 + test-review 強化 + req-map.js 整理

A が前提条件として B より先に必要。

</details>