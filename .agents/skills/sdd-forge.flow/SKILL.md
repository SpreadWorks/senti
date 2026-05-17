---
name: sdd-forge.flow
description: Run the SDD flow end-to-end — planning (draft → spec → approval → test), implementation (code → review → gate), and finalization (commit → merge → sync → cleanup). Thin dispatcher over the CLI's next-action facility; use this for any feature or fix request.
---

# SDD Flow

This skill drives a full Spec-Driven Development flow from a feature / fix request all the way through finalization. It is a **thin dispatcher**: per-step procedures live in the CLI's data-driven next-action facility (`sdd-forge flow get next-action`), not in this file.

## Core Principle

**MUST: When a rule in this skill conflicts with a memory entry (e.g. `feedback_*.md` referenced from `MEMORY.md`), the skill rule takes precedence.** Memory entries that contradict skill rules should be considered stale; update or delete them.

**Use the CLI's `requires_approval` field to decide whether user confirmation is required before a step.**
Do not ask the user to confirm routine step execution when `requires_approval: false`.

**autoApprove check (MANDATORY):**
Before presenting any choice to the user, you MUST run `sdd-forge flow get status` and display the `autoApprove` field value. This is not optional — skipping this check is a protocol violation.
- Run the command exactly as `sdd-forge flow get status` (no extra options).
- If the next-action envelope has `requires_approval: false`, execute the step without a "run this step?" confirmation. This applies even when `autoApprove: false`.
- If `requires_approval: true` and `autoApprove: false` (or field is missing): present the choice to the user and wait for input.
- If `requires_approval: true` and `autoApprove: true`: treat choice id=1 as selected and proceed immediately. Display progress briefly (e.g. "auto: approval → [1] 承認").
- Continue without waiting when the step does not require approval, or when `autoApprove: true` satisfies a required approval.
- If a step fails (command error, gate FAIL, test failure), apply the retry limits defined in each skill. If the retry limit is reached, STOP and return control to the user.

**autoApprove exceptions (MUST present to user even when `autoApprove: true`):**
The following user-facing choices are explicit exceptions to the auto-select rule because silently picking `[1]` would risk irreversible loss:
- `finalize-cleanup` orphan-commit recovery prompt (`ORPHAN_COMMITS_DETECTED`): always present the cherry-pick / abort / force-continue choice to the user. Do not auto-select. See `flow.run.finalize-cleanup` for details.
- Any choice whose envelope error code begins with `SQUASH_BASELINE_` or `FORCED_ORPHAN_`: surface the recovery guidance verbatim and let the user decide.

### MUST
**MUST: AI は `sdd-forge flow set auto on` を自分で実行してはならない。** auto モード切替はユーザーの明示的指示（`/sdd-forge.flow-auto` 等）でのみ実行する。

### Why
auto モードは AI が確認なしに進行できるため、誤動作時の影響が大きい。AI が独断で auto を有効化すると、ユーザーの判断機会を奪う重大な逸脱となる。過去 4 件の事例あり。

### How to apply
- envelope の `requires_approval: true` を見ても、AI 側で auto を有効化することはしない。
- ユーザーが interactive Q&A 中の場合、auto モード reminder が context にあっても判断を待つ。
- `flow get next-action` の autoUpgrade.available === true でも、AI が `set auto on` を自走実行してはならない（ユーザーが選択肢で `[1]` を選ぶまで待機）。

### MUST
**MUST: SDD フロー内では、CLI の `requires_approval` が true のアクションだけユーザー承認を要求する。** `requires_approval: false` の通常 step では、実行確認の選択肢を出さずに step instruction を実行する。

### Why
`requires_approval` は CLI 側が持つ承認境界である。skill 側が全 step で確認を挟むと、review-draft-questions などの機械的 step まで不要に停止し、CLI の承認設計と矛盾する。

### How to apply
- `flow get next-action` の `requires_approval` が false なら、「実行しますか？」の確認を出さずに指示を実行する。
- `requires_approval` が true か、autoUpgrade / エラー復旧 / ユーザー回答が必要な QA loop の場合だけ Choice Format で確認する。
- step 完了後は次の `flow get next-action` を読み、同じルールで判断する。

**MUST: 即答せず、要件・前提・例外を洗い出してから回答する。** 実装着手前に要件を列挙し、完了時に突き合わせる。

