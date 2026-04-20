# Code Review Results

### [x] 1. Extract Git Repo Test Setup Helper
**File:** `tests/unit/flow/commands/review.test.js`  
**Issue:** `collectTouchedFiles` の2テストで `git init/config/add/commit` の初期化手順がほぼ重複しており、保守コストが上がっています。  
**Suggestion:** `initTestRepo(tmp)` や `commitFiles(tmp, files)` のようなヘルパーを作って重複を除去し、各テストは差分シナリオだけ記述する形にします。

**Verdict:** APPROVED
**Reason:** 重複した Git 初期化手順の共通化はテスト可読性と保守性を上げます。テストコード内の整理であり、実装挙動への破壊リスクは低いです。

### [ ] 2. Replace String-Matched Errors with Structured Error Codes
**File:** `src/flow/lib/get-status.js`  
**Issue:** no active flow 時に汎用 `Error("no active flow ...")` を投げ、呼び出し側が文言依存で判定する設計になっており、文言変更に弱いです。  
**Suggestion:** 例外に `code`（例: `NO_ACTIVE_FLOW`）を持たせるか、エンベロープに機械可読なエラーコードを返すようにして、skills 側はコードで分岐させます。

**Verdict:** REJECTED
**Reason:** 品質改善の方向性は妥当ですが、`flow get status` の既存契約（戻り値/失敗時挙動）を変えやすく、既存 caller を壊すリスクが高いです。互換維持方針がない提案は保守的に却下です。

### [ ] 3. Reduce Public Surface of `review.js`
**File:** `src/flow/commands/review.js`  
**Issue:** `buildFinalSystemPrompt` を含む内部関数を多数 export しており、内部実装に外部が依存しやすくなっています（実質的な dead/public API 拡張）。  
**Suggestion:** 実運用 API は最小化し、テスト用公開が必要なら `__test__` 名前空間に限定して export するか、振る舞いベースでテストして内部関数 export を減らします。

**Verdict:** REJECTED
**Reason:** 不要 export 削減は一般に有効ですが、現状どこから参照されているか不明なまま縮小すると互換性破壊のリスクがあります。実使用調査なしの API 縮小は保守的に不可です。

### [x] 4. Unify “No Proposals” Output Path
**File:** `src/flow/commands/review.js`  
**Issue:** scope filter 後に0件のときだけ `review.md` を直接 `writeFileSync` しており、通常経路（フォーマッタ経由）と出力経路が分岐しています。  
**Suggestion:** 0件ケースも既存の出力フォーマット関数に通す共通経路に寄せ、review 出力の仕様を1か所で管理します。

**Verdict:** APPROVED
**Reason:** 出力経路の一本化は仕様の一貫性と変更耐性を上げます。既存フォーマッタを使う形なら挙動差分も管理しやすく、破壊リスクは低いです。

### [x] 5. Improve Naming/Intent for Touched-File Collection
**File:** `src/flow/commands/review.js`  
**Issue:** `collectTouchedFiles` は実際には `git diff <baseBranch>` と `git diff --cached` の合算で、対象範囲の意図が名前から読み取りづらいです。  
**Suggestion:** `collectDiffAndStagedFiles` などに改名するか、関数コメントに「何を含み/含まないか」を明記して、設計意図をコード上で一貫させます。

**Verdict:** APPROVED
**Reason:** 意図の明確化は誤用防止に効きます。特にコメント追記で対応すれば非破壊で品質向上できます（公開名変更は避ける前提）。
