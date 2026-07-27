---
name: senti.flow
description: Run the Spec-Driven Development flow end-to-end after the user explicitly invokes Spec-Driven Development flow, explicitly requests a flow start, or resumes an active flow. Thin dispatcher over the CLI's next-action facility.
---

# Spec-Driven Development Flow

This skill drives a full Spec-Driven Development flow from an explicitly started request all the way through finalization. It is a **thin dispatcher**: per-step procedures live in the CLI's data-driven next-action facility (`senti flow get next-action`), not in this file.

## Core Principle

**MUST: When a rule in this skill conflicts with a memory entry (e.g. `feedback_*.md` referenced from `MEMORY.md`), the skill rule takes precedence.** Memory entries that contradict skill rules should be considered stale; update or delete them.

**Use the CLI's `requires_approval` field to decide whether user confirmation is required before a step.**
Do not ask the user to confirm routine step execution when `requires_approval: false`.

**autoApprove check (MANDATORY):**
Before presenting any choice to the user, you MUST run `senti flow get status` and display the `autoApprove` field value. This is not optional — skipping this check is a protocol violation.
- If the current flow `runId` is known, prefer `senti flow get status <runId>` so the check reads the target flow instead of an unrelated current context.
- `active: true` is not by itself a reason to stop a new flow start. Parallel flows are allowed when the new target is addressed by an explicit preparing `runId` and verified with target-aware status.
- When starting a new flow while another flow is active, record the `runId` returned by `senti flow set init`; before and after `senti flow prepare --run-id <runId>`, verify the target with `senti flow get status <runId> --expect-run-id <runId>` plus every known `--expect-issue` and `--expect-spec` guard.
- After a dispatcher target `runId` is known, all target-sensitive dispatcher continuation commands for that flow must carry `--expect-run-id <runId>` plus every known `--expect-issue` and `--expect-spec` guard. This applies to `senti flow get next-action`, target-bound `senti flow get context` reads, target-bound `senti flow get prompt ...` reads such as `plan.approval`, `senti flow run ...`, and active-flow-mutating `senti flow set ...` commands.
- If the user explicitly continues an existing flow and the target Issue is known, run `senti flow get status <runId> --expect-run-id <runId> --expect-issue <n>` when `runId` is known. Without a target `runId`, use bare status for display and do not treat another active flow as authorization to continue it.
- If the user explicitly continues an existing spec target, run `senti flow get status --expect-spec <spec>` before dispatcher actions.
- If the user explicitly continues an existing runId target for dispatcher continuation, run `senti flow get status <runId> --expect-run-id <runId>` before dispatcher actions.
- Treat `ACTIVE_FLOW_MISMATCH` as a no-mutation boundary, then distinguish a
  locally generated runId transcription error from a true target mismatch:
  - A transcription error is recoverable only for the same read-only
    `senti flow get status <selectedRunId> ...` command when all of the
    following hold: `<selectedRunId>` equals the exact `targetRunId` previously
    returned by a successful CLI response; `data.activeRunId` also equals that
    value; the only unequal expected/active identity pair is
    `expectedRunId`/`activeRunId`; and every supplied Issue/spec guard pair
    matches.
  - For that case, rebuild both the positional selector and
    `--expect-run-id` from the stored `targetRunId`, preserve the matching
    Issue/spec guards, and retry the same read-only status command once in the
    same turn. Do not ask the user, enter direct mode, or run any mutating
    command before this retry passes.
  - If the corrected status passes, continue the existing Flow in the same
    turn. If it fails again, or any Issue/spec/selected-run identity differs,
    STOP before `next-action`, `repair`, `run`, `finalize`, `cleanup`, or file
    edits. `autoApprove` and `requires_approval` never bypass a true mismatch.
- Store runId values returned by the CLI as opaque tokens. Build
  `targetGuardArgs` once from those stored tokens and reuse them verbatim;
  never retype, shorten, reconstruct, or infer a runId from a branch, path, or
  prose.
- A preparing flow still reports `autoApprove: false` in status; use the `senti flow set auto on --run-id <runId>` response and `senti flow prepare --run-id <runId>` inheritance for prelude auto mode.
- Bare `senti flow get status` remains valid for current-context display and for detecting whether any active flow exists before a runId is known.
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
**MUST: AI は `senti flow set auto on` を自分で実行してはならない。** auto モード切替はユーザーの明示的指示（`/senti.flow-auto` 等）でのみ実行する。

### Why
auto モードは AI が確認なしに進行できるため、誤動作時の影響が大きい。AI が独断で auto を有効化すると、ユーザーの判断機会を奪う重大な逸脱となる。過去 4 件の事例あり。

### How to apply
- envelope の `requires_approval: true` を見ても、AI 側で auto を有効化することはしない。
- ユーザーが interactive Q&A 中の場合、auto モード reminder が context にあっても判断を待つ。
- `flow get next-action` の autoUpgrade.available === true でも、AI が `set auto on` を自走実行してはならない（ユーザーが選択肢で `[1]` を選ぶまで待機）。

### MUST
**MUST: Spec-Driven Development フロー内では、CLI の `requires_approval` が true のアクションだけユーザー承認を要求する。** `requires_approval: false` の通常 step では、実行確認の選択肢を出さずに step instruction を実行する。

### Why
`requires_approval` は CLI 側が持つ承認境界である。skill 側が全 step で確認を挟むと、draft-questions-review などの機械的 step まで不要に停止し、CLI の承認設計と矛盾する。

### How to apply
- `flow get next-action` の `requires_approval` が false なら、「実行しますか？」の確認を出さずに指示を実行する。
- `requires_approval` が true か、autoUpgrade / エラー復旧 / ユーザー回答が必要な QA loop の場合だけ Choice Format で確認する。
- step 完了後は次の `flow get next-action` を読み、同じルールで判断する。

**MUST: 即答せず、要件・前提・例外を洗い出してから回答する。** 実装着手前に要件を列挙し、完了時に突き合わせる。

**MUST: 場当たり的な修正をしない。** 同種の箇所を grep し、既存の仕組みを調べてから設計する。1 箇所だけ直して残りを放置するパターンは禁止。