**MUST: 場当たり的な修正をしない。** 同種の箇所を grep し、既存の仕組みを調べてから設計する。1 箇所だけ直して残りを放置するパターンは禁止。

**MUST: Issue を勝手に分割提案しない。** ユーザーが定義した Issue が 1 つの concern であるかはユーザーの判断。AI は Issue を複数の spec に分割する提案をしない。

**MUST: 承認済みのコミット分割は auto モードでも遵守する。** finalize-commit 時に「論理的に複数コミットに分けてレビュー可能性を高める」と合意済みの場合、auto モードでも 1 コミットに squash しない。

**MUST: `sdd-forge` コマンドをチェーン (`&&` `;` `|`) または background 実行してはならない。** 各 `sdd-forge` 呼び出しは独立した foreground Bash で実行し、結果を確認してから次へ進む。

**Flow runtime log rule (MANDATORY):**
- Never hardcode `/tmp/...` for flow-related logs or temporary files.
- When a flow command needs an agent/tmp/log base directory for the current invocation, pass `--agent-work-dir <path>` to `sdd-forge flow run ...`.
- When preserving human-readable command output, pass `--log-file <path>` to `sdd-forge flow run ...`; if omitted, the CLI writes a default runtime log under `<agentWorkDir>/logs/<flowId>/`.
- Do not wrap flow commands with environment-variable prefixes or shell redirection just to capture logs; keep the command prefix as `sdd-forge flow run ...` so approval-prefix rules can match it.

## Flow Progress Tracking

**MUST: Run `sdd-forge flow set step <id> <val>` upon completion of each step to record flow progress.** Exceptions: `test-execute`, `test-result-review`, `retro`, and the `finalize-*` leaves (`finalize-commit`, `finalize-merge`, `finalize-sync`, `finalize-cleanup`) are advanced by their own CLI commands' post hooks — do not advance them manually. Manual completion must not mask prerequisite failures, invalid v2 test artifacts, or failed project regression evidence.

All flow step IDs are defined in the CLI schema. The dispatcher obtains the current step and instructions from `sdd-forge flow get next-action` — the skill itself does not encode per-step sequencing.

## Context Recording (Compaction Resilience)

**MUST: Record key decisions for compaction recovery.**

- After each user choice, record: `sdd-forge flow set note "<step>: <choice summary>"`
- After flow.json is created (prelude step), record the request: `sdd-forge flow set request "<user's original request>"`

## Metric Recording (Read Tool)

**MUST: When reading files directly with the Read tool (not via `sdd-forge flow get context`), record the metric:**
- After reading `docs/` files: `sdd-forge flow set metric <current-phase> docsRead`
- After reading `src/` files: `sdd-forge flow set metric <current-phase> srcRead`

The current phase can be determined from the current step (e.g. `draft`, `spec`, `gate`, `test`, `implement`, `test-execute`, `test-result-review`, `review`, `gate-impl`, `retro`, `finalize`).

Note: `sdd-forge flow get context` automatically records these metrics via hooks — manual recording is only needed for direct Read tool usage.

## Choice Format

Present choices in the following format:
```
──────────────────────────────────────────────────────────
  Description (question or situation)
──────────────────────────────────────────────────────────

  [1] Label
  [2] Label
  [3] Other

```
- Do not combine the description and choices into one sentence. Description goes inside the lines, choices go outside.
- Add blank lines before and after the choices.

**MUST: ユーザーへの全ての質問は Choice Format で提示する。** ラベル + 1 行注釈の選択肢。詳細説明は選択肢ブロックの外（上側）に独立配置する。free-form question 禁止（applied user-requested changes の確認も含む）。

<!-- ai-question-style.md — shared style rules for AI-generated questions and choices -->

## AI Question / Choice Style Rules

These rules apply to every question and option block that the AI presents to the user.
The goal is to produce output that is consistent in granularity, tone, and structure
regardless of which model renders it.

### 1. 文体 (Prose Style)

- 結論先出し。前置き・総括文を省く。
- 一文を短く。修飾の入れ子を避ける。
- 体言止め・箇条書きで密度を上げる。
- 二重譲歩を畳む。
- 曖昧な修飾語を避ける: `strict`, `autonomous`, `low impact`, `backward-compatible`,
  `appropriate`, `fast`, `easy` など検証不能な語。検証可能な条件に書き換える。

**悪い例:**
> 既存機能への影響はおそらく低く、互換性を保てるような形で統合される可能性があります。

