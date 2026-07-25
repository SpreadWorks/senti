## Summary

When stale test evidence recovery is run after a material implementation fix changes the repair fingerprint, the flow can return to `test-execute`, but the tail of the `impl-repair` ledger remains on the old fingerprint. If the flow then proceeds to `acceptance-review`, `impl-repair.json` is treated as `invalid_schema`, causing the flow to become blocked again.

Issue #453 confirmed the following:

- `currentHash` at the tail of `impl-repair.json`: `6567b687b1c766f40ca2496c49484b52603ec27a17f62f4843a74220df2dac46`
- Test evidence / current fingerprint after stale evidence regeneration: `b950fcb2f9689400076d18f46e23c071a00d451f1b1fd3dc202e1ff262b3d569`
- `acceptance-review` blocker: `Required artifact is invalid: impl-repair.json.`

The same kind of fingerprint recovery inconsistency has occurred in another session as well, so this is not an isolated incident.

## Problem

`StaleTestEvidenceRefresh` invalidates stale artifacts and resets the lifecycle from `test-execute` onward, but it does not advance the following formal repair chain to the current material state:

- repair fingerprint manifest
- `impl-repair` ledger
- repair delta

Meanwhile, `acceptance-review` validates on the assumption that the `currentHash` at the tail of the `impl-repair` ledger matches the current repair fingerprint. As a result, even if only the artifacts are regenerated, the audit chain remains stale, and the flow cannot be completed through normal operations alone.

The fingerprint mismatch itself is correct fail-closed behavior and must not be resolved by manually editing hashes or weakening validation.

## Expected Fix

Treat stale test evidence recovery not merely as artifact regeneration, but as an auditable formal repair transaction.

Requirements:

- Reuse the existing `TestEvidenceRefreshPurpose` / `impl-repair` transaction authority, and do not add a new mutation owner.
- Consistently update the repair manifest, ledger, delta, artifact invalidation, and flow lifecycle transition in the same transaction.
- Maintain the same invariant across all entry points that may detect stale evidence, such as `final-regression`, `acceptance-review`, and the integration gate.
- Do not accept intermediate states as current evidence.
- Do not report partial success on transaction failure or crash injection.

Out of scope:

- Direct hash editing
- Workarounds by manually deleting artifacts
- Weakening fingerprint validation on the `acceptance-review` side

## Completion Criteria

- In a flow with an `impl-repair` ledger, running stale evidence recovery after a material fix leaves the ledger tail matching the current fingerprint.
- After recovery, the flow can regenerate and complete through the normal path: `test-execute` → `test-result-review` → `impl-review` → `impl-gate` → `retro` → `acceptance-review`.
- If `final-regression` detects stale test evidence, it can return to `test-execute` with audit tracking.
- Intermediate states of the manifest, ledger, delta, artifact invalidation, and lifecycle are not accepted as current evidence.
- Valid evidence matching the current fingerprint, malformed evidence, and target guard mismatches continue to fail closed as before.
- Shared unit tests and CLI lifecycle regressions verify cases that include an existing `impl-repair` ledger.

## Main Targets

- `src/flow/lib/stale-test-evidence-refresh.js`
- `src/flow/lib/impl-repair-artifacts.js`
- `src/flow/lib/acceptance-review-artifacts.js`
- `src/flow/lib/run-final-regression.js`
- `src/flow/lib/run-gate.js`
- Related flow lifecycle / transaction tests

## Related

- Issue #457: A problem where stale test evidence recovery becomes blocked at `impl-gate`. This issue handles ledger continuity as a downstream concern.
- Issue #449: Redesign of repair fingerprint / manifest / ledger / AI projection. This issue is a corrective follow-up to maintain that invariant after post-evidence recovery.

<details>
<summary>ja</summary>

stale test evidence recoveryがimpl-repair ledgerを更新せずflowを再閉塞させる

## 概要

material な実装修正で repair fingerprint が変わった後に stale test evidence recovery を実行すると、test-execute には戻れる一方で `impl-repair` ledger の末尾が旧 fingerprint のまま残る。その状態で `acceptance-review` に進むと `impl-repair.json` が `invalid_schema` 扱いになり、flow が再度閉塞する。

Issue #453 では以下を確認した。

- `impl-repair.json` 末尾の `currentHash`: `6567b687b1c766f40ca2496c49484b52603ec27a17f62f4843a74220df2dac46`
- stale evidence 再生成後の test evidence / current fingerprint: `b950fcb2f9689400076d18f46e23c071a00d451f1b1fd3dc202e1ff262b3d569`
- `acceptance-review` blocker: `Required artifact is invalid: impl-repair.json.`

同種の fingerprint 回復不整合は別セッションでも発生しており、局所事象ではない。

## 問題

`StaleTestEvidenceRefresh` は stale artifact の無効化と `test-execute` 以降の lifecycle reset を行うが、以下の formal repair chain を current material state まで前進させない。

- repair fingerprint manifest
- `impl-repair` ledger
- repair delta

一方で `acceptance-review` は、`impl-repair` ledger 末尾の `currentHash` が現在の repair fingerprint と一致することを前提に検証している。そのため artifact だけを再生成しても audit chain は古いままで、正規操作だけでは flow を完走できない。

なお fingerprint mismatch 自体は正しい fail-closed 動作であり、hash の手編集や検証緩和で解消してはならない。

## 期待する修正

stale test evidence recovery を単なる artifact 再生成ではなく、監査可能な formal repair transaction として扱う。

要件:

- 既存の `TestEvidenceRefreshPurpose` / `impl-repair` transaction authority を再利用し、新たな mutation owner は増やさない。
- repair manifest、ledger、delta、artifact invalidation、flow lifecycle transition を同一 transaction で整合的に更新する。
- `final-regression`、`acceptance-review`、integration gate など、stale evidence を検出しうるすべての entrypoint で同じ invariant を維持する。
- 途中状態を current evidence として受理しない。
- transaction failure や crash injection 時に部分成功を報告しない。

非対応:

- hash の直接編集
- artifact の手削除による回避
- `acceptance-review` 側 fingerprint 検証の緩和

## 完了条件

- `impl-repair` ledger を持つ flow で material 修正後に stale evidence recovery を実行しても、ledger 末尾が current fingerprint と一致する。
- recovery 後に `test-execute` → `test-result-review` → `impl-review` → `impl-gate` → `retro` → `acceptance-review` を正規経路で再生成し、完走できる。
- `final-regression` で stale test evidence を検出した場合も、監査付きで `test-execute` へ戻れる。
- manifest、ledger、delta、artifact invalidation、lifecycle の途中状態は current evidence として受理されない。
- current fingerprint と一致する正常 evidence、malformed evidence、target guard 不一致は従来どおり fail-closed を維持する。
- shared unit tests と CLI lifecycle regression で、既存 `impl-repair` ledger を持つケースを含めて検証する。

## 主な対象

- `src/flow/lib/stale-test-evidence-refresh.js`
- `src/flow/lib/impl-repair-artifacts.js`
- `src/flow/lib/acceptance-review-artifacts.js`
- `src/flow/lib/run-final-regression.js`
- `src/flow/lib/run-gate.js`
- 関連する flow lifecycle / transaction tests

## 関連

- Issue #457: `impl-gate` で stale test evidence recovery が閉塞する問題。本件はその downstream として ledger continuity まで扱う。
- Issue #449: repair fingerprint / manifest / ledger / AI projection の再設計。本件はその invariant を post-evidence recovery でも維持する corrective follow-up。

</details>