**MUST: Issue を勝手に分割提案しない。** ユーザーが定義した Issue が 1 つの concern であるかはユーザーの判断。AI は Issue を複数の spec に分割する提案をしない。

**MUST: 承認済みのコミット分割は auto モードでも遵守する。** finalize-commit 時に「論理的に複数コミットに分けてレビュー可能性を高める」と合意済みの場合、auto モードでも 1 コミットに squash しない。

**MUST: `senti` コマンドをチェーン (`&&` `;` `|`) または background 実行してはならない。** 各 `senti` 呼び出しは独立した foreground Bash で実行し、結果を確認してから次へ進む。

**Flow runtime log rule (MANDATORY):**
- Never hardcode `/tmp/...` for flow-related logs or temporary files.
- When a flow command needs an agent/tmp/log base directory for the current invocation, pass `--agent-work-dir <path>` to `senti flow run ...`.
- Flow commands automatically append stdout/stderr to `.tmp/logs/<flowId>.log`, or `.tmp/logs/no-flow.log` when no flow is active.
- Use `senti flow get runtime-log` to inspect the latest flow command output after failures.
- Do not wrap flow commands with environment-variable prefixes or shell redirection just to capture logs; keep the command prefix as `senti flow ...` so approval-prefix rules can match it.

### Prompt guidance placement contract

When implementing prompt guidance movement between flow skill files or flow prompt files, inspect related shared regression tests and update their placement-contract assertions. The checks must cover old-placement removal assertions and new-placement presence assertions. This rule applies to general prompt guidance movement, not a single guidance topic.

## Flow Progress Tracking

**MUST: Run `senti flow set step <id> <val>` upon completion of each step to record flow progress.**

Post-hook-managed exceptions:

| Step | Command | Auto-advance condition |
|---|---|---|
| `scenario-validity` | `senti flow run scenario-validity` | every testable requirement is `expected_fail`; any other classification keeps the step active |
| `test-execute` | `senti flow run test-execute` | valid v2 artifact is written |
| `test-result-review` | `senti flow run test-result-review` | review verdict is `pass` |
| `retro` | `senti flow run retro` | command succeeds |
| `final-regression` | `senti flow run final-regression` | final project regression passes |
| `finalize-*` leaves | `senti flow run finalize-commit`, `finalize-merge`, `finalize-sync`, `finalize-cleanup` | each command succeeds for its own leaf |

Do not advance these manually. Manual completion must not mask blocked scenario-validity classifications, prerequisite failures, invalid v2 test artifacts, deferred full regression, or failed final-regression evidence.

All flow step IDs are defined in the CLI schema. The dispatcher obtains the current step and instructions from `senti flow get next-action` — the skill itself does not encode per-step sequencing.

## Context Recording (Compaction Resilience)

**MUST: Record key decisions for compaction recovery.**

- After each user choice, record: `senti flow set note "<step>: <choice summary>"`
- After flow.json is created (prelude step), record the request: `senti flow set request "<user's original request>"`

## Metric Recording (Read Tool)

**MUST: When reading files directly with the Read tool (not via `senti flow get context`), record the metric:**
- During draft work after reading `docs/` files: `senti flow set metric draft docsRead`
- During draft work after reading `src/` files: `senti flow set metric draft srcRead`

Use a phase accepted by `senti flow set metric`. Accepted phases are defined by the CLI's `VALID_PHASES` list. Step keys returned by next-action, such as `test`, `scenario-validity`, `test-review`, `impl-review`, `impl-gate`, and `retro`, are not phase arguments.

Note: `senti flow get context` automatically records these metrics via hooks — manual recording is only needed for direct Read tool usage.

## Choice Format

Use this format only for two or more materially different choices that require
new user authority. Never display a single operation as a choice, and never add
“inspect” or “keep the current state” merely to manufacture a second option.

Present real choices in the following format:
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

A user decision exists only when at least two materially different executable
outcomes need new user authority. Do not present a choice block when:

- only one operation is available;
- the only alternatives are read-only inspection or keeping the current state;
- the user already asked to continue and the remaining path is a deterministic,
  non-destructive continuation;
- the operation merely reads state needed for the agent's next judgment.

Execute those mechanical operations directly. If they cannot make progress,
explain the concrete blocker without asking the user to approve an inspection.

Every turn that asks the user to choose between two or more real outcomes MUST contain all five sections below in order:

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
過去のセッションで、AI が議論を勝手に締めて方向性を確定させ、ユーザーが意図しない実装に進んだ事例が 8 件発生している。AI が議論をリードしすぎると、ユーザーの判断機会を奪う。

### How to apply
- このルールが表示されたフェーズでは、複数の選択肢があり得る論点を必ず Choice Format で提示する。
- 「結論:」「決定:」「方針が確定した」等の語で議論を締めない。「推奨:」「私の見解:」までに留める。
- ユーザーが明示的に選択肢を指定するまで、AI は最終決定を確定させない。

## Required Sequence

### A. Entry — branch on flow state

Run bare `senti flow get status` first. This is a display and branch-decision check; it is not a target selection mechanism.

- For an explicit new flow-start request, inspect the bare status result before B. Prelude. `active: true` is not by itself a reason to stop a new flow start; parallel flows are allowed when the new target is addressed by an explicit preparing `runId`.
- Do not continue an existing active flow merely because bare status reports one. Existing-flow continuation requires the user's intent to match that Issue/spec/runId, verified by target-aware status.
- When starting a new Issue/spec while another flow is active, the prelude must use the explicit preparing `runId` returned by `senti flow set init`; never rely on cwd, bare active status, or implicit current flow selection to choose the target.
- Use target-aware status for required prelude verification and for explicit existing-target continuation. Do not treat bare active status as target selection.
- If an existing target `runId` is known, run `senti flow get status <runId> --expect-run-id <runId>` before dispatcher actions. Add every known `--expect-issue <n>` and `--expect-spec <spec>` guard.
- If an existing target spec is known and no runId is available, run `senti flow get status --expect-spec <spec>` before dispatcher actions.
- If target-aware status returns `ACTIVE_FLOW_MISMATCH`, apply the Core
  Principle transcription-recovery contract. Only the narrowly verified
  read-only runId transcription case may retry once; every true target
  mismatch stops before `next-action`, repair, run, finalize, cleanup, or file
  edits.