**良い例:**
> 既存機能への影響なし。R1 / R2 のみ追加。既存本文は変更しない。

### 2. 前提知識 (Assumed Knowledge)

- 専門用語を出したら 1-2 行で定義を添える。
- 読者が該当コードを開いていない前提で書く。
- 関数名・ファイル名・CLI だけ挙げず、何をするものか短く記す。

**悪い例:**
> buildGuardrailPrompt を差し替えて agent.call のコストを下げます。

**良い例:**
> `buildGuardrailPrompt` (= gate 評価 prompt を組み立てる関数) を置換。
> agent.call は Claude / codex CLI を外部 spawn する関数で、呼び出し 1 回が数秒コスト。

### 3. 選択肢提示 (Choice Presentation)

- 選択肢ブロック内は「ラベル」＋「1 行注釈」のみ。複数行の説明を詰めない。
- 比較・評価・pros/cons の詳細は、選択肢ブロックの外（上側の本文）に独立配置する。
- 推奨案があれば明示し、根拠を 1-2 行で添える。
- 推奨案がある場合、推奨案を `[1]` に配置する。同率トップ（僅差）が複数ある場合は 1 件を `[1]` に置き、残り候補は本文側で補足する。推奨案が無い場合は配置ルールを発動させない（並び順は自由）。
- 選択肢内に新規 API / ファイル / コマンドを挙げるときは、本文側で以下を 3-5 行示す:
  - 関数: シグネチャ例（引数型・戻り値型・呼び出し例）
  - CLI: 呼び出し例と出力 JSON 例
  - ファイル: 想定される中身のスケッチ

**悪い例（選択肢内に詳細を詰め込む）:**

```
  [1] 共通パーシャル化
      pros: DRY。編集が 1 箇所で済む。既存の include 基盤を流用できる。
            upgrade でユーザーに反映される。
      cons: get-step-instructions.js の改修が必要。既存パーサーを流用するので
            コスト小。
  [2] コピー埋め込み
      ...
```

**良い例（本文で比較、選択肢はラベル + 短注釈）:**

> 共通パーシャル化 vs コピー埋め込みの比較:
>
> | 方式 | 編集コスト | 同期リスク | 実装差分 |
> |---|---|---|---|
> | パーシャル | 1 箇所 | なし | ローダ改修あり |
> | コピー | 2 箇所 | あり | なし |

```
  [1] 共通パーシャル化（推奨）
  [2] コピー埋め込み
```

### 4. Turn Structure for User Decisions (Required)

Although these rules are written in English, perform reasoning AND user-facing output in the user's response language. The only tokens that may remain in the source language are: code identifiers (function/class/variable names, file paths, command names, CLI flags, error codes), library/package names, and proper product/brand names. Every other token MUST be translated into the response language.

Every turn that asks the user to choose, decide, or confirm MUST contain all five sections below in order:

1. **Decision statement** (REQUIRED, 1 sentence): explicitly state what is being decided.
2. **Recommendation + rationale** (REQUIRED, 1-3 sentences): name the recommended option and give the reason. If no recommendation is possible, REQUIRED to explicitly state that no recommendation is possible, with the reason — do not skip this section.
3. **Comparison** (REQUIRED, one short paragraph or 2-4 bullets): how the recommended option differs from each alternative. This section is mandatory even when options are equivalent — in that case, state how they differ in trade-offs.
4. **Options block** (REQUIRED): list every option as "label — one-line note". Each option MUST appear. Mark the recommended one explicitly.
5. **Response instruction** (REQUIRED, 1 sentence): tell the user exactly what to type/say to advance.

ABSOLUTELY PROHIBITED:

- Skipping any of the 5 sections above.
- Producing a single-line response when a decision is being asked.
- Listing facts and asking "which one?" without providing the recommendation section.
- Leaving foreign-language tokens in prose that have natural equivalents in the response language.

All sections marked REQUIRED must appear regardless of whether the AI internally judges them necessary; the structure itself is the contract.

### MUST
**MUST: 議論の途中で「結論:」「決定:」と独断で締めてはならない。** 設計判断はユーザーが決定者である。AI は選択肢とトレードオフを示し、ユーザーの選択を待つ。

### Why
過去のセッションで、AI が議論を勝手に締めて方向性を確定させ、ユーザーが意図しない実装に進んだ事例が 8 件発生している。AI が議論をリードしすぎると、ユーザーの判断機会が奪われる。

