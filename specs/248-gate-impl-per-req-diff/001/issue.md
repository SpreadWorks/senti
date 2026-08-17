### Overview
Change the gate-impl (requirement implementation check) structure from injecting the full spec.json + diff every time, to splitting by requirement and passing only the diffs for related files.

### Background
- gate-impl consumed 1,997K cacheCreate tokens in the past 2 days (42.7% of all phases)
- Average 182K tokens per spec / 3.4 invocations
- The majority of the prompt is the full git diff (75–118 KB)
- The full diff is injected every time, resending the same diff on each retry

### Current Structure
`buildImplCheckPrompt(specText, diff, knownIds)` (run-gate.js:1145)
- Combines full spec.json + full diff + requirement IDs into a single prompt
- Has the AI determine whether each requirement is implemented in the diff
- Re-injects the full diff on retries (skipping with previouslyPassedIds exists, but diff volume is unchanged)

### Prior Art
The same problem has already been addressed in impl review (review.js) (spec 242: impl-review-token-opt):
- `shouldUseLoopReview(fileCount)`: loop mode for 10+ files
- `collectPerFileDiffs()`: runs git diff individually per file
- `groupByDiffContent()`: grouping by identical diff content (deduplication)
- `runLoopReview()`: AI invocation per file

### Proposed Fix
1. Use file-map.json to get the requirement → files mapping
2. Extract only the diffs for related files per requirement
3. Invoke the AI per requirement (relevant spec section + related diffs)
4. On retry, re-evaluate only failed requirements
5. Share and reuse `collectPerFileDiffs()` / `groupByDiffContent()` from impl review

### Estimated Impact
Estimated from file-map.json and actual diff sizes:

| spec | current | after split | reduction |
|------|---------|-------------|-----------|
| 246-test-map-null-sentinel | 261 KB | 36 KB | 86% |
| 247-review-pipeline-simplification | 416 KB | 128 KB | 69% |

Average diff per requirement: 1–4 KB (2–5% of total diff).

Overall impact on cacheCreate (combined with review-spec improvement):

| phase | current | after | reduction |
|-------|---------|-------|-----------|
| review-spec | 1,236K | 260K | -79% |
| gate-impl | 1,997K | 459K | -77% |
| other | 1,444K | 1,444K | 0% |
| total | 4,677K | 2,163K | **-54%** |

### Affected Scope
- `src/flow/lib/run-gate.js`: split buildImplCheckPrompt, add per-requirement loop
- `src/flow/commands/review.js`: extract collectPerFileDiffs / groupByDiffContent to shared lib layer
- `src/flow/lib/req-map.js`: read file-map.json (existing)

<details>
<summary>ja</summary>

[ENHANCE] gate-impl の per-requirement diff 分割によるトークン削減

### 概要
gate-impl（requirement 実装確認）で spec.json + diff 全文を毎回投入している構造を、requirement 単位に分割して関連ファイルの diff だけ渡す方式に変更する。

### 背景
- gate-impl は直近2日で cacheCreate 1,997K tokens を消費（全フェーズの 42.7%）
- spec あたり平均 182K tokens / 3.4回呼び出し
- プロンプトの大部分は git diff 全文（75-118KB）
- 毎回全 diff を投入するため、リトライのたびに同じ diff を再送信

### 現状の構造
`buildImplCheckPrompt(specText, diff, knownIds)` (run-gate.js:1145)
- spec.json 全文 + diff 全文 + requirement IDs を1プロンプトに結合
- AI に「各 requirement が diff で実装されているか」を判定させる
- リトライ時も全 diff を再投入（previouslyPassedIds でスキップはあるが diff 量は同じ）

### 先例
impl review (review.js) に同じ問題の対策が実装済み（spec 242: impl-review-token-opt）:
- `shouldUseLoopReview(fileCount)`: 10ファイル以上でループモード
- `collectPerFileDiffs()`: ファイルごとに個別に git diff 実行
- `groupByDiffContent()`: 同一 diff のグループ化（重複排除）
- `runLoopReview()`: ファイル単位で AI 呼び出し

### 修正案
1. file-map.json で requirement → ファイルの対応を取得
2. requirement ごとに関連ファイルの diff のみ抽出
3. requirement 単位で AI を呼び出し（spec の該当セクション + 関連 diff）
4. リトライ時は fail した requirement のみ再判定
5. impl review の `collectPerFileDiffs()` / `groupByDiffContent()` を共通化して再利用

### 推定効果
file-map.json と実 diff サイズからの推定:

| spec | 現状 | 分割後 | 削減率 |
|------|------|-------|-------|
| 246-test-map-null-sentinel | 261KB | 36KB | 86% |
| 247-review-pipeline-simplification | 416KB | 128KB | 69% |

requirement あたりの diff は平均 1-4KB（全体 diff の 2-5%）。

全体の cacheCreate への影響（review-spec 改善と合算）:

| フェーズ | 現状 | 改善後 | 削減 |
|---------|------|-------|------|
| review-spec | 1,236K | 260K | -79% |
| gate-impl | 1,997K | 459K | -77% |
| その他 | 1,444K | 1,444K | 0% |
| 合計 | 4,677K | 2,163K | **-54%** |

### 影響範囲
- `src/flow/lib/run-gate.js`: buildImplCheckPrompt の分割、per-requirement ループ追加
- `src/flow/commands/review.js`: collectPerFileDiffs / groupByDiffContent の共通化（lib 層へ移動）
- `src/flow/lib/req-map.js`: file-map.json の読み込み（既存）

</details>