- After the explicit existing-target guard passes, continue to the autoApprove checks and `requires_approval` handling.
- Evaluate target mismatch before autoApprove or `requires_approval` for existing-flow continuation; neither can bypass `ACTIVE_FLOW_MISMATCH`.

- If the user's latest request explicitly invokes Spec-Driven Development flow, explicitly requests starting the flow, or provides an Issue/spec target as part of a flow-start instruction → go to **B. Prelude**.
- If the user's latest request is to continue the current active flow and `active: true` → go to **C. Dispatcher loop**.
- If `active: false` and `directFlowSession` is present → tell the user normal Flow is not authoritative and invoke `/senti.flow-direct` for the exact target. Do not route by the stale normal phase.
- If `active: false` and there is no explicit flow-start request or direct session → tell the user there is no active flow and stop. Do not start the flow, and do not present a mandatory startup choice for ordinary requests.

### B. Prelude (pre-flow setup)

Use this path when no active flow exists, or when starting an additional flow with an explicit preparing `runId`. The prelude creates a fresh flow state; after it completes, proceed to the dispatcher loop.

Parallel-flow rules:
- `senti flow set init [--issue N] [--request ...]` may be run even when another flow is active; it only creates a preparing state.
- After `set init`, immediately record `data.runId` as the opaque
  `targetRunId`. Before `prepare`, run `senti flow get status <runId> --expect-run-id <runId>`
  plus every known `--expect-issue <n>` and `--expect-spec <spec>` guard,
  substituting both `<runId>` occurrences from that same stored value. If this
  does not report the intended preparing flow, apply the Core Principle
  transcription-recovery contract; otherwise STOP.
- Run prepare only as `senti flow prepare ... --run-id <runId>`. Never run bare `senti flow prepare` while an unrelated flow is active.
- Never run bare `senti flow get next-action`, bare `senti flow run ...`, repair, finalize, cleanup, or file edits for a target while another unrelated flow is active; use explicit runId/Issue/spec target guards first.

B.0. **Initialize flow state**
   - **Input parsing rules** — apply these rules to the user's raw input before running `set init`:
     - `#<number>` → always interpret as a GitHub Issue. Capture the number for `--issue`.
     - `issue <number>` or similar explicit forms → treat as a GitHub Issue.
     - `spec <number>` or `specs/<number>-...` → treat as a local spec reference (do not pass as `--issue`).
     - A bare number (e.g., `133`) → ambiguous input. Do not pass as `--issue`; include in the request text so prelude Q1 can disambiguate.
   - Run `senti flow set init [--issue N] [--request "<user raw text>"]` to create a preparing state file (`.active-flow.<runId>`).
   - Save the returned `runId` from `data.runId` as the opaque `targetRunId`
     for use in B.4. Reuse it verbatim rather than copying the UUID again.

B.0.5. **Preflight summary and auto-mode eligibility check** (spec 208, phase-aware input per spec 220, ba40)
   - If an Issue is linked, ensure its body is reflected into `--request` at `flow set init` (fetch with `senti flow get issue <n>` if needed). The CLI derives the input statically from the preparing flow state (`issue + request`) — `--input` is no longer accepted.
   - Build a preflight interpretation before auto-check. Use only the user's request and linked Issue content; do not inspect project code and do not invent project-specific fields.
     - Format: `Goal` + `Scope` + `Out of Scope` (if inferable) + 1-3 line description.
     - If the original request is too thin but a bounded interpretation can be derived directly from the words given, persist the refined request with `senti flow set request "<Goal/Scope/description text>" --run-id <runId>` before auto-check.
   - Run `senti flow run auto-check --run-id <runId>` and read `data.eligible` and `data.breakdown`. `--run-id` is required in preparing mode (spec 220 removed the single-preparing auto-select).
   - **If `eligible: false` and the breakdown points to missing specBuildability, ambiguity, verifiability, or scopeBoundedness**:
     - Refine the preflight interpretation from the same request / Issue text and the breakdown reason.
     - Persist the refined request with `senti flow set request "<refined Goal/Scope/description text>" --run-id <runId>`.
     - Re-run `senti flow run auto-check --run-id <runId>`.
     - Retry this preflight refinement at most 2 times. If still ineligible, continue with the normal B.1 → B.2 → B.3 flow; do not display the auto-mode prompt.
   - **If `eligible: true`**: present the auto-mode prompt using the Choice Format. This prompt is also the intent confirmation: the user is approving the displayed Goal + Scope + description and choosing whether to enter auto mode.
     - Description (inside lines): show the preflight `Goal` + `Scope` + 1-3 line description that was sent to auto-check.
     - Choices: `[1] Enable auto — summary is correct; AI proceeds without confirmations` `[2] Keep manual — revise or confirm intent before continuing`.
     - Note below choices: "You can switch later with `/senti.flow-auto on`."
     - If user picks `[1]`:
       - Run `senti flow set auto on --run-id <runId>` (the CLI trusts the verdict already persisted by `run auto-check` above and writes `autoApprove: true` to the preparing flow so `flow prepare` will inherit it; no second AI call. Rejection here means STOP).
       - **Skip B.1 and B.2.** Use work-environment = worktree and base-branch = current branch by default.
       - Treat the accepted preflight summary as Draft Q1. Derive the spec `--title`: short, max 30 characters, lowercase English, hyphen-separated.
       - Proceed to B.4.
     - If user picks `[2]`: continue with the normal B.1 → B.2 → B.3 flow.
   - **If `eligible: false`**: do NOT display the auto-mode prompt. Continue with the normal B.1 → B.2 → B.3 flow. The result is still persisted in the flow state `autoCheck` for audit.

B.1. **Choose work environment**
   - **Auto-detect:** if `.git` is a file (not directory) in the project root, you are already inside a worktree — skip the choice and use `--no-branch` automatically.
   - Otherwise: run `senti flow get prompt plan.work-environment` and present the choices.