### How to apply
- draft / review-draft-questions / draft-refine / review-draft-coverage / spec / review-spec / spec-review-triage / spec-repair の各フェーズで、複数の選択肢があり得る論点では必ず Choice Format で提示する。
- 「結論:」「決定:」「方針が確定した」等の語で議論を締めない。「推奨:」「私の見解:」までに留める。
- ユーザーが明示的に選択肢を指定するまで、AI は最終決定を確定させない。

## Required Sequence

### A. Entry — branch on flow state

Run `sdd-forge flow get status`.

- If `active: false` → go to **B. Prelude**.
- If `active: true` → go to **C. Dispatcher loop**.

### B. Prelude (pre-flow setup)

Use this path when no active flow exists. The prelude creates a fresh flow state; after it completes, proceed to the dispatcher loop.

B.0. **Initialize flow state**
   - **Input parsing rules** — apply these rules to the user's raw input before running `set init`:
     - `#<number>` → always interpret as a GitHub Issue. Capture the number for `--issue`.
     - `issue <number>` or similar explicit forms → treat as a GitHub Issue.
     - `spec <number>` or `specs/<number>-...` → treat as a local spec reference (do not pass as `--issue`).
     - A bare number (e.g., `133`) → ambiguous input. Do not pass as `--issue`; include in the request text so prelude Q1 can disambiguate.
   - Run `sdd-forge flow set init [--issue N] [--request "<user raw text>"]` to create a preparing state file (`.active-flow.<runId>`).
   - Save the returned `runId` from `data.runId` for use in B.4.

B.0.5. **Auto-mode eligibility check** (spec 208, phase-aware input per spec 220)
   - If an Issue is linked, ensure its body is reflected into `--request` at `flow set init` (fetch with `sdd-forge flow get issue <n>` if needed). The CLI derives the input statically from the preparing flow state (`issue + request`) — `--input` is no longer accepted.
   - Run `sdd-forge flow run auto-check --run-id <runId>` and read `data.eligible`. `--run-id` is required in preparing mode (spec 220 removed the single-preparing auto-select).
   - **If `eligible: true`**: present the auto-mode prompt using the Choice Format. The prompt asks ONLY whether to enable auto mode — do not bundle a "is this summary correct?" question into the same choice (the summary is confirmed in B.3).
     - Question (above choices): `Enable auto mode?` (single line).
     - Choices: `[1] Yes — AI proceeds without confirmations` `[2] No — keep normal per-step confirmations`.
     - Note below choices: "You can switch later with `/sdd-forge.flow-auto on`."
     - If user picks `[1]`:
       - Run `sdd-forge flow set auto on --run-id <runId>` (the CLI trusts the verdict already persisted by `run auto-check` above and writes `autoApprove: true` to the preparing flow so `flow prepare` will inherit it; no second AI call. Rejection here means STOP).
       - **Skip B.1 and B.2.** Use work-environment = worktree and base-branch = current branch by default.
       - Proceed to B.3 (Draft Q1 is also auto-approved under autoApprove).
     - If user picks `[2]`: continue with the normal B.1 → B.2 → B.3 flow.
   - **If `eligible: false`**: do NOT display the auto-mode prompt. Continue with the normal B.1 → B.2 → B.3 flow. The result is still persisted in the flow state `autoCheck` for audit.

B.1. **Choose work environment**
   - **Auto-detect:** if `.git` is a file (not directory) in the project root, you are already inside a worktree — skip the choice and use `--no-branch` automatically.
   - Otherwise: run `sdd-forge flow get prompt plan.work-environment` and present the choices.

B.2. **Choose base branch**
   - For work-environment options 1 (worktree) and 2 (branch): run `sdd-forge flow get prompt plan.base-branch` and present the choices. Append `` (`<current-branch>`) `` to the description.
     - `[1]` → use `--base <current-branch>`.
     - `[2]` → ask which branch and use `--base <user-specified-branch>`.

B.3. **Draft Q1 — intent confirmation**
   - **autoApprove skip:** if `autoApprove: true`, skip this interactive step and use the Issue / request text directly as the draft source.
   - If an Issue number was captured, run `sdd-forge flow get issue <number>` to fetch the title and body.
   - Present a concise summary using the unified Goal + Scope + 1–3 line description format (same shape the auto-check prompt uses in B.0.5).
   - Ask with the Choice Format: `[1] Yes [2] Revise [3] Other`. **Retry limit: 1 round.** If `[3]` is selected twice, STOP.
   - Derive the spec `--title`: short, max 30 characters, lowercase English, hyphen-separated.

