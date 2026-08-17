## Background

For speeding up flow, separate from making AI guardrail judgments deterministic (6fbd), there may be room to move the surrounding processing currently passed to AI toward scripts and static artifacts. Recent agent metrics from specs 293-299 show that the following phases are especially heavy.

- impl-review: calls=60, durMs=5,897,507
- spec-review: calls=8, durMs=1,744,536
- test-review: calls=38, durMs=1,204,677
- impl-gate: calls=52, durMs=964,429
- finalize-sync: calls=16, durMs=737,924

This issue investigates reducing AI call count, input tokens, and response wait time by slimming down skills, prompts, review inputs, context exploration, docs sync, and AI output repair, rather than changing the guardrail judgments themselves.

## Objective

Separate, by phase, what truly requires AI judgment from what can be deterministically preprocessed, compressed, or split out, and organize a plan to reduce overall flow latency and round trips without reducing quality.

## Non-goals

- Making AI guardrail judgments deterministic itself (covered by 6fbd)
- Improving the pre-auto-check UX / preflight loop (covered by ba40)
- Removing AI judgment entirely

## Investigation Tracks

### 1. Skill slimming

The generated `.agents/skills/senti.flow/SKILL.md` is about 41k characters and may be increasing runtime context and judgment load. Investigate whether operational branching can be moved into fields returned by `senti flow get next-action`, such as `step`, `instructions`, `context`, `output_schema`, `requires_approval`, `maxAttempts`, and `retryRecovery`, allowing the skill to become a thin dispatcher.

Expected minimum responsibilities:

- Read `next-action`
- Run the specified `senti flow` command
- Ask for confirmation only when the envelope requires user judgment
- Report the command result and next step

### 2. Manifest-based inputs for impl-review / spec-review

Investigate whether a script can generate a review manifest before passing diffs or broad context directly to AI. Candidates include:

- Changed hunks only
- Mapping between requirement IDs and touched files
- Whether exported APIs / public commands / schemas / config changed
- Changes not registered in the file-map
- Summary of test evidence / test-result-review / retro
- Static detection results for risky patterns
- Previous review findings and resolution status

Fallback to a full review only when the manifest cannot express the needed information.

### 3. Coverage matrix inputs for test-review

Investigate whether a requirement-level coverage matrix can be generated before passing full test contents to AI. Candidates include:

- Requirement ID
- Corresponding test file
- Test name
- Number of assertions or executed test blocks
- Presence of `.skip` / skipped option
- Whether it is helper-only or an executable test
- References to scenario-validity / test-execute results

### 4. Reducing AI fallback in context.search / auto-check

- `flow.context.search`: Can AI keyword selection be limited to cases where there are zero search results and explicit opt-in is provided?
- `flow.auto-check`: Can Goal / Scope / Expected / Out of scope / Reproduction / target path / verification phrase and similar fields be scored rule-based, sending only boundary cases to AI while obvious pass / fail cases avoid AI?

### 5. Findings de-dupe / aggregation

Investigate whether duplicate findings can be deterministically merged using keys such as `sourceStep + sourceArtifact + sourceFindingId` or `sourceStep + file + locator + requirementRef + failureMode`.

Points to verify:

- Severity merge rules
- De-duplication before passing findings to `issue-log` / `flow-findings` / `acceptance-review`
- An auditable representation that keeps findings as grouped rather than deleted
- Whether `suggestedDisposition` / `evidenceRefs` for acceptance evidence can be generated automatically when the latest test-review has `blocking=0` and requirement coverage has been updated

### 6. Separating and delaying finalize-sync / docs build

In `finalize-sync`, `docs build` can call AI through `docs.enrich` / `docs.text` / `docs.readme` / `docs.agents` / `docs.translate`. Given that flow quality judgment is mostly completed by acceptance-review / final-regression, revisit whether docs-related AI steps need to remain on the blocking path of every finalize.

Investigation points:

- Can finalize run only deterministic docs build and split AI enrich / translate into separate tasks?
- Can unsynced docs be left as a warning / follow-up artifact without blocking flow finalize itself?
- Can differential judgment decide whether to run AI docs based on change type?
- Can call count / duration / tokens be measured for each AI step in docs build?

### 7. Partially making docs.enrich static

Investigate whether the following can be covered by path rules / parsers / AST-lite:

- keywords: generated from class / function / export / import / route / command names
- chapter: inferred from path, package, file role, and preset chapter definitions
- role: classification as config, test, command, schema, template, skill, etc.
- detail: generated only when AI is needed, reusing entries whose existing hash has not changed

