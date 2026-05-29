## Background

Guardrail violations are accumulated in `issue-log.json` and review findings in `review.md` on a per-spec basis, but there is no means to aggregate or visualize them across specs. Furthermore, there is no mechanism to measure whether the repair steps after review (draft/spec repair steps, manual application of impl review proposals, test review fixes, etc.) actually resolved the findings or whether the same findings are being regenerated in subsequent attempts.

As a result, the following remain invisible:
- Which guardrails are being violated frequently
- Whether similar findings existed in the past
- Which phases concentrate the most problems
- Whether repair is effective or merely consuming attempts

### Why Automatic Generation Was Not Adopted

Initially, automatically generating guardrails from frequent violation patterns was considered, but was abandoned for the following reasons:

- Adding or modifying guardrails is not a simple task of "add one when it triggers repeatedly." Human judgment is required to determine whether the root cause lies in the guardrail wording, the design pattern, or the instruction text
- Defining the auto-promotion logic (frequency/severity thresholds, conflict resolution with existing guardrails, granularity design) in a generic way is not practical
- Incorrectly auto-added guardrails risk degrading the quality of the entire flow

Therefore, the first step is to build a foundation for the "observe → human judgment → improve" cycle, with automation as a subsequent phase.

## Approach

Provide a report command that aggregates past flow artifacts across specs to support human-driven improvement decisions. Make **review finding trends** and **repair effectiveness** visible from both sides on the same data foundation.

## Data Sources

| Source | Content | Questions Answered |
|---|---|---|
| `specs/*/issue-log.json` | Guardrail violations, attempt history, step transition records | What keeps breaking, how many attempts to exit |
| `specs/*/review.md` (must be stored per attempt) | History of review findings | Were there similar findings in the past, were the same findings regenerated between attempts |
| `specs/*/<phase>-artifact.json` (e.g., `impl-review.json`) | Structured data of review output | blocking / non-blocking classification, finding categories |
| git log (repair commits) | What changed in repair | Correspondence between findings and diffs |

### Prerequisite Schema Preparation

If the current storage format does not satisfy the following, the necessary additions will be made within this task. This is not large enough to split into a separate task and will be treated as part of this task:

- Review artifacts (review.md / review JSON) must remain as history per attempt (not overwritten by the latest)
- Repair steps must be able to reference the corresponding finding id (extension of the recording format in issue-log)

## Decision Support Provided by the Report

### Review Finding Trends (cross-spec aggregation)

| Perspective | Implication |
|---|---|
| Frequently occurring guardrail violations | Guardrail wording is ambiguous, or a deep-rooted problem as a design pattern |
| Guardrails with zero violations | Possibly unnecessary, or detection is too lenient |
| Violations concentrated in a specific phase | Possible problem in the instruction text for that phase |
| Violations concentrated in a specific spec / task type | Insufficient preset or domain-specific guardrails |
| Trends in review finding categories | Visualization of recurring finding patterns |
| Search for past similar findings | Detection of recurrence of the same problem, reference to known patterns |

### Repair Effectiveness (within-spec attempt-to-attempt analysis)

| Perspective | Implication |
|---|---|
| Rate at which findings disappeared in the next attempt | Whether repair is working |
| Rate at which findings reappeared in a different form in the next attempt | Whether repair is becoming superficial or ad hoc |
| Rate of reappearance of the same finding category between attempts | Stability of review prompt, or finding patterns that cannot be repaired |
| Correspondence between repair diff scope and finding references | Whether repair actually touched the finding location |
| Specs that reached attempt limit without repair | Proportion that exited via forced ADVANCE / human judgment |

## Implementation

Place as `sdd-forge metrics guardrail` or `metrics review` as a sibling command to `metrics token`.

### Input
- Cross-scan guardrail entries, attempt history, and step transitions in `specs/*/issue-log.json`
- Keyword-index finding patterns from `specs/*/review.md` history (per attempt)
- Reference blocking / non-blocking classification from review JSON artifacts
- Retrieve repair commit diffs from git log as needed

### Output (text / json / csv)

Review finding side:
- Violation count and phase distribution per guardrail
- Violation concentration per phase
- List of guardrails with zero violations
- Frequency by review finding category
- Time-series trends (based on `finalizedAt`)

Repair effectiveness side:
- Finding disappearance rate / reappearance rate between attempts
- Unrepairable patterns (specs where the same category persisted across multiple attempts)
- List of specs that exited at attempt limit with reasons
- Presence or absence of correspondence between repair diffs and finding references

### Search Feature
- Keyword-based search of review history (retrieve similar cases from past finding patterns)

## Improvement Cycle Stages

1. **Report** (this task) → Human reviews and decides, manually improves guardrails / prompts / phase design
2. **Proposal** (future) → AI suggests improvements based on the report, human approves
3. **Auto-apply** (further ahead) → Only low-risk items are applied automatically

## Related
- e0b3: Automatic improvement loop (as auto-execution increases issue-log data, the accuracy of this report will also improve)
- cdb2: Review convergence improvement (done). This task also serves to measure the effectiveness of the blocking / non-blocking separation and advisory non-consumption established in cdb2
- Considering introducing a polish phase after impl. The effectiveness of polish (applied improvement categories, test green retention rate) is also expected to be measured on the same foundation

<details>
<summary>ja</summary>

フロー観測レポート（review 指摘傾向・repair 効果・改善サイクル）

## 背景

