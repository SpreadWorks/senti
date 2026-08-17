## Background

During the cdb2 cleanup, it was confirmed as a remaining issue that impl review uses NO_PROPOSALS as its completion condition, making flow difficult to converge when non-blocking improvement suggestions keep being generated.

Past log investigation (spec 259, 260, etc.) revealed the root cause: reviewers do not re-propose the same proposals but instead keep generating new angles of feedback after seeing revised code — a "feedback inflation" that fails to converge. The implementer (main AI) retains context from spec/code/history and can take responsibility for triaging proposals. In fact, a triage mechanism already exists at src/flow/prompts/impl/review.md:7-27 (reads review.md to determine "apply / not needed"). However, triage criteria are vague ("improve quality? risk breaking? within scope?") and reviewer output is not classified as blocking/non-blocking.

Therefore, the proper approach is to change the reviewer's output control and PASS criteria, and share blocking failure modes across the implement/triage/reviewer 3 prompts.

## blocking failure mode (for impl review, enumerated)

Similar to spec review (review.js:1777-1788) / test review (review.js:1163-1169), define specific failure modes as an enumerated type. Do not use abstract expressions like "important things."

1. **Spec acceptance requirement not implemented / incomplete**
   - Example: parsing of a flag defined by spec is missing, case branch is omitted

2. **Implementation contradicts behavior explicitly specified in spec**
   - Example: spec defines exit code 2 but implementation uses exit code 1

3. **Reproducible and concrete security / data integrity bugs**
   - Example: user input passed unescaped to external command, guaranteed crash from null dereference
   - Does not include "just in case" or "might be a problem in the future" level issues

### Not included in blocking (delegated to other phases)

| Item | Responsible |
|---|---|
| Existing test breakage (regression) | gate-impl test artifact trust verification (run-gate.js:128-144) |
| False positives in additional tests (missing assertions, static anti-patterns) | test review (test-review blockingFindings) |
| Scope creep (changes outside spec) | gate-impl no-overengineering etc. guardrail |
| Project rule violations (adding external dependencies, etc.) | gate-impl guardrail |
| Naming / refactor / DRY / comment / docs proposals | non-blocking (improvement) |

## What we want to do

### Core changes (sharing blocking failure mode across 4 locations)