### 8. Templating docs.text / README / AGENTS

Inventory whether parts of README, AGENTS, and `{{text}}` directives can be moved toward `{{data}}` plus renderers.

Investigation points:

- Data-rendered README command list / setup / test / flow usage
- Fixed template for the PROJECT section of AGENTS
- A structure where AI does not regenerate the full text, and only handles diff candidates or natural-language additions
- Identify chapters where `{{text}}` can be replaced with `{{data}}`

### 9. Replacing AI JSON repair with a normalizer

Investigate how much of the path that uses AI again to repair AI output JSON, such as in spec-review, can be replaced by a schema-aware normalizer.

Candidate targets:

- JSON parse repair
- Schema normalization
- Default insertion
- Removal of extra prose

Only cases that cannot be repaired should go to AI repair or hard fail.

### 10. Machine generation of triage / repair artifacts

Investigate whether initial triage / repair artifacts can be generated structurally from AI findings.

Candidates:

- Generate initial triage values from `guardrail_id` / `where.file` / `locator` / `requirementRef`
- Generate repair checklist / mutation audit templates
- Clarify the boundary between mechanical artifacts and semantic repair

### 11. Partially making requirement implementation compliance static

Investigate how far the pre-judgment for whether spec requirements are implemented in the diff, currently checked by integration gate, can be assisted by file-map / changed files / test summary / requirement coverage.

Candidates:

- Summarize AI input for requirements that have a requirement ID in the file-map and corresponding changed files plus test evidence
- Fail obvious cases before AI, such as unregistered file-map entries, missing test evidence, or no diff
- Pass only undecidable requirements to AI

## Policy for preserving quality

- Do not remove AI judgment entirely. Fall back to the existing AI path when manifest / matrix / static score / static docs classification is insufficient.
- Make the conditions that require full review / full docs generation explicit.
- Compare before / after behavior using representative specs and fixtures so that existing finding detection rates and docs quality do not regress.
- Measure not only prompt reduction, but also effects on retries, issue-log, acceptance loop, and finalize-sync wait time.
- Keep automatically generated and normalized artifacts auditable, and do not lose the original AI response or grouped findings.

## Deliverables

- Phase-by-phase list of staticization / slimming candidates
- Expected effect, quality risk, and fallback conditions for each candidate
- Responsibility split proposal for skill slimming
- Prototype specification for impl-review / spec-review manifest
- Prototype specification for test-review coverage matrix
- Proposed fallback conditions for context.search / auto-check
- Proposed separation policy for finalize-sync / docs build
- List of deterministic candidates for docs.enrich / docs.text / README / AGENTS
- Proposed JSON normalizer policy
- Findings de-dupe / aggregation keys and audit representation proposal
- Before / after measurement results on representative specs

## Acceptance Criteria

- Classifies which AI calls can be made static or slimmed down by phase, and organizes expected effects and quality risks
- Organizes rules that can be removed from the skill, rules that should move into the CLI envelope, and exceptions that should remain in the skill
- Defines a prototype specification for the impl-review / spec-review manifest
- Defines a prototype specification for the test-review coverage matrix
- Organizes AI fallback conditions for context.search / auto-check
- Organizes whether AI steps in finalize-sync / docs build can be separated or delayed
- Inventories deterministic candidates for docs.enrich / docs.text / README / AGENTS
- Organizes candidates for replacing AI JSON repair with a schema-aware normalizer
- Designs keys and an audit representation for finding de-dupe / aggregation
- Measures impact on agent call count, duration, input tokens, retry count, finalize-sync time, and completion rate for representative specs

## Related Code

- `src/skills/senti.flow/SKILL.md`
- `.agents/skills/senti.flow/SKILL.md`
- `src/flow/lib/get-next-action.js`
- `src/flow/commands/review.js`
- `src/flow/lib/run-gate.js`
- `src/flow/lib/get-context.js`
- `src/flow/lib/run-auto-check.js`
- `src/flow/lib/run-acceptance-review.js`
- `src/flow/lib/flow-findings.js`
- `src/flow/lib/run-finalize-sync.js`
- `src/docs/commands/build.js`
- `src/docs/commands/enrich.js`
- `src/docs/commands/text.js`
- `src/docs/commands/readme.js`
- `src/docs/commands/agents.js`
- `src/docs/commands/translate.js`
- `src/lib/json-parse.js`

<details>
<summary>ja</summary>

[RESEARCH] flow の AI 呼び出し削減: skill 薄型化と review 入力 manifest 化