guardrail 違反は issue-log.json に、review 指摘は review.md に spec 単位で蓄積されているが、横断的に集計・可視化する手段がない。さらに、review 後の repair（draft/spec の repair step、impl review proposal の手動 apply、test review の修正等）が「実際に指摘を解消したか」「同じ指摘が次 attempt で再生成されていないか」を測る仕組みも無い。

そのため以下が見えない:
- どの guardrail が頻繁に破られているか
- 過去に似た指摘があったか
- どの phase で問題が集中しているか
- repair が役に立っているのか、attempt を消費しているだけか

### 自動生成を採用しない理由

当初は「頻出パターンから guardrail を自動生成する」方向を検討したが、以下の理由で断念した:

- guardrail の追加・修正は「何度も引っかかったら足す」という単純作業ではない。違反の根本原因が guardrail の文言にあるのか、設計パターンにあるのか、指示文にあるのかは人間の判断が必要
- 自動昇格のロジック（頻出回数・重大度の閾値、既存 guardrail との衝突解決、粒度設計）を汎用的に定義するのは現実的でない
- 誤った guardrail の自動追加はフロー全体の品質を下げるリスクがある

したがって、まず「観測→人間が判断→改善」のサイクルを回せる基盤を作り、自動化はその先の段階とする。

## 方針

過去のフロー成果物を横断集計するレポートコマンドを提供し、人間による改善判断を支援する。**review の指摘傾向**と **repair の効果**を同じデータ基盤の上で両側から見られるようにする。

## データソース

| ソース | 内容 | 答える問い |
|---|---|---|
| `specs/*/issue-log.json` | guardrail 違反、attempt 履歴、step 遷移の記録 | 何が繰り返し壊れているか、何 attempt で抜けたか |
| `specs/*/review.md`（attempt 単位で保存される必要あり） | review 指摘の履歴 | 過去に似た指摘があったか、attempt 間で同じ指摘が再生成されたか |
| `specs/*/<phase>-artifact.json`（impl-review.json 等） | review 出力の構造化データ | blocking / non-blocking 分類、finding カテゴリ |
| git log（repair commit） | repair で何が変わったか | 指摘と diff の対応 |

### 前提となる schema 整備

現状の保存形式が以下を満たしていなければ、本タスク内で必要な分だけ追加する。「別タスクに切り出す」ほどの規模ではなく、本タスクの一部として扱う:

- review artifact（review.md / review JSON）が attempt 単位で履歴として残ること（最新で上書きされない）
- repair step が「対応する finding id」を参照できること（issue-log への記録形式の拡張）

## レポートが提供する判断材料

### review 指摘の傾向（cross-spec aggregation）

| 観点 | 示唆 |
|---|---|
| 頻出する guardrail 違反 | guardrail の文言が曖昧、または設計パターンとして根深い問題 |
| 一度も引っかからない guardrail | 不要か、検知が甘い |
| 特定 phase に集中する違反 | その phase の指示文に問題がある可能性 |
| 特定 spec / タスク種別に集中 | プリセットや領域固有の guardrail が不足 |
| review 指摘カテゴリの傾向 | 繰り返される指摘パターンの可視化 |
| 過去の類似指摘の検索 | 同じ問題の再発検知、既知パターンの参照 |

### repair の効果（within-spec attempt-to-attempt analysis）

| 観点 | 示唆 |
|---|---|
| 指摘が次 attempt で消失した率 | repair が効いているか |
| 指摘が次 attempt で形を変えて再出現した率 | repair が表面的・場当たり的になっていないか |
| 同 finding category の attempt 間再出現率 | review prompt の安定性、または repair 不能な指摘パターン |
| repair の diff 範囲と finding 参照の対応 | repair が指摘箇所を実際に触っているか |
| repair なしで attempt 上限到達した spec | 強制 ADVANCE / 人間判定で抜けた割合 |

## 実装

`sdd-forge metrics guardrail` または `metrics review` として `metrics token` の兄弟コマンドに配置する。

### 入力
- `specs/*/issue-log.json` の guardrail エントリ、attempt 履歴、step 遷移を横断走査
- `specs/*/review.md` 履歴（attempt 単位）の指摘パターンをキーワードインデックス化
- review JSON artifact の blocking / non-blocking 分類を参照
- 必要に応じて git log で repair commit の diff を取得

### 出力（text / json / csv）

review 指摘側:
- guardrail 別の違反回数・phase 分布
- phase 別の違反集中度
- 違反ゼロの guardrail 一覧
- review 指摘カテゴリ別の頻度
- 時系列トレンド（finalizedAt ベース）

repair 効果側:
- 指摘の attempt 間消失率 / 再出現率
- repair 不能パターン（複数 attempt で同 category が残った spec）
- attempt 上限で抜けた spec の一覧と理由
- repair diff と finding 参照の対応有無

### 検索機能
- キーワードによる review 履歴検索（過去の指摘パターンから類似事例を引く）

## 改善サイクルの段階

1. **レポート**（本タスク）→ 人間が見て判断し guardrail / prompt / phase 設計を手動改善
2. **提案**（将来）→ レポートを元に AI が改善案を出す、人間が承認
3. **自動適用**（さらに先）→ 低リスクなものだけ自動

## 関連
- e0b3: 自動改善ループ（自動実行で issue-log データが増えれば、本レポートの精度も上がる）
- cdb2: review 収束性改善（done）。本タスクは cdb2 で整備された blocking / non-blocking 分離や advisory 非消費の効果を計測する役割も担う
- impl 後の polish phase 導入を検討中。polish の効果（適用された改善カテゴリ、テスト緑保持率）も同じ基盤で計測することを想定する

</details>