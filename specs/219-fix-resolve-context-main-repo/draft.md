# Draft: 219-fix-resolve-context-main-repo

**開発種別:** bugfix
**目的:** active flow の context を解決する CLI コマンドが、worktree 内から実行されても「メインリポジトリのパス」を正しく返すようにする。

## Scope Verification
- In scope (priority order — P1 is critical, P4 is supporting):
  - **P1.** When an active flow is in worktree mode and the user queries the flow context from inside the worktree, the system shall return a main repository path that points to the primary repository (not the worktree itself).
  - **P2.** When the main repository path and the worktree path are both returned, they shall refer to distinct filesystem locations, so that callers can restore a valid working directory after worktree cleanup.
  - **P3.** When the same context shape is surfaced via both the read-only context query and the resume entrypoint, both shall report the same, corrected main repository path (no drift between the two).
  - **P4.** When the fix is in place, the automated test suite shall include a regression test that fails if the main repository path ever collapses to the worktree path again.
- Out of scope:
  - Changing the persisted shape of `flow.json` / `active-flow.json` or the public keys of the context envelope.
  - Adjusting the flow skill documentation (`SKILL.md`) — the existing instructions already direct the reader to read the main repository path from the context query; the user-facing contract does not change and thus needs no rewrite.
  - Finalize / merge / cleanup internals, which already resolve the main repository path correctly via a different code path.

## Impact on Existing Features
- 影響ありの既存機能:
  - The `flow get resolve-context` CLI output: in worktree mode the `mainRepoPath` field now points to the primary repository instead of the worktree. This is a **semantic fix of a returned value**, not a contract change — the field name, type, and meaning are unchanged; only the previously-incorrect value is corrected.
  - The `flow run resume` CLI output: same semantic fix, applied consistently because it shares the envelope shape.
  - The `flow-finalize` skill's post-cleanup recovery step (`cd <mainRepoPath>`): this fallback was documented but effectively broken; the fix activates it.
- Backward compatibility note:
  - No migration step is required. Any caller that previously consumed `mainRepoPath == worktreePath` was observing the bug, not a documented contract; no scripts or skills depend on the buggy equality (the only consumer, `flow-finalize` skill, already expects the fixed semantics).
- 影響なし:
  - Non-worktree (plain branch / local) flows: `mainRepoPath` was already correct there and remains unchanged.
  - All `flow set ...` mutation commands, `flow prepare`, and `flow run finalize` execution logic.

## Q&A
- Q: 修正の単位は `resolve-context` クエリだけで足りるか？
  - A: No. 同じ envelope 形状を返す resume エントリも同一の欠陥を抱えている。片方だけ直すと context 形状 drift を起こすため一括修正する。
- Q: SKILL.md の `cd <mainRepoPath>` 記述は修正が必要か？
  - A: 不要。既存記述は context query から `mainRepoPath` を取得する運用を前提としており、本修正でその前提が初めて成立する。契約変更は発生しない。
- Q: この変更は backward-compatible か？
  - A: Yes。返却フィールドの名称・型・意味は不変。誤った値が正しい値に修正されるだけで、正しい値を前提にしていた唯一の消費者（finalize skill）は挙動が改善される。
- Q: 回帰をどう防ぐか？
  - A: worktree mode で context を解決したとき `mainRepoPath !== worktreePath` が成立することを assert する unit test を追加する。

## Open Questions
-

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-23
- Notes: auto-mode eligible (score 22/24)
