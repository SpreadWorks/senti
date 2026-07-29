## Summary

`stale test evidence recovery` also deletes `upgrade-result.json` and `tests/.raw/upgrade.log` when invalidating downstream artifacts. However, the subsequent canonical lifecycle has no owner step that regenerates upgrade evidence for the current fingerprint.

As a result, recovery itself succeeds and can return to `test-execute`, but the next time `impl-gate` / the integration gate runs `validateUpgradeEvidenceForGate()`, it fail-closes again with `upgrade-result.json missing`. Users cannot proceed unless they manually rerun `senti upgrade` every time.

The core bug is not incorrect stale invalidation, but that **the lifecycle lacks responsibility for preserving, republishing, or regenerating upgrade evidence after invalidation**.

## Behavior

In `specs/334-stale-test-evidence-recovery/issue-log.json`, the same blockage occurred at least 5 times between 2026-07-24 and 2026-07-25.

- `issue-log-37f7a7f3-f62e-43dc-a404-e2a3fa48cdd0`
- `issue-log-85c72f22-5104-4c18-b6be-ac4d67a4a8bd`
- `issue-log-18f1480c-680a-4996-b5ab-31d72e681bda`
- `issue-log-1a9a5ce9-fcf7-46b2-a03d-041293cbf0f6`
- `issue-log-978fff44-bf41-42f4-add3-55797c2d7c58`

Observed behavior:

- The integration precheck after stale recovery returns `upgrade-result.json missing`
- Manually running `senti upgrade` temporarily allows progress
- After a material fix or another stale recovery, upgrade evidence is invalidated again and the same blockage repeats

## Cause

The current contract is inconsistent in the following 3 ways:

- stale recovery invalidates `upgrade-result.json` and `tests/.raw/upgrade.log` as part of downstream / rebuildable artifacts
- the integration gate requires an `upgrade-result.json` matching the current `checkedPaths` and fail-closes when upgrade-required source paths exist
- however, there is no owned step anywhere on the canonical path from `test-execute` back to `impl-gate` that regenerates invalidated upgrade evidence for the current state

Therefore, even after canonical recovery completes, the impl-gate preconditions cannot be restored through the canonical path alone, effectively making a manual workaround mandatory.

## Expected Fix

- After stale recovery, determine whether upgrade-required changes remain for the current fingerprint
- If upgrade evidence is required and the current artifact is missing / stale, regenerate `upgrade-result.json` and `tests/.raw/upgrade.log` on the canonical path before impl-gate
- Only preserve or republish evidence when the change contents are identical and safe to reuse, after validating authority and the current fingerprint
- If source has changed, continue to reject old upgrade evidence fail-closed
- Record the preserve / reuse / regenerate decision in the flow audit evidence
- Allow users to proceed to impl-gate without manually running `senti upgrade` after every recovery

## Scope

Primary targets:

- `src/flow/lib/impl-repair-artifacts.js`
- `src/flow/lib/stale-test-evidence-refresh.js`
- `src/flow/lib/test-artifacts.js`
- `src/flow/lib/run-gate.js`
- `src/flow/definition.js`

Out of scope:

- Changes that make stale / missing / malformed artifacts fail-open
- Relaxing upgrade-required source detection itself
- Transaction continuity for repair manifest / ledger / delta handled by Issue #458

## Completion Criteria

- When stale-evidence recovery occurs in a flow that changed preset / skill source, the flow can return to impl-gate through the canonical path as-is
- Repeated recovery does not cause another blockage with `upgrade-result.json missing`
- If source has changed, old upgrade evidence is not accepted, and only evidence corresponding to the current state is used
- No unnecessary upgrade is run for changes that do not require an upgrade
- preserve / regenerate / stale / missing / multiple recovery cases are covered by spec-local tests and shared lifecycle regression tests

<details>
<summary>ja</summary>

stale recovery 後に upgrade 証跡が失われ impl-gate が再閉塞する

## 概要