B.2. **Choose base branch**
   - For work-environment options 1 (worktree) and 2 (branch): run `senti flow get prompt plan.base-branch` and present the choices. Append `` (`<current-branch>`) `` to the description.
     - `[1]` → use `--base <current-branch>`.
     - `[2]` → ask which branch and use `--base <user-specified-branch>`.

B.3. **Draft Q1 — intent confirmation**
   - **Preflight auto skip:** if B.0.5 `[1]` was accepted, this confirmation is already satisfied by the accepted preflight Goal + Scope + description. Do not ask again.
   - If an Issue number was captured, run `senti flow get issue <number>` to fetch the title and body.
   - Present a concise summary using the unified Goal + Scope + 1–3 line description format (same shape the auto-check prompt uses in B.0.5).
   - Ask with the Choice Format: `[1] Yes [2] Revise [3] Other`. **Retry limit: 1 round.** If `[3]` is selected twice, STOP.
   - Derive the spec `--title`: short, max 30 characters, lowercase English, hyphen-separated.

B.4. **Prepare spec (silent)**
   - Commands (based on B.1, or B.0.5 auto default when preflight auto was accepted). `--run-id <runId>` from B.0 inherits `--issue` and `--request`:
     - Worktree: `senti flow prepare --title "..." --base <branch> --worktree --run-id <runId>`
     - Branch: `senti flow prepare --title "..." --base <branch> --run-id <runId>`
     - No branch: `senti flow prepare --title "..." --no-branch --run-id <runId>`
   - On `{ok: false, code: "DIRTY_WORKTREE"}` → run `senti flow get prompt plan.dirty-worktree` and present the choices; do not retry until clean.
   - After a successful prepare, immediately verify the promoted target:
     - If an Issue number was captured and the prepared spec is known from the prepare response: `senti flow get status <runId> --expect-run-id <runId> --expect-issue <n> --expect-spec <spec>`.
     - If an Issue number was captured but the prepared spec is not known: `senti flow get status <runId> --expect-run-id <runId> --expect-issue <n>`.
     - If no Issue number was captured but the prepared spec is known from the prepare response: `senti flow get status <runId> --expect-run-id <runId> --expect-spec <spec>`.
   - If verification returns `ACTIVE_FLOW_MISMATCH`, apply the Core Principle
     transcription-recovery contract before classifying it as terminal. For
     any other `ok: false`, repeated mismatch, or mismatching `data.runId` /
     `data.issue` / `data.spec` / branch / worktree, STOP immediately. Do not
     run `next-action`, `run`, `repair`, `finalize`, `cleanup`, or file edits.
   - After verification succeeds, bind the dispatcher target for the rest of this flow:
     - Keep `targetRunId` equal to the exact opaque runId returned by the CLI.
     - Set `targetIssue = <n>` when an Issue was captured.
     - Set `targetSpec = <spec>` from the prepare/status response when known.
     - Build `targetGuardArgs` once from all known target fields: always
       `--expect-run-id <targetRunId>`, plus `--expect-issue <targetIssue>` when
       known, plus `--expect-spec <targetSpec>` when known. Reuse this argument
       list verbatim instead of reconstructing UUID text for each command.
   - All subsequent target-sensitive dispatcher commands for this flow MUST include `targetGuardArgs` until `finalize-cleanup` completes and releases the flow. This includes `senti flow get next-action`, target-bound `senti flow get context` reads, target-bound `senti flow get prompt ...` reads such as `plan.approval`, `senti flow run ...`, and active-flow-mutating `senti flow set ...` commands.

Proceed to **C. Dispatcher loop**.

Note:
- Plan-phase test flow: next-action selects `test`, `scenario-validity`, and `test-review`. `test` writes spec-local tests, `scenario-validity` persists `scenario-validity-result.json` and `tests/.raw/scenario-validity.log`, and `test-review` performs static test review.
- Upgrade artifact flow: when `src/skills/**`, `src/presets/**`, or upgrade source files are changed, run `senti upgrade` after those edits. Active-flow upgrade writes `upgrade-result.json` and `tests/.raw/upgrade.log`; integration gate treats that artifact as the upgrade evidence input and rejects missing, failed, or stale checked paths.
- Impl-phase test flow: `test-execute` runs after `implement`, owns spec-local evidence, and persists `test-execute-result.json` version `"2"` plus raw output. It runs targeted project regression only for configured `test.projectPaths` changes unless `test.testExecuteRegression` explicitly overrides that policy. Full project regression is deferred to `final-regression` after `retro`.
- Subsequent steps (`test-result-review`, `impl-review`, flow-level `impl-gate`, `retro`) read those impl-phase artifacts and do not re-run tests. `final-regression` runs the full project command once after retro and before finalize.
- Hard stops: Prepare/docs-scan and `analysis.json` read/validation failures stop the flow. A started targeted project regression failure is valid evidence and advances to `test-result-review`; a prerequisite failure before command start is a hard stop and must not be hidden with manual step completion. `final-regression` failures are classified in `final-regression-result.json`; environment, sandbox, permission, timeout, dependency, and invalid-command failures carry a typed recovery policy and explicit resume instruction instead of returning to the normal implementation repair loop.
- On impl-gate FAIL, show every Observation from `data.artifacts.nextAction.diagnosis.observations` and use those observations as the primary repair input.
- When updating base guardrails, apply the guardrail rewrite rubric: named violation, diff-verification condition, and severity-policy.

Placeholder artifact permission:
- Do not write placeholder test artifacts to satisfy the flow.
- If real execution is unavailable and the user explicitly permits a placeholder, record `specs/<spec>/placeholder-permission.json` with `version: 1`, `phase: "integration"`, `approvedByUser: true`, `artifactPaths`, `permissionText`, `reason`, and `createdAt`.
- Without that record, flow-level `impl-gate` rejects the artifact with `ARTIFACT_PLACEHOLDER`.

### C. Dispatcher loop

Repeat until the loop exit condition is met. The loop is bounded by the finite flow schema and the returned `maxAttempts`; stop if the dispatcher cannot make progress within the remaining step count.

#### Turn completion contract

- One invocation owns the whole Flow continuation, not only the current step.
  An `ok: true` next action with `requires_approval: false` MUST be executed in
  the same turn.
