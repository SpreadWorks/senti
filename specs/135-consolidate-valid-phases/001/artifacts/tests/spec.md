# Test Design

### Test Design

---

#### phases.js 単体 (Req 1)

- **TC-1: VALID_PHASES exports correct list**
  - Type: unit
  - Input: `import { VALID_PHASES } from "../src/flow/lib/phases.js"`
  - Expected: `VALID_PHASES` が `["draft", "spec", "gate", "impl", "test", "lint"]` と深い等値

- **TC-2: VALID_PHASES is frozen**
  - Type: unit
  - Input: `Object.isFrozen(VALID_PHASES)`
  - Expected: `true`

- **TC-3: VALID_PHASES is immutable at runtime**
  - Type: unit
  - Input: `VALID_PHASES.push("extra")` / `VALID_PHASES[0] = "x"`
  - Expected: strict mode で TypeError が throw される。配列の内容は変化しない

---

#### get-guardrail.js 統合 (Req 2)

- **TC-4: get-guardrail uses shared VALID_PHASES**
  - Type: unit
  - Input: `get-guardrail.js` のモジュールソースを読み取り
  - Expected: `phases.js` からの import 文が存在し、ファイル内に `VALID_PHASES` のローカル定義（配列リテラル）が存在しない

- **TC-5: get-guardrail accepts every valid phase**
  - Type: unit
  - Input: 各フェーズ `"draft"`, `"spec"`, `"gate"`, `"impl"`, `"test"`, `"lint"` を引数に `getGuardrail()` を呼び出す
  - Expected: いずれも Error を throw せず、ガードレール情報（オブジェクトまたは該当なしの正常値）を返す

- **TC-6: get-guardrail rejects unknown phase**
  - Type: unit
  - Input: `getGuardrail("deploy")` など VALID_PHASES に含まれないフェーズ
  - Expected: Error が throw される（既存の挙動が維持される）

---

#### set-metric.js 統合 (Req 3)

- **TC-7: set-metric uses shared VALID_PHASES**
  - Type: unit
  - Input: `set-metric.js` のモジュールソースを読み取り
  - Expected: `phases.js` からの import 文が存在し、ファイル内に `VALID_PHASES` のローカル定義（配列リテラル）が存在しない

- **TC-8: set-metric accepts every valid phase**
  - Type: unit
  - Input: 各 VALID_PHASES の要素をフェーズ引数として `setMetric()` を呼び出す（他の引数は有効値）
  - Expected: いずれもフェーズバリデーションを通過し、正常に処理される

- **TC-9: set-metric rejects unknown phase**
  - Type: unit
  - Input: `setMetric({ phase: "deploy", ... })` など無効フェーズ
  - Expected: Error が throw される（既存の挙動が維持される）

---

#### review.js subset 検証 (Req 4)

- **TC-10: review.js loads successfully when REVIEW_PHASES ⊆ VALID_PHASES**
  - Type: unit
  - Input: `import("../src/flow/commands/review.js")`（現在の REVIEW_PHASES が VALID_PHASES の subset である前提）
  - Expected: モジュールが正常にロードされ、export が利用可能

- **TC-11: review.js throws on load when REVIEW_PHASES ⊄ VALID_PHASES**
  - Type: unit
  - Input: VALID_PHASES に存在しないキーを REVIEW_PHASES に含むようモックした状態で動的 import する
  - Expected: モジュールロード時（トップレベル）に Error が throw される。エラーメッセージに違反したフェーズ名が含まれる

- **TC-12: review.js uses shared VALID_PHASES**
  - Type: unit
  - Input: `review.js` のモジュールソースを読み取り
  - Expected: `phases.js` からの import 文が存在する

---

#### registry.js ヘルプテキスト (Req 5)

- **TC-13: registry help text lists all phases**
  - Type: unit
  - Input: `registry.js` から取得したヘルプテキスト文字列
  - Expected: `"draft"`, `"spec"`, `"gate"`, `"impl"`, `"test"`, `"lint"` の全フェーズが記載されている

- **TC-14: registry help text does not list stale phases**
  - Type: unit
  - Input: `registry.js` のヘルプテキスト文字列
  - Expected: VALID_PHASES に含まれないフェーズ名（旧定義にのみ存在した値があれば）が記載されていない

---

#### CLI 後方互換 (Req 6)

- **TC-15: `flow run get-guardrail --phase spec` output unchanged**
  - Type: acceptance
  - Input: CLI コマンド `sdd-forge flow run get-guardrail --phase spec` を実行
  - Expected: 出力形式（JSON 構造・フィールド名）と終了コード 0 が変更前と一致する

- **TC-16: `flow set metric` with valid phase — exit code 0**
  - Type: acceptance
  - Input: CLI コマンド `sdd-forge flow set metric --phase impl --key duration --value 42` を実行
  - Expected: 終了コード 0。出力形式に変更なし

- **TC-17: `flow set metric` with invalid phase — exit code non-zero**
  - Type: acceptance
  - Input: CLI コマンド `sdd-forge flow set metric --phase deploy --key duration --value 42` を実行
  - Expected: 終了コード非 0。エラーメッセージに無効フェーズであることが示される

- **TC-18: `flow run get-guardrail --phase deploy` — exit code non-zero**
  - Type: acceptance
  - Input: CLI コマンド `sdd-forge flow run get-guardrail --phase deploy` を実行
  - Expected: 終了コード非 0。エラーメッセージが変更前と同等

---

#### 単一定義の一貫性 (横断)

- **TC-19: No duplicate VALID_PHASES definitions in codebase**
  - Type: integration
  - Input: `src/flow/` 配下の全 `.js` ファイルを grep で走査
  - Expected: `VALID_PHASES` の配列リテラル定義が `phases.js` の 1 箇所のみに存在する

- **TC-20: All consumers import from phases.js**
  - Type: integration
  - Input: `src/flow/` 配下で `VALID_PHASES` を参照する全ファイルを走査
  - Expected: 全ファイルが `./phases.js` または `../lib/phases.js` 等の相対パスで `phases.js` から import している

---

#### テストタイプ分布サマリー

| Type | Count | Coverage |
|------|-------|----------|
| Unit | 14 | phases.js 単体、各モジュールのバリデーション挙動、ソース構造検証 |
| Integration | 2 | 単一定義の一貫性・import チェーン |
| Acceptance | 4 | CLI インターフェースの後方互換性 |