## 背景

flow 高速化では AI guardrail 判定の deterministic 化（6fbd）とは別に、AI に渡している周辺処理そのものを script / static artifact に寄せられる余地がある。最近の spec 293-299 の agent metrics では、特に以下の phase が重い。

- impl-review: calls=60, durMs=5,897,507
- spec-review: calls=8, durMs=1,744,536
- test-review: calls=38, durMs=1,204,677
- impl-gate: calls=52, durMs=964,429
- finalize-sync: calls=16, durMs=737,924

本件では guardrail 判定そのものではなく、skill / prompt / review input / context 探索 / docs sync / AI 出力修復を薄くし、AI 呼び出し回数・入力 token・応答待ちを減らせるかを調査する。

## 目的

phase ごとに「AI でしか扱えない判断」と「deterministic に前処理・圧縮・分離できる処理」を切り分け、品質を落とさずに flow 全体の待ち時間と往復回数を下げる方針を整理する。

## 非対象

- AI guardrail 判定の deterministic 化そのもの（6fbd 側）
- auto-check 前 UX / preflight loop の改善（ba40 側）
- AI 判断の全面撤去

## 調査トラック

### 1. skill 薄型化

生成済み `.agents/skills/senti.flow/SKILL.md` は約 41k chars あり、実行時の context と判断負荷になっている可能性がある。`senti flow get next-action` が返せる `step`、`instructions`、`context`、`output_schema`、`requires_approval`、`maxAttempts`、`retryRecovery` などへ運用分岐を寄せ、skill を薄い dispatcher にできるか調査する。

想定する最小責務:

- `next-action` を読む
- 指定された `senti flow` command を実行する
- envelope がユーザー判断を要求した場合だけ確認する
- command 結果と次 step を報告する

### 2. impl-review / spec-review 入力の manifest 化

AI に diff や広い context を直接渡す前に、review manifest を script で生成できるか調査する。候補は以下。

- changed hunk のみ
- requirement id と touched files の対応
- exported API / public command / schema / config 変更の有無
- file-map 未登録変更
- test evidence / test-result-review / retro の要約
- risky pattern の静的検出結果
- previous review findings と解消状態

manifest で表現しきれない場合のみ full review に fallback する。

### 3. test-review 入力の coverage matrix 化

AI に test 全文を渡す前に、requirement 単位の coverage matrix を生成できるか調査する。候補は以下。

- requirement id
- 対応 test file
- test name
- assertion 数または実行 test block 数
- `.skip` / skipped option の有無
- helper-only か executable test か
- scenario-validity / test-execute の結果参照

### 4. context.search / auto-check の AI fallback 縮小

- `flow.context.search`: AI keyword selection を「検索結果 0 件かつ明示 opt-in」の場合だけに寄せられるか
- `flow.auto-check`: Goal / Scope / Expected / Out of scope / Reproduction / target path / verification phrase などを rule-based に採点し、明白な pass / fail は AI を呼ばず、境界ケースのみ AI に回せるか

### 5. findings の de-dupe / aggregation

`sourceStep + sourceArtifact + sourceFindingId` や `sourceStep + file + locator + requirementRef + failureMode` のような key で重複 findings を deterministic に統合できるか調査する。

確認したい点:

- severity の統合ルール
- `issue-log` / `flow-findings` / `acceptance-review` へ渡す前の重複除去
- 「削除」ではなく grouped として監査可能に残す表現
- 最新 test-review が `blocking=0` かつ requirement coverage 更新済みのとき、acceptance evidence の `suggestedDisposition` / `evidenceRefs` を自動生成できるか

### 6. finalize-sync / docs build の分離・遅延

`finalize-sync` では `docs build` により `docs.enrich` / `docs.text` / `docs.readme` / `docs.agents` / `docs.translate` が AI を呼びうる。flow の品質判定が acceptance-review / final-regression で概ね完了している前提で、docs 系 AI step を毎回 finalize の blocking path に置く必要があるか見直す。

調査観点:

- finalize では deterministic docs build のみ実行し、AI enrich / translate を別タスクへ分離できるか
- docs 未同期を warning / follow-up artifact として残し、flow finalize 自体は止めない運用が可能か
- 変更種別に応じて AI docs を走らせる差分判定ができるか
- docs build の AI step ごとに call count / duration / token を計測できるか

### 7. docs.enrich の部分静的化

以下を path rule / parser / AST-lite で補えるか調査する。