- `autoApprove: true` also satisfies ordinary `requires_approval: true`
  boundaries as defined below. Continue fetching and executing actions after
  that boundary.
- A progress summary such as “draft gate passed” or “current step: spec” is
  commentary only. It MUST NOT be used as the final response and MUST NOT end
  the turn.
- Do not ask the user to invoke `$senti.flow` again merely to advance to the
  next normal step. Context compaction, elapsed time, or the amount of work
  remaining are not loop exit conditions.
- A final response is allowed only after the documented loop exit condition:
  Flow completion, a real user decision, a concrete non-recoverable blocker,
  state corruption, or a true/unrecovered target mismatch. A corrected
  read-only runId transcription error is not a loop exit condition.

C.1. **Ask the CLI for the next action**
   - If `targetRunId` is known, run `senti flow get next-action <targetGuardArgs>`.
   - If `targetRunId` is not known, first establish an exact target from the user's intent using target-aware status. Bare `senti flow get next-action` is allowed only when the current context has been verified as the intended single active flow; if another active flow exists or the target is ambiguous, STOP and ask for the Issue/spec/runId.
   - The CLI auto-promotes the next pending step on `done` transitions via the definition hierarchy. Do not manually `flow set step <id> in_progress` to advance the flow.
   - If all mainline steps are `done` or `skipped` → loop exit (CLI returns `NO_IN_PROGRESS_STEP`).
   - Otherwise, consume `directive` as the sole execution authority. Fields
     such as step outcomes and recovery diagnostics explain state only; they
     MUST NOT be interpreted as competing next actions.
   - When `nonblockingDecision` is present, invoke `/senti.flow-nonblocking` before dispatching the normal directive. The decision is agent-owned: inspect the returned evidence, then record the single digest-guarded repair, retry, or continue command without a user-facing choice. The ordinary directive describes the strict route and is not an additional decision while this evidence is pending. Do not offer or start direct mode after nonblocking is enabled.
   - Dispatch the directive by its typed kind:
     1. `execute_step`: execute `instructions.content`, then re-fetch guarded
        `next-action`.
     2. `execute_command`: execute the directive's exact `nextAction`
        immediately, then re-fetch guarded `next-action`. This includes bounded
        tooling retry, audited retry recovery, and durable transaction replay.
        It is not a user decision and MUST NOT be displayed as a choice.
     3. `repair_evidence`: perform one bounded repair pass using the persisted
        findings and the named `evidenceKind` / `phase`. Keep all edits inside
        the managed worktree. Then execute the directive's guarded
        `nextAction`, which refreshes authority before any retry. If the repair
        requires a product decision not established by the request, project
        rules, or persisted evidence, stop and ask only that concrete decision.
    4. `await_user_decision`: explain the concrete situation and materially
        different outcomes in the user's language. Translate and reword text
        for clarity; do not expose raw action IDs, commands, impact arrays,
        state-transition names, or internal class names unless diagnostics
        were requested. Present every materially different choice in the
        standard numbered format, put the recommendation first, and wait for
        the user's number or localized label. Map the answer to the current
        choice's exact action and re-fetch afterward.
        - A prompt with the two choices `KEEP_STRICT_FLOW` and
          `ENABLE_NONBLOCKING` appears only after normal strict recovery has
          stopped on an eligible acceptance-backed checkpoint with a durable
          non-pass artifact. This includes review/gate checkpoints throughout
          planning and implementation, scenario/test verification, task
          review/gate, retro, acceptance, and final regression. It is the only
          manual mode-selection point: do not offer advisory continuation
          earlier and do not offer direct mode here.
        - If the user chooses advisory continuation, record a concise bounded
          reason and run `senti flow set policy nonblocking --reason "<reason>"
          <targetGuardArgs>`, then re-fetch guarded `next-action`. The policy
          is one-way; a failed policy command or stale target is blocking and
          must follow its returned continuation.
        - If the user keeps strict recovery, leave the Flow unchanged, report
          the original strict blocker, and exit the loop. Do not synthesize a
          retry, a no-op refresh loop, or a mode-selection prompt.
     5. `blocked`: report `reason` and `resumeInstruction` as the concrete
        non-recoverable blocker. Do not offer status inspection, normal/direct
        mode selection, retry, keep-state, or another `$senti.flow` invocation
        unless the refreshed CLI returns one as an executable directive.
     6. `completed`, `aborted`, or `idle`: exit the loop and report the terminal
        state.
   - A missing or invalid `directive` is a CLI contract failure. STOP instead
     of reconstructing recovery from `reviewAction`, `retryRecovery`,
     `gateStop`, `continuation`, `actionPrompt`, process exit status, or prose.
   - Transition into direct mode, adopt/reconcile an already-merged result, risk acceptance, deletion, orphan handling, and force actions always require explicit user selection. `autoApprove` never selects them. When direct mode is selected, use the `senti.flow-direct` dispatcher rules and continue to preserve this skill's bound target guards.

C.1.5. **Auto-upgrade check (spec 232)**
   - Run this check only for `directive.kind: "execute_step"`.
   - If the envelope contains `autoUpgrade` with `available === true`, present the following choice **before** executing step instructions:
     ```
     ──────────────────────────────────────────────────────────
       Auto mode is available. Switch now?
     ──────────────────────────────────────────────────────────

       [1] Switch to auto — continue without confirmations
       [2] Stay manual — keep normal per-step confirmations

     ```
   - If `[1]`: run `senti flow set auto on <targetGuardArgs>` when `targetRunId` is known. Without a known `targetRunId`, run bare `senti flow set auto on` only after C.1 verified the current context is the intended single active flow. On success, update `autoApprove` to `true` for subsequent steps.
   - If `[2]`: run `senti flow set auto off <targetGuardArgs>` when `targetRunId` is known. Without a known `targetRunId`, run bare `senti flow set auto off` only after C.1 verified the current context is the intended single active flow. The `autoDesired` flag is cleared and no further upgrade prompts will appear.
   - This check runs at most once per flow (the CLI clears `autoUpgrade` after `set auto on/off` via the trust path).