B.4. **Prepare spec (silent)**
   - Commands (based on B.1). `--run-id <runId>` from B.0 inherits `--issue` and `--request`:
     - Worktree: `sdd-forge flow prepare --title "..." --base <branch> --worktree --run-id <runId>`
     - Branch: `sdd-forge flow prepare --title "..." --base <branch> --run-id <runId>`
     - No branch: `sdd-forge flow prepare --title "..." --no-branch --run-id <runId>`
   - On `{ok: false, code: "DIRTY_WORKTREE"}` → run `sdd-forge flow get prompt plan.dirty-worktree` and present the choices; do not retry until clean.

Proceed to **C. Dispatcher loop**.

Note: Test execution is centralized in the impl-phase `test-execute` step. The dispatcher invokes it after `implement` and persists `test-execute-result.json` version `"2"` + raw output. Subsequent steps (`test-result-review`, `review`, flow-level `gate-impl`, `retro`) read those artifacts and do not re-run tests. Prepare/docs-scan and `analysis.json` read/validation failures are hard stops. A started project regression failure is valid evidence and advances to `test-result-review`; a prerequisite failure before command start is a hard stop and must not be hidden with manual step completion.

### C. Dispatcher loop

Repeat until the loop exit condition is met:

C.1. **Ask the CLI for the next action**
   - Run `sdd-forge flow get next-action`.
   - The CLI auto-promotes the next pending step on `done` transitions via the definition hierarchy. Do not manually `flow set step <id> in_progress` to advance the flow.
   - If all mainline steps are `done` or `skipped` → loop exit (CLI returns `NO_IN_PROGRESS_STEP`).
   - Otherwise, consume the returned envelope: `action`, `instructions.content`, `context`, `output_schema`, `requires_approval`.

C.1.5. **Auto-upgrade check (spec 232)**
   - If the envelope contains `autoUpgrade` with `available === true`, present the following choice **before** executing step instructions:
     ```
     ──────────────────────────────────────────────────────────
       Auto mode is available. Switch now?
     ──────────────────────────────────────────────────────────

       [1] Switch to auto — continue without confirmations
       [2] Stay manual — keep normal per-step confirmations

     ```
   - If `[1]`: run `sdd-forge flow set auto on`. On success, update `autoApprove` to `true` for subsequent steps.
   - If `[2]`: run `sdd-forge flow set auto off`. The `autoDesired` flag is cleared and no further upgrade prompts will appear.
   - This check runs at most once per flow (the CLI clears `autoUpgrade` after `set auto on/off` via the trust path).

C.2. **Execute instructions**
   - Treat `instructions.content` as the authoritative procedure for this step. Follow it exactly.
   - Fetch any additional context the instructions request via `sdd-forge flow get context ...` / `sdd-forge flow get guardrail <phase>`.
   - Retry limits: read the resolved numeric maxAttempts from the next-action envelope (`maxAttempts`). When that limit is reached, STOP and return control to the user.
   - When the current step's work is finished, advance step status:
     - If the instructions run a CLI command whose post-hook advances step (`flow run gate`, `flow run impl-confirm`, `flow run finalize-commit`, `flow run finalize-merge`, `flow run finalize-sync`, `flow run finalize-cleanup`, `flow run sync`) — the hook handles the transition; do nothing further.
     - **`flow run review`**: draft review phases (`review-draft-questions` / `review-draft-coverage`) auto-complete on PASS or ADVISORY via post hook. `review-spec` auto-completes via post hook for PASS / ADVISORY / FAIL; FAIL advances to `spec-review-triage`. `review-test` still follows its prompt instructions. Impl/task review still auto-dones via post hook.
     - **`flow run test-execute` / `flow run test-result-review` / `flow run retro`**: post hooks validate current v2 artifacts and advance their own steps. Do not manually mark them done to bypass prerequisite failures.
     - Otherwise, manually record completion: `sdd-forge flow set step <current-step> done`.

C.3. **Loop**
   - Return to C.1.

### Loop exit condition

The loop exits when `sdd-forge flow get status` reports all steps either `done` or `skipped`, or when a retry budget is exhausted. On budget exhaustion, STOP and return control to the user.

## Universal Guardrails

