## Background

In long sessions, AI drifts away from the rules in SKILL.md / CLAUDE.md, causing frequent norm violations (Q&A structure collapse, worktree boundary crossing, reflex revert, etc.). This surfaced during spec 251 sessions.

## Proposal

Prepend a phase-specific persistent rules block to `instructions.content` in every `sdd-forge flow get next-action` response, forcing the AI to re-acknowledge the rules each time.

## Verified Facts

- v5b (verbose, 1 rule, ~800 tokens) successfully enforced the 5-section structure on both Opus 4.7 and 4.6
- v6 (terse, 10 rules, ~250 tokens) caused structure collapse — over-compression kills effectiveness
- v5b maintained structure even in a synthetic 168K-token long context
- True drift verification requires real SDD flow execution (synthetic verification has limits)

## Design Discussion — Finalized Details (2026-05-07)

| Axis | Decision |
|---|---|
| Injection strategy | **Inject every time** (no trigger condition; filter selects applicable rules per phase). Violation-detection triggering is split out to 6f7d |
| SSOT | `skill-rules.json` (single JSON file, separate domain from guardrail.json) |
| Preset chain merge | Not needed. Single fixed location |
| Filter keys | 2 axes: phase + state. state is an extensible array |
| Placement | Reuse existing `{{data}}` directive. Add new `RulesSource` DataSource under `src/docs/data/` |
| Expand timing | At `sdd-forge upgrade` time, together with SKILL.md generation |
| Directive marker removal | Independent post-process step `stripDataMarkers(content)` inserted into the upgrade pipeline |
| State enum candidates | Start with `worktreeActive` / `autoApproveOn` (extensible array, easy to add more) |
| Relationship with memory | Skill-priority rules are stated explicitly in the skill itself. When skill and memory conflict, skill wins |
| Partial handling | **Keep partials**. Extract rule body from partials into skill-rules.json; place `` placeholders in partials. Do not abolish partials |
| Partial role | (1) Rule grouping (logical groups expressed per file) (2) Home for non-rule structural text (preamble / headings / transitions) (3) Placement of `{{data}}` placeholders |
| skill-rules.json placement metadata | Not needed. Placement is determined by placeholder position in partials, so no `meta.section`-style fields |
| Rule data file | `src/templates/skills/rules.json` (currently under templates/; moves to `src/skills/rules.json` after the 7da8 refactor) |
| Rule loader location | `src/lib/skill-rules.js` (follows existing lib convention, same as guardrail.js) |
| DataSource adapter location | `src/docs/data/rules.js` (follows existing docs/data convention, same as agents.js; migration from docs/data/ to data/ is split to 7da8) |
| `{{data}}` directive format | `` (source="skills" plural, method="rule" singular concept, id specified via options) |
| Rule entry ID format | kebab-case (e.g. `worktree-no-cd-out`), consistent with guardrail.json |
| Structural rename handling | **Not in this issue (b25c)**. templates/ → skill/ and docs/data/ → data/ are deferred to issue 7da8, to be started after effect measurement |

## Layer Responsibilities (2026-05-07)

| Layer | Role |
|---|---|
| skill-rules.json | SSOT for rule body (MUST wording + detail) |
| partial | Grouping + non-rule structural text + placement of `{{data}}` placeholders |
| SKILL.md | Top-level template assembling partials via `` |

## Drift-Prone Rule Empirical Data (2026-05-07)

Corrective patterns extracted from session logs over the past month (149 sessions, ~8,300 user messages).

### Primary drift (rules already written but not followed)
- Premature conclusion / pre-empting discussion (8 cases) — `feedback_no_premature_conclusion.md`
- Sycophancy / lack of independent analysis (3 cases) — `feedback_independent_analysis.md`
- Auto-mode runaway (4 cases) — `feedback_no_auto_mode_override.md`

### Key finding: not drift but initial load failure

**Rules written directly in CLAUDE.md: 0 violations. Rules referenced via memory files: 15 violations.** Even among "explicitly written rules", the location makes an order-of-magnitude difference in deterrence. The `feedback_*.md` files written by Claude's auto-memory mechanism are only linked from MEMORY.md — their body text is not loaded into context.

This reinforces the b25c prescription: rather than a re-injection mechanism, simply promoting dormant rules to a loaded layer (SKILL.md / next-action) is likely to address the 3 primary drift cases.

## Confirmed Rules to Include (2026-05-07)

Classified all 16 feedback rules from memory and confirmed their destination.

