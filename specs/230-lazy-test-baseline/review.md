# Code Review Results

### [x] 1. Extract Shared Test-Run Pipeline
**File:** `src/flow/lib/run-tests.js`  
**Issue:** `captureBaselineInWorktree()` now re-implements core test execution steps (spawn, log write, count parsing, summary persistence, agent fallback) that are likely already present in the head-test path inside `execute()`. This increases drift risk and maintenance cost.  
**Suggestion:** Introduce a single internal helper (for example `runTestsAndPersistSummary({ cwd, logRel, baseline })`) and reuse it for both baseline and head runs. Keep only worktree lifecycle logic in `captureBaselineInWorktree()`.

**Verdict:** APPROVED
**Reason:** 重複した実行・要約・永続化ロジックを共通化するのは保守性とドリフト耐性を実際に改善します。内部ヘルパー化で外部挙動を変える必要がなく、破壊リスクは低いです。

### [x] 2. Reduce Responsibility of `captureBaselineInWorktree`
**File:** `src/flow/lib/run-tests.js`  
**Issue:** `captureBaselineInWorktree()` currently handles both environment setup (worktree add/remove) and business logic (test summarization + fallback). This mixes layers and makes the function harder to reason about and test.  
**Suggestion:** Split into two helpers: one for worktree lifecycle (`withDetachedWorktree`) and one for test execution/summarization. This keeps design consistent with single-responsibility style.

**Verdict:** APPROVED
**Reason:** worktree ライフサイクルとテスト要約処理の分離は責務を明確にし、テストしやすさを上げます。分割先で現在の例外処理順序を維持すれば挙動変更リスクは低いです。

### [ ] 3. Improve Naming Precision for Worktree Path
**File:** `src/flow/lib/run-tests.js`  
**Issue:** `BASELINE_WORKTREE_DIR = "baseline-worktree"` is generic and reused as a fixed directory name, which can cause collisions across repeated runs and obscures intent.  
**Suggestion:** Rename to something intent-rich (for example `BASELINE_WORKTREE_NAME`) and generate a unique per-run directory (`baseline-worktree-<runId|timestamp>`), then clean it up. This improves clarity and robustness.

**Verdict:** REJECTED
**Reason:** 命名変更自体はほぼ cosmetic で、ユニークディレクトリ化は実行履歴・クリーンアップ・失敗時残骸の扱いを変えるため挙動リスクがあります。現状の固定パス＋事前削除でも要件を満たせるなら保守的には見送るべきです。

### [ ] 4. Remove Unused Catch Variable
**File:** `src/flow/lib/run-tests.js`  
**Issue:** `gitErr` in `catch (gitErr)` is never used, which is dead local state and adds noise.  
**Suggestion:** Change to `catch { ... }` (or log `gitErr.message` if useful for diagnostics) to keep error handling minimal and intentional.

**Verdict:** REJECTED
**Reason:** `catch (gitErr)` を `catch {}` にする提案は品質改善が限定的で実質 cosmetic です（未使用変数警告解消以上の効果が小さい）。

### [x] 5. Keep Behavioral Guarantees Explicit in Skill Doc
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The new short note says baseline capture is lazy, but it drops previously explicit guarantees (best-effort behavior, non-blocking on failure, and where fallback handling occurs). This can create operator ambiguity.  
**Suggestion:** Keep the concise wording, but add one compact sentence clarifying: baseline capture is automatic, best-effort, and flow progression must continue even if baseline capture fails.

**Verdict:** APPROVED
**Reason:** best-effort・非ブロッキング保証を明文化するのは運用上の誤解防止に有効で、実装挙動は変えません。ドキュメント品質の実質的改善です。
