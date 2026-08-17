Link workflow (board operations) with flow, moving the corresponding board item to In Progress on prepare, and importing the issue-log to the board on finalize.

## Background Changes (#348 reflected)

This draft was conceived before work began on #348 (promoting workflow to src/), and has been revised since the following differs from the current state:

- workflow is always available as `sdd-forge workflow <subcommand>`. The old `config.experimental.workflow.enable` gate has been removed (the [EXPERIMENTAL] label continues).
- Command implementation is in `src/workflow/`, skill is `sdd-forge.workflow`.
- The commandId prefix for AI calls is `workflow.*` (the old `experimental.workflow.*` is deprecated).
- Config keys are only `workflow.languages.*` (enable is deprecated).

## Task 1: Determine trigger condition for flow integration (redefining the old "enable check")

- The old proposal triggered integration when `config.experimental.workflow.enable === true`, but this flag was removed in #348.
- An alternative trigger condition needs to be decided (candidates: auto-detect by presence of board config / `commands.gh` / new config flag). ← Needs discussion (open)
- If a value read via `flow get` is needed for the check, add the minimum required.

## Task 2: Add 2 new commands to workflow

### sdd-forge workflow issue-start \<issueNumber\>

- Search board items for the matching issue number using searchItems.
- If found, move it with ensureStatusOption(boardConfig, "In Progress") + setItemStatus (auto-add the option if not present).
- If not found, return ok=true, data.matched=false (do not treat as an error).
- If already In Progress, no-op.

### sdd-forge workflow issue-log-import --spec \<path\>

- Read the issue-log.json at the specified spec path (does not depend on active flow; spec path is required).
- Classify each entry as BUG / ENHANCE / other using AI; target only BUG and ENHANCE.
- For each target entry, use AI to judge similarity against existing board items. If similar, skip.
- If no similarity, call `sdd-forge workflow add` (title/body generated in Japanese by AI from reason/trigger/resolution; category is the AI classification result).
- Do not change the existing issue-log schema (maintain backward compatibility).

### commandId for AI calls

- workflow.issue-log-import.classify (classification)
- workflow.issue-log-import.similarity (similarity judgment)
- workflow.issue-log-import.compose (title/body generation)
- Provider switching is possible via the existing agent.profiles longest-prefix-match mechanism. No additional config schema changes needed.

## Task 3: Add conditional branches to flow skill templates

- Do not modify the flow logic layer (src/flow/lib/*.js). Do not introduce a dependency on workflow.
- Add a conditional block to the flow run prepare-spec skill template: if the Task 1 trigger condition is met and an issue number is present → run `sdd-forge workflow issue-start`.
- Add a conditional block to the flow run finalize skill template: if the Task 1 trigger condition is met → run `sdd-forge workflow issue-log-import --spec <currentSpecPath>`.

## Implementation Order

Task 1 → Task 2 → Task 3

The trigger condition must be finalized in Task 1 before the skill-side conditional branch in Task 3 can be written. Task 3's call target command must exist, so Task 2 must be complete before Task 3 can be implemented.

<details>
<summary>ja</summary>

[ENHANCE] workflow コマンドを flow lifecycle に統合（prepare 時 In Progress / finalize 時 issue-log 取り込み）

workflow（ボード運用）と flow を連携させ、prepare 時に対応するボード項目を In Progress へ移動し、finalize 時に issue-log をボードへ取り込む。

## 前提の変更（#348 反映）

本 draft は #348（workflow の src/ 昇格）着手前のアイデアであり、以下が現状と異なるため改訂した。

- workflow は `sdd-forge workflow <subcommand>` として常時利用可能。旧 `config.experimental.workflow.enable` ゲートは撤廃された（[EXPERIMENTAL] ラベルは継続）。
- コマンド実装は `src/workflow/`、skill は `sdd-forge.workflow`。
- AI 呼び出しの commandId プレフィックスは `workflow.*`（旧 `experimental.workflow.*` は廃止）。
- config キーは `workflow.languages.*` のみ（enable は廃止）。

## Task 1: flow 連携の発動条件を決める（旧「enable 取得」を再定義）

- 旧案は `config.experimental.workflow.enable === true` で連携を発動していたが、このフラグは #348 で廃止された。
- 代替の発動条件を決める必要がある（候補: ボード設定の有無で自動判定 / `commands.gh` / 新規 config フラグ）。← 要検討（open）
- 判定に flow get で読む値が必要なら最小追加する。

## Task 2: workflow に新コマンド 2 つを追加

### sdd-forge workflow issue-start <issueNumber>

- searchItems で該当 issue 番号のボード項目を検索。
- 見つかれば ensureStatusOption(boardConfig, "In Progress") + setItemStatus で移動（option が無ければ自動追加）。
- 見つからなければ ok=true, data.matched=false を返す（エラーにしない）。
- 既に In Progress の場合は no-op。

### sdd-forge workflow issue-log-import --spec <path>

- 指定 spec パスの issue-log.json を読む（active flow に依存しない、spec パスは必須）。
- 各エントリを AI で BUG / ENHANCE / その他に分類し、BUG と ENHANCE のみ対象にする。
- 各対象エントリについて、AI で既存ボード項目との類似度を判定。類似があれば skip。
- 類似なしなら sdd-forge workflow add を呼び出す（title / body は AI が reason / trigger / resolution から日本語生成、category は AI 判定結果）。
- 既存 issue-log スキーマには変更を加えない（後方互換維持）。

### AI 呼び出しの commandId

- workflow.issue-log-import.classify（分類）
- workflow.issue-log-import.similarity（類似判定）
- workflow.issue-log-import.compose（title / body 生成）
- 既存の agent.profiles のプレフィックス最長一致機構で provider 切替可能。追加の config スキーマ変更は不要。

## Task 3: flow 側の skill テンプレートに条件分岐を追加

- flow ロジック層（src/flow/lib/*.js）は変更しない。workflow への依存を持たせない。
- flow run prepare-spec の skill テンプレートに条件ブロック追加: Task 1 の発動条件を満たし、かつ issue 番号あり → sdd-forge workflow issue-start を実行。
- flow run finalize の skill テンプレートに条件ブロック追加: Task 1 の発動条件を満たす → sdd-forge workflow issue-log-import --spec <currentSpecPath> を実行。

## 実装順序

Task 1 → Task 2 → Task 3

Task 1 で発動条件を確定しないと Task 3 の skill 側条件分岐が書けない。Task 2 完了後でないと Task 3 の呼び出し先コマンドが存在しない。

</details>