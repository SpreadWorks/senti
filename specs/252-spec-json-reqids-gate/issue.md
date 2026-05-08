## Overview

The reqIds retrieval logic in `run-gate.js:1754` branches on whether file-map.json exists to decide whether to read spec.json. Fix this so that `spec.json`'s `requirements[].id` is always read with priority.

## Current Code

```js
let reqIds;
if (hasFileMap) {
  try {
    const specJson = loadSpecJson(absSpecPath, { validate: false });
    reqIds = (specJson.requirements || []).map((r) => r.id);
  } catch (err) {
    process.stderr.write(`...`);
  }
}
if (!reqIds || reqIds.length === 0) {
  reqIds = extractRequirementIds(specText);  // spec.md regex fallback
}
```

## After Fix

```js
let reqIds;
try {
  const specJson = loadSpecJson(absSpecPath, { validate: false });
  reqIds = (specJson.requirements || []).map((r) => r.id);
} catch (err) {
  process.stderr.write(`...`);
}
if (!reqIds || reqIds.length === 0) {
  reqIds = extractRequirementIds(specText);
}
```

Simply remove the `if (hasFileMap)` block. file-map.json is only needed for per-requirement diff splitting and is not required for ID enumeration.

## Effect

- Specs without a generated file-map.json can now use spec.json requirements directly
- Moves closer to eliminating the need for `**REQ-N**` bold markers in spec.md (regex fallback remains as a last resort)
- The REQ-SPEC fallback in impl gate will almost never trigger, eliminating the whack-a-mole structure
- Examples of affected older specs: 213, 215, 221, 226

## Test Impact

**`tests/e2e/flow/gate-impl-integration.test.js`** will definitely fail because it is designed assuming the REQ-SPEC fallback path:

- L55 comment: "Minimal spec.md — no **REQ-XXX** markers so extractRequirementIds falls back to REQ-SPEC"
- L36 fixture: spec.json has `requirements: [{ id: "R1", ... }]`
- Stub agent (`tests/helpers/stub-agent.js:defaultPassResponse`) has `guardrail_id: "REQ-SPEC"` hardcoded

Behavior after fix:
- Expected reqIds: `["R1"]`
- Stub response: `[{ guardrail_id: "REQ-SPEC", ... }]`
- `parseEvaluationResponse` throws with "unknown guardrail_id \"REQ-SPEC\""

### Test Fix Options

1. Remove requirements from the test fixture's spec.json (preserving the old fallback scenario)
2. Change the stub response to `"R1"` and update the L55 comment (migrate to the new scenario)
3. Keep the old scenario in a separate fixture and add a new test for the new scenario

Since the scenario itself (the premise that REQ-SPEC fallback always occurs) has changed, updating the test can be considered within the exception scope of "do not modify test code to make tests pass" (the scenario's validity has expired).

## Related Notes

No other tests directly touching the reqIds enumeration logic were found. Tests 248/241/209/235 are on the per-req diff processing side and are unaffected.

<details>
<summary>ja</summary>

impl gate: spec.json の requirements を file-map.json 有無に関わらず読む

## 概要

`run-gate.js:1754` の reqIds 取得ロジックが、file-map.json の有無によって spec.json を読むかどうかを分岐している。これを修正し、spec.json の requirements[].id を常時優先で読むようにする。

## 現状コード

```js
let reqIds;
if (hasFileMap) {
  try {
    const specJson = loadSpecJson(absSpecPath, { validate: false });
    reqIds = (specJson.requirements || []).map((r) => r.id);
  } catch (err) {
    process.stderr.write(`...`);
  }
}
if (!reqIds || reqIds.length === 0) {
  reqIds = extractRequirementIds(specText);  // spec.md regex fallback
}
```

## 修正後

```js
let reqIds;
try {
  const specJson = loadSpecJson(absSpecPath, { validate: false });
  reqIds = (specJson.requirements || []).map((r) => r.id);
} catch (err) {
  process.stderr.write(`...`);
}
if (!reqIds || reqIds.length === 0) {
  reqIds = extractRequirementIds(specText);
}
```

`if (hasFileMap)` ブロックを外すだけ。file-map.json は per-requirement の diff 分割にのみ必要であり、ID 列挙には不要。

## 効果

- 古い spec（file-map.json 未生成）でも spec.json の requirements を直接利用
- spec.md の `**REQ-N**` 太字マーカー不要に近づく（regex fallback は最終 fallback として残る）
- impl gate の REQ-SPEC fallback がほぼ発動しなくなり、もぐら叩き構造が解消
- 該当する古い spec の例: 213, 215, 221, 226

## テスト影響

**`tests/e2e/flow/gate-impl-integration.test.js`** が REQ-SPEC fallback 経路を前提に設計されているため確実に落ちる:

- L55 コメント: 「Minimal spec.md — no **REQ-XXX** markers so extractRequirementIds falls back to REQ-SPEC」
- L36 fixture: spec.json に `requirements: [{ id: "R1", ... }]` あり
- スタブ agent (`tests/helpers/stub-agent.js:defaultPassResponse`) は `guardrail_id: "REQ-SPEC"` ハードコード

修正後の挙動:
- 期待 reqIds: `["R1"]`
- スタブ応答: `[{ guardrail_id: "REQ-SPEC", ... }]`
- `parseEvaluationResponse` が「unknown guardrail_id "REQ-SPEC"」で throw

### テスト修正の選択肢

1. テスト fixture の spec.json から requirements を消す（旧 fallback シナリオを温存）
2. スタブ応答を `"R1"` に変えて L55 コメント更新（新シナリオに移行）
3. 旧シナリオは別 fixture で残し、新シナリオを別テストで追加

シナリオ自体（REQ-SPEC fallback が常に起きる前提）が変わるため、テスト更新は「テストを通すためにテストコードを修正してはならない」の例外範囲（シナリオ妥当性が失効）と判断できる。

## 関連メモ

他に reqIds 列挙ロジックを直接触る tests は確認した範囲では無し。248/241/209/235 spec-local tests は per-req diff 処理側で、影響なし。

</details>