| # | Destination | Content (core) |
|---|---|---|
| 1 | CLAUDE.md (personal) | communication: no mixed ja/en / call bugs bugs / lead with conclusion / don't assume prior knowledge |
| 2 | preset/base/guardrail.json (impl, code-quality) | code_quality: no unnecessary indirection / DRY first / present design direction to user before implementing |
| 3 | skill-rules.json | no_premature_conclusion: don't close with "Conclusion:" / "Decision:" mid-discussion / present options and trade-offs |
| 4 | CLAUDE.md (personal) | independent_analysis: don't immediately agree with user's point / independently verify reasoning |
| 5 | skill-rules.json + CLAUDE.md (split) | no_auto_mode_override: SDD auto-mode operation (skill) / AI judgment authority during interactive sessions (CLAUDE.md) |
| 6 | CLAUDE.md (personal) | facilitation_catchball: don't turn facilitation into a monologue |
| 7 | CLAUDE.md (personal) | no_speculation: explicitly say "I don't remember" / present evidence for assumptions |
| 8 | skill-rules.json | thoroughness: enumerate requirements before implementing / cross-check on completion / probe before answering |
| 9 | skill-rules.json | no_shortcuts: no ad-hoc fixes / grep similar locations / investigate existing mechanisms |
| 10 | skill-rules.json + CLAUDE.md (split) | wait_for_instruction: don't actuate in SDD flow without instruction (skill) / AI runaway in general conversation (CLAUDE.md) |
| 11 | skill-rules.json | commit_split_strategy: honor approved commit split even in auto mode / don't squash into one |
| 12 | **Static fix (separate issue)** | finalize_pr_route: PR route selection should be enforced in CLI logic (same philosophy as 99b2) |
| 13 | skill-rules.json | no_scope_splitting: don't proactively propose splitting an issue; defer to user |
| 14 | Merge into existing partial | choice_format → integrate with `choice-format.md` / `ai-question-style.md` |
| 15 | Merge into existing partial | no_chain_sddforge → integrate with `core-principle.md` |
| 16 | Merge into existing partial | no_shared_repo_git_ops → integrate with `worktree-mode.md` |

