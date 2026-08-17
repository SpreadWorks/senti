## Goal

Unify flow definition step names under the `<phase>-<concern>-<action>` convention, eliminating bare names like `review` and `gate` that cause confusion. Document the naming rules in `src/AGENTS.md`, and provide a replacement script to bulk-convert legacy step names remaining in past spec `flow.json` / `issue-log.json` files.

## Background

Step names in `src/flow/definition.js` have steps added after the impl phase that were left without a phase prefix, leaving bare `review` / `gate` names whose meaning (flow, task, or phase) must be inferred from context. This causes:

- Inability to tell "which phase a step belongs to" from the step ID alone
- Ambiguity when matching against skill / docs / historical spec text
- The need to distinguish phases when aggregating by phase in future metrics / reports (4d21)

## Naming Convention (to be added to `src/AGENTS.md`)

**All step names must carry the phase grouping they belong to as a prefix.** Format:

```
<phase>-<concern>-<action>
```

- `<phase>`: The conceptual phase the step belongs to (`draft`, `spec`, `test`, `impl`, `finalize`, `task`)
- `<concern>`: The concern the step handles (`questions`, `coverage`, `result`, etc. — omit if singular)
- `<action>`: The operation performed (`review`, `triage`, `repair`, `gate`, `execute`, etc.)

Examples:
- `draft-questions-review` — review the questions concern in the draft phase
- `draft-questions-triage`
- `draft-questions-repair`
- `spec-review` — review in the spec phase (single concern)
- `impl-gate` — gate in the impl phase

**No exceptions.** Phase prefix is mandatory.

## Rename List

### Required Renames (bare → prefixed)

| Old Name | New Name |
|---|---|
| `review` (impl child) | `impl-review` |
| `gate` (plan child, spec gate) | `spec-gate` |
| `gate-draft` | `draft-gate` |
| `gate-impl` (flow child) | `impl-gate` |
| `review-draft-questions` | `draft-questions-review` |
| `review-draft-coverage` | `draft-coverage-review` |
| `review-spec` | `spec-review` |
| `review-test` | `test-review` |

### task scope (subtask) renames

| Old Name | New Name |
|---|---|
| `impl` (task child) | `task-impl` |
| `review` (task child) | `task-review` |
| `gate-impl` (task child) | `task-gate` |

### Cleanup for consistency (optional but recommended)

| Old Name | New Name | Reason |
|---|---|---|
| `spec-review-triage` | `spec-triage` | Implies triage of `spec-review`, but `review-triage` double-action is redundant |

### Keep as-is (already compliant or phase entry steps)

| Name | Reason |
|---|---|
| `draft`, `spec`, `test` | Phase entry steps (subject = phase name). Duplication but natural |
| `draft-refine` | Compliant |
| `draft-questions-triage` / `draft-questions-repair` | Compliant |
| `draft-coverage-triage` / `draft-coverage-repair` | Compliant |
| `spec-repair` | Compliant |
| `test-execute`, `test-result-review` | Compliant |
| `finalize-commit`, `finalize-merge`, `finalize-sync`, `finalize-cleanup` | Compliant |
| `prepare-spec` | Setup step before phase transition. `spec-prepare` would also work but breaking-change cost > benefit. Keep. |
| `branch`, `approval`, `scenario-validity`, `implement`, `retro`, `final-regression` | Singletons with no collision. Meaning is clear from phase context. Keep. |

## Implementation Scope

### Code Changes

- `src/flow/definition.js` — rename step IDs
- `src/flow/registry.js` — update command metadata references
- `src/flow/lib/run-*.js` / `set-*.js` / `get-*.js` — all step ID references
- Route definitions such as `src/flow/lib/draft-review-routes.js`
- Skill documents including `src/templates/skills/sdd-forge.flow/SKILL.md`
- Any hard-coded step IDs in `src/presets/base/templates/**`
- Tests (`tests/unit/flow/**` — assertions referencing step IDs)

### Historical Data Replacement Script

Implement as `scripts/rename-phase-steps.js` (or a dev subcommand in `src/cli`):

