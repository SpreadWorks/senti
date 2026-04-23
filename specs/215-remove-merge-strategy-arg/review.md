# Code Review Results

### [x] 1. Dry-run が実際の分岐結果を返していない
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `dry-run` 時の `results.merge.strategy` が常に `"auto"` になっており、実行時に返る `"pr"` / `"squash"` / `"skip"` と意味が揃っていません。後続処理や利用側で分岐条件が二重化しやすくなります。  
**Suggestion:** `merge.js` 側の判定ロジックを再利用できる `resolveMergeStrategy(...)`（または同等の純関数）を切り出し、`dry-run` でも実際に選ばれる戦略値を返すようにしてください。

**Verdict:** APPROVED
**Reason:** 現状は `dry-run` の `strategy: "auto"` が実行時の実際値（`"pr" / "squash" / "skip"`）と不一致で、`sync` 判定まで誤誘導します。`resolveMergeStrategy(...)` を共通化して dry-run にも適用するのは品質・整合性の両面で有効で、挙動破壊リスクも低いです。

### [x] 2. 戦略判定ロジックが関数本体に埋め込まれており再利用しにくい
**File:** `src/flow/commands/merge.js`  
**Issue:** `ghEnabled && isGhAvailable()` の判定が `runMerge` 内に直接書かれており、他箇所（例: dry-run 表示や将来の診断コマンド）で同じ判定が必要になった場合に重複しやすい構造です。  
**Suggestion:** 判定を `resolveMergeStrategy(config, ghAvailable)` のような小さなヘルパーに抽出し、`runMerge` はその結果を使うだけにすると、重複排除とテスト容易性が上がります。

**Verdict:** APPROVED
**Reason:** `ghEnabled && isGhAvailable()` の判定抽出は重複回避とテスト容易性を上げる妥当なリファクタです。純関数化して既存分岐をそのまま使えば実行挙動は維持できます。

### [ ] 3. テストで同じ実行/パース処理が重複している
**File:** `tests/unit/flow/get-prompt.test.js`  
**Issue:** `execFileSync` 実行と JSON パース処理が複数テストで重複し、`try/catch` の失敗系検証も読みづらくなっています。  
**Suggestion:** `runGetPrompt(kind)` のヘルパーを作って共通化し、失敗ケースは `assert.throws` + 例外内容抽出ヘルパーに寄せると、重複削減と可読性改善になります。

**Verdict:** REJECTED
**Reason:** 主効果が可読性向上に留まるテスト側の整理で、現時点では機能品質の改善が限定的です。`assert.throws` 化は `execFileSync` の `stdout` 解析（現在の失敗検証）を弱める実装になりやすく、回帰検知力を落とすリスクがあります。