Tally:
- skill-rules.json: 8 entries (#3, #5, #8, #9, #10, #11, #13, + merged from existing partials 14/15/16)
- CLAUDE.md (personal): 6 entries (#1, #4, #5, #6, #7, #10)
- preset guardrail: 1 entry (#2)
- Static fix (separate issue): 1 entry (#12)

### Split-writing policy (#5, #10)
To avoid SSOT collapse, the 2 dual-destination entries are written with different wording and different angles:
- skill-rules.json: specific instructions in SDD-flow context
- CLAUDE.md: more abstract principle

## Open Questions

(All locked)

## Related Issues (Split Out)
- `6f7d`: Real-time automated detection of behavior rule violations (under no-hook constraint) — **Requires discussion. Implementation prohibited.** Violation-detection triggering to be explored separately in 6f7d
- `7da8`: src/ structure cleanup (templates/ → skill-related names, docs/data/ → data/, experimental likewise) — **Planned after effect measurement post b25c implementation.** No renaming in this issue

## Implementation Scope

- Add `src/docs/data/rules.js` (DataSource adapter, source name = "skills", method = "rule")
- Add `src/lib/skill-rules.js` (rule loader: reads rules.json + filter / hydrate)
- Add `src/templates/skills/rules.json` (rule SSOT)
- Add `stripDataMarkers(content)` to docs lib and wire it into the `sdd-forge upgrade` pipeline
- Embed `` directives in SKILL.md / existing partials and migrate corresponding rules to rules.json
- Explicitly state the precedence rule in the skill itself: "when skill rules conflict with memory, skill wins"
- Modify `src/flow/lib/get-next-action.js` to include rule bodies filtered by phase + state in the result
- Add code_quality rule (#2) to `preset/base/guardrail.json`
- Append #1, #4, #5, #6, #7, #10 to CLAUDE.md (personal / sdd-forge project)
- Add unit tests

## Related
- Drift observed during spec 251 sessions
- Aligned with existing board item `99b2` (review maxAttempts CLI enforcement) — independent layer guardrail separate from CLI enforcement
- `#12` static fix **needs its own issue** (not yet created)

<details>
<summary>ja</summary>

[ENHANCE] flow get next-action にフェーズ別 persistent rules を注入して長セッション drift を軽減

## 背景

長セッションで AI が SKILL.md / CLAUDE.md のルールへの注意を drift させ、規範違反 (Q&A 構造崩壊、worktree 境界越え、reflex revert 等) が頻発する。spec 251 セッションで顕在化。

## 提案

`sdd-forge flow get next-action` 応答の `instructions.content` 先頭に、フェーズ別の persistent rules ブロックを毎回 prepend し、AI に再認識させる。

## 検証済み事実

- v5b (verbose、1 ルール、~800 tokens) は Opus 4.7 / 4.6 双方で 5 セクション構造を強制成功
- v6 (terse、10 ルール、~250 tokens) は構造崩壊。短縮しすぎは効果なし
- 168K tokens の synthetic 長 context でも v5b は構造維持
- 真の drift 検証は実 SDD flow 実行が必要 (synthetic 検証では限界)

## 設計議論で確定した詳細 (2026-05-07)

| 軸 | 決定 |
|---|---|
| 注入戦略 | **毎回注入**（trigger は条件なし、filter で該当 rule のみ選択）。違反検知トリガーは 6f7d に切り出し |
| SSOT | `skill-rules.json` (JSON 1 ファイル、guardrail.json とは別ドメイン) |
| preset chain merge | 不要。1 箇所固定 |
| filter キー | phase + state の 2 軸。state は拡張可能な配列 |
| 配置軸 | 既存 `{{data}}` directive を流用。新 `RulesSource` DataSource (`src/docs/data/`) を追加 |
| expand のタイミング | `sdd-forge upgrade` 時に SKILL.md 生成と一緒に行う |
| directive マーカー除去 | post-process の独立ステップ `stripDataMarkers(content)` を upgrade pipeline に挿入 |
| state enum 候補 | `worktreeActive` / `autoApproveOn` の 2 つから開始 (拡張可能配列なので追加容易) |
| memory との関係 | skill 優先 rule を skill 自身に明記。memory との conflict 時は skill が勝つ |
| partial の扱い | **partial は残す**。partial 内のルール本文を skill-rules.json に切り出し、partial には `` placeholder を配置。partial 廃止しない |
| partial の役割分担 | (1) ルールのグルーピング (ファイル単位で論理グループを表現) (2) 非ルール構造文の置き場所 (前置き / 見出し / transition) (3) `{{data}}` placeholder の配置 |
| skill-rules.json の placement metadata | 不要。配置は partial 内の placeholder 位置で決まるので `meta.section` のようなフィールドは持たない |
| rule data file | `src/templates/skills/rules.json` (今は templates/ 配下、7da8 リファクタ後は `src/skills/rules.json`) |
| rule loader の置き場所 | `src/lib/skill-rules.js` (既存 lib 慣習: guardrail.js と同様) |
| DataSource adapter の置き場所 | `src/docs/data/rules.js` (既存 docs/data 慣習: agents.js と同様。docs/data/ から data/ への移動は 7da8 に切り出し) |
| {{data}} directive 形式 | `` (source="skills" 複数形、method="rule" 単数概念、options で id 指定) |
| rule entry の ID 形式 | kebab-case (例: `worktree-no-cd-out`)。guardrail.json と一致 |
| 構造リネームの扱い | **本 issue (b25c) では実施しない**。templates/ → skill/, docs/data/ → data/ は別 issue 7da8 で実装後の効果測定後に着手 |

## 層の役割分担 (2026-05-07)

| 層 | 役割 |
|---|---|
| skill-rules.json | ルール本文 (MUST 文言 + 詳細) の SSOT |
| partial | グルーピング + 非ルール構造文 + `{{data}}` placeholder の配置 |
| SKILL.md | partial を `` で組み立てる top-level template |

## drift-prone rule 経験データ (2026-05-07)

過去 1 ヶ月のセッションログ (149 セッション、約 8300 user メッセージ) から訂正パターンを抽出。

### 本命 drift (既存ルール明文化済みなのに守れていない)
- premature conclusion / 議論先取り (8 件) — `feedback_no_premature_conclusion.md`
- 同調・独立分析欠如 (3 件) — `feedback_independent_analysis.md`
- auto モード暴走 (4 件) — `feedback_no_auto_mode_override.md`

### 重要発見: drift ではなく initial load 失敗

**CLAUDE.md 直記ルールは違反 0 件、memory ファイル参照ルールは違反 15 件。** 同じ「明文化されたルール」でも置き場所で抑止力が桁違い。Claude の AI auto-memory 機構が書いた feedback_*.md は MEMORY.md にリンクされているだけで、本文は context に load されていない。

これは b25c の処方を強化する: 再注入機構より、まず dormant な rule を load される層 (SKILL.md / next-action) に持ち上げるだけで本命 drift 3 件に効く可能性が高い。

## 取り込み対象 rule の確定 (2026-05-07)

memory にある 16 件の feedback rule を分類・行先確定。

| # | 行先 | 内容（核心） |
|---|---|---|
| 1 | CLAUDE.md (個人) | communication: 日英混在禁止 / バグはバグと呼ぶ / 結論先出し / 前提知識を仮定せず説明 |
| 2 | preset/base/guardrail.json (impl, code-quality) | code_quality: 不要な間接層禁止 / DRY 最重視 / 実装前に設計の方向性をユーザー提示 |
| 3 | skill-rules.json | no_premature_conclusion: 議論中に「結論:」「決定:」と締めない / 選択肢とトレードオフを示す |
| 4 | CLAUDE.md (個人) | independent_analysis: ユーザー指摘に即同調しない / 根拠を独立検証 |
| 5 | skill-rules.json + CLAUDE.md (書き分け) | no_auto_mode_override: SDD auto mode 運用 (skill) / interactive 中の AI judgment authority (CLAUDE.md) |
| 6 | CLAUDE.md (個人) | facilitation_catchball: ファシリテートは独演にしない |
| 7 | CLAUDE.md (個人) | no_speculation: 過去判断を覚えていない時は明言 / 推測なら根拠提示 |
| 8 | skill-rules.json | thoroughness: 実装前に要件列挙 / 完了時に突き合わせ / 即答せず洗う |
| 9 | skill-rules.json | no_shortcuts: 場当たり修正しない / 同種箇所を grep / 既存仕組みを調べる |
| 10 | skill-rules.json + CLAUDE.md (書き分け) | wait_for_instruction: SDD 内 actuation を勝手にしない (skill) / 会話中の AI 暴走全般 (CLAUDE.md) |
| 11 | skill-rules.json | commit_split_strategy: 承認済みコミット分割を auto モードでも遵守 / squash に押し込まない |
| 12 | **静的解決 (別 issue)** | finalize_pr_route: PR ルート選択は CLI ロジックで強制すべき (99b2 と同じ思想) |
| 13 | skill-rules.json | no_scope_splitting: Issue を勝手に分割提案しない |
| 14 | 既存 partial 統合 | choice_format → `choice-format.md` / `ai-question-style.md` と統合 |
| 15 | 既存 partial 統合 | no_chain_sddforge → `core-principle.md` と統合 |
| 16 | 既存 partial 統合 | no_shared_repo_git_ops → `worktree-mode.md` と統合 |

合計内訳:
- skill-rules.json: 8 件 (#3, #5, #8, #9, #10, #11, #13, + 既存 partial 14/15/16 統合分)
- CLAUDE.md (個人): 6 件 (#1, #4, #5, #6, #7, #10)
- preset guardrail: 1 件 (#2)
- 静的解決 (別 issue): 1 件 (#12)

### 書き分け方針 (#5, #10)
両所書きの 2 件は SSOT 崩壊を避けるため、別の文・別の切り口で書き分ける:
- skill-rules.json: SDD-flow context での具体的指示
- CLAUDE.md: より抽象的な原則

## 未決の論点

(全 lock 済み)

## 関連 issue (切り出し済み)
- `6f7d`: behavior rule 違反検知の real-time 自動化方針 (hook 不使用制約下) — **要議論。実装禁止。** 違反検知トリガーは 6f7d で別途検討
- `7da8`: src/ 構造整理 (templates/ → skill 関連名, docs/data/ → data/, experimental も同様) — **b25c 実装後の効果測定後に着手予定。** 本 issue ではリネームしない

## 実装スコープ

- `src/docs/data/rules.js` を新規追加 (DataSource adapter、source name = "skills"、method = "rule")
- `src/lib/skill-rules.js` を新規追加 (rule loader: rules.json 読み込み + filter / hydrate)
- `src/templates/skills/rules.json` を新規追加 (rule SSOT)
- `stripDataMarkers(content)` を docs lib に追加し `sdd-forge upgrade` パイプラインに組み込む
- SKILL.md / 既存 partial に `` directive を埋め、相当する rule を rules.json に移行
- skill 自身に "skill rule が memory と矛盾したら skill を優先" の precedence rule を明記
- `src/flow/lib/get-next-action.js` を修正し、phase + state で filter した rule body を結果に含める
- `preset/base/guardrail.json` に code_quality rule (#2) を追加
- CLAUDE.md (個人 / sdd-forge プロジェクト用) に #1, #4, #5, #6, #7, #10 を追記
- 単体テスト追加

## 関連
- spec 251 セッションでの drift 観察
- 既存ボード `99b2` (review maxAttempts CLI 強制) と方向性一致 (CLI 強制と独立した layer の guardrail)
- `#12` 静的解決は **別 issue 化必要** (未作成)

</details>