These apply to every step executed by the dispatcher. They are enforced here because they are cross-cutting — the per-step instructions assume them.

### Approval-gated transitions

- Do not advance past any step whose `requires_approval` is `true` without explicit user approval.
- **autoApprove exception:** when `autoApprove: true`, `requires_approval: true` is satisfied by auto-selecting `[1]`.

### No-auto-promote

- Do not implement code before the spec gate has PASSed, tests are written, and the user has approved the spec (plan-phase gate chain).
- Do not finalize before the impl-phase gate has PASSed.

### Worktree boundary

When `worktree: true` in flow.json:
- **All file operations (editing, creating, reading) MUST be done inside the worktree directory.** Do not edit files in the main repository.
- Run `sdd-forge flow get status` to see the worktree path. Use absolute paths if needed.
- The worktree is an isolated copy — changes in the main repo are NOT visible in the worktree and vice versa.
- **Flow state definitions:**
  - **Flow is active** — BOTH of the following hold simultaneously (AND):
    - `sdd-forge flow get status` returns `active: true`.
    - The worktree directory still exists on disk (verifiable via `test -d <worktree-path>`).
  - **Flow is released** — EITHER of the following has flipped (OR); either one alone is sufficient:
    - `sdd-forge flow get status` returns `active: false` — the flow has ended.
    - The worktree directory no longer exists (`test -d <worktree-path>` fails) — cleanup has deleted it.
- **MUST: While the flow is active (per the definition above), never `cd` out of the worktree path.**
- **Once the flow is released, the worktree boundary is lifted and `cd` out of the (former) worktree path is allowed.**
- **Once `sdd-forge flow run finalize-cleanup` completes successfully (envelope `ok: true`), both release conditions flip together: the worktree directory is removed and `flow get status` reports `active: false`.** Cleanup itself emits the finalize Report inline in the response envelope (`data.report.text`); subsequent `sdd-forge` commands run from the main repository because the worktree no longer exists.
- **Halt envelopes (e.g. `ORPHAN_COMMITS_DETECTED`, `SQUASH_BASELINE_MISSING`, `SQUASH_BASELINE_DIVERGED`, `MAIN_REPO_DIRTY`, `MAIN_REPO_LOCKED`, `CHERRY_PICK_CONFLICT`, `ARGS_ERROR`) leave the worktree boundary in effect.** The worktree directory and feature branch are intentionally retained so the user can recover (e.g. archive the branch, run `--auto-rescue`, or re-run with `--force`). Until the next `finalize-cleanup` invocation succeeds, do NOT cd out of the worktree.
- **MUST: Never run `git stash` / `git stash pop` / `git stash apply` / `git reset --hard` / `git checkout -- <path>` in the main repository while the flow is active.** Stashes, resets, and checkouts on shared state can restore stale content (e.g. unrelated stashes from other branches), introduce conflicts, and corrupt the main working tree — even when the flow's own worktree is unaffected.
- **If baseline comparison (e.g., running tests on `baseBranch` to compare failure counts) is required, do NOT cd into the main repo.** Instead, create a short-lived detached worktree (`git worktree add --detach <tmp-path> <baseBranch>` in an allowed location, run the comparison there, then remove it with `git worktree remove <tmp-path>`). When in doubt, reuse evidence already captured in prior `issue-log.json` entries rather than re-measuring against `main`.
- **MUST: During an active worktree flow, never pass a main repo absolute path as the file-path argument to Edit/Write tool calls.** Allowed alternatives are (a) a relative path from the worktree cwd, or (b) an absolute path under the `worktreePath` returned by `sdd-forge flow get resolve-context`. Rationale: Edit/Write writes to whatever absolute path it receives regardless of the shell's cwd, so a main-repo path silently bypasses the worktree and mutates shared state. Paths surfaced by Read/Grep that resolve to the main repo must be rewritten to the worktree equivalent before being passed to Edit/Write.