C.2. **Execute instructions**
   - Treat `instructions.content` as the authoritative procedure for this step. Follow it exactly.
   - Before running any `instructions.content` command that reads or mutates active flow state, preserve target binding by appending `targetGuardArgs` when available. This applies to:
     - `senti flow get next-action`, `senti flow get context ...`, `senti flow get prompt ...` commands that read active flow state such as `plan.approval`, and `senti flow get qa-count`.
     - `senti flow run ...` commands that operate on the active flow target, including gate, review, impl/finalize commands, reopen-draft, task commands, lint, retro, final-regression, acceptance-review, and report.
     - `senti flow set ...` commands that mutate active flow state, including step, request, issue, note, summary, req, files, broad, metric, approval, issue-log, retry, acceptance-decision, and auto.
   - If a target-sensitive instruction contains a bare `senti flow ...` command and the command cannot accept `targetGuardArgs`, STOP rather than running it. Report the CLI target-binding gap instead of relying on cwd or bare active-flow selection.
   - Fetch any additional context the instructions request via `senti flow get context ... <targetGuardArgs>` / `senti flow get guardrail <phase>`. `get guardrail` is static and does not select an active flow.
   - Retry limits: read the resolved numeric maxAttempts from the next-action envelope (`maxAttempts`). A command reaching that limit must persist a typed terminal `StepAttempt`; do not infer the terminal action from the old envelope or process exit status.
   - When the current step's work is finished, advance step status:
      - If the instructions run a CLI command whose post-hook advances step (`flow run gate`, `flow run impl-confirm`, `flow run finalize-commit`, `flow run finalize-merge`, `flow run finalize-sync`, `flow run finalize-cleanup`, `flow run sync`) — run target-sensitive commands with `targetGuardArgs`; the hook handles the transition, so do nothing further.
      - **`flow run review`**:
        - Draft review routes:

          | Review step | Triage step | Repair step |
          |---|---|---|
          | `draft-questions-review` | `draft-questions-triage` | `draft-questions-repair` |
          | `draft-coverage-review` | `draft-coverage-triage` | `draft-coverage-repair` |

        - Draft review phases write only detection JSON artifacts. PASS completes the review leaf and registry hook writes empty triage/repair bookkeeping artifacts before advancing to the normal next step. ADVISORY / REJECTED enter the route's triage step. Triage records disposition, repair records mutation audit, and draft-gate performs mechanical readiness validation of artifact shape, links, item correspondence, unresolved user decisions, and draft approval.
        - `spec-review` records detection output via post hook. PASS / ADVISORY complete review, while REJECTED completes review and advances to `spec-triage`.
        - `test-review` records one-shot static test review artifacts. PASS and ADVISORY complete `test-review`; REJECTED leaves it open for a test-design fix; TOOLING_ERROR leaves it open without consuming semantic review retry. After explicit nonblocking activation, a continued stop always leaves an acceptance handoff: semantic findings retain their canonical source, while a verification/tooling stop receives a typed handoff source. It remains unresolved until acceptance records its final disposition. Follow the single returned `directive`; register finalized independent evidence only when its repair instruction requires it, and never substitute a completion override for canonical review evidence.
        - Impl/task review writes detection output only; its post hook advances according to the existing impl/task review route.
      - **`flow run scenario-validity` / `flow run test-execute` / `flow run test-result-review` / `flow run retro` / `flow run final-regression`**: post hooks validate current artifacts and advance their own steps. Do not manually mark them done to bypass prerequisite failures or final-regression failures.
      - Otherwise, manually record completion: `senti flow set step <current-step> done <targetGuardArgs>`.
   - After every instruction command completes, including a command with a non-zero exit status, re-fetch `next-action` with `targetGuardArgs` before deciding whether to continue or stop. The previously fetched action is stale after command and post-hook completion.
   - Treat `lastStepOutcome` as durable diagnostics only. The refreshed
     `directive` has already reconciled that outcome with review, gate, and
     recovery authority. Never route directly from the outcome kind, command
     exit status, errors, or prose.
   - State corruption or a true/unrecovered target mismatch stops the loop
     without another mutating command. A narrowly recoverable status runId
     transcription error follows the Core Principle contract and retries only
     that read-only status command.

C.3. **Loop**
   - Return to C.1 using the guarded re-fetch above. Never reuse the pre-command next-action envelope.

### Loop exit condition

The loop exits when the guarded refreshed next-action returns a terminal
`directive` (`completed`, `aborted`, `idle`, or `blocked`), a real
`await_user_decision`, state corruption, or a true/unrecovered target mismatch.
If `targetRunId`
is known, use `senti flow get status <targetRunId> <targetGuardArgs>` for final
readback; the positional runId selects the flow, and `--expect-run-id` validates
that the resolved flow still matches the dispatcher target. Retry exhaustion
by itself is not an exit condition when the directive provides deterministic
recovery or evidence repair.

## Post-flow: plugin lifecycle

Optional post-flow handling is implemented by plugin hooks and issue-log candidates. The flow skill must not run integration-specific commands after completion; report any hook warnings that the flow command recorded, then stop.

## Universal Guardrails

These apply to every step executed by the dispatcher. They are enforced here because they are cross-cutting — the per-step instructions assume them.

### Approval-gated transitions

- Do not advance past any step whose `requires_approval` is `true` without explicit user approval.
- **autoApprove exception:** when `autoApprove: true`, `requires_approval: true` is satisfied by auto-selecting `[1]`.
- **Non-auto-selectable actions:** autoApprove never selects entry into direct mode, already-merged adoption/reconcile, risk acceptance, deletion, orphan handling, or force actions.

### No-auto-promote

- Do not implement code before the spec gate has PASSed, tests are written, and the user has approved the spec (plan-phase gate chain).
- Do not finalize before the impl-phase gate has PASSed.

### Worktree boundary

