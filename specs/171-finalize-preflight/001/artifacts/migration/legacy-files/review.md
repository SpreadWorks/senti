# Code Review Results

### [ ] 1. Reduce Unnecessary Exported Surface
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `resolveGitCommonDir` と `assertGitWriteAccess` が `export` されていますが、この差分内では `runFinalizePreflight` からのみ内部利用されています。不要な公開 API は保守負荷と依存結合を増やします。  
**Suggestion:** 外部利用がないなら `export` を外して内部関数にし、公開は `runFinalizePreflight` のみに絞ってください（テストで必要なら明示的に理由をコメント化）。

**Verdict:** REJECTED
**Reason:** `export` を外す変更は外部 import（他モジュール/テスト）を壊す可能性があり、提示情報だけでは安全性を証明できません。保守性改善は理解できますが、挙動互換の観点で保守的に不採用です。

### [x] 2. Clarify Directory Naming
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `gitDir` という名前は `.git` 実体を想起させますが、取得しているのは `--git-common-dir` です。ワークツリー/共通ディレクトリが分離された環境では意味がズレます。  
**Suggestion:** `gitDir` を `gitCommonDir` に変更し、`assertGitWriteAccess(gitCommonDir)` のように命名を揃えて意図を明確化してください。

**Verdict:** APPROVED
**Reason:** `gitDir` → `gitCommonDir` は意味整合性を上げる純粋な命名改善で、挙動変更リスクがほぼありません。`--git-common-dir` の実体と一致し可読性が向上します。

### [ ] 3. Avoid Duplicate Error Prefix Construction
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `"finalize preflight failed: ..."` の文言が `assertOk(...)` と `buildFinalizePreflightError(...)` で重複し、将来の文言変更時に不整合が起きやすいです。  
**Suggestion:** 例えば `const FINALIZE_PREFLIGHT_PREFIX = "finalize preflight failed";` を導入し、メッセージ生成を一元化してください。

**Verdict:** REJECTED
**Reason:** 主に文言のDRY化で、実質的な品質改善は小さく cosmetic 寄りです。現状でも不整合は限定的で、保守的には優先度不足です。

### [ ] 4. Make Temp Lock Handling More Robust
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `writeFile` 後に `unlink` を直列実行しており、`unlink` 失敗時も即 preflight failure になります。実際には書き込み可でもクリーンアップのみ失敗するケースを同列に扱ってしまいます。  
**Suggestion:** `try/finally` で削除を試みつつ、主判定は「作成できたか」に寄せるか、`fs.promises.open(lockPath, "wx")` を使って lock 生成意図を明確化し、エラー分類（作成失敗 vs 削除失敗）を分けてメッセージを改善してください。

**Verdict:** REJECTED
**Reason:** 「作成成功を主判定」に寄せると、削除失敗を成功扱いにして一時 lock 残骸や環境異常を見逃す可能性があります。エラー分類改善自体は有益ですが、提案の方向は既存挙動を変えるリスクが高いです。