**MUST: active flow 中は main リポジトリで `git stash` / `git stash pop` / `git stash apply` / `git reset --hard` / `git checkout -- <path>` を実行してはならない。** 別ブランチ由来の stale な stash 復元・共有状態破壊を防ぐ。ベースライン比較は短命の detached worktree を使う。
- Before merge, consider running `git rebase <baseBranch>` in the worktree to incorporate upstream changes and avoid post-merge test failures.
- The finalize phase is decomposed into 4 independent leaf steps driven by the dispatcher: `finalize-commit` → `finalize-merge` → `finalize-sync` → `finalize-cleanup`. Each step has its own CLI command (`sdd-forge flow run finalize-commit`, etc.) and prompt. Each command's post hook normalizes its own step status to `done` on success — do not advance these steps manually.
- **MUST: Do NOT run `sdd-forge flow run finalize-cleanup` in background.** Run it in the foreground and wait for it to complete before proceeding.
- **MUST: After `sdd-forge flow run finalize-cleanup` completes successfully**, the response envelope's `data.report.text` field contains the finalize Report. Place that text verbatim inside a fenced code block so the user sees the Report. If `data.report` is `null`, an envelope `errors` entry with code `REPORT_MISSING` explains why — surface that warning to the user instead of fabricating Report contents. The cleanup command itself removes the worktree and writes `.sdd-forge/last-finalized-spec`; the next `sdd-forge` command runs from the main repository.
- **MUST: When `finalize-cleanup` returns `ORPHAN_COMMITS_DETECTED`, present the cherry-pick / abort / force-continue choice to the user.** This is an explicit exception to autoApprove auto-select: silently picking force-continue would lose feature-branch commits permanently. The envelope ships `data.orphanCommits` (sha + subject) and `data.recoveryOptions = ["cherry-pick", "abort", "force-continue"]` — show the commit list and the choice block, then act on the user's selection (`--auto-rescue` for cherry-pick, halt for abort, `--force` for force-continue with explicit user confirmation). `SQUASH_BASELINE_MISSING` and `SQUASH_BASELINE_DIVERGED` are similar manual-recovery prompts; surface their `errors[0].messages` verbatim.

### Draft Return: phase-aware

When spec writing discovers a missing user decision that belongs in draft QA:
- Use `sdd-forge flow run reopen-draft --reason "<text>"` to return to the draft phase.
- Pre-implementation plan flows do not require a done task. On success, the command marks `draft` as `in_progress` and resets downstream plan steps so draft review, gate, spec, approval, and test planning run again.
- Existing spec artifacts are retained and the reopen reason is recorded in `issue-log.json` so the next draft pass can see why the return happened.

When `reopen-draft` fails or reports a recovery choice, surface that recovery through Choice Format and wait for the user's decision unless `autoApprove` explicitly covers the choice and the skill does not list it as an exception.

### Draft Return: implementation-phase task additions

When implementation reveals that the spec needs additional tasks:
- **MUST: Do not add tasks dynamically via any CLI during impl.** The only legitimate path is to return to the draft phase, append new tasks to `spec.json.tasks[]`, and re-approve.
- Use `sdd-forge flow run reopen-draft [--reason "<text>"]` to rewind the draft step. Preconditions for implementation-phase task additions: at least one done task exists and the flow lifecycle is still `active`.
- After `reopen-draft` succeeds: edit `spec.json.tasks[]` to append new tasks (new entries must have `added_round = max(existing) + 1`). Existing tasks' `id` / `origin` / `added_round` are invariant — the spec gate rejects any changes to those fields. `title` / `description` of existing tasks may be corrected.
- Proceed through `gate-draft → spec → gate → approval` again. `spec.json` remains the source of truth; the approval prompt renders `spec.md` only when the user needs the human-readable view. The approval post-hook reflects only the new tasks into `flow.json.tasks[]`; existing tasks keep their status and steps.

### Command execution discipline

- **NEVER chain or background `sdd-forge` commands.** Each `sdd-forge` command must be run as a separate, foreground Bash invocation. Do not use `&&`, `||`, `;`, pipes, or `run_in_background`. If a command ends up in the background, wait for the completion notification before proceeding.
- **NEVER run `sdd-forge flow set auto on` yourself.** Only the user can enable autoApprove mode (via `/sdd-forge.flow-auto` or explicit instruction).

## Hard Stops

- Do not write code before the approach plan is user-approved.
- Do not finalize without user confirmation.
- Do not proceed past a failed gate.
- Do not proceed to the next step without user confirmation.
- Do not `cd` out of the worktree during an active flow (except after finalize cleanup completes).

**autoApprove exception:** when `autoApprove: true`, the rules "do not proceed without user confirmation" and "do not finalize without asking" are satisfied by auto-selecting `[1]`. All other hard stops remain in effect.

## Issue Log Recording

