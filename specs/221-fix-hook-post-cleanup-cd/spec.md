# Feature Specification: 221-fix-hook-post-cleanup-cd

**Feature Branch**: `feature/221-fix-hook-post-cleanup-cd`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #240

## Goal
- `flow run finalize` cleanup 完了直後に AI が main repo への `cd` を拒否する問題を、worktree 境界ルールの文言を書き直すことで解消する。具体的には「active の AND 定義」と「境界解除の OR 条件」を別 bullet に分離し、post-cleanup の `cd` が mandatory であることを明示する。

## Background
- Issue #240 の denial メッセージは `settings.json` の hook ではなく、AI 自身が CLAUDE.md / `sdd-forge.flow` skill の MUST ルールを読んで自己規制した結果出力している reason 文である。現行の rule text は `MUST: Never cd out of the worktree path during an active flow` が強く、例外条項「after finalize cleanup」が同一 bullet の副次句として埋もれているため、AI が cleanup 完了判定を誤った場合に MUST 側を優先してしまう。
- rule text は `src/templates/partials/worktree-mode.md` に一元化されており、`sdd-forge.flow/SKILL.md` が include で展開している。`sdd-forge upgrade` により生成済み skill に反映される。

## Scope
- `src/templates/partials/worktree-mode.md` の worktree boundary セクションの文言書き換え。
- `active` を AND 条件（status が active: true AND worktree ディレクトリ存在）として定義。
- 境界解除のトリガーを OR 条件（status が active: false OR worktree ディレクトリ不在）として独立 bullet で記述。
- cleanup 完了時の `cd <mainRepoPath>` が mandatory である旨を独立 bullet で明記。

## Out of Scope
- 実 PreToolUse hook の追加（`settings.json` 配線）。
- `flow run finalize` の CLI 出力変更（BOUNDARY RELEASED シグナル等）。
- プロジェクト固有 CLAUDE.md の「Worktree の境界を越えない」セクション更新。
- 生成済み skill ファイル (`.claude/skills/sdd-forge.flow/SKILL.md`) の直接編集。source template 更新を `sdd-forge upgrade` で反映する。
- 他 worktree 境界関連ルール（`git stash` 禁止、detached worktree 案内）の改訂。
- テストの追加・既存テストの変更。

## Constraints
- sdd-forge の alpha 版ポリシー: 後方互換シムは書かず、旧文言は削除して新文言に置き換える。
- `src/` 配下のため、プロジェクト固有の情報（特定プロジェクト名・パス・ホスト名等）を埋め込まない。
- 本 spec 実装中に旧文言を参照しないこと（参照すると AI が古いルールに引きずられるリスク）。

## Design Principles
- 「禁止条項」と「解除条件」を構造的に別 bullet に分ける（読み順で干渉しないよう可視的に独立させる）。
- 解除条件は AI が決定論的に観測できるもののみ（CLI 出力 + ファイルシステム存在確認）。曖昧な推論条件は使わない。
- 解除条件は OR で冗長化し、片方が満たされれば境界が解除されることを明示（cleanup 完了時は両方同時に成立するが、独立した観測指標として冗長性を残す）。

## Overview
### Modules
- `src/templates/partials/worktree-mode.md` — worktree 境界ルールの source of truth。

### Data Flow
- `src/templates/partials/worktree-mode.md` → include 展開 → `.claude/skills/sdd-forge.flow/SKILL.md` への反映（`sdd-forge upgrade` 実行時）。

### Decisions
- アプローチは docs-only（A）を選択。hook 追加や CLI 変更は見送り。
- 境界解除条件は `active: false` **OR** worktree 不在の OR 条件。
- 変更対象は source partial 1 ファイルのみ。生成済み skill は upgrade で反映する方針。

## Clarifications (Q&A)
Note: 以下は draft フェーズで確定したユーザー決定の要約（意思決定モード）。

