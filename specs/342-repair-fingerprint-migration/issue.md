## Symptom

When an existing active flow is rebased onto the current `main`, the integration gate stops with `repair fingerprint hash does not match its canonical state`.

## Reproduction Conditions

1. Prepare an active flow that generated `repair-fingerprint.json` version `2` with the old implementation.
2. Pull in `main`, where `CanonicalRepairEntry.canonicalParts()` has been updated from a version that includes `statuses` and `indexOid` to one that does not include them.
3. Run `senti flow run gate`.

## Cause

The canonical input for the hash changed while the manifest format version remained `2`. The old manifest hits a hash mismatch in the new `RepairFingerprintManifest` constructor, and because an existing `repairBaseline` is present, `ensureRepairFingerprintContract()` does not migrate it and stops before stale-evidence recovery.

## Expected Behavior

- When changing the canonical input, bump the format version and explicitly migrate the old version.
- If an existing version `2` artifact can be read, atomically and auditably rematerialize it into the current format before processing downstream evidence.
- Return to `test-execute` with a guarded command without manually editing or deleting the current artifact with the hash mismatch.

## Evidence

- Issue #455 / runId `2d0439dc-13ce-4358-846f-48278d21c02c`
- base `main`: `65db8b84`
- stored hash: `543753ab589e2e3faaa818d3c4bf7bd820376df0cbef6ff1fbbb63f850530438`
- current canonical hash: `e615116d0ac39f985a6afa69c244046fd68bccd3640935099b898b3e5b005089`

## Targets

- `src/flow/lib/repair-state-identity.js`
- `src/flow/lib/impl-repair-artifacts.js`
- migration / integration gate regression tests

<details>
<summary>ja</summary>

version 2 repair fingerprint のcanonical移行が既存flowを停止させる

## 現象

既存の active flow を current `main` に rebase すると、integration gate が `repair fingerprint hash does not match its canonical state` で停止する。

## 再現条件

1. 旧実装で `repair-fingerprint.json` version `2` を生成した active flow を用意する。
2. `CanonicalRepairEntry.canonicalParts()` が `statuses` と `indexOid` を含む版から、それらを含まない版へ更新された `main` を取り込む。
3. `senti flow run gate` を実行する。

## 原因

manifest format version は `2` のままなのに、hash のcanonical inputが変わっている。旧manifestは新しい `RepairFingerprintManifest` のconstructorでhash mismatchになり、`ensureRepairFingerprintContract()` は既存 `repairBaseline` があるため移行せず、stale-evidence recovery より前に停止する。

## 期待する挙動

- canonical inputを変える場合はformat versionを上げ、旧versionを明示的に移行する。
- 既存version `2` artifactを読み取れる場合は、原子的・監査可能に現在形式へ再materializeしてから下流evidenceを処理する。
- hash不一致の現行artifactを手編集・削除せず、guarded commandで `test-execute` まで戻れる。

## 証跡

- Issue #455 / runId `2d0439dc-13ce-4358-846f-48278d21c02c`
- base `main`: `65db8b84`
- stored hash: `543753ab589e2e3faaa818d3c4bf7bd820376df0cbef6ff1fbbb63f850530438`
- current canonical hash: `e615116d0ac39f985a6afa69c244046fd68bccd3640935099b898b3e5b005089`

## 対象

- `src/flow/lib/repair-state-identity.js`
- `src/flow/lib/impl-repair-artifacts.js`
- migration / integration gate regression tests

</details>