When `worktree: true` in flow.json:
- **All file operations (editing, creating, reading) MUST be done inside the worktree directory.** Do not edit files in the main repository.
- Run `senti flow get status` to see the worktree path. Use absolute paths if needed.
- The worktree is an isolated copy — changes in the main repo are NOT visible in the worktree and vice versa.
- **Flow state definitions:**
  - **Flow is active** — BOTH of the following hold simultaneously (AND):
    - `senti flow get status` returns `active: true`.
    - The worktree directory still exists on disk (verifiable via `test -d <worktree-path>`).
  - **Flow is released** — EITHER of the following has flipped (OR); either one alone is sufficient:
    - `senti flow get status` returns `active: false` — the flow has ended.
    - The worktree directory no longer exists (`test -d <worktree-path>` fails) — cleanup has deleted it.
- **MUST: While the flow is active (per the definition above), never `cd` out of the worktree path.**
- **MUST: The worktree boundary applies to commands that continue, edit, finalize, or clean up this specific flow.** It does not prohibit main-repo prelude commands for a different flow when those commands are explicitly `runId`-targeted and verified against the intended Issue/spec before and after `prepare`.
- **MUST: Never use implicit current-context flow commands from the main repository or another worktree while an unrelated flow is active.** Use explicit `runId` / Issue / spec target guards instead.
- **Once the flow is released, the worktree boundary is lifted and `cd` out of the (former) worktree path is allowed.**
- **Once `senti flow run finalize-cleanup` completes successfully (envelope `ok: true`), both release conditions flip together: the worktree directory is removed and `flow get status` reports `active: false`.** The cleanup command owns finalize Report delivery and removes the worktree; subsequent `senti` commands run from the main repository because the worktree no longer exists.
- **Halt envelopes (e.g. `ORPHAN_COMMITS_DETECTED`, `SQUASH_BASELINE_MISSING`, `SQUASH_BASELINE_DIVERGED`, `MAIN_REPO_DIRTY`, `MAIN_REPO_LOCKED`, `CHERRY_PICK_CONFLICT`, `ARGS_ERROR`) leave the worktree boundary in effect.** The worktree directory and feature branch are intentionally retained so the user can recover (e.g. archive the branch, run `--auto-rescue`, or re-run with `--force`). Until the next `finalize-cleanup` invocation succeeds, do NOT cd out of the worktree.
- **MUST: Never run `git stash` / `git stash pop` / `git stash apply` / `git reset --hard` / `git checkout -- <path>` in the main repository while the flow is active.** Stashes, resets, and checkouts on shared state can restore stale content (e.g. unrelated stashes from other branches), introduce conflicts, and corrupt the main working tree — even when the flow's own worktree is unaffected.
- **If baseline comparison (e.g., running tests on `baseBranch` to compare failure counts) is required, do NOT cd into the main repo.** Instead, create a short-lived detached worktree (`git worktree add --detach <tmp-path> <baseBranch>` in an allowed location, run the comparison there, then remove it with `git worktree remove <tmp-path>`). When in doubt, reuse evidence already captured in prior `issue-log.json` entries rather than re-measuring against `main`.
- **MUST: During an active worktree flow, never pass a main repo absolute path as the file-path argument to Edit/Write tool calls.** Allowed alternatives are (a) a relative path from the worktree cwd, or (b) an absolute path under the `worktreePath` returned by `senti flow get resolve-context`. Rationale: Edit/Write writes to whatever absolute path it receives regardless of the shell's cwd, so a main-repo path silently bypasses the worktree and mutates shared state. Paths surfaced by Read/Grep that resolve to the main repo must be rewritten to the worktree equivalent before being passed to Edit/Write.

**MUST: active flow 中は main リポジトリで `git stash` / `git stash pop` / `git stash apply` / `git reset --hard` / `git checkout -- <path>` を実行してはならない。** 別ブランチ由来の stale な stash 復元・共有状態破壊を防ぐ。ベースライン比較は短命の detached worktree を使う。
- Before merge, consider running `git rebase <baseBranch>` in the worktree to incorporate upstream changes and avoid post-merge test failures.
- The finalize phase is decomposed into 4 independent leaf steps driven by the dispatcher: `finalize-commit` → `finalize-merge` → `finalize-sync` → `finalize-cleanup`. Each step has its own CLI command (`senti flow run finalize-commit`, etc.) and prompt. Each command's post hook normalizes its own step status to `done` on success — do not advance these steps manually.
- **MUST: Do NOT run `senti flow run finalize-cleanup` in background.** Run it in the foreground and wait for it to complete before proceeding.
- **MUST: After `senti flow run finalize-cleanup` completes successfully**, the cleanup command itself displays the finalize Report in a non-stdout `Finalize Report` block when `data.report.text` is present. The response envelope still contains `data.report.text` for machine callers; do not rely on manually pasting it as the primary delivery path. If `data.report` is `null`, an envelope `errors` entry with code `REPORT_MISSING` explains why - surface that warning to the user instead of fabricating Report contents. The cleanup command itself removes the worktree and writes `.senti/last-finalized-spec`; the next `senti` command runs from the main repository.
- **MUST: When `finalize-cleanup` returns `ORPHAN_COMMITS_DETECTED`, present the cherry-pick / abort / force-continue choice to the user.** This is an explicit exception to autoApprove auto-select: silently picking force-continue would lose feature-branch commits permanently. The envelope ships `data.orphanCommits` (sha + subject) and `data.recoveryOptions = ["cherry-pick", "abort", "force-continue"]` — show the commit list and the choice block, then act on the user's selection (`--auto-rescue` for cherry-pick, halt for abort, `--force` for force-continue with explicit user confirmation). `SQUASH_BASELINE_MISSING` and `SQUASH_BASELINE_DIVERGED` are similar manual-recovery prompts; surface their `errors[0].messages` verbatim.

### Draft Return: phase-aware

When spec writing discovers a missing user decision that belongs in draft QA:
- Use `senti flow run reopen-draft --reason "<text>"` to return to the draft phase.
- Pre-implementation plan flows do not require a done task. On success, the command marks `draft` as `in_progress` and resets downstream plan steps so draft review, gate, spec, approval, and test planning run again.
- Existing spec artifacts are retained and the reopen reason is recorded in `issue-log.json` so the next draft pass can see why the return happened.

When `reopen-draft` fails or reports a recovery choice, surface that recovery through Choice Format and wait for the user's decision unless `autoApprove` explicitly covers the choice and the skill does not list it as an exception.

### Draft Return: implementation-phase spec corrections

