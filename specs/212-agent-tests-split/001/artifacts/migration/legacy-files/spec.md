# Feature Specification: 212-agent-tests-split

**Feature Branch**: `feature/212-agent-tests-split`
**Created**: 2026-04-22
**Status**: Draft
**Input**: GitHub Issue #216

## Goal
実 AI エージェント (claude CLI) を呼び出すテストを tests/agent/ に分離し、npm test のデフォルト高速パスから除外する。AI 関連コード修正時のみ明示的に AI テストを走らせる運用を確立する。

## Background
npm test の実時間 190 秒のうち 110 秒以上を tests/e2e/acceptance/report.test.js が占める (/tmp/profile-tests.mjs で計測)。同テストは runPipeline 経由で enrich/text ステップの実 claude CLI を呼ぶため、AI 関連コードを変更しない場合でも毎回高コストを支払っている。他の既存テストは AI をモック化しているため、実 AI 実行を伴うのはこの 1 本のみ。

## Scope
- tests/agent/ ディレクトリの新設
- tests/e2e/acceptance/report.test.js を tests/agent/report.test.js へ移動 (assertion 不変)
- tests/run.js に --agent / --all フラグを追加し、デフォルト探索から tests/agent/ を除外する
- package.json に scripts.test:agent (node tests/run.js --agent) および scripts.test:all (node tests/run.js --all) を追加
- CLAUDE.md の '### テスト' セクションに、src/lib/agent.js / src/docs/commands/enrich.js / src/docs/commands/text.js を変更した際は npm run test:agent を実行する旨を追記

## Out of Scope
- report.test.js の高速化・モック化
- .github/workflows 等 CI 設定の変更 (npm test → npm run test:all の CI 切替は別 spec)
- 他既存テストの分類見直し

## Constraints
- 外部依存追加禁止 (Node.js 組み込みモジュールのみ)
- alpha 版ポリシー: 後方互換コードを追加しない
- tests/run.js の既存 --preset / --scope オプションの挙動を変更しない
- --agent と --preset / --scope を同時指定した場合は非ゼロ終了でエラー (Exit Code Contract)
- report.test.js の assertion 内容は変更しない (移動のみ)

## Design Principles
- 既存コードパターン踏襲: tests/run.js の searchDirs 配列構築に分岐を追加する形で実装する
- シンプルなインターフェース: tests/agent/ ディレクトリ規約 1 つで分類が完結。テストファイル側に特別なマーカーは導入しない
- エラーは非ゼロ終了 + stderr で示す (既存 --preset / --scope バリデーションパターンと一貫)

## Overview
### Modules
- tests/run.js: --agent / --all フラグのパース、searchDirs 構築分岐、排他バリデーションを追加
- tests/agent/: 新規ディレクトリ。実 AI 実行テストを格納
- package.json: scripts.test:agent, scripts.test:all を追加
- CLAUDE.md: '### テスト' セクションに AI テスト運用ルールを追記

### Data Flow
- npm test → tests/run.js (フラグなし) → searchDirs = [tests/unit, tests/e2e, src/presets] (tests/agent は含まれない)
- npm run test:agent → tests/run.js --agent → searchDirs = [tests/agent] のみ
- npm run test:all → tests/run.js --all → searchDirs = [tests/unit, tests/e2e, src/presets, tests/agent]

### Decisions
- tests/agent/ をデフォルト searchDirs に含めない (Issue の目的)
- --agent は排他セレクタ。--preset / --scope との同時指定をエラー
- 分離対象は report.test.js 1 本のみ (他に実 AI 実行テストは存在しない)
- ファイル名はリネームせず report.test.js のまま (対象機能 docs report との対応維持)

## Clarifications (Q&A)
- Q: --agent 単独指定時に tests/agent/ 以外のパスも探索すべきか?
  - A: 否。--agent は排他セレクタとし tests/agent/ のみ対象。AI テスト単独実行の最短パス提供が目的。
- Q: CI が npm test を呼んでいる場合、本 spec 内で CI 設定も修正するか?
  - A: 否。本 spec は test スクリプトの分離まで。CI 側の test → test:all 切替は別 spec で実施 (影響範囲の分離)。
- Q: tests/agent/ 配下の将来的な追加ファイル命名規約は?
  - A: 既存 *.test.js パターンをそのまま踏襲。特別な prefix/suffix は導入しない。

## Alternatives Considered
- ファイル名に .agent.test.js サフィックスを導入し filter する方式 — テスト配置が散らばり可読性が下がる。ディレクトリ分離のほうが一目で判別でき、既存 tests/unit/ / tests/e2e/ 構造と一貫する。
- 環境変数 SKIP_AGENT_TESTS=1 でランタイム skip — テスト内の個別判定が必要になり複数ファイルへ侵襲的な変更が入る。ディレクトリ分離ならランナー側 1 箇所で完結。
- report.test.js をモック化してデフォルト維持 — Issue が明示する AI 実行の実動作確認は回帰検知の最後の砦として残す必要がある。本 spec は分離であり、モック化は Out of Scope。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-22
- Notes: auto mode 承認。

## Requirements
- R1 [must]: When npm test is invoked without flags, then tests/agent/ shall be excluded from the executed test set.
- R2 [must]: When npm run test:agent is invoked, then tests/run.js --agent shall execute only tests located under tests/agent/.
- R3 [must]: When npm run test:all is invoked, then tests/run.js --all shall execute the default discovery set plus tests under tests/agent/.
- R4 [must]: After this change, tests/e2e/acceptance/report.test.js shall no longer exist at that path and shall exist under tests/agent/report.test.js with unchanged assertion content.
- R5 [should]: When --agent is combined with --preset or --scope on tests/run.js, then the process shall exit with a non-zero status and print an error message to stderr.
- R6 [should]: CLAUDE.md の '### テスト' セクションに、src/lib/agent.js / src/docs/commands/enrich.js / src/docs/commands/text.js を変更した際は npm run test:agent を実行する旨が含まれること。

## Acceptance Criteria
- npm test 実行時の stdout に report.test.js 由来のログが含まれない (自動テスト)
- npm run test:agent 実行時に tests/agent/report.test.js のみが走る (自動テスト)
- npm run test:all 実行時に既存テスト全部 + tests/agent/report.test.js が走る (自動テスト)
- node tests/run.js --agent --preset hono が非ゼロ終了し stderr にエラーメッセージを出す (自動テスト)
- tests/e2e/acceptance/report.test.js が存在せず tests/agent/report.test.js が存在する (git で検証可能)
- CLAUDE.md の '### テスト' セクションに npm run test:agent 実行指示が含まれる (grep で検証可能)

## Implementation Targets
-

## Open Questions
- [ ]