#### A. Reviewer prompt
- File: src/flow/commands/review.js:249-295 (buildDraftSystemPrompt)
- Change output schema to JSON bisplit of blockingFindings[] + nonBlockingImprovements[] (same pattern as spec review's review.js:1744-1764)
- Enumerate the 3 blocking failure modes explicitly
- Add "non-blocking is optional; focus on blocking detection" to suppress feedback inflation

#### B. PASS determination
- File: src/flow/lib/run-review.js:188-193 (isImplPass)
- Current: PASS when proposalCount === 0
- After change: PASS when blockingFindings.length === 0
- Also align run-review.js:513-538 impl phase processing (proposal count parsing, no-proposals determination, next step decision)

#### C. Implementer triage prompt
- File: src/flow/prompts/impl/review.md
- Replace current "improve quality? risk breaking? within scope?" with triage criteria aligned to blocking failure modes
- blocking must always be applied; non-blocking is context-based "apply / record only" selection
- Maintain the "deemed unnecessary" report structure

#### D. Implement implementation prompt
- File: src/flow/prompts/impl/implement.md
- Make explicit that implementation should satisfy blocking failure modes (especially security and data integrity)
- Share the same failure modes 1-to-1 with reviewer prompt to prevent misalignment

### Secondary (for consistency)

#### E. Proposal parsing
- File: src/flow/commands/review.js:318-400 (parseProposals, filterProposalsByScope, writeReviewMd, formatReviewMd)
- Rewrite to support new JSON schema

#### F. Structured artifact (impl-review.json)
- Same pattern as spec review having spec-review.json (review.js:1974-1983 loadSpecReviewArtifact)
- Save both review.md (markdown) + impl-review.json (structured)

#### G. Previous review memory
- Port spec review's toPromptMemory() (review.js:1912-1918) for impl use
- Embed verdict, counts, previousBlockingFindings[], acknowledgedNonBlockingImprovements[] in next review prompt
- Auxiliary measure for inflation suppression

### Automatically achieved by existing mechanisms (no new implementation needed)

- **advisory / non-blocking improvements do not consume retry budget**
  → Existing design where src/flow/lib/review-failure.js consumes retry only for verdict=FAIL (run-review.js:200-227 updateReviewRetryCounter). Automatically achieved once impl review returns a verdict

- **Terminal state when retries exhausted with blocking remaining**
  → Already handled by existing REVIEW_MAX_ATTEMPTS_EXCEEDED (run-review.js:161-186 checkReviewRetryBelowMax). Follows existing behavior of returning Envelope.fail and presenting recovery command (`sdd-forge flow set retry reset review impl --reason REASON --yes`) to user. No additional implementation needed

### Exclusions (removed from original proposal)

- **Do not re-propose acknowledged non-blocking / rejected proposals (former item 5)**
  → Past log investigation (spec 259, 260) found no cross-round re-proposal of identical proposals (H1); low priority. Since proposal content is newly generated each round, "not squeezing them out / letting them flow through" is more directly effective than re-proposal suppression. With previous review memory (G), inflation is indirectly covered through suppression

## Completion Criteria

- impl review PASSes when blockingFindings.length === 0
- non-blocking improvements do not consume retry budget and flow advances
- implementer (main AI) retains responsibility for context-based triage of non-blocking
- implement / reviewer / triage 3 prompts share the same blocking failure mode enumeration

## Scope of Impact

### Files to modify
- src/flow/commands/review.js (buildDraftSystemPrompt, parseProposals, filterProposalsByScope, writeReviewMd, formatReviewMd, new: loadImplReviewArtifact, toPromptMemory equivalent)
- src/flow/lib/run-review.js (isImplPass, updateReviewRetryCounter uses existing)
- src/flow/lib/review-failure.js (existing use, no changes expected)
- src/flow/prompts/impl/review.md
- src/flow/prompts/impl/implement.md

### Affected tests
- tests/unit/flow/commands/review.test.js (parseProposals, filterProposalsByScope)
- tests/unit/flow/commands/review-envelope-consistency.test.js (Envelope format)
- tests/unit/flow/run-review-advisory.test.js (ADVISORY response)
- tests/unit/flow/phases-review.test.js (phase state transitions)
- tests/e2e/flow/gate-impl-integration.test.js (downstream impact verification)

## Related

### Existing pattern references
- spec review: blockingFindings[] + nonBlockingImprovements[] (review.js:1744-1764), spec-review.json structured artifact (review.js:1974-1983), previous memory (review.js:1912-1918, 2073-2080)
- test review: blockingFindings[] + advisoryFindings[] (review.js:1163-1174)

### Handling naming inconsistency
- spec review uses nonBlockingImprovements, test review uses advisoryFindings — inconsistency exists
- Which to align to for impl review should be decided during implementation. Unifying all three may exceed 125b scope, so consider as a separate task
- Recommended for now: align with spec review name (nonBlockingImprovements), unify with test review as a follow-up task

### Existing retry mechanism
- impl review step: maxAttempts: 4 (definition.js:313-422)
- REVIEW_MAX_ATTEMPTS_EXCEEDED → manual reset (run-review.js:161-186)
- retryBudgetConsumed: only true for verdict=FAIL (review-failure.js:111)

<details>
<summary>ja</summary>

[ENHANCE] impl review artifact / PASS 条件整理

## 背景

cdb2 の整理で、impl review が NO_PROPOSALS を完了条件にしているため、blocking ではない改善提案が出続けると flow が収束しにくいことが残課題として確認された。

過去ログ調査 (spec 259, 260 等) で、reviewer が同じ proposal を再提案するのではなく、修正されたコードを見て新しい角度の指摘を生成し続ける「指摘出しインフレ」が収束しない真因と判明した。implementer (メイン AI) は spec・コード・履歴の文脈を保持しており、proposals を取捨選択する責務を担える。実際 src/flow/prompts/impl/review.md:7-27 に triage 機構が既存実装されている (review.md を読んで「適用 / 対応不要」を判定)。ただし triage 基準は曖昧 ("improve quality? risk breaking? within scope?") で、reviewer の output も blocking/non-blocking に分類されていない。

したがって reviewer の出力制御と PASS 基準を変え、implement / triage / reviewer の 3 プロンプトで blocking failure mode を共有するのが本筋。

## blocking failure mode (impl review 用、列挙型)

spec review (review.js:1777-1788) / test review (review.js:1163-1169) と同様、具体的失敗モードを列挙型で定義する。「重要なもの」のような抽象表現は使わない。

1. **spec の acceptance requirement が実装されていない / 不完全**
   - 例: spec が定義した flag のパースが無い、case 分岐が漏れている

2. **実装が spec で明示された behavior と矛盾する**
   - 例: spec で exit code 2 と定義されているのに exit code 1

3. **再現可能で具体的なセキュリティ / データ整合性 bug**
   - 例: ユーザー入力が unescaped で外部コマンドに渡る、null 参照で確実な crash
   - 「念のため」「将来問題になるかも」レベルは含めない

### blocking に含めない (他フェーズに委譲)

| 項目 | 担当先 |
|---|---|
| 既存テスト破壊 (regression) | gate-impl の test artifact trust 検証 (run-gate.js:128-144) |
| 追加テストの偽陽性 (assertion 欠落、static anti-pattern) | test review (test-review の blockingFindings) |
| スコープ creep (spec 外の変更) | gate-impl の no-overengineering 等 guardrail |
| プロジェクトルール違反 (外部依存追加等) | gate-impl の guardrail |
| 命名・リファクタ・DRY・コメント・docs 提案 | non-blocking (improvement) |

## やりたいこと

### コア改修 (4 箇所で blocking failure mode を共有)

#### A. reviewer プロンプト
- ファイル: src/flow/commands/review.js:249-295 (buildDraftSystemPrompt)
- 出力スキーマを blockingFindings[] + nonBlockingImprovements[] の JSON 二分割に変更 (spec review の review.js:1744-1764 と同パターン)
- blocking failure mode 3 つを列挙型で明示
- 「non-blocking は無くてもよい、blocking 検出に集中せよ」を追記し、指摘出しインフレを抑制

#### B. PASS 判定
- ファイル: src/flow/lib/run-review.js:188-193 (isImplPass)
- 現状: proposalCount === 0 で PASS
- 改修後: blockingFindings.length === 0 で PASS
- run-review.js:513-538 の impl phase 処理 (proposal count パース、no-proposals 判定、next step 決定) も整合させる

#### C. implementer triage プロンプト
- ファイル: src/flow/prompts/impl/review.md
- 現状の「improve quality? risk breaking? within scope?」を、blocking failure mode に対応した triage 基準に置換
- blocking は必ず適用、non-blocking は context based に「適用 / 記録だけ」を選択
- 「対応不要と判断」のレポート構造は維持

#### D. implement 実装プロンプト
- ファイル: src/flow/prompts/impl/implement.md
- 実装時に blocking failure mode を満たすよう明示 (特にセキュリティ・データ整合性)
- reviewer プロンプトと 1 対 1 で同じ failure mode を共有し、認識ズレを防ぐ

### 副次 (整合性のため)

#### E. proposal パース
- ファイル: src/flow/commands/review.js:318-400 (parseProposals, filterProposalsByScope, writeReviewMd, formatReviewMd)
- 新 JSON スキーマ対応に書き換え

#### F. structured artifact (impl-review.json)
- spec review が spec-review.json を持つのと同パターン (review.js:1974-1983 loadSpecReviewArtifact)
- review.md (markdown) + impl-review.json (structured) の両方を保存

#### G. previous review memory
- spec review の toPromptMemory() (review.js:1912-1918) を impl 用に移植
- verdict, counts, previousBlockingFindings[], acknowledgedNonBlockingImprovements[] を次 review prompt に埋め込み
- inflation 抑制の補助

### 既存機構で自動達成 (新規実装不要)

- **advisory / non-blocking improvement では retry 予算を消費しない**
  → src/flow/lib/review-failure.js が verdict=FAIL のみ retry 消費する既存設計 (run-review.js:200-227 updateReviewRetryCounter)。impl review が verdict を返すようになれば自動達成

- **blocking が残ったまま retry 枯渇時の terminal state**
  → 既存 REVIEW_MAX_ATTEMPTS_EXCEEDED (run-review.js:161-186 checkReviewRetryBelowMax) で対応済み。Envelope.fail を返し、recovery command (`sdd-forge flow set retry reset review impl --reason REASON --yes`) をユーザーに提示する既存挙動を踏襲。追加実装不要

### 除外 (元案から外す)

- **acknowledged non-blocking / rejected proposal を再提案しない (旧 5)**
  → 過去ログ調査 (spec 259, 260) で同一 proposal の round 跨ぎ再提案 (H1) は観察されず、優先度低い。指摘内容は round ごとに新規生成されるため、再提案抑止より「絞り出させない / 出ても流す」の方が直接効く。previous review memory (G) があれば inflation 抑制で間接的にカバーされる

## 完了条件

- impl review が blockingFindings.length === 0 で PASS する
- non-blocking improvement が生成されても retry 予算を消費せず flow が前進する
- implementer (メイン AI) は文脈ベースで non-blocking を取捨選択する責務を保つ
- implement / reviewer / triage の 3 プロンプトが同じ blocking failure mode 列挙を共有している

## 影響範囲

### 改修ファイル
- src/flow/commands/review.js (buildDraftSystemPrompt, parseProposals, filterProposalsByScope, writeReviewMd, formatReviewMd、新規: loadImplReviewArtifact, toPromptMemory 相当)
- src/flow/lib/run-review.js (isImplPass, updateReviewRetryCounter は既存利用)
- src/flow/lib/review-failure.js (既存利用、変更なし見込み)
- src/flow/prompts/impl/review.md
- src/flow/prompts/impl/implement.md

### 影響テスト
- tests/unit/flow/commands/review.test.js (parseProposals, filterProposalsByScope)
- tests/unit/flow/commands/review-envelope-consistency.test.js (Envelope 形式)
- tests/unit/flow/run-review-advisory.test.js (ADVISORY 反応)
- tests/unit/flow/phases-review.test.js (phase 間の状態遷移)
- tests/e2e/flow/gate-impl-integration.test.js (downstream 影響確認)

## 関連

### 既存パターン参照
- spec review: blockingFindings[] + nonBlockingImprovements[] (review.js:1744-1764)、spec-review.json structured artifact (review.js:1974-1983)、previous memory (review.js:1912-1918, 2073-2080)
- test review: blockingFindings[] + advisoryFindings[] (review.js:1163-1174)

### 命名揺れの扱い
- spec review = nonBlockingImprovements、test review = advisoryFindings の揺れあり
- impl review でどちらに揃えるかは実装時に検討。三者統一は 125b スコープを超える可能性ありで、別 task 検討
- 当面の推奨: spec review と同名 (nonBlockingImprovements) で揃え、test review との統一は後続 task

### 既存 retry 機構
- impl review step: maxAttempts: 4 (definition.js:313-422)
- REVIEW_MAX_ATTEMPTS_EXCEEDED → manual reset (run-review.js:161-186)
- retryBudgetConsumed: verdict=FAIL のみ true (review-failure.js:111)

</details>