# Code Review Results

### [x] 1. Replace Ad-hoc Result Objects with a Consistent Return Type
**File:** `src/flow/lib/set-test-summary.js`  
**Issue:** `parseJsonPayload()` と `validateFailedArray()` が `{ fail }` / `{ payload }` / `{ failed }` という ad-hoc な object を返しており、実質的に擬似 union になっています。設計意図が読み取りづらく、呼び出し側の `if (x.fail)` 分岐が増えやすいです。  
**Suggestion:** 返却型を統一してください。例えば `Envelope` を直接返す失敗パス + 成功時は値そのものを返す、または小さな専用クラス（`ValidationSuccess` / `ValidationFailure`）に揃えると、設計パターンの一貫性と可読性が上がります。

**Verdict:** APPROVED
**Reason:** This is a real design improvement (clearer success/failure contract, less pseudo-union ambiguity) and can preserve behavior if applied as an internal refactor with unchanged envelope codes/messages.

### [ ] 2. Eliminate Repeated “check-fail-then-unpack” Logic
**File:** `src/flow/lib/set-test-summary.js`  
**Issue:** `execute()` 内で `parsed.fail` → `validated.fail` の同型分岐が連続しており、同じ制御パターンが重複しています。  
**Suggestion:** `unwrapOrReturnFail(result, key)` のような小ヘルパーを導入して、失敗時 return と成功値抽出を共通化してください。分岐の重複を減らし、今後の検証ステップ追加時の保守性が上がります。

**Verdict:** REJECTED
**Reason:** The duplication is minimal (2 steps), and a generic `unwrapOrReturnFail(result, key)` adds indirection/dynamic key risk for little gain; likely cosmetic and could reduce readability.

### [x] 3. Improve Function Naming to Match Actual Responsibility
**File:** `src/flow/lib/set-test-summary.js`  
**Issue:** `failJson()` は JSON パース失敗以外（`failed[]` の型・長さ検証）にも使っており、名前と責務がずれています。`parseJsonPayload()` も実際には「JSON object か検証」まで含んでいます。  
**Suggestion:** `failJson` を `failSetTestSummaryValidation`（または `failSetTestSummaryArg`）に改名し、`parseJsonPayload` を `parseJsonObjectArg` などに変更して、責務が名前から直感的に分かるようにしてください。

**Verdict:** APPROVED
**Reason:** Current names are slightly misleading (`failJson` is used beyond parse errors). Renaming to responsibility-accurate names improves maintainability with near-zero behavior risk.

### [ ] 4. Reduce Test Case Duplication in Table-driven Specs
**File:** `tests/unit/flow/throw-to-envelope-codes.test.js`  
**Issue:** 追加された2ケースは既存の `set summary` ケースと構造がほぼ同じで、今後同種ケースが増えるとテーブルの重複が拡大します。  
**Suggestion:** 同系統ケースを生成する小さな factory（例: `invalidJsonCase(commandArgs)`）を使って定義を共通化し、ケース追加時の編集量と表記ゆれを減らしてください。

**Verdict:** REJECTED
**Reason:** With only a couple of similar rows, a factory is premature abstraction. It adds helper indirection without meaningful quality gain and can make case intent less explicit.
