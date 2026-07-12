## Summary
Resolve audit findings F-013 (suite foundation portion) and F-022. The goal is to make test suite selection strict and make CI-oriented `test:ci` credential-free and stable. Separate real-provider-dependent tests from deterministic tests so implementation, review, revert, and verification can be handled as independent units.

- Category: High / CI infrastructure
- Target findings: F-013 (suite foundation portion), F-022
- Recommended Wave: Wave 1

## Problem
- Suite selection is ambiguous, silently ignoring unknown flags and missing presets
- Acceptance targets are hard-coded and may diverge from the actual fixtures
- Real-provider-dependent tests and deterministic tests are mixed together, making the CI contract unstable

## Scope
- `package.json`
- `tests/run.js`
- `tests/helpers/test-runner-search-dirs.js`
- `tests/acceptance/lib/targets.js`
- stub-agent fixture
- CLI smoke tests

## Deliverables
- Make `TestSelection` strict, causing unknown / conflicting / missing preset cases to exit non-zero
- Treat `--help` and `--list --json` as separate contracts and verify each independently
- Make `test:ci` credential-free and able to complete with the following targets:
  - unit
  - integration
  - stub acceptance
  - CLI smoke
- Derive acceptance targets from real fixtures and do not treat 0 matches as success

## Acceptance Criteria
- Invalid suite specifications, conflicting flags, and missing presets fail with a non-zero exit code
- `--help` has dedicated validation as a usage contract, and `--list --json` has dedicated validation as a machine-readable output contract
- `npm run test:ci` passes reproducibly without credentials in both local and CI environments
- Target resolution is based on actual fixtures, and 0 matches causes failure
- Add a failing reproduction or automated test before the fix and show that it passes after the fix
- Confirm there are no regressions in existing happy paths

## Evidence
- F-013 / F-022 and referenced sources in `.tmp/refactoring/report.md`
- Added failure reproduction or automated test
- Execution logs
  - Strict selector failure cases
  - `--help`
  - `--list --json`
  - `npm run test:ci`

## Constraints
- Do not make tests pass by directly rewriting flow state or artifacts from tests
- If source updates are made, synchronize the related docs
- Do not include opportunistic fixes for findings not listed in this issue

## Out of Scope
- Fixes for findings not listed in this issue
- `npm publish`
- `npm dist-tag`
- Executing the official release

## Dependency / Parallelism
- No dependencies
- Prerequisite for D-18
- Can run in parallel with D-01 and D-02, but ownership of shared test fixtures must be separated

<details>
<summary>ja</summary>

strict test selector と credential-free `test:ci` を構築する

## Summary
監査 finding F-013（suite 基盤部分）と F-022 を解消する。目的は、test suite selection を strict にし、CI 向け `test:ci` を credential-free で安定実行できる状態を作ること。実 provider 依存テストと deterministic test を分離し、実装・review・revert・検証を独立して行える単位で扱えるようにする。

- カテゴリ: High / CI 基盤
- 対象 finding: F-013（suite 基盤部分）、F-022
- 推奨 Wave: Wave 1

## Problem
- suite 選択が曖昧で、unknown flag や preset 不備を黙殺している
- acceptance target が hard-code されており、fixture 実態と乖離しうる
- 実 provider 依存テストと deterministic test が混在し、CI 契約が不安定になっている

## Scope
- `package.json`
- `tests/run.js`
- `tests/helpers/test-runner-search-dirs.js`
- `tests/acceptance/lib/targets.js`
- stub-agent fixture
- CLI smoke tests

## Deliverables
- `TestSelection` を strict 化し、unknown / conflict / missing preset を非 0 終了にする
- `--help` と `--list --json` を別契約として扱い、それぞれを個別に検証する
- `test:ci` を credential-free にし、以下を実行対象として完走できるようにする
  - unit
  - integration
  - stub acceptance
  - CLI smoke
- acceptance target を実在 fixture から導出し、0 件マッチを成功扱いしない

## Acceptance Criteria
- 無効な suite 指定、競合フラグ、preset 未指定時に非 0 で失敗する
- `--help` は usage 契約、`--list --json` は machine-readable 出力契約として、それぞれ専用の検証がある
- `npm run test:ci` が credential なしでローカル/CI の両方で再現可能に通る
- target 解決は fixture 実体ベースで行われ、0 件時は失敗する
- 修正前に失敗する reproduction または自動テストを追加し、修正後に通ることを示す
- 既存正常系に回帰がないことを確認する

## Evidence
- `.tmp/refactoring/report.md` の F-013 / F-022 と参照 source
- 追加した failure reproduction または自動テスト
- 実行ログ
  - strict selector の失敗系
  - `--help`
  - `--list --json`
  - `npm run test:ci`

## Constraints
- flow の状態や artifact をテストから直接書き換えて成功させない
- source 更新が入った場合は関連 docs を同期する
- この Issue に記載していない finding の便乗修正は含めない

## Out of Scope
- この Issue に記載していない finding の修正
- `npm publish`
- `npm dist-tag`
- 正式 release の実行

## Dependency / Parallelism
- 依存関係なし
- D-18 の前提
- D-01、D-02 と並列可。ただし共通 test fixture の所有範囲は分離する

</details>