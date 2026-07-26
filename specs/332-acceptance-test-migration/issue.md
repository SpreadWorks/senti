## Problem

Multiple historical spec regression tests directly import or require the now-deleted `buildAcceptanceReviewArtifactFromEvidence` export. The current acceptance-review module has moved to the artifact writer/validation lifecycle and production command path, and no longer has a compatibility export, so these tests fail before verifying their intended scenarios.

## Evidence

Active test references exist in at least the following 6 specs:

- `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`
- `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`
- `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`
- `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`
- `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`
- `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`

The repository's production source has no export with that name, and `src/flow/lib/acceptance-review-artifacts.js` exposes the current class-based artifact normalization, validation, write, and evidence binding APIs.

## Acceptance Criteria

- Migrate the 6 historical scenarios to the current public/production acceptance-review contract.
- Do not reintroduce the deleted compatibility export.
- Preserve the original requirements of each scenario, especially the meanings of verdict policy, deferred finding, producer contract, retry exhaustion, no-tests state, and post-hook deferral.
- Do not replace them with test-only shortcuts that production cannot reach.
- The complete regression files for the target 6 specs pass with the current production API.
- If a test scenario exposes a current product defect, do not weaken the test; separate it as another BUG.

## Scope

This only covers migrating historical regression scenarios that depend on the deleted export. It does not include redesigning the acceptance-review product lifecycle, compatibility shims, or changes for Issue #443.

<details>
<summary>ja</summary>

複数のhistorical回帰テストが削除済みacceptance-review exportを要求する

## 問題

複数の historical spec 回帰テストが、現在は削除されている `buildAcceptanceReviewArtifactFromEvidence` export を直接 import または要求する。現在の acceptance-review module は artifact writer/validation lifecycle と production command 経路へ移行済みで互換 export を持たないため、これらのテストは intended scenario を検証する前に失敗する。

## 証拠

active test reference は少なくとも次の6 spec に存在する。

- `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`
- `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`
- `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`
- `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`
- `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`
- `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`

repository の production source には同名 export がなく、`src/flow/lib/acceptance-review-artifacts.js` は現在の class-based artifact normalization、validation、write、evidence binding API を公開する。

## Acceptance Criteria

- 6件の historical scenario を current public/production acceptance-review 契約へ移行する。
- 削除済み compatibility export を再導入しない。
- 各 scenario の元の要件、特に verdict policy、deferred finding、producer contract、retry exhaustion、no-tests state、post-hook deferral の意味を維持する。
- production 到達不能な test-only shortcut へ置き換えない。
- 対象6 spec の complete regression files が current production API で通る。
- test scenario が現 product defect を露出した場合は test を弱めず、別 BUG として切り分ける。

## スコープ

削除 export に依存する historical regression scenario の移行だけを扱う。acceptance-review product lifecycle の再設計、互換 shim、Issue #443 の変更は含めない。

</details>