**MUST: When a fix, correction, or workaround is needed (e.g., a command fails, a gate check reveals an issue, a test reveals a bug, a design assumption turns out wrong), record it immediately:**

```
sdd-forge flow set issue-log --step <current-step> --reason "<what went wrong>" --trigger "<what triggered the issue>" --resolution "<how it was fixed>" --guardrail-candidate "<principle to prevent recurrence>"
```

- Do not defer recording — record as soon as the fix is applied.
- `--reason` and `--step` are required. `--trigger`, `--resolution`, `--guardrail-candidate` are optional but recommended.
- Minimum length (enforced by the CLI): `--reason` 20 chars (trimmed), optional fields 10 chars (trimmed). Shorter inputs are rejected with a non-zero exit code.
- This creates `specs/<spec>/issue-log.json`. The file persists with the spec.

### When to record

Record in issue-log when any of the following occur:

- A test failure reveals a production code bug that is outside the current spec's scope (the bug exists independently of this spec's changes).
- A test is adjusted to match current (incorrect) behavior because the spec prohibits production code changes — the underlying bug must not be silently lost.
- A worktree creation or deletion operation fails (e.g., path conflict, branch already exists).
- A merge conflict occurs during rebase or merge.
- A commit fails (including pre-commit hook failures).
- A workaround is applied instead of a proper fix (e.g., retrying a command with different flags, skipping a step due to an environment issue).
- A design assumption documented in the spec turns out to be wrong during implementation.
- A gate check fails and requires spec or code correction.

**Key principle:** If a problem is discovered but not fixed in this spec's scope, it MUST be recorded so it is not forgotten. This is especially critical in auto mode where no human is watching.

### Examples

```bash
# Test revealed a production code bug outside spec scope
sdd-forge flow set issue-log --step test \
  --reason "fixUnescapedQuotes mishandles nested quotes — test adjusted to match current behavior" \
  --trigger "unit test for edge case with nested single quotes inside double-quoted values" \
  --resolution "adjusted test expectation to match current (incorrect) behavior per spec constraint" \
  --guardrail-candidate "when a test reveals a pre-existing bug, always record it before adjusting the test"

# Worktree merge conflict
sdd-forge flow set issue-log --step finalize \
  --reason "merge conflict in SKILL.md due to upstream changes during implementation" \
  --trigger "git merge development into feature branch" \
  --resolution "manually resolved conflict, kept both upstream and feature changes"
```

## Commands (reference)

```bash
sdd-forge flow get status
sdd-forge flow get next-action
sdd-forge flow get context [<path> | --search "..."] [--raw]
sdd-forge flow get guardrail <draft|spec|task-spec|task-impl|integration|test|lint|review>  # alias: impl -> task-impl
sdd-forge flow get prompt <kind>
sdd-forge flow get check <target>
sdd-forge flow get issue <number>
sdd-forge flow get qa-count
sdd-forge flow get resolve-context
sdd-forge flow set init [--issue N] [--request "..."]
sdd-forge flow set step <id> <status>
sdd-forge flow set summary '<JSON array>'
sdd-forge flow set req <index> <status>
sdd-forge flow set request "<text>"
sdd-forge flow set note "<text>"
sdd-forge flow set issue <number>
sdd-forge flow set metric <phase> <counter>
sdd-forge flow set issue-log --step <id> --reason "<text>" [--trigger "<text>"] [--resolution "<text>"] [--guardrail-candidate "<text>"]
sdd-forge flow set retry reset <gate|review> <phase> --yes
sdd-forge flow prepare --title "..." [--base branch] [--worktree] [--no-branch] [--issue N] [--request "..."] [--run-id <id>]
sdd-forge flow run gate [--phase <draft|spec|task-spec|task-impl|integration>] [--agent-work-dir <path>] [--log-file <path>]
sdd-forge flow run review [--phase <draft|spec|test|impl>] [--agent-work-dir <path>] [--log-file <path>]
sdd-forge flow run test-execute
sdd-forge flow run test-result-review
sdd-forge flow run impl-confirm --mode <overview|detail>
sdd-forge flow run finalize-commit [--message "<msg>"]
sdd-forge flow run finalize-merge
sdd-forge flow run finalize-sync
sdd-forge flow run finalize-cleanup
sdd-forge flow run reopen-draft [--reason "<text>"]
sdd-forge flow run retro [--force] [--dry-run]
sdd-forge flow run report [--dry-run]
sdd-forge snapshot check
```