- Q: 修正アプローチはどれにするか？
  - A: A（skill/partial の文言クリア化のみ）。hook 追加 (B) は alpha 期間のコスト超過、CLI 出力変更 (C) は副作用大。

- Q: 境界解除の判定条件は？
  - A: `sdd-forge flow get status` が `active: false` **OR** worktree ディレクトリ不在、の OR 条件。

- Q: 変更対象ファイル範囲は？
  - A: `src/templates/partials/worktree-mode.md` のみ。生成済み skill は `sdd-forge upgrade` で反映する。

- Q: テストは？
  - A: テスト無し。ドキュメント文言の変更であり、alpha 期間の過剰防御回避方針に合致。

## Alternatives Considered
- **B: 実 PreToolUse hook を追加**: 決定論的強度は高いが、hook インフラを sdd-forge に配線する実装コストが大きく、全ユーザーの `settings.json` 更新という副作用を伴う。alpha 版のシンプル維持方針と相性が悪い。
- **C: `flow run finalize` cleanup 完了時の CLI 出力シグナル**: AI の解釈負担は下がるが、finalize コマンドの出力変更は UX に副作用が広がる。テスト・docs への波及も大きい。
- **D: A + C**: 二段構え安全装置として優位だが、本 bug は単一の文言解釈ミスが原因と判定でき、A のみで十分。オーバーエンジニアリング回避のため不採用。

### Why This Approach (A)
- 根本原因が rule text の構造（禁止条項と解除条件が同一 bullet）にあり、構造改善のみで解消可能。
- 変更範囲が 1 ファイルに閉じ、影響面が小さい。
- alpha 期間の「過剰防御を避ける」「シンプルに保つ」方針と一致。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23
- Notes: /sdd-forge.flow-auto on 起動により approval 通過

## Requirements
1. **R1 (最優先):** When `src/templates/partials/worktree-mode.md` defines worktree boundary behavior, the rule text shall place the MUST-forbid clause and the boundary-release condition clause on different top-level bullets (they shall not appear within the same bullet or sentence).
2. **R2:** When the rule text defines "flow is active", it shall state that "active" means both of the following hold simultaneously — `sdd-forge flow get status` returns `active: true`, **AND** the worktree directory still exists (AND semantics).
3. **R3:** When either of the two active conditions flips (status returns `active: false`, OR the worktree directory no longer exists), the rule text shall explicitly state that the boundary is lifted and `cd` out of the (former) worktree is allowed.
4. **R4:** When `flow run finalize` cleanup has completed, the rule text shall state that the AI must immediately `cd` back to the main repo path (mandatory, not optional).

## Acceptance Criteria
- AC1: `src/templates/partials/worktree-mode.md` の差分に、従来の `MUST: Never cd out of the worktree path during an active flow.` を単一 bullet で記述していた箇所が無く、代わりに「MUST-forbid 項」と「boundary-release 条件項」が独立した top-level bullet として存在する。
- AC2: 同ファイルに、「active」を `sdd-forge flow get status` の `active: true` **AND** worktree ディレクトリ存在の AND 条件として定義する記述が存在する。
- AC3: 同ファイルに、境界解除トリガーを `active: false` **OR** worktree ディレクトリ不在の OR 条件として列挙した独立 bullet が存在する。
- AC4: 同ファイルに、`flow run finalize` cleanup 完了後に main repo へ `cd` することが mandatory であることを示す独立 bullet が存在する。
- AC5: 既存テストが全て PASS する（baseline と同じ test 結果）。

## Test Strategy
- 新規テストは追加しない。rule text 変更のため機械的な回帰検知は不要と判断（draft Q&A で合意済み）。
- 既存テストは変更しない。
- 手動検証: 変更後に `sdd-forge upgrade` を実行し、`.claude/skills/sdd-forge.flow/SKILL.md` の該当セクションが新文言で再生成されることを確認する。

## Implementation Targets
- `src/templates/partials/worktree-mode.md`

## Open Questions
- [ ]