- **Targets**: Legacy step names remaining in the following files under all specs:
  - `specs/*/flow.json` (steps array, history, metrics)
  - `specs/*/issue-log.json` (entry.step, entry.phase)
  - `specs/*/report.json` / `retro.json` / `review.md` (inline references)
- **Behavior**:
  - Default to dry-run mode (diff only); write changes only with `--apply`
  - Embed old→new mapping in the script (from the rename list above)
  - JSON: replace only fields whose string value exactly matches (no partial-match false positives)
  - Markdown: replace only within code blocks and path strings; avoid false positives in prose
- **Safety**:
  - Require `git status` to be clean before running
  - Record replacement results in a single commit (so it can be `git revert`ed)

### Docs / Memory Updates

- Add naming convention to `src/AGENTS.md`
- Record as a breaking change in `CHANGELOG.md` (no compatibility shim needed during alpha)

## Acceptance Criteria

- Step IDs in `src/flow/definition.js` updated per the rename list
- Naming convention documented in `src/AGENTS.md`
- All code and tests working under the new names
- Past spec files bulk-updated by the replacement script
- No legacy names remaining in skill / docs text (grep returns 0 hits)
- Change recorded in `CHANGELOG.md`

## Impact / Risk

- No backward-compatibility code will be added (alpha period policy).
- Historical spec data will be bulk-converted by the replacement script. Environments that have not run the script will have mixed old/new names in metrics aggregation, so the 4d21 implementation may assume new names only (no legacy-name compatibility mapping).
- If any open PRs / branches contain `flow.json`, the script must be re-run after merging; note this in the CHANGELOG.

## Related

- 4d21: Flow observation report. Once step names are unified, the aggregation logic can group by phase prefix.
- Resolving the bare `review` / `gate` naming issue is also useful in the context of cdb2 (review convergence).

<details>
<summary>ja</summary>

[ENHANCE] flow step 名の phase 接頭辞統一（命名規則策定 + 改名 + 過去データ置換スクリプト）

## ゴール

flow definition の step 名を「phase 接頭辞 + concern + action」規則で統一し、混乱の原因となっている bare 名（`review`, `gate` 等）を解消する。命名規則を `src/AGENTS.md` に明文化し、過去 spec の `flow.json` / `issue-log.json` 等に残る旧名は置換スクリプトで一括変換する。

## 背景

`src/flow/definition.js` の step 名は impl 実装以降に追加された step が phase 接頭辞なしのまま残っており、bare な `review` / `gate` が flow / task / phase いずれを指すか文脈依存で読み解いている状態。これは:

- step ID から「どの phase の step か」が読めず混乱を生む
- skill / docs / 過去 spec のテキストとマッチング時に意味が曖昧
- 将来の metrics / レポート（4d21）で phase 別集計するときも判別が必要

## 命名規則（src/AGENTS.md に追加）

**すべての step 名は所属する phase grouping を接頭辞に持つ。** 形式:

```
<phase>-<concern>-<action>
```

- `<phase>`: 所属する概念フェーズ（`draft`, `spec`, `test`, `impl`, `finalize`, `task`）
- `<concern>`: その step が扱う関心事（`questions`, `coverage`, `result` 等。単一なら省略）
- `<action>`: 実行する操作（`review`, `triage`, `repair`, `gate`, `execute` 等）

例:
- `draft-questions-review` — draft phase の questions concern を review
- `draft-questions-triage`
- `draft-questions-repair`
- `spec-review` — spec phase の review（concern 単一）
- `impl-gate` — impl phase の gate

**例外なし**。phase 接頭辞は必須。

## 改名リスト

### 必須改名（phase 接頭辞なし → 付与）

| 旧名 | 新名 |
|---|---|
| `review` (impl 子) | `impl-review` |
| `gate` (plan 子, spec の gate) | `spec-gate` |
| `gate-draft` | `draft-gate` |
| `gate-impl` (flow 子) | `impl-gate` |
| `review-draft-questions` | `draft-questions-review` |
| `review-draft-coverage` | `draft-coverage-review` |
| `review-spec` | `spec-review` |
| `review-test` | `test-review` |

### task スコープ（subtask）の改名