- keywords: class / function / export / import / route / command 名から生成
- chapter: path、package、file role、preset chapter 定義から推定
- role: config、test、command、schema、template、skill などを分類
- detail: AI が必要な場合だけ生成し、既存 hash が変わらない entry は再利用

### 8. docs.text / README / AGENTS の template 化

README、AGENTS、`{{text}}` directive の一部を `{{data}}` と renderer に寄せられるか棚卸しする。

調査観点:

- README の command list / setup / test / flow usage の data renderer 化
- AGENTS の PROJECT section の固定 template 化
- AI に全文再生成させず、差分候補や自然文補足だけを任せる構成
- `{{text}}` を `{{data}}` に置き換えられる chapter の洗い出し

### 9. AI JSON repair の normalizer 化

spec-review などで AI 出力 JSON 修復に再度 AI を使う経路を、schema-aware normalizer でどこまで置き換えられるか調査する。

対象候補:

- JSON parse repair
- schema normalize
- default insertion
- 余計な prose 除去

直せないケースだけ AI repair または hard fail に寄せる。

### 10. triage / repair artifact の機械生成

AI が出した finding から、triage / repair artifact の初期値を structured に生成できるか調査する。

候補:

- `guardrail_id` / `where.file` / `locator` / `requirementRef` から triage 初期値生成
- repair checklist / mutation audit 雛形の生成
- mechanical artifact と semantic repair の境界整理

### 11. requirement implementation compliance の部分静的化

integration gate で見ている「spec requirement が diff に実装されているか」の事前判定を、file-map / changed files / test summary / requirement coverage からどこまで補助できるか調査する。

候補:

- file-map に requirement id があり、対応 changed file と test evidence が揃う requirement は AI 入力を要約する
- file-map 未登録、test evidence missing、diff なしなどの obvious fail は AI 前に落とす
- 判断不能な requirement のみ AI に渡す

## 品質を落とさない方針

- AI 判断は全面撤去しない。manifest / matrix / static score / static docs classification で不十分な場合は既存 AI path に fallback する。
- full review / full docs generation が必要な条件を明示する。
- 既存の finding 検出率や docs 品質を下げないよう、代表 spec と fixture で before / after 比較を行う。
- prompt 削減だけでなく、retry、issue-log、acceptance loop、finalize-sync 待ち時間への影響も測る。
- 自動生成・正規化した artifact は監査可能にし、元の AI response や grouped finding を失わない。

## 成果物

- phase 別の静的化 / 薄型化候補一覧
- 各候補の期待効果、品質リスク、fallback 条件
- skill 薄型化の責務分割案
- impl-review / spec-review manifest prototype 仕様
- test-review coverage matrix prototype 仕様
- context.search / auto-check fallback 条件案
- finalize-sync / docs build 分離方針案
- docs.enrich / docs.text / README / AGENTS の deterministic 化候補一覧
- JSON normalizer 方針案
- findings de-dupe / aggregation key と audit 表現案
- 代表 spec での before / after 計測結果

## 受け入れ条件

- どの AI 呼び出しを静的化・薄型化できるかを phase 別に分類し、期待効果と品質リスクを整理している
- skill から削れる rules、CLI envelope に移すべき rules、skill に残すべき例外を整理している
- impl-review / spec-review manifest の prototype 仕様を定義している
- test-review coverage matrix の prototype 仕様を定義している
- context.search / auto-check の AI fallback 条件を整理している
- finalize-sync / docs build の AI step 分離・遅延可否を整理している
- docs.enrich / docs.text / README / AGENTS の deterministic 化候補を棚卸ししている
- AI JSON repair の schema-aware normalizer 化候補を整理している
- finding de-dupe / aggregation の key と audit 表現を設計している
- 代表 spec に対して agent call count、duration、input token、retry 回数、finalize-sync 時間、完遂率への影響を測定している

## 関連コード

- `src/skills/senti.flow/SKILL.md`
- `.agents/skills/senti.flow/SKILL.md`
- `src/flow/lib/get-next-action.js`
- `src/flow/commands/review.js`
- `src/flow/lib/run-gate.js`
- `src/flow/lib/get-context.js`
- `src/flow/lib/run-auto-check.js`
- `src/flow/lib/run-acceptance-review.js`
- `src/flow/lib/flow-findings.js`
- `src/flow/lib/run-finalize-sync.js`
- `src/docs/commands/build.js`
- `src/docs/commands/enrich.js`
- `src/docs/commands/text.js`
- `src/docs/commands/readme.js`
- `src/docs/commands/agents.js`
- `src/docs/commands/translate.js`
- `src/lib/json-parse.js`

</details>