`stale test evidence recovery` は downstream artifact を無効化する際に `upgrade-result.json` と `tests/.raw/upgrade.log` も削除する。一方で、その後の正規 lifecycle には current fingerprint に対応する upgrade 証跡を再生成する owner step が存在しない。

その結果、recovery 自体は成功して `test-execute` へ戻れるが、次に `impl-gate` / integration gate が `validateUpgradeEvidenceForGate()` を実行すると `upgrade-result.json missing` で再び fail-closed し、利用者が毎回手動で `senti upgrade` を再実行しない限り先へ進めない。

これは stale invalidation の誤りではなく、**無効化後の upgrade 証跡の保持・再公開・再生成責務が lifecycle に欠けている**ことが本質的な不具合である。

## 現象

`specs/334-stale-test-evidence-recovery/issue-log.json` では、2026-07-24 から 2026-07-25 にかけて同じ停止が少なくとも 5 回発生している。

- `issue-log-37f7a7f3-f62e-43dc-a404-e2a3fa48cdd0`
- `issue-log-85c72f22-5104-4c18-b6be-ac4d67a4a8bd`
- `issue-log-18f1480c-680a-4996-b5ab-31d72e681bda`
- `issue-log-1a9a5ce9-fcf7-46b2-a03d-041293cbf0f6`
- `issue-log-978fff44-bf41-42f4-add3-55797c2d7c58`

観測された振る舞い:

- stale recovery 後の integration precheck が `upgrade-result.json missing` を返す
- `senti upgrade` を手動実行すると一時的に先へ進める
- その後に material な修正や追加 stale recovery が入ると upgrade 証跡が再び無効化され、同じ停止を繰り返す

## 原因

現在の契約は次の 3 点で噛み合っていない。

- stale recovery は downstream / rebuildable artifact の一部として `upgrade-result.json` と `tests/.raw/upgrade.log` を無効化する
- integration gate は upgrade-required source path が存在する場合、current `checkedPaths` に一致する `upgrade-result.json` を必須として fail-closed に検証する
- しかし `test-execute` から `impl-gate` へ戻る正規経路のどこにも、無効化済み upgrade 証跡を current state 向けに再生成する owned step がない

このため、canonical recovery を完了しても impl-gate 前提を canonical path だけでは回復できず、実質的に手動 workaround が必須になっている。

## 期待する修正

- stale recovery 後、upgrade-required な変更が current fingerprint に対して残っているかを判定できる
- upgrade 証跡が必要で current artifact が missing / stale の場合、impl-gate 前の正規経路で `upgrade-result.json` と `tests/.raw/upgrade.log` を再生成できる
- 変更内容が同一で安全に再利用できる場合だけ、authority と current fingerprint を検証したうえで証跡を保持または再公開できる
- source が変わった場合は古い upgrade 証跡を従来どおり fail-closed に拒否する
- preserve / reuse / regenerate の判断結果を flow の監査証跡へ残す
- recovery のたびに利用者が `senti upgrade` を手動実行しなくても impl-gate まで進める

## スコープ

主な対象:

- `src/flow/lib/impl-repair-artifacts.js`
- `src/flow/lib/stale-test-evidence-refresh.js`
- `src/flow/lib/test-artifacts.js`
- `src/flow/lib/run-gate.js`
- `src/flow/definition.js`

非対象:

- stale / missing / malformed artifact を fail-open にする変更
- upgrade-required source 判定そのものの緩和
- Issue #458 が扱う repair manifest / ledger / delta の transaction continuity

## 完了条件

- preset / skill source を変更した flow で stale-evidence recovery を発生させても、そのまま正規経路で impl-gate まで復帰できる
- recovery を複数回繰り返しても `upgrade-result.json missing` で再閉塞しない
- source が変わった場合は古い upgrade 証跡を受理せず、current state に対応する証跡だけを使う
- upgrade 不要の変更では余計な upgrade を実行しない
- preserve / regenerate / stale / missing / 複数 recovery の各ケースを spec-local test と共有 lifecycle regression で検証する

</details>