# Feature Specification: 089-issue-19-move-preset-acceptance-tests

**Feature Branch**: `feature/089-issue-19-move-preset-acceptance-tests`
**Created**: 2026-03-23
**Status**: Draft
**Input**: GitHub Issue #19

## Goal

`tests/acceptance/` に集約されている preset ごとの acceptance テストと fixture を、各 preset の `src/presets/<name>/tests/acceptance/` 配下へ移動する。各 acceptance テストを preset 単位で完結させ、fixture の共有をなくしつつ、既存の実行入口と公開物制御を保ったまま運用できるようにする。

## Scope

1. **acceptance テスト再配置**: 現在 `tests/acceptance/` にある各 preset 用テストを対応する `src/presets/<name>/tests/acceptance/test.js` へ移動する
2. **fixture 再配置**: 現在 `tests/acceptance/fixtures/` にある fixture を対応する preset 配下へ移し、共有 fixture をなくす
3. **共有インフラ維持**: `tests/acceptance/lib/` と `tests/acceptance/run.js` は残し、探索先・fixture 解決・実行ロジックだけ新配置に対応させる
4. **テスト検出と実行更新**: `npm test` と preset 指定実行が `src/presets/*/tests/acceptance/` を含むよう更新する
5. **公開物と運用ルール更新**: npm publish 対象から preset 内テストを除外し、`src/AGENTS.md` に acceptance テスト作成・実行ルールを追記する

## Out of Scope

- acceptance テストの共通ライブラリ (`tests/acceptance/lib/`) 自体の全面刷新
- Node.js 組み込み test runner 以外への移行
- 現在 `tests/acceptance/` に存在しない新規 preset の acceptance テスト追加
- preset テンプレート、DataSource、scan ロジックの仕様変更

## Clarifications (Q&A)

- Q: 今回の spec のスコープは？
  - A: テスト移設に必要な周辺変更を一式含める。
- Q: 公開物と運用ルールの更新は含めるか？
  - A: 含める。publish 対応と `src/AGENTS.md` 更新も必須成果物にする。
- Q: 移設対象の preset 範囲は？
  - A: 現在 `tests/acceptance/` にある acceptance テスト一式を対象にする。
- Q: fixture の配置方針は？
  - A: fixture は原則 preset 配下へ移し、共有しない。各 preset 内で閉じる。
- Q: acceptance テストファイルの命名は？
  - A: 各 preset 配下へ移したうえで、ファイル名は `test.js` に統一する。
- Q: acceptance テストの実行入口は？
  - A: `tests/acceptance/run.js` は残し、探索先だけ preset 配下へ変更する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-23
- Notes: User approved the spec without further changes.

## Requirements

### P1-a: acceptance テストと fixture の再配置（最優先: 後続作業の前提）

R1. When migrating the current preset-specific acceptance tests, the implementation shall move each test that now exists under `tests/acceptance/` into the corresponding `src/presets/<name>/tests/acceptance/test.js` file.
R2. When migrating the current acceptance fixtures, the implementation shall move each fixture that now exists under `tests/acceptance/fixtures/` into the corresponding preset's `src/presets/<name>/tests/acceptance/fixtures/` directory.
R3. When the fixture migration is completed, the resulting layout shall keep fixtures closed within each preset and shall not leave any fixture directory or fixture file shared across multiple presets.
R4. When preset acceptance tests are moved to `test.js`, the implementation shall update relative imports so each moved test can still reference the shared acceptance infrastructure.
R5. After the replacement test files and fixtures are in place, the implementation shall delete the original preset-specific test files and fixtures from their previous locations.

### P1-b: 共有実行基盤の継続利用（次優先: 新配置を実行可能にする）

R6. When preserving the shared acceptance runner, the implementation shall keep `tests/acceptance/run.js` and change its discovery target to `src/presets/<name>/tests/acceptance/test.js`.
R7. When a preset name is passed to `tests/acceptance/run.js`, the runner shall preserve the current preset-specific execution interface and run only the requested preset.
R8. When fixture paths are resolved through `tests/acceptance/lib/test-template.js`, the resolver shall operate correctly against the new preset-local layout.
R9. When maintaining the shared acceptance infrastructure, the implementation shall keep `tests/acceptance/lib/` as shared infrastructure only and shall not move preset-specific logic or fixtures into it.

### P1-c: テスト検出とコマンド更新（その次: 開発フローとCLI実行を整合させる）

R10. When `npm test` collects test files, the test discovery configuration shall include `src/presets/*/tests/acceptance/`.
R11. When `npm test -- --preset <name>` or an equivalent preset-specific test command is executed, the command shall include `src/presets/<name>/tests/acceptance/test.js` together with the shared test set.
R12. When validating or discovering preset names for acceptance execution, the implementation shall keep that logic consistent with the new preset-local acceptance test layout.
R13. If a nonexistent preset is specified, the relevant command shall print a clear error message and exit with a non-zero status.

### P2: 公開物制御

R14. When preparing the npm publish payload, the packaging configuration shall exclude `tests/` and `src/presets/*/tests/` so preset-local acceptance tests are not included in the published package.
R15. When implementing that publish exclusion, the implementation shall keep the chosen mechanism consistent with the existing `package.json` and `.npmignore` packaging policy.

### P2: 運用ルール更新

R16. When preset templates are created or modified, `src/AGENTS.md` shall require that acceptance tests are also implemented and run.
R17. When preset-local acceptance tests are defined or maintained, `src/AGENTS.md` shall describe the preset-local acceptance test layout and how to run it.

### P2: 既存機能への影響整理

R18. When existing tests such as `tests/e2e/acceptance/` and `tests/e2e/docs/commands/parent-chain.test.js` reference `tests/acceptance/lib/` or acceptance fixtures, the implementation shall update the necessary paths so those tests still work with the new layout.
R19. When the acceptance test relocation is complete, the acceptance report generation flow, including `acceptance-report.json`, shall remain intact.

## Acceptance Criteria

- AC1: 既存の acceptance 対象 preset (`base`, `cakephp2`, `cli`, `laravel`, `library`, `node-cli`, `node`, `php`, `symfony`, `webapp`) それぞれに `src/presets/<name>/tests/acceptance/test.js` が存在する
- AC2: 各 preset の fixture が `src/presets/<name>/tests/acceptance/fixtures/` 配下に配置され、`tests/acceptance/fixtures/` に preset 共有 fixture が残っていない
- AC3: `node tests/acceptance/run.js` で全 acceptance テストが新配置から実行される
- AC4: `node tests/acceptance/run.js symfony` のような preset 指定実行が新配置で成功する
- AC5: `npm test -- --preset nonexistent` または同等の preset 指定で、明確なエラーを出して失敗する
- AC6: `npm test` の実行対象に preset 配下の acceptance テストが含まれる
- AC7: `npm pack --dry-run` 相当の確認で、`tests/` および `src/presets/*/tests/` が公開物に含まれない
- AC8: `src/AGENTS.md` に acceptance テスト実装・実行ルールが追記されている

## Open Questions

（なし）