| 旧名 | 新名 |
|---|---|
| `impl` (task 子) | `task-impl` |
| `review` (task 子) | `task-review` |
| `gate-impl` (task 子) | `task-gate` |

### 一貫性のため整理（任意だが推奨）

| 旧名 | 新名 | 理由 |
|---|---|---|
| `spec-review-triage` | `spec-triage` | `spec-review` の triage という意味だが、`review-triage` の二重 action が冗長 |

### 維持（既に規則に合致、または phase entry step）

| 名前 | 理由 |
|---|---|
| `draft`, `spec`, `test` | phase entry step（書く対象 = phase 名）。重複だが自然 |
| `draft-refine` | 規則合致 |
| `draft-questions-triage` / `draft-questions-repair` | 規則合致 |
| `draft-coverage-triage` / `draft-coverage-repair` | 規則合致 |
| `spec-repair` | 規則合致 |
| `test-execute`, `test-result-review` | 規則合致 |
| `finalize-commit`, `finalize-merge`, `finalize-sync`, `finalize-cleanup` | 規則合致 |
| `prepare-spec` | phase 移行前の setup step。`spec-prepare` でもよいが破壊変更コスト > 効果。維持 |
| `branch`, `approval`, `scenario-validity`, `implement`, `retro`, `final-regression` | singleton で衝突なし。phase 内文脈で意味が通る。維持 |

## 実装スコープ

### コード変更

- `src/flow/definition.js` — step ID の改名
- `src/flow/registry.js` — コマンドメタデータの参照更新
- `src/flow/lib/run-*.js` / `set-*.js` / `get-*.js` — step ID 参照箇所すべて
- `src/flow/lib/draft-review-routes.js` 等の route 定義
- `src/templates/skills/sdd-forge.flow/SKILL.md` ほか skill 文書
- `src/presets/base/templates/**` で step ID を直書きしている箇所
- テスト（`tests/unit/flow/**`、step ID を assertion している箇所）

### 過去データ置換スクリプト

`scripts/rename-phase-steps.js`（または `src/cli` の dev 用サブコマンド）として実装:

- 対象: 全 spec 配下の以下ファイルに残る旧 step 名
  - `specs/*/flow.json`（steps 配列、history、metrics）
  - `specs/*/issue-log.json`（entry.step, entry.phase）
  - `specs/*/report.json` / `retro.json` / `review.md`（テキスト内引用）
- 動作:
  - dry-run モード（diff のみ表示）を default にし、`--apply` で実書き換え
  - 旧名 → 新名のマッピングをスクリプト内に固定（上の改名リスト）
  - JSON は string 値で完全一致したフィールドのみ置換（部分一致による誤爆を避ける）
  - Markdown はコードブロック内・パス文字列内のみ置換し、自然文中の単語誤爆を避ける
- 安全策:
  - 置換前に `git status` clean を要求
  - 置換結果を 1 commit で記録（後から `git revert` できるように）

### docs / メモリ更新

- `src/AGENTS.md` に命名規則を追記
- `CHANGELOG.md` に breaking change として記載（alpha 期間中なので互換シム不要）

## 完了条件

- `src/flow/definition.js` の step ID が改名リストに従って更新されている
- `src/AGENTS.md` に命名規則が記載されている
- 全コード・テストが新名で動作する
- 過去 spec 配下のファイルが置換スクリプトで一括更新されている
- skill / 旧 docs テキストに残る旧名がない（grep で 0 件）
- CHANGELOG.md に変更が記載されている

## 影響範囲・リスク

- alpha 期間なので後方互換コードは追加しない。
- 過去 spec のデータは置換スクリプトで一括変換。スクリプト未走の環境では metrics 集計時に旧名が混在するため、4d21 実装側は新名のみを前提にしてよい（旧名互換 mapping は持たない）。
- 既存 PR / branch に flow.json が含まれる場合は merge 後に再走させる必要がある旨を CHANGELOG に明記。

## 関連

- 4d21: フロー観測レポート。本タスクで step 名が統一されれば集計ロジックが phase 接頭辞で grouping できるようになる
- bare `review` / `gate` 命名問題の解消は cdb2（review 収束性）の関連でも有用

</details>