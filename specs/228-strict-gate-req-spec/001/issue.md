## Background

During the implementation of spec 215, gate-impl failed REQ-SPEC several times, but ultimately passed with a judgment of "implementation exists in diff + head test exits 0". At that point, insufficient evidence for REQ-12 (integration scenario) was flagged, yet the overall verdict still leaned toward PASS.

As a result, spec 215 was merged with the task decomposition feature's entry point (tasks[] generation) and exit point (task completion transition) left unwired, and flow.json.tasks[] has remained empty across all 300+ specs in production (the full extent was reported in Issue #256).

## Problem

The current gate-impl REQ-SPEC evaluation produces PASS/FAIL based on the following combination:

- Whether implementation code exists in the diff
- Exit code of the head test
- Whether existing tests are broken

However, it does not treat as a mandatory condition that "E2E/integration scenarios declared in the spec's Acceptance Criteria / Test Strategy actually PASS on a real machine with evidence". Even if the spec states "this test passes in CI", the test itself may not exist, or even if it does exist, gate does not directly verify the PASS evidence — making it structurally possible to conceal the gap.

## Proposed Remediation (details TBD)

1. Map test identifiers from spec.json's acceptance_criteria / test_strategy
2. Have gate-impl directly verify the exit code of those tests and the existence of new tests
3. Add "spec-promised test does not exist" and "no PASS evidence" as REQ-SPEC FAIL reasons

## Related

- Issue #256 is a concrete example of this problem
- spec 226 addresses the symptom by making "E2E + Dogfood" mandatory in the spec's Acceptance Criteria; the fundamental strengthening of the gate mechanism is handled independently in this Issue

<details>
<summary>ja</summary>

[ENHANCE] gate-impl の REQ-SPEC 甘判定を厳格化（spec の Acceptance に宣言された test の PASS evidence を必須化）

## 背景

spec 215 の実装過程で gate-impl が REQ-SPEC を何度か FAIL したが、最終的に「diff に実装がある + head test が exit 0」という評価で PASS 判定された。この時、REQ-12（integration シナリオ）の evidence 不足を指摘されていながら、総合判定では PASS に傾いた。

結果として、タスク分解機能の入口（tasks[] 生成）と出口（task 完了遷移）が未配線のまま spec 215 は merge され、全 300+ spec で flow.json.tasks[] が空のまま運用され続けている（Issue #256 で全容が指摘された）。

## 問題

現行の gate-impl REQ-SPEC 評価は以下の組合せで PASS/FAIL を出す:

- diff に実装コードが存在するか
- head test の exit code
- 既存 test が壊れていないか

しかし「spec の Acceptance Criteria / Test Strategy で宣言された E2E / integration シナリオが実機で PASS する evidence」を必須条件にしていない。spec 側で「この test が CI で PASS する」と書いても、その test 自体が存在しないか、存在しても gate が PASS evidence を直接突き合わせないため、構造的に隠蔽できる。

## 対策案（詳細は別途検討）

1. spec.json の acceptance_criteria / test_strategy に test 識別子を mapping
2. gate-impl が該当 test の exit code と新規 test の存在を直接確認
3. 「spec で約束した test が実在しない」「PASS evidence が無い」を REQ-SPEC FAIL reason に追加

## 関連

- Issue #256 が本問題の具体例
- spec 226 は spec 側で「E2E + Dogfood」を Acceptance 必須化することで対症する。gate 機構の本質的強化は本 Issue で独立に扱う

</details>