When source verification during implementation discovers a contradictory or missing spec decision:
- Use the guarded correction route even when no task is done: `senti flow run reopen-draft --category spec-correction --reason "<audit reason>" --expect-run-id <runId> --expect-spec <spec> --expect-issue <issue>`.
- For an Issue-less flow, replace `--expect-issue <issue>` with `--expect-no-issue`. Do not fabricate or assign an Issue.
- Read `runId`, spec, and Issue presence/value from the active flow returned by `senti flow get next-action`; do not infer identity from a branch name or path.
- On success, preserve the current worktree and partial source changes. Resume through draft/spec clarification, spec review, gate, approval, and test design in the regular order before returning to implementation.

### Draft Return: implementation-phase task additions

When implementation reveals that the spec needs additional tasks:
- **MUST: Do not add tasks dynamically via any CLI during impl.** The only legitimate path is to return to the draft phase, append new tasks to `spec.json.tasks[]`, and re-approve.
- Use `senti flow run reopen-draft [--reason "<text>"]` to rewind the draft step. Preconditions for implementation-phase task additions: at least one done task exists and the flow lifecycle is still `active`.
- After `reopen-draft` succeeds: edit `spec.json.tasks[]` to append new tasks (new entries must have `added_round = max(existing) + 1`). Existing tasks' `id` / `origin` / `added_round` are invariant — the spec gate rejects any changes to those fields. `title` / `description` of existing tasks may be corrected.
- Proceed through `draft-gate → spec → spec-gate → approval` again. `spec.json` remains the source of truth; the approval prompt renders `spec.md` only when the user needs the human-readable view. The approval post-hook reflects only the new tasks into `flow.json.tasks[]`; existing tasks keep their status and steps.

### Command execution discipline

- **NEVER chain or background `senti` commands.** Each `senti` command must be run as a separate, foreground Bash invocation. Do not use `&&`, `||`, `;`, pipes, or `run_in_background`. If a command ends up in the background, wait for the completion notification before proceeding.
- **NEVER run `senti flow set auto on` yourself.** Only the user can enable autoApprove mode (via `/senti.flow-auto` or explicit instruction).

## Hard Stops

- Do not write code before the approach plan is user-approved.
- Do not start `finalize-commit` without its required user confirmation unless the autoApprove exception applies; subsequent finalize leaves follow their `requires_approval` value and hook-managed transitions.
- Do not bypass a failed gate. Re-fetch the guarded next action and follow its typed retry, defer, decision, or external-block outcome.
- Do not proceed past a step whose `requires_approval` is `true` without user confirmation unless the autoApprove exception applies.
- Do not `cd` out of the worktree during an active flow (except after finalize cleanup completes).

**autoApprove exception:** when `autoApprove: true`, the rules "do not proceed without user confirmation" and "do not finalize without asking" are satisfied by auto-selecting `[1]`. All other hard stops remain in effect.

## Issue Log Recording

**MUST: When a fix, correction, or workaround is needed (e.g., a command fails, a gate check reveals an issue, a test reveals a bug, a design assumption turns out wrong), record it immediately:**

```
senti flow set issue-log --step <current-step> --reason "<what went wrong>" --trigger "<what triggered the issue>" --resolution "<how it was fixed>" --guardrail-candidate "<principle to prevent recurrence>"
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
senti flow set issue-log --step test \
  --reason "fixUnescapedQuotes mishandles nested quotes — test adjusted to match current behavior" \
  --trigger "unit test for edge case with nested single quotes inside double-quoted values" \
  --resolution "adjusted test expectation to match current (incorrect) behavior per spec constraint" \
  --guardrail-candidate "when a test reveals a pre-existing bug, always record it before adjusting the test"

# Worktree merge conflict
senti flow set issue-log --step finalize \
  --reason "merge conflict in SKILL.md due to upstream changes during implementation" \
  --trigger "git merge development into feature branch" \
  --resolution "manually resolved conflict, kept both upstream and feature changes"
```

## Commands (reference)

```bash
# Reference forms below omit `targetGuardArgs`; when a dispatcher target is bound, append the required `--expect-run-id` / `--expect-issue` / `--expect-spec` guards.
senti flow get status
senti flow get next-action
senti flow get direct
senti flow get context [<path> | --search "..."] [--raw]
senti flow get guardrail <draft|spec|task-spec|task-impl|integration|test|lint|review>  # alias: impl -> task-impl
senti flow get prompt <kind>
senti flow get check <target>
senti flow get issue <number>
senti flow get qa-count
senti flow get resolve-context
senti flow set init [--issue N] [--request "..."]
senti flow set step <id> <status>
senti flow set summary '<JSON array>'
senti flow set req <reqId|zeroBasedIndex> <status>
senti flow set request "<text>"
senti flow set note "<text>"
senti flow set issue <number>
senti flow set metric <phase> <counter>
senti flow set issue-log --step <id> --reason "<text>" [--trigger "<text>"] [--resolution "<text>"] [--guardrail-candidate "<text>"]
senti flow set retry reset <gate|review> <phase> --reason <text> --yes
# Retry recovery reason is required, records an audit entry, grants one re-evaluation, and rejects unchanged evidence.
senti flow prepare --title "..." [--base branch] [--worktree] [--no-branch] [--issue N] [--request "..."] [--run-id <id>]
senti flow run gate [--phase <draft|spec|task-spec|task-impl|integration>] [--agent-work-dir <path>]
senti flow run review [--phase <draft|spec|test|impl>] [--agent-work-dir <path>]
senti flow get runtime-log [--format json] [--sequence <n>] [--run-id <runId[#sequence]>]
senti flow run scenario-validity
senti flow run test-execute
senti flow run test-result-review
senti flow run impl-confirm --mode <overview|detail>
senti flow run retro [--force] [--dry-run]
senti flow run final-regression
senti flow run finalize-commit [--message "<msg>"]
senti flow run finalize-merge
senti flow run finalize-sync
senti flow run finalize-cleanup
senti flow run direct --action <CLI-provided-action>
senti flow run reopen-draft [--reason "<text>"]
senti flow run report [--dry-run]
senti snapshot check
```
