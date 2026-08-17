## Target
The prompt input contract for review-test. Main target files are collectTestFiles, buildGapAnalysisPrompt, buildTestFixPrompt, TEST_REVIEW_PROMPT_CHAR_LIMIT in src/flow/commands/review.js, plus the corresponding unit and e2e tests.

## Problem
Saved prompt logs show review-test consuming 150 calls and 50,535,739 chars. In past failures, most of the prompt was a huge dump of Existing Test Code, which was the main cause of input-too-large errors. The current code has already improved this, but if the contract regresses, it could approach the provider input limit again.

## Cause
The old review-test structure was heavy because it placed the full test code in the prompt. If inputs outside the spec-local scope, such as project root tests or raw logs, get mixed in, the prompt grows. The current code only collects spec-local tests, has TEST_REVIEW_PROMPT_CHAR_LIMIT = 1_000_000, and places testDesign in the systemPrompt. However, without tests that explicitly lock this contract, future changes could revert it.

## Investigation and Verification Results
After checking src/flow/commands/review.js, collectTestFiles only collects from path.resolve(root, specDir, "tests"). TEST_REVIEW_PROMPT_CHAR_LIMIT is 1_000_000. buildGapAnalysisPrompt and buildTestFixPrompt place testDesign in addSystemPrompt("## Test Design", testDesign), while Existing Test Code and Gaps are placed in userPrompt. Saved prompt logs show review-test at 150 calls and 50,535,739 chars, so it is still one of the highest-volume phases overall.

## Simple Simulation
If the current contract is preserved, review-test input is limited to spec-local tests, avoiding prompt bloat from project root tests, raw logs, or the full spec.md. The hard cap stops prompts exceeding 1,000,000 chars before calling the provider. By placing testDesign in systemPrompt, the userPrompt for gap-analysis and gap-fix only contains changing test files and gaps, preserving a structure that is friendly to prompt caching.

## Improvement Direction
Avoid large new behavior changes and lock the current improved contract with tests. Verify in unit/e2e tests that anything outside spec-local tests is not included in the prompt, raw logs and project root tests are excluded, prompts exceeding 1,000,000 chars stop before the provider call, and testDesign goes into systemPrompt while userPrompt does not contain ## Test Design.

## Proposed Acceptance Criteria
- Only spec-local tests are included in the review-test prompt.
- Project root tests, tests/.raw/test-execution.log, and the full spec.md are not included in the review-test prompt.
- agent.call is not executed when TEST_REVIEW_PROMPT_CHAR_LIMIT is exceeded.
- testDesign is included in the systemPrompt for gap-analysis and gap-fix, and userPrompt does not contain ## Test Design.
- Contract violations can be detected by the normal npm test run.

## Reason to Put This on the Board
The current code for review-test has already been improved, so this is mainly about locking the contract rather than a major implementation task like priorities 1-3. However, saved logs still show it among the highest-volume phases, and it is directly connected to past input-too-large failures, so it is worth handling as an independent task to prevent future regressions.

<details>
<summary>ja</summary>

[ENHANCE] review-test の入力契約と prompt 上限を回帰テストで固定

## 対象
review-test の prompt 入力契約。主な対象ファイルは src/flow/commands/review.js の collectTestFiles、buildGapAnalysisPrompt、buildTestFixPrompt、TEST_REVIEW_PROMPT_CHAR_LIMIT、および対応する単体・e2e テスト。

## 問題
保存済み prompt log では review-test が 150 calls、50,535,739 chars を消費している。過去の失敗では prompt の大半が Existing Test Code の巨大 dump で、input-too-large の主因になっていた。現行コードでは改善済みだが、契約が崩れると再び provider input limit に近づく。

## 原因
過去の review-test は test code 全文を prompt に入れる構造が重く、project root tests や raw log など spec-local 以外の入力が混入すると prompt が膨らむ。現行コードは spec-local tests のみを collect し、TEST_REVIEW_PROMPT_CHAR_LIMIT = 1_000_000 と testDesign の systemPrompt 化を持つが、この契約を明示的に固定するテストが不足すると将来の変更で戻るリスクがある。

## 調査・検証結果
src/flow/commands/review.js を確認した結果、collectTestFiles は path.resolve(root, specDir, "tests") のみを収集対象にしている。TEST_REVIEW_PROMPT_CHAR_LIMIT は 1_000_000。buildGapAnalysisPrompt と buildTestFixPrompt は testDesign を addSystemPrompt("## Test Design", testDesign) に置き、Existing Test Code や Gaps は userPrompt に置いている。保存済み prompt log の review-test は 150 calls、50,535,739 chars で、依然として総量上位 phase である。

## 簡易シミュレーション
現行 contract が維持される場合、review-test の入力は spec-local tests に限定され、project root tests、raw log、spec.md 全文の混入による巨大化を避けられる。hard cap により 1,000,000 chars を超える prompt は provider 呼び出し前に停止できる。testDesign を systemPrompt に置くことで、gap-analysis と gap-fix の userPrompt には変動する test files/gaps だけが入り、prompt cache の効きやすい形が維持される。

## 改善方向
新しい大きな挙動変更は避け、現行の改善済み契約をテストで固定する。spec-local tests 以外が prompt に入らないこと、raw log と project root tests が除外されること、1,000,000 chars を超える場合に provider call 前で停止すること、testDesign が systemPrompt に入り userPrompt に ## Test Design が含まれないことを unit/e2e で検証する。

## 受け入れ条件案
- spec-local tests だけが review-test prompt に入る。
- project root tests、tests/.raw/test-execution.log、spec.md 全文は review-test prompt に入らない。
- TEST_REVIEW_PROMPT_CHAR_LIMIT 超過時は agent.call が実行されない。
- gap-analysis と gap-fix の systemPrompt に testDesign が含まれ、userPrompt に ## Test Design が含まれない。
- npm test の通常実行で契約違反を検出できる。

## ボードに置く理由
review-test は現行コードで既に改善されているため、優先度 1〜3 のような主要実装ではなく契約固定が中心になる。ただし保存ログでは総量上位で、過去の input-too-large 原因と直結するため、将来の回帰を防ぐ独立タスクとして扱う価